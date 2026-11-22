// Tamanho do texto (UX-3): normal, grande (115%) ou maior (130%). Igual ao tema, a escolha fica num cookie
// para o servidor já entregar a página no tamanho certo (sem piscar). O CSS multiplica as fontes por --ts.
export type TextSize = "100" | "115" | "130";
export const TEXT_COOKIE = "gadu_texto";
export const TEXT_SIZES: { id: TextSize; label: string; hint: string }[] = [
  { id: "100", label: "Normal", hint: "Tamanho padrão." },
  { id: "115", label: "Grande", hint: "15% maior." },
  { id: "130", label: "Maior", hint: "30% maior. Bom para ler de longe." },
];

export function parseTextSize(v: unknown): TextSize {
  return v === "115" || v === "130" ? v : "100";
}

/** Tamanho em uso no navegador (o que o servidor aplicou no <html>). */
export function readTextSize(): TextSize {
  if (typeof document === "undefined") return "100";
  return parseTextSize(document.documentElement.dataset.texto);
}

export function applyTextSize(t: TextSize) {
  document.documentElement.dataset.texto = t;
  document.cookie = `${TEXT_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
}
