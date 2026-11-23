import { z } from "zod";
import { resolveAcoes } from "@/lib/acoes-resolver";
import type { ChatAction } from "@/lib/chat-actions";
import { checkDailyQuota, checkProviderSpend, safeRpc } from "@/lib/chat-budget-guard";
import { readBudgets, serverConfig } from "@/lib/config";
import { accessOf } from "@/lib/access";
import { after } from "next/server";
import { AllProvidersFailed, BudgetReached, routeChat, NoProviderError } from "@/lib/llm/router";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import type { ChatTurn } from "@/lib/llm/types";
import { splitMeta, visiblePart } from "@/lib/meta";
import { costUsd, estimateMaxCost } from "@/lib/pricing";
import { estimatePartialUsage } from "@/lib/partial-cost";
import { releaseBudget, reserveBudget, settleBudget } from "@/lib/ai-budget";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { accessToken, events, formatEvents, formatMails, GoogleError, googleIntent, inbox } from "@/lib/google";
import { insights, type InTask } from "@/lib/insights";
import { embed, embeddingsAvailable, toVector } from "@/lib/embeddings";
import { agentAreas } from "@/lib/presets";
import { contextBlock, extrasBlock, systemPrompt } from "@/lib/prompt";
import { AssistantContextSchema, contextLine } from "@/lib/assistant-context";
import { supabaseServer } from "@/lib/supabase/server";
import { collectAttention } from "@/lib/core/collect";
import { coreEnabled } from "@/lib/core/flag";
import { formatCoreBlock, toItem, type SourceItem } from "@/lib/core/format";
import { googleReader } from "@/lib/core/google-adapter";
import { detectFinanceIntent, detectGoalsIntent, detectIntent } from "@/lib/core/plan";
import { collectGoals, formatGoalsBlock, goalsProposalRules, type GoalRef } from "@/lib/core/goals";
import { goalsEnabled } from "@/lib/goals/flag";
import type { MetaDraft } from "@/lib/goals/types";
import { collectFinance, financeProposalRules, formatFinanceBlock } from "@/lib/core/finance";
import { financeEnabled } from "@/lib/finance/flag";
import { modeling3dEnabled } from "@/lib/3d/flag";
import { blocoSalario, pedidoSalario } from "@/lib/finance/salario-texto";
import { hojeSP, isoDia } from "@/lib/finance/datas";
import type { GastoProposta } from "@/lib/finance/lancamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.number().int().positive().nullable().optional(),
  // Só valem ao criar uma conversa nova: conversa sobre um projeto ou com um agente.
  projectId: z.number().int().positive().nullable().optional(),
  agentId: z.number().int().positive().nullable().optional(),
  // Assistente Universal: em que módulo e tela a pessoa está. Só um rótulo validado; não carrega dados nem amplia o acesso.
  context: AssistantContextSchema.nullable().optional(),
});

// Eventos enviados ao app, um JSON por linha (NDJSON).
type Out =
  | { t: "start"; conversationId: number }
  | { t: "provider"; name: string }
  | { t: "delta"; text: string }
  | { t: "done"; memories: number }
  | { t: "reminders"; items: { id: number; text: string; dueAt: string }[] }
  | { t: "tasks"; items: { id: number; title: string; due: string | null }[] }
  | { t: "events"; items: { title: string; start: string; end: string; location: string | null }[] }
  | { t: "gastos"; items: GastoProposta[] }
  | { t: "metas"; items: MetaDraft[] }
  | { t: "acoes"; items: ChatAction[] }
  | { t: "sources"; items: SourceItem[]; unavailable: string[] }
  | { t: "notice"; text: string; kind: "privacy" | "quota" | "engine" | "error" | "acao" };

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !(await accessOf(supabase, user)).ok) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  const message = parsed.data.message;
  const cfg = serverConfig();

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: Out) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      // Reserva de orçamento desta resposta: liquidada pelo custo real ou liberada no finally.
      let reservationId: string | null = null;
      let reservedUsd = 0;
      let settled = false;
      // Já houve tentativa de gravar o custo desta resposta (com sucesso ou não): não grava de novo.
      let recorded = false;
      // Para estimar o custo se a resposta for interrompida (S-02).
      let full = "";
      let inputChars = 0;
      let streamProvider: ProviderId | null = null;
      let usage: { input: number; output: number; cost: number; provider: ProviderId; model: string } | null = null;
      try {
        // 1. Privacidade: dado sensível não sai daqui e nem é gravado.
        if (isSensitive(message)) {
          send({ t: "notice", kind: "privacy", text: "Percebi um dado sensível nessa mensagem (documento, senha, dado bancário ou de saúde). Pela regra de privacidade, ele não vai para nenhuma IA externa, então não enviei. Pode reescrever sem esse dado?" });
          return;
        }
        // 2. Limites por provedor (Ajustes): leitura sem custo. Sem esse dado não dá para respeitá-los (fail closed).
        const spendRows = await safeRpc<unknown>(() => supabase.rpc("month_spend_by_provider"));
        const providerSpend = checkProviderSpend(spendRows);
        if (!providerSpend.ok) {
          console.error("chat provider budget validation unavailable");
          send({ t: "notice", kind: "error", text: "Não consegui verificar os limites dos motores de IA agora. Tente novamente em instantes." });
          return;
        }
        // 2b. Teto mensal com RESERVA atômica: o banco soma gasto + reservas abertas + estimativa desta resposta.
        //     Pedidos simultâneos não ultrapassam o teto. Estimativa: contexto típico (~60 mil caracteres) e saída máxima.
        const reserved = estimateMaxCost(cfg.model, message.length + 60_000, 8000);
        // S-01: reserva e liquidação só pelo servidor, com o id da sessão (nunca do corpo da requisição).
        const reservation = await reserveBudget(user.id, "chat", reserved);
        if (reservation.ok) {
          reservationId = reservation.id;
          reservedUsd = reservation.amount;
        } else if (reservation.reason === "unavailable") {
          console.error("chat budget reservation unavailable");
          send({ t: "notice", kind: "error", text: "Não consegui verificar seu orçamento de IA agora. Tente novamente em instantes." });
          return;
        } else {
          const lim = reservation.limit !== null ? ` (US$ ${reservation.limit.toFixed(2)})` : "";
          send({ t: "notice", kind: "quota", text: reservation.reason === "global"
            ? "O limite de gasto com IA da conta foi atingido neste mês. Fale com o administrador do GaDu."
            : `O teto de gasto do mês${lim} foi atingido. O GaDu volta a responder no próximo mês, ou quando o teto for aumentado.` });
          return;
        }
        // 2c. Cota diária por último, logo antes de gravar: atômica no banco, limite definido pelo servidor
        //     (nunca enviado pelo app) e dia de Brasília. Mensagem bloqueada acima não gasta cota.
        // S-07: sem contingência. Se a função falhar ou não existir, bloqueia (fail closed).
        const daily = checkDailyQuota(await safeRpc<unknown>(() => supabase.rpc("consume_daily_quota")));
        if (!daily.allowed) {
          if (daily.reason === "unavailable") {
            console.error("chat quota validation unavailable");
            send({ t: "notice", kind: "error", text: "Não consegui verificar seu limite de mensagens agora. Tente novamente em instantes." });
          } else {
            send({ t: "notice", kind: "quota", text: `Você chegou ao limite de ${daily.limit} mensagens de hoje. O limite volta à meia-noite.` });
          }
          return;
        }
        // 3. Conversa: usa a existente (se for da pessoa) ou cria uma nova.
        let conversationId = parsed.data.conversationId ?? null;
        let msgCount = 0;
        let hasSummary = false;
        let projectId: number | null = null;
        let agentId: number | null = null;
        if (conversationId) {
          const { data } = await supabase.from("conversations").select("id, message_count, summary, project_id, agent_id").eq("id", conversationId).maybeSingle();
          if (!data) conversationId = null;
          else {
            msgCount = Number(data.message_count ?? 0);
            hasSummary = Boolean(data.summary);
            projectId = (data.project_id as number | null) ?? null;
            agentId = (data.agent_id as number | null) ?? null;
          }
        }
        if (!conversationId) {
          // RLS só mostra projetos e agentes da própria pessoa: id de outra pessoa vira null.
          const [pj, ag] = await Promise.all([
            parsed.data.projectId ? supabase.from("projects").select("id").eq("id", parsed.data.projectId).maybeSingle() : Promise.resolve({ data: null }),
            parsed.data.agentId ? supabase.from("agents").select("id").eq("id", parsed.data.agentId).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          projectId = (pj.data?.id as number | undefined) ?? null;
          agentId = (ag.data?.id as number | undefined) ?? null;
          const { data, error } = await supabase.from("conversations").insert({ title: message.slice(0, 80), project_id: projectId, agent_id: agentId }).select("id").single();
          if (error || !data) throw new Error("não consegui criar a conversa");
          conversationId = data.id as number;
        }
        send({ t: "start", conversationId });

        // Busca por significado em paralelo (memórias, conversas, tarefas, projetos). Falha não atrapalha a conversa.
        const semantic = semanticContext(supabase, message);
        // 4. Contexto: perfil, memória aprovada, histórico recente, conversas antigas relacionadas e gasto por provedor.
        const [profile, memories, history, related, openTasks, activeProjects, agentRow, projectRow] = await Promise.all([
          supabase.from("profiles").select("display_name, settings").eq("id", user.id).maybeSingle(),
          supabase.from("memories").select("content, area").eq("status", "approved").order("created_at", { ascending: true }).limit(80),
          supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(16),
          relatedQuery(message)
            ? supabase.from("conversations").select("title, summary, updated_at").textSearch("search", relatedQuery(message), { type: "websearch", config: "portuguese" }).not("summary", "is", null).neq("id", conversationId).order("updated_at", { ascending: false }).limit(3)
            : Promise.resolve({ data: [] as { title: string; summary: string; updated_at: string }[] }),
          supabase.from("tasks").select("title, priority, due_date, projects(name)").eq("status", "open").order("due_date", { ascending: true, nullsFirst: false }).order("priority").limit(15),
          supabase.from("projects").select("id, name, goal").eq("status", "active").order("updated_at", { ascending: false }).limit(20),
          agentId ? supabase.from("agents").select("name, area, instructions").eq("id", agentId).maybeSingle() : Promise.resolve({ data: null }),
          projectId ? supabase.from("projects").select("name, goal, next_steps").eq("id", projectId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        // Agente: só as memórias da área dele e as preferências gerais.
        const agentArea = (agentRow.data as { area?: string } | null)?.area;
        const memFor = ((memories.data ?? []) as { content: string; area: string }[]).filter((m) => !agentArea || agentAreas(agentArea).includes(m.area));
        const extras = extrasBlock({
          tasks: ((openTasks.data ?? []) as unknown as { title: string; priority: number; due_date: string | null; projects: { name: string } | null }[])
            .map((t) => ({ title: t.title, priority: t.priority, due_date: t.due_date, project: t.projects?.name ?? null })),
          projects: (activeProjects.data ?? []) as { name: string; goal: string | null }[],
          agent: (agentRow.data as { name: string; area: string; instructions: string } | null) ?? null,
          project: (projectRow.data as { name: string; goal: string | null; next_steps: string | null } | null) ?? null,
        });
        // Limite por provedor: quem passou do limite do mês fica de fora desta resposta.
        const budgets = readBudgets(profile.data?.settings);
        const spentBy = providerSpend.spentBy;
        const skip = new Set<ProviderId>();
        if ((spentBy.anthropic ?? 0) >= budgets.anthropic) skip.add("anthropic");
        if ((spentBy.gateway ?? 0) >= budgets.gateway) skip.add("gateway");
        const name = String(profile.data?.display_name ?? "").split(" ")[0];
        const blocked: string[] = Array.isArray(profile.data?.settings?.blocked) ? profile.data.settings.blocked : [];
        const turns: ChatTurn[] = [];
        for (const m of (history.data ?? []).reverse()) {
          const role = m.role === "assistant" ? "assistant" : "user";
          if (!turns.length && role !== "user") continue;
          const last = turns[turns.length - 1];
          if (last && last.role === role) last.content += "\n\n" + m.content;
          else turns.push({ role, content: m.content });
        }
        // Fase 2: agenda e e-mails do Google entram no contexto só quando o assunto pede.
        const taskList = ((openTasks.data ?? []) as unknown as { title: string; priority: number; due_date: string | null }[]);
        // Core "O que merece minha atenção hoje?": regra simples (sem IA), só com CORE_MVP ligado. Escopo = a sessão.
        // Falha do Core nunca derruba o chat: volta ao caminho anterior.
        let coreBlock = "";
        let coreSources: { items: SourceItem[]; unavailable: string[] } | null = null;
        if (coreEnabled() && detectIntent(message) === "atencao_hoje" && !profile.error) {
          try {
            const core = await collectAttention({ userId: user.id, db: supabase, google: googleReader(supabase, user.id), blocked });
            coreBlock = formatCoreBlock(core);
            coreSources = { items: core.facts.map(toItem), unavailable: core.unavailable.map((u) => u.text) };
          } catch (e) {
            console.error("core falhou", e instanceof Error ? e.message.slice(0, 120) : "erro");
          }
        }
        // Finanças (FINANCE_ENABLED, padrão ligado). Intenção simples, sem IA extra:
        //  - perguntar ("quanto gastei", "como estão minhas contas"): a fonte `finance` do Core (precisa do CORE_MVP ligado) injeta o bloco [F1]…;
        //  - lançar ("gastei 45 no mercado no pix"): só ensina o modelo a PROPOR; a pessoa confirma e quem grava é /api/finance/gastos, com a sessão dela.
        // A pergunta de atenção do dia tem prioridade. Falha na leitura vira aviso ao modelo (nunca inventar valores).
        const finIntent = !coreBlock && financeEnabled() ? detectFinanceIntent(message) : null;
        let financeBlock = "";
        if (finIntent?.kind === "gasto") {
          financeBlock = financeProposalRules(isoDia(hojeSP()));
        } else if (finIntent && coreEnabled()) {
          const falha = "Não consegui ler seus dados financeiros agora.";
          if (profile.error) {
            financeBlock = `\n\nFinanças: ${falha} Diga isso com franqueza e não invente valores.`;
            coreSources = { items: [], unavailable: [falha] };
          } else {
            try {
              const fin = await collectFinance({ userId: user.id, db: supabase, blocked, intent: finIntent });
              financeBlock = formatFinanceBlock(fin);
              coreSources = { items: fin.facts.map(toItem), unavailable: fin.unavailable };
            } catch (e) {
              console.error("finance core falhou", e instanceof Error ? e.message.slice(0, 80) : "erro");
              financeBlock = `\n\nFinanças: ${falha} Diga isso com franqueza e não invente valores.`;
              coreSources = { items: [], unavailable: [falha] };
            }
          }
        }
        // Metas (GOALS_ENABLED, padrão ligado). Intenção simples, sem IA extra; depende da fonte do Core (CORE_MVP ligado) porque precisa ler as metas:
        //  - perguntar ("como estão minhas metas", "minha meta de leitura"): injeta o bloco [M1]…;
        //  - atualizar ("corri 5 km hoje", "conclui a meta X"): o modelo só PROPÕE; a pessoa confirma e quem grava é /api/goals/*, com a sessão dela.
        // Prioridade: atenção do dia > finanças > metas. Falha na leitura vira aviso ao modelo (nunca inventar progresso).
        const goalsIntent = !coreBlock && !finIntent && goalsEnabled() ? detectGoalsIntent(message) : null;
        let goalsBlock = "";
        let goalRefs: GoalRef[] = [];
        if (goalsIntent && coreEnabled()) {
          const falha = "Não consegui ler suas metas agora.";
          if (profile.error) {
            goalsBlock = `\n\nMetas: ${falha} Diga isso com franqueza e não invente progresso.`;
            coreSources = { items: [], unavailable: [falha] };
          } else {
            try {
              const g = await collectGoals({ userId: user.id, db: supabase, blocked, intent: goalsIntent });
              goalsBlock = formatGoalsBlock(g) + (goalsIntent.kind === "atualizar" ? goalsProposalRules(isoDia(hojeSP())) : "");
              goalRefs = g.refs;
              coreSources = { items: g.facts.map(toItem), unavailable: g.unavailable };
            } catch (e) {
              console.error("goals core falhou", e instanceof Error ? e.message.slice(0, 80) : "erro");
              goalsBlock = `\n\nMetas: ${falha} Diga isso com franqueza e não invente progresso.`;
              coreSources = { items: [], unavailable: [falha] };
            }
          }
        }
        // O Core já traz agenda e e-mails de hoje: não lê o Google duas vezes (exceto se pediu a semana).
        const google = coreBlock && !googleIntent(message).week ? "" : await googleContext(supabase, user.id, message, blocked, taskList);
        const lastTurn = turns[turns.length - 1];
        if (lastTurn && lastTurn.role === "user") lastTurn.content += "\n\n" + message;
        else turns.push({ role: "user", content: message });

        // 5. Resposta em streaming, com troca de provedor se o principal cair.
        let provider = "";
        let sent = 0;
        const system = systemPrompt();
        // Simulador de salário: o servidor calcula (salario.ts) e o resultado entra no contexto; o modelo só repete os números.
        const salarioPedido = financeEnabled() ? pedidoSalario(message) : null;
        const salarioBlock = salarioPedido ? blocoSalario(salarioPedido) ?? "" : "";
        const context = contextBlock(name, memFor, (related.data ?? []) as { title: string; summary: string; updated_at: string }[]) + extras + (await semantic) + google + coreBlock + financeBlock + goalsBlock + salarioBlock + (parsed.data.context ? contextLine(parsed.data.context) : "");
        inputChars = system.length + context.length + turns.reduce((n, t) => n + t.content.length, 0);
        for await (const ev of routeChat({
          system,
          context,
          turns,
          signal: request.signal,
          onUsage: (u) => {
            usage = {
              input: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
              output: u.output_tokens ?? 0,
              cost: costUsd(u),
              provider: u.provider,
              model: u.model,
            };
          },
        }, skip)) {
          if (ev.type === "provider") {
            streamProvider = ev.id;
            provider = `${ev.name} · ${ev.id === "gateway" ? "Vercel" : ev.id === "anthropic" ? "Anthropic" : "Google"}`;
            send({ t: "provider", name: provider });
          } else {
            full += ev.text;
            const vis = visiblePart(full);
            if (vis.length > sent) {
              send({ t: "delta", text: vis.slice(sent) });
              sent = vis.length;
            }
          }
        }

        // 6. Grava a conversa e as memórias propostas (sempre pendentes).
        const { body: answer, memories: proposals, reminders, tasks: taskProposals, events: eventProposals, gastos: gastoProposals, metas: metaProposals, acoes: acaoProposals } = splitMeta(full);
        await supabase.from("messages").insert([
          { conversation_id: conversationId, role: "user", content: message },
          {
            conversation_id: conversationId, role: "assistant", content: answer || "(sem resposta)", provider,
            input_tokens: (usage as { input: number } | null)?.input ?? null,
            output_tokens: (usage as { output: number } | null)?.output ?? null,
            cost_usd: (usage as { cost: number } | null)?.cost ?? null,
          },
        ]);
        const u = usage as { input: number; output: number; cost: number; provider: ProviderId; model: string } | null;
        // Liquida a reserva pelo custo real (consumo gravado na mesma transação).
        if (u) {
          recorded = true;
          settled = await settleBudget(user.id, reservationId, "chat", u);
        }
        const newCount = msgCount + 2;
        await supabase.from("conversations").update({ updated_at: new Date().toISOString(), message_count: newCount }).eq("id", conversationId);
        // Memória v2: resume a conversa em segundo plano (depois de responder), a cada 6 mensagens.
        if (newCount >= 4 && (!hasSummary || newCount % 6 === 0)) {
          const convId = conversationId;
          after(() => summarize(supabase, user.id, convId, skip));
        }
        let added = 0;
        if (proposals.length) {
          const { data: existing } = await supabase.from("memories").select("content");
          const seen = new Set((existing ?? []).map((m) => String(m.content).toLowerCase()));
          const rows = proposals
            .filter((p) => !seen.has(p.content.toLowerCase()) && !blockedTerm(p.content, blocked) && !isSensitive(p.content))
            .map((p) => ({ content: p.content, area: p.area, origin: "Conversa", status: "pending" }));
          if (rows.length) {
            const { error } = await supabase.from("memories").insert(rows);
            if (!error) added = rows.length;
          }
        }
        // Lembretes pedidos nesta mensagem (o agendador avisa no celular na hora certa).
        const okReminders = reminders.filter((r) => !isSensitive(r.text) && !blockedTerm(r.text, blocked));
        if (okReminders.length) {
          const { data: created } = await supabase
            .from("reminders")
            .insert(okReminders.map((r) => ({ text: r.text, due_at: r.dueAt, origin: "Conversa", conversation_id: conversationId })))
            .select("id, text, due_at");
          if (created?.length) send({ t: "reminders", items: created.map((r) => ({ id: r.id as number, text: r.text as string, dueAt: r.due_at as string })) });
        }
        // Tarefas pedidas nesta mensagem. Projeto pelo nome (só os da pessoa) ou o projeto desta conversa.
        const okTasks = taskProposals.filter((t) => !isSensitive(t.title) && !blockedTerm(t.title, blocked));
        if (okTasks.length) {
          const byName = new Map(((activeProjects.data ?? []) as { id: number; name: string }[]).map((p) => [p.name.toLowerCase(), p.id]));
          const { data: createdTasks } = await supabase
            .from("tasks")
            .insert(okTasks.map((t) => ({
              title: t.title, due_date: t.due, priority: t.priority, origin: "Conversa", conversation_id: conversationId,
              project_id: (t.project ? byName.get(t.project.toLowerCase()) : undefined) ?? projectId,
            })))
            .select("id, title, due_date");
          if (createdTasks?.length) send({ t: "tasks", items: createdTasks.map((t) => ({ id: t.id as number, title: t.title as string, due: (t.due_date as string | null) ?? null })) });
        }
        // Eventos: só propostas. O app mostra e a pessoa confirma antes de criar na agenda.
        const okEvents = eventProposals.filter((e) => !isSensitive(e.title) && !blockedTerm(e.title, blocked));
        if (okEvents.length) send({ t: "events", items: okEvents });
        // Gastos: só propostas (nada é gravado aqui). Só quando a mensagem tinha a intenção de lançar e Finanças está ligado.
        // Descrição com termo bloqueado ou dado sensível é descartada; o valor e a categoria seguem.
        if (finIntent?.kind === "gasto" && gastoProposals.length) {
          send({ t: "gastos", items: gastoProposals.map((g) => (isSensitive(g.descricao) || blockedTerm(g.descricao, blocked) ? { ...g, descricao: "" } : g)) });
        }
        // Metas: só propostas (nada é gravado aqui). A etiqueta vira o id real NO SERVIDOR, só entre as metas que a pessoa pode atualizar por aqui.
        let metaSent = false;
        if (goalsIntent?.kind === "atualizar" && goalRefs.length && metaProposals.length) {
          const drafts = metaProposals.flatMap((p) => {
            const ref = goalRefs.find((r) => r.tag === p.meta);
            if (!ref) return [];
            if (p.acao === "registrar" && ref.medicao !== "numerica" && ref.medicao !== "percentual") return [];
            if (p.acao === "registrar" && ref.medicao === "percentual" && (p.valor ?? 0) > 100) return [];
            return [{ goalId: ref.id, titulo: ref.titulo, unidade: ref.medicao === "percentual" ? "%" : ref.unidade, acao: p.acao, valor: p.valor, data: p.acao === "registrar" ? (p.data ?? isoDia(hojeSP())) : null, agregacao: ref.agregacao } satisfies MetaDraft];
          });
          if (drafts.length) { send({ t: "metas", items: drafts }); metaSent = true; }
        }
        // "Tudo por voz": ações de qualquer módulo (criar meta, marco, concluir tarefa, conta paga, ajustes…). Só propostas:
        // os nomes viram ids SÓ entre os itens da pessoa (sessão + user_id) e ela confirma no cartão ou dizendo "sim".
        let acoesOk = metaSent ? acaoProposals.filter((a) => a.tipo !== "meta_registrar" && a.tipo !== "meta_concluir") : acaoProposals;
        if (salarioPedido) {
          // O valor e os dependentes do cartão são os que a pessoa disse, não os que o modelo repetiu; sem ação do modelo, o servidor propõe o cartão.
          const dele = acoesOk.find((a) => a.tipo === "salario_simular");
          const base = { tipo: "salario_simular" as const, bruto: salarioPedido.bruto, dependentes: salarioPedido.dependentes };
          acoesOk = [...acoesOk.filter((a) => a.tipo !== "salario_simular"), { ...base, salvar: dele?.tipo === "salario_simular" ? dele.salvar : false }];
        }
        if (acoesOk.length) {
          const { actions, misses } = await resolveAcoes(supabase, user.id, acoesOk, {
            goals: goalsEnabled(), finance: financeEnabled(), modeling3d: modeling3dEnabled(),
            // Agenda do Google só para achar o evento pelo nome (token da própria pessoa, só no servidor).
            calendar: async (from, to) => events(await accessToken(supabase, user.id), from, to),
            blocked: (t) => isSensitive(t) || Boolean(blockedTerm(t, blocked)),
          });
          if (actions.length) send({ t: "acoes", items: actions });
          for (const text of misses) send({ t: "notice", kind: "acao", text });
        }
        if (coreSources) send({ t: "sources", ...coreSources });
        send({ t: "done", memories: added });
      } catch (e) {
        if (e instanceof BudgetReached) {
          send({ t: "notice", kind: "quota", text: "Os motores de IA chegaram ao limite de gasto que você definiu para este mês. Ajuste os limites em Ajustes para continuar." });
        } else if (e instanceof NoProviderError) {
          send({ t: "notice", kind: "engine", text: "O motor ainda não está configurado neste servidor. Publique na Vercel (usa o AI Gateway) ou cadastre ANTHROPIC_API_KEY." });
        } else if (e instanceof AllProvidersFailed && !request.signal.aborted) {
          const text = {
            auth: "Os motores de IA recusaram a chave de acesso. Confira a chave da Anthropic no servidor.",
            credits: "Os motores de IA estão sem crédito. Adicione crédito na Anthropic ou no AI Gateway da Vercel.",
            busy: "Os motores de IA estão ocupados agora. Tente de novo em alguns segundos.",
            other: "Não consegui responder agora. Tente de novo em instantes.",
          }[e.kind];
          console.error("chat error", e.kind);
          send({ t: "notice", kind: "engine", text });
        } else if (!request.signal.aborted) {
          console.error("chat error", e instanceof Error ? e.message : "unknown");
          send({ t: "notice", kind: "error", text: "Não consegui responder agora. Tente de novo em instantes." });
        }
      } finally {
        // Reserva ainda aberta (bloqueio, erro do provedor, cancelamento):
        //  - já saiu texto: o provedor cobrou, então liquida (pelo uso real se chegou, senão pela estimativa; S-02);
        //  - nada saiu: libera para não prender o orçamento.
        try {
          if (reservationId && !settled && !recorded) {
            const real = usage as { input: number; output: number; cost: number; provider: ProviderId; model: string } | null;
            if (real) {
              recorded = true;
              settled = await settleBudget(user.id, reservationId, "chat", real);
            } else if (streamProvider) {
              const model = streamProvider === "anthropic" ? cfg.model : streamProvider === "gateway" ? cfg.gatewayModel : cfg.geminiModel;
              const est = estimatePartialUsage(model, inputChars, full.length, reservedUsd);
              if (est) {
                recorded = true;
                settled = await settleBudget(user.id, reservationId, "chat", { provider: streamProvider, model: est.model, input: est.input, output: est.output, cost: est.cost });
              }
            }
          }
          if (reservationId && !settled) await releaseBudget(user.id, reservationId);
        } catch (e) {
          console.error("encerramento do orçamento falhou", e instanceof Error ? e.message.slice(0, 120) : "erro");
        } finally {
          controller.close();
        }
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

const STOP = new Set("para como mais muito pela pelo isso esta este essa esse estou você voce sobre qual quais quando onde porque também tambem agora ainda depois antes então entao gadu fala falar pode poderia quero queria tenho temos fazer coisa coisas hoje".split(" "));

/** Monta a busca por conversas antigas: palavras relevantes da mensagem, unidas por "or". */
function relatedQuery(message: string): string {
  const words = message
    .toLowerCase()
    .normalize("NFC")
    .match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const uniq = [...new Set(words.filter((w) => !STOP.has(w)))].slice(0, 8);
  return uniq.join(" or ");
}

type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Gera ou atualiza o resumo da conversa com o modelo mais barato. Falhas não afetam a conversa. */
async function summarize(supabase: Db, userId: string, conversationId: number, skip: Set<ProviderId>) {
  try {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("summary").eq("id", conversationId).maybeSingle(),
      supabase.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(30),
    ]);
    const transcript = (msgs ?? []).reverse().map((m) => `${m.role === "user" ? "Pessoa" : "GaDu"}: ${String(m.content).slice(0, 1500)}`).join("\n");
    if (!transcript) return;
    // Resumo também passa pelo orçamento: reserva antes, liquida depois; sem orçamento, não resume.
    const prompt = transcript.length + 800;
    const resv = await reserveBudget(userId, "summary", estimateMaxCost(serverConfig().cheapModel, prompt, 600));
    if (!resv.ok) return;
    const rid = resv.id;
    let done = false;
    try {
    const r = await complete(
      `Resuma a conversa abaixo em português do Brasil, em até 120 palavras, para servir de memória futura do assistente. Inclua decisões, pedidos pendentes, nomes de projetos e datas citadas. Não inclua dados sensíveis (documentos, senhas, dados bancários ou de saúde). Responda só com o resumo, sem título.${conv?.summary ? `\n\nResumo anterior:\n${conv.summary}` : ""}\n\nConversa:\n${transcript}`,
      { maxTokens: 600, skip },
    );
    await supabase.from("conversations").update({ summary: r.text.slice(0, 2000), summary_at: new Date().toISOString() }).eq("id", conversationId);
    done = await settleBudget(userId, rid, "summary", r);
    } finally {
      if (rid && !done) await releaseBudget(userId, rid);
    }
  } catch (e) {
    console.error("resumo falhou", e instanceof Error ? e.message.slice(0, 200) : "erro");
  }
}

/** Lê agenda e/ou e-mails quando a mensagem pede. Falhas viram um aviso no contexto, nunca derrubam a conversa. */
async function googleContext(supabase: Db, userId: string, message: string, blocked: string[], tasks: InTask[]): Promise<string> {
  const want = googleIntent(message);
  if (!want.agenda && !want.email) return "";
  try {
    const token = await accessToken(supabase, userId);
    // Começo de hoje no horário de Brasília (UTC-3, sem horário de verão).
    const sp = new Date(Date.now() - 3 * 3_600_000);
    const start = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 3));
    const end = new Date(start.getTime() + (want.week ? 7 : 2) * 86_400_000);
    const hide = (t: string) => isSensitive(t) || Boolean(blockedTerm(t, blocked));
    const [ev, mails] = await Promise.all([
      want.agenda ? events(token, start, end) : Promise.resolve(null),
      want.email ? inbox(token) : Promise.resolve(null),
    ]);
    const parts = [ev ? formatEvents(ev) : "", mails ? formatMails(mails, hide) : ""].filter(Boolean);
    // Insights calculados (conflitos, janela livre, atrasos, e-mails parados): use no briefing e ao priorizar.
    const tips = insights({ events: ev ? ev.filter((e) => !e.declined && e.start < new Date(start.getTime() + 86_400_000).toISOString()) : null, tasks, mails: mails?.filter((m) => !hide(`${m.from} ${m.subject} ${m.snippet}`)) ?? null });
    if (tips.length) parts.push("Insights de hoje:\n" + tips.map((t) => `- ${t.text}`).join("\n"));
    return `\n\nDados do Google (lidos agora, só leitura):\n${parts.join("\n\n")}`;
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "not_connected") {
      return "\n\nDados do Google: a conta Google não está conectada. Se a pessoa pedir agenda ou e-mails, diga que ela pode conectar em Ajustes, Conexões.";
    }
    console.error("google no chat falhou", e instanceof Error ? e.message : "erro");
    return "\n\nDados do Google: não consegui ler agora (falha temporária ou acesso revogado). Diga isso com franqueza e sugira tentar de novo ou reconectar em Ajustes.";
  }
}

/** Itens parecidos com a mensagem, pela busca por significado. */
async function semanticContext(supabase: Db, message: string): Promise<string> {
  if (!embeddingsAvailable() || message.trim().length < 12) return "";
  try {
    const [v] = await embed([message]);
    const { data } = await supabase.rpc("search_similar", { query_embedding: toVector(v), match_count: 6 });
    const label: Record<string, string> = { memory: "memória", conversation: "conversa anterior", task: "tarefa", project: "projeto" };
    const hits = ((data ?? []) as { kind: string; content: string; similarity: number }[]).filter((r) => r.similarity > 0.4);
    if (!hits.length) return "";
    return "\n\nItens relacionados encontrados por significado (use só se ajudar):\n" + hits.map((h) => `- (${label[h.kind] ?? h.kind}) ${h.content.slice(0, 300)}`).join("\n");
  } catch {
    return "";
  }
}
