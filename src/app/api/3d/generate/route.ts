import { NextResponse } from "next/server";
import { releaseBudget, reserveBudget, settleBudget } from "@/lib/ai-budget";
import { checkDailyQuota, checkProviderSpend, safeRpc } from "@/lib/chat-budget-guard";
import { readBudgets, serverConfig } from "@/lib/config";
import { SAIDA_MAX_TOKENS } from "@/lib/3d/limits";
import { GenerateBody } from "@/lib/3d/schemas";
import { buildPrompt, extractScad, validateScad } from "@/lib/3d/scad";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import { estimateMaxCost } from "@/lib/pricing";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { fail, modeling3dGuard, NO_STORE } from "../_guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gera ou ajusta código OpenSCAD com o modelo barato. Mesmo pipeline de custo do chat, fail closed:
// sessão → acesso → interruptor → zod → privacidade → limites por motor → RESERVA de orçamento (só servidor) →
// cota diária → IA → liquidação pelo custo real. O servidor nunca executa o código: só devolve o texto.
export async function POST(request: Request) {
  const g = await modeling3dGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;

  const p = GenerateBody.safeParse(await request.json().catch(() => null));
  if (!p.success) return fail(400, "invalid", p.error.issues[0]?.message ?? "Confira os dados.");
  const { modo, pedido, scad, erro } = p.data;

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

  const prompt = buildPrompt({ modo, pedido, scad, erro });
  const cfg = serverConfig();
  // Reserva atômica do teto mensal, só pelo servidor, com o id da SESSÃO (nunca do corpo).
  const resv = await reserveBudget(user.id, "chat", estimateMaxCost(cfg.cheapModel, prompt.length, SAIDA_MAX_TOKENS));
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
    let r;
    try {
      r = await complete(prompt, { maxTokens: SAIDA_MAX_TOKENS, skip });
    } catch {
      return fail(502, "ai", "A IA não respondeu agora. Tente de novo em instantes.");
    }
    // O custo real vale mesmo que o código volte inválido.
    settled = await settleBudget(user.id, resv.id, "chat", r);
    const code = extractScad(r.text);
    const v = validateScad(code);
    if (!v.ok) return fail(422, "invalid_scad", v.message);
    return NextResponse.json({ scad: code }, { headers: NO_STORE });
  } finally {
    if (!settled) await releaseBudget(user.id, resv.id);
  }
}
