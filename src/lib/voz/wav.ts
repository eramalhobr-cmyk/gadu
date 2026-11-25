// WAV PCM 16 bits: o único formato que todos os modelos de transcrição do Gateway aceitam (testado em 24/11/2026:
// a Microsoft recusa webm e m4a, que são o que o navegador grava). O app grava PCM e monta o WAV aqui.
// Funções puras, sem DOM: usadas no aparelho (montar) e no servidor (conferir e medir a duração).

export const TAXA = 16_000;

/** Média dos blocos para reduzir a taxa de amostragem (ex.: 48 kHz → 16 kHz). Simples e suficiente para voz. */
export function reduzirTaxa(entrada: Float32Array, de: number, para = TAXA): Float32Array {
  if (de <= para) return entrada;
  const razao = de / para;
  const n = Math.floor(entrada.length / razao);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * razao), b = Math.min(entrada.length, Math.floor((i + 1) * razao));
    let s = 0;
    for (let j = a; j < b; j++) s += entrada[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

/** Monta um WAV mono, 16 bits, na taxa dada. */
export function montarWav(amostras: Float32Array, taxa = TAXA): Uint8Array {
  const buf = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, "RIFF"); v.setUint32(4, 36 + amostras.length * 2, true); txt(8, "WAVE");
  txt(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, "data"); v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export type InfoWav = { taxa: number; canais: number; segundos: number };

/** Confere o cabeçalho (RIFF/WAVE, PCM 16 bits, 8 a 48 kHz, 1 ou 2 canais) e mede a duração pelo tamanho real dos dados.
 * Devolve null para qualquer coisa fora disso: o servidor não manda adiante áudio que não entende. */
export function infoWav(b: Uint8Array): InfoWav | null {
  if (b.length < 44) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const txt = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (txt(0) !== "RIFF" || txt(8) !== "WAVE") return null;
  let o = 12, fmt: { canais: number; taxa: number; bits: number; formato: number } | null = null;
  while (o + 8 <= b.length) {
    const id = txt(o), tam = v.getUint32(o + 4, true), corpo = o + 8;
    if (id === "fmt " && tam >= 16 && corpo + 16 <= b.length) {
      fmt = { formato: v.getUint16(corpo, true), canais: v.getUint16(corpo + 2, true), taxa: v.getUint32(corpo + 4, true), bits: v.getUint16(corpo + 14, true) };
    } else if (id === "data") {
      if (!fmt || fmt.formato !== 1 || fmt.bits !== 16 || fmt.canais < 1 || fmt.canais > 2 || fmt.taxa < 8000 || fmt.taxa > 48_000) return null;
      const dados = Math.min(tam, b.length - corpo);
      return { taxa: fmt.taxa, canais: fmt.canais, segundos: dados / (fmt.taxa * fmt.canais * 2) };
    }
    o = corpo + tam + (tam % 2);
  }
  return null;
}

/** Volume (RMS) de um bloco, de 0 a 1. Usado para saber se a pessoa já falou e quando parou. */
export function volume(bloco: Float32Array): number {
  let s = 0;
  for (let i = 0; i < bloco.length; i++) s += bloco[i] * bloco[i];
  return Math.sqrt(s / Math.max(1, bloco.length));
}
