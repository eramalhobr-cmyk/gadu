// 3D-1b: o render atual da peça vai junto com cada ajuste ("refinar"), para a IA ver a forma e não só o código.
// A imagem é feita no navegador (canvas do visualizador, lado maior de IMAGEM_LADO px, JPEG) e conferida aqui no servidor.
// Custo: o modelo barato cobra a imagem como tokens de entrada, cerca de (largura × altura) / 750.

export const IMAGEM_LADO = 512;
export const IMAGEM_MAX_BYTES = 300_000;
/** Teto de tokens de uma imagem de até 512 × 512 (≈ 350), com folga, para a reserva de orçamento. */
export const IMAGEM_TOKENS_EST = 400;
/** A reserva estima tokens por caracteres (≈ 3 por token): quanto a imagem soma ao tamanho do prompt. */
export const IMAGEM_CHARS_EST = IMAGEM_TOKENS_EST * 3;
export const IMAGEM_DATAURL_MAX = Math.ceil((IMAGEM_MAX_BYTES * 4) / 3) + 40;

export type Imagem = { mediaType: "image/png" | "image/jpeg"; data: string };

/** data:image/(png|jpeg);base64,… → imagem conferida (tipo pelo cabeçalho real, tamanho), ou null. */
export function lerImagem(dataUrl: string): Imagem | null {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const data = m[2];
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
  if (bytes < 100 || bytes > IMAGEM_MAX_BYTES) return null;
  let head: number[];
  try { head = [...atob(data.slice(0, 16))].map((c) => c.charCodeAt(0)); } catch { return null; }
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const jpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (m[1] === "image/png" ? !png : !jpg) return null;
  return { mediaType: m[1] as Imagem["mediaType"], data };
}

/** Tokens de uma imagem de w × h px (regra da Anthropic: w·h/750). */
export const tokensDaImagem = (w: number, h: number) => Math.ceil((w * h) / 750);

/** Lado maior em IMAGEM_LADO, mantendo a proporção. */
export function tamanhoCaptura(w: number, h: number): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, IMAGEM_LADO / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
