// Configuração lida do ambiente. Só use no servidor (exceto as NEXT_PUBLIC_*).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const APP_VERSION = "0.3.0";

function list(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function serverConfig() {
  const limit = Number.parseInt(process.env.DAILY_MESSAGE_LIMIT ?? "", 10);
  const budget = Number.parseFloat(process.env.MONTHLY_BUDGET_USD ?? "");
  const effort = process.env.GADU_EFFORT ?? "low";
  return {
    allowedEmails: list(process.env.ALLOWED_EMAILS),
    dailyLimit: Number.isFinite(limit) && limit > 0 ? limit : 150,
    // Teto de gasto com IA por pessoa por mês (US$). Ao atingir, o Gadu para de chamar os motores.
    monthlyBudgetUsd: Number.isFinite(budget) && budget > 0 ? budget : 20,
    model: process.env.GADU_MODEL || "claude-opus-5-5",
    effort: (["low", "medium", "high", "xhigh", "max"].includes(effort) ? effort : "low") as
      "low" | "medium" | "high" | "xhigh" | "max",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    geminiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    // Modelos via Vercel AI Gateway (ids exatos de https://ai-gateway.vercel.sh/v1/models).
    gatewayModel: process.env.GATEWAY_MODEL || "anthropic/claude-opus-5.5",
    gatewayFallbackModel: process.env.GATEWAY_FALLBACK_MODEL || "google/gemini-3.5-flash",
    // Modelo barato para tarefas de bastidor (resumos, importação).
    cheapModel: process.env.CHEAP_MODEL || "claude-haiku-5-5",
    gatewayCheapModel: process.env.GATEWAY_CHEAP_MODEL || "anthropic/claude-haiku-5.5",
  };
}

/** Só e-mails da lista entram. Lista vazia = ninguém entra (padrão seguro). */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverConfig().allowedEmails.includes(email.toLowerCase());
}

/** Limites de gasto por provedor (US$ por mês), definidos pela pessoa em Ajustes. */
export type Budgets = { anthropic: number; gateway: number };
export const DEFAULT_BUDGETS: Budgets = { anthropic: 5, gateway: 5 };
export function readBudgets(settings: unknown): Budgets {
  const b = ((settings ?? {}) as { budgets?: Partial<Budgets> }).budgets ?? {};
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  return { anthropic: num(b.anthropic, DEFAULT_BUDGETS.anthropic), gateway: num(b.gateway, DEFAULT_BUDGETS.gateway) };
}
