import { NextResponse } from "next/server";
import { releaseBudget, reserveBudget, settleBudget } from "@/lib/ai-budget";
import { checkDailyQuota, checkProviderSpend, safeRpc } from "@/lib/chat-budget-guard";
import { readBudgets, serverConfig } from "@/lib/config";
import { SAIDA_MAX_TOKENS } from "@/lib/3d/limits";
import { GenerateBody } from "@/lib/3d/schemas";
import { IMAGEM_CHARS_EST, lerImagem } from "@/lib/3d/render-imagem";
import { buildPrompt, buildRetryPrompt, extractScad, scadIncompleto, validateScad } from "@/lib/3d/scad";
import { complete, isTimeout, type Completion } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import { estimateMaxCost } from "@/lib/pricing";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { fail, modeling3dGuard, NO_STORE } from "../_guard";

export const dynamic = "force-dynamic";
// Peças maiores levam mais de 30 s na IA; com 60 s a função era cortada antes da resposta (referência de 23/11).
export const maxDuration = 120;
/** Prazo próprio, abaixo do maxDuration, para responder com mensagem clara em vez de ser cortada pela Vercel. */
const PRAZO_MS = 105_000;
/** Cada motor espera no máximo isto; a nova tentativa automática só começa se ainda houver tempo. */
const MOTOR_MS = 55_000;

// Gera ou ajusta código OpenSCAD com o modelo barato. Mesmo pipeline de custo do chat, fail closed:
// sessão → acesso → interruptor → zod → privacidade → limites por motor → RESERVA de orçamento (só servidor) →
// cota diária → IA → liquidação pelo custo real. O servidor nunca executa o código: só devolve o texto.
export async function POST(request: Request) {
  const inicio = Date.now();
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;

  const p = GenerateBody.safeParse(await request.json().catch(() => null));
  if (!p.success) return fail(400, "invalid", p.error.issues[0]?.message ?? "Confira os dados.");
  const { modo, pedido, scad, erro, causa } = p.data;
  // 3D-1b: render atual da peça junto do ajuste. Conferido pelo cabeçalho real e pelo tamanho; inválido = 400.
  const imagem = p.data.imagem ? lerImagem(p.data.imagem) : null;
  if (p.data.imagem && !imagem) return fail(400, "invalid", "A imagem da peça veio num formato que não reconheço.");

  // Privacidade: dado sensível ou termo bloqueado pela pessoa não sai daqui.
  const { data: profile } = await supabase.from("profiles").select("settings").eq("id", user.id).maybeSingle();
  const settings = (profile?.settings ?? {}) as { blocked?: unknown };
  const blocked = Array.isArray(settings.blocked) ? settings.blocked.map(String) : [];
  if (isSensitive(pedido) || blockedTerm(pedido, blocked)) {
    return fail(422, "privacy", "Percebi um dado sensível ou um termo que você bloqueou nesse pedido. Pela regra de privacidade ele não vai para a IA. Reescreva sem esse dado.");
  }

  // Limites por motor definidos em Ajustes. Sem esse dado não dá para respeitá-los: bloqueia.
  const spend = checkProviderSpend(await safeRpc<unknown>(() => supabase.rpc("month_spend_by_provider")));
  if (!spend.ok) return fail(503, "budget", "Não consegui verificar os limites de IA agora. Tente de novo em instantes.");
  const budgets = readBudgets(profile?.settings);
  const skip = new Set<ProviderId>();
  if ((spend.spentBy.anthropic ?? 0) >= budgets.anthropic) skip.add("anthropic");
  if ((spend.spentBy.gateway ?? 0) >= budgets.gateway) skip.add("gateway");

  const prompt = buildPrompt({ modo, pedido, scad, erro, causa, comImagem: Boolean(imagem) });
  const cfg = serverConfig();
  // Reserva atômica do teto mensal, só pelo servidor, com o id da SESSÃO (nunca do corpo).
  // A reserva cobre também a nova tentativa automática (código cortado), para o teto valer mesmo no pior caso.
  const resv = await reserveBudget(user.id, "chat", 2 * estimateMaxCost(cfg.cheapModel, prompt.length + (imagem ? IMAGEM_CHARS_EST : 0), SAIDA_MAX_TOKENS));
  if (!resv.ok) {
    return resv.reason === "unavailable"
      ? fail(503, "budget", "Não consegui verificar seu orçamento de IA agora. Tente de novo em instantes.")
      : fail(402, "budget", resv.reason === "global" ? "O limite de gasto com IA da conta foi atingido neste mês. Fale com o administrador do GaDu." : "O teto de gasto com IA do mês foi atingido. Você ainda pode mexer nos controles da peça, que não usam IA.");
  }
  let settled = false;
  try {
    // Cota diária (atômica no banco, limite definido pelo servidor). Sem resposta válida: bloqueia.
    const daily = checkDailyQuota(await safeRpc<unknown>(() => supabase.rpc("consume_daily_quota")));
    if (!daily.allowed) {
      return daily.reason === "unavailable"
        ? fail(503, "quota", "Não consegui verificar seu limite diário agora. Tente de novo em instantes.")
        : fail(429, "quota", `Você chegou ao limite de ${daily.limit} usos de IA hoje. O limite volta à meia-noite. Os controles da peça continuam funcionando.`);
    }
    const deadline = inicio + PRAZO_MS;
    const chamar = (texto: string) => complete(texto, { maxTokens: SAIDA_MAX_TOKENS, skip, timeoutMs: MOTOR_MS, maxRetries: 0, deadline, semRaciocinio: true, ...(imagem ? { image: imagem } : {}) });
    let r: Completion;
    try {
      r = await chamar(prompt);
    } catch (e) {
      return isTimeout(e)
        ? fail(504, "ai_timeout", "A IA demorou demais para responder (mais de 1 minuto e meio). Tente de novo; se repetir, peça uma peça mais simples ou em partes.")
        : fail(502, "ai", "O serviço de IA falhou ao responder agora. Tente de novo em instantes.");
    }
    // O custo real vale mesmo que o código volte inválido.
    settled = await settleBudget(user.id, resv.id, "chat", r);
    let code = extractScad(r.text);
    // Código cortado (limite de saída) ou que não terminou: UMA nova tentativa automática, mais curta, se houver tempo.
    if ((r.cortada || scadIncompleto(code)) && deadline - Date.now() > 20_000) {
      try {
        const r2 = await chamar(buildRetryPrompt({ modo, pedido, scad, erro, causa, comImagem: Boolean(imagem) }));
        // A reserva já foi liquidada pela primeira chamada: a segunda grava o consumo direto (custo nunca fica de fora).
        await settleBudget(user.id, null, "chat", r2);
        code = extractScad(r2.text);
      } catch (e) {
        console.error("3d: nova tentativa falhou", isTimeout(e) ? "tempo" : "motor");
      }
    }
    const v = validateScad(code);
    if (!v.ok) return fail(422, "invalid_scad", v.message);
    return NextResponse.json({ scad: code }, { headers: NO_STORE });
  } finally {
    if (!settled) await releaseBudget(user.id, resv.id);
  }
}
