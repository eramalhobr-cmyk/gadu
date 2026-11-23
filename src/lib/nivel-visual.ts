// Modo voz imersivo (UX-7 · G1): transforma o nível real da voz (voice-level.ts) no que os anéis do núcleo mostram.
// Sem sinal recente (-1), usa uma respiração leve por estado; nunca inventa "volume" quando a pessoa está calada.

export type ModoNucleo = "idle" | "listening" | "thinking" | "speaking";

/** Nível visual de 0 a 1. `real` é o voiceLevel.read() (−1 = sem sinal); `t` em segundos. */
export function nivelVisual(real: number, modo: ModoNucleo, t: number): number {
  if (real >= 0 && (modo === "listening" || modo === "speaking")) return Math.min(1, Math.max(0, real));
  if (modo === "thinking") return 0.18 + 0.08 * Math.sin(t * 5);
  if (modo === "listening" || modo === "speaking") return 0.06 + 0.04 * Math.sin(t * 2.2);
  return 0;
}

/** Altura (0 a 1) de cada traço do anel de espectro: o nível real, distribuído ao redor do círculo com ondas suaves. */
export function espectro(n: number, nivel: number, t: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const onda = 0.55 + 0.25 * Math.sin(a * 3 + t * 4) + 0.2 * Math.sin(a * 7 - t * 6.5);
    out.push(Math.min(1, Math.max(0, nivel * onda)));
  }
  return out;
}

/** Rótulo do estado, em caixa alta no HUD. */
export function rotuloModo(modo: ModoNucleo, listening: boolean): string {
  if (listening || modo === "listening") return "Ouvindo";
  if (modo === "thinking") return "Pensando";
  if (modo === "speaking") return "Falando";
  return "Pronto";
}

/** "Modo voz", "modo imersivo", "modo Jarvis", "abre o modo de voz": abre a escuta em tela cheia, sem modelo. */
export function parseModoVoz(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(gadu )?(por favor )?((abre|abrir|ativa|ativar|liga|ligar|entra no|entrar no|vai pro|vai para o) )?(o )?modo (de )?(voz|imersivo|jarvis|conversa por voz)( por favor)?$/.test(t);
}
