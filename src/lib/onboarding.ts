// UX-4 · primeiro uso guiado e falado, em 3 passos: nome, testar microfone e voz, conectar o Google.
// A preferência fica no perfil, em `profiles.settings.onboarding` (como `tips` e `blocked`): sem migração.

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STEPS = ["nome", "voz", "google"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export type OnboardingStatus = "done" | "skipped";
export type OnboardingState = { v: number; status: OnboardingStatus; at: string };

/** Lê o que está guardado no perfil. Qualquer coisa fora do formato conta como "nunca fez". */
export function parseOnboarding(settings: unknown): OnboardingState | null {
  const o = settings && typeof settings === "object" ? (settings as { onboarding?: unknown }).onboarding : null;
  if (!o || typeof o !== "object") return null;
  const { v, status, at } = o as Record<string, unknown>;
  if ((status !== "done" && status !== "skipped") || typeof v !== "number") return null;
  return { v, status, at: typeof at === "string" ? at.slice(0, 40) : "" };
}

/** O guia abre sozinho só para quem é novo: sem registro do guia e sem nenhuma dica já vista (quem já usa o app não é interrompido). */
export function needsOnboarding(settings: unknown): boolean {
  if (parseOnboarding(settings)) return false;
  const tips = settings && typeof settings === "object" ? (settings as { tips?: unknown }).tips : null;
  return !(Array.isArray(tips) && tips.length > 0);
}

/** Novas `settings` com o guia marcado como feito ou pulado. Preserva as outras chaves. */
export function withOnboarding(settings: unknown, status: OnboardingStatus, now = new Date()): Record<string, unknown> {
  const base = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  return { ...base, onboarding: { v: ONBOARDING_VERSION, status, at: now.toISOString() } satisfies OnboardingState };
}

/** Nome para o GaDu usar na saudação: sem espaços sobrando nem símbolos de controle, até 40 letras. */
export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

export type StepDef = { id: OnboardingStep; title: string; text: string; /** O que o GaDu fala ao abrir o passo. */ say: string };
export const STEPS: Record<OnboardingStep, StepDef> = {
  nome: {
    id: "nome",
    title: "Como posso te chamar?",
    text: "Escreva o seu nome. Eu uso nas saudações.",
    say: "Oi! Eu sou o Gadu. Vou te mostrar o básico em três passos rápidos. Primeiro: como posso te chamar?",
  },
  voz: {
    id: "voz",
    title: "Vamos testar a voz",
    text: "Toque em Ouvir a voz do GaDu. Depois, toque em Falar e diga qualquer frase.",
    say: "Agora o segundo passo. Toque em ouvir a minha voz. Depois toque em falar e diga uma frase, para testar o microfone.",
  },
  google: {
    id: "google",
    title: "Conecte o Google",
    text: "Assim eu vejo a sua agenda e os seus e-mails. Você escolhe o que liberar e pode desligar quando quiser.",
    say: "Último passo. Conecte o Google para eu ver a sua agenda e os seus e-mails. Se preferir, toque em agora não. Dá para fazer depois.",
  },
};

/** Passo seguinte e anterior (nulo nas pontas). */
export const nextStep = (s: OnboardingStep): OnboardingStep | null => ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(s) + 1] ?? null;
export const prevStep = (s: OnboardingStep): OnboardingStep | null => ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(s) - 1] ?? null;

/** Frases de feedback do teste do microfone e da voz. */
export const VOICE_TEXT = {
  listening: "Pode falar. Estou ouvindo.",
  heard: (t: string) => `Ouvi: “${t}”. O microfone está funcionando.`,
  nothing: "Não ouvi nada. Toque em Falar e tente de novo.",
  noMic: "Este navegador não tem reconhecimento de voz. Você ainda pode escrever para o GaDu.",
  noVoice: "Este aparelho não tem voz para o GaDu falar. Você ainda pode ler as respostas.",
} as const;
