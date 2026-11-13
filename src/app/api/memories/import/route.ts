import { NextResponse } from "next/server";
import { z } from "zod";
import { readBudgets, serverConfig } from "@/lib/config";
import { releaseBudget, reserveBudget, settleBudget } from "@/lib/ai-budget";
import { checkProviderSpend, safeRpc } from "@/lib/chat-budget-guard";
import { estimateMaxCost } from "@/lib/pricing";
import { accessOf } from "@/lib/access";
import { IMPORT_MAX_CHARS, IMPORT_MAX_ITEMS, looksLikeList, parseImport } from "@/lib/importer";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import { AREAS } from "@/lib/meta";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(IMPORT_MAX_CHARS),
  origin: z.enum(["Claude", "ChatGPT", "Gemini", "Outra"]),
  area: z.enum(AREAS).optional(),
}).strict();

// Importa memórias de outra IA. Tudo entra como pendente: a pessoa aprova uma a uma (ou em lote).
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !(await accessOf(supabase, user)).ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid", message: "Texto vazio ou grande demais (máximo 30 mil caracteres)." }, { status: 400 });
  const { text, origin } = parsed.data;

  const [{ data: profile }, { data: existing }, spendRes] = await Promise.all([
    supabase.from("profiles").select("settings").eq("id", user.id).maybeSingle(),
    supabase.from("memories").select("content"),
    safeRpc<unknown>(() => supabase.rpc("month_spend_by_provider")),
  ]);
  const settings = (profile?.settings ?? {}) as { blocked?: unknown };
  const blocked = Array.isArray(settings.blocked) ? settings.blocked.map(String) : [];

  let items: { content: string; area: string }[];
  let usedAi = false;
  if (looksLikeList(text)) {
    items = parseImport(text).map((c) => ({ content: c, area: parsed.data.area ?? "Pessoal" }));
  } else {
    // Texto livre: o modelo barato extrai fatos duráveis. Respeita os limites de gasto.
    // Sem o gasto por provedor não dá para respeitar os limites de Ajustes: bloqueia (fail closed).
    const spend = checkProviderSpend(spendRes);
    if (!spend.ok) return NextResponse.json({ error: "budget", message: "Não consegui verificar seus limites de IA agora. Tente de novo em instantes." }, { status: 503 });
    const budgets = readBudgets(profile?.settings);
    const skip = new Set<ProviderId>();
    if ((spend.spentBy.anthropic ?? 0) >= budgets.anthropic) skip.add("anthropic");
    if ((spend.spentBy.gateway ?? 0) >= budgets.gateway) skip.add("gateway");
    // Teto mensal com reserva atômica (transição: sem a migração, segue como antes).
    const resv = await reserveBudget(supabase, "import", estimateMaxCost(serverConfig().cheapModel, text.length + 600, 3000));
    if (!resv.ok && !resv.legacy) {
      return NextResponse.json({ error: "budget", message: resv.reason === "unavailable" ? "Não consegui verificar seu orçamento de IA agora. Tente de novo em instantes." : "O teto de gasto com IA do mês foi atingido. Importe como lista (uma informação por linha), que não usa IA." }, { status: resv.reason === "unavailable" ? 503 : 402 });
    }
    const rid = resv.ok ? resv.id : null;
    let settledImport = false;
    try {
      const r = await complete(
        `Extraia do texto abaixo fatos duráveis sobre a pessoa (preferências, rotina, projetos pessoais, pessoas próximas, objetivos). ` +
          `Ignore dados sensíveis (documentos, senhas, banco, saúde) e qualquer assunto da empresa onde ela trabalha. ` +
          `Responda só com JSON: {"memorias":[{"texto":"frase curta em português","area":"${AREAS.join("|")}"}]}, no máximo 40 itens.\n\nTexto:\n${text}`,
        { maxTokens: 3000, skip },
      );
      usedAi = true;
      settledImport = await settleBudget(supabase, rid, "import", r);
      const json = r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1);
      const list = (JSON.parse(json) as { memorias?: { texto?: unknown; area?: unknown }[] }).memorias ?? [];
      items = list
        .map((m) => ({
          content: typeof m.texto === "string" ? m.texto.trim().slice(0, 400) : "",
          area: typeof m.area === "string" && (AREAS as readonly string[]).includes(m.area) ? m.area : "Pessoal",
        }))
        .filter((m) => m.content.length >= 8);
    } catch {
      return NextResponse.json({ error: "ai", message: "Não consegui ler esse texto agora. Tente colar como lista, uma informação por linha." }, { status: 502 });
    } finally {
      if (rid && !settledImport) await releaseBudget(supabase, rid);
    }
  }

  const seen = new Set((existing ?? []).map((m) => String(m.content).toLowerCase()));
  let skipped = 0;
  const rows: { content: string; area: string; origin: string; status: "pending" }[] = [];
  for (const it of items.slice(0, IMPORT_MAX_ITEMS)) {
    const key = it.content.toLowerCase();
    if (seen.has(key) || isSensitive(it.content) || blockedTerm(it.content, blocked)) { skipped++; continue; }
    seen.add(key);
    rows.push({ content: it.content, area: it.area, origin: `Importado · ${origin}`.slice(0, 40), status: "pending" });
  }
  if (rows.length) {
    const { error } = await supabase.from("memories").insert(rows);
    if (error) return NextResponse.json({ error: "save", message: "Não consegui salvar. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ added: rows.length, skipped, usedAi });
}
