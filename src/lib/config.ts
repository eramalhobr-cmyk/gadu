// Configuração lida do ambiente. Só use no servidor (exceto as NEXT_PUBLIC_*).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const APP_VERSION = "0.1.0";

function list(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function serverConfig() {
  const limit = Number.parseInt(process.env.DAILY_MESSAGE_LIMIT ?? "", 10);
  const effort = process.env.GADU_EFFORT ?? "low";
  return {
    allowedEmails: list(process.env.ALLOWED_EMAILS),
    dailyLimit: Number.isFinite(limit) && limit > 0 ? limit : 150,
    model: process.env.GADU_MODEL || "claude-opus-5-5",
    effort: (["low", "medium", "high", "xhigh", "max"].includes(effort) ? effort : "low") as
      "low" | "medium" | "high" | "xhigh" | "max",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    geminiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  };
}

/** Só e-mails da lista entram. Lista vazia = ninguém entra (padrão seguro). */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverConfig().allowedEmails.includes(email.toLowerCase());
}
