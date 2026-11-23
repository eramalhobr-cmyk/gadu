// Nível da voz (0 a 1) para o avatar do GaDu reagir ao som de verdade (UX-7, palco de voz).
// Fontes: o medidor do microfone (computador), cada trecho reconhecido (celular) e cada palavra falada pela voz do aparelho.
// Sem fonte recente, o avatar usa a animação própria (fallback). Só apresentação: nada é gravado nem enviado.

/** Depois deste tempo sem sinal, o nível é considerado ausente e o avatar volta à animação própria. */
export const STALE_MS = 450;

/** Volume de um bloco de amostras do microfone (bytes de 0 a 255, silêncio = 128), já com portão de ruído e ganho. */
export function rmsLevel(samples: ArrayLike<number>, gate = 0.02, gain = 4): number {
  const n = samples.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / n);
  if (rms <= gate) return 0;
  return Math.min(1, (rms - gate) * gain);
}

/** Suaviza o nível: sobe rápido (ataque) e desce devagar (soltura), para o avatar não tremer. `dt` em segundos. */
export function smoothLevel(prev: number, target: number, dt: number, attack = 18, release = 5): number {
  const k = target > prev ? attack : release;
  const next = prev + (target - prev) * Math.min(1, Math.max(0, dt) * k);
  return Math.min(1, Math.max(0, next));
}

/** Medir o microfone em paralelo ao reconhecimento só no computador: no Android e no iPhone, abrir o microfone duas vezes pode derrubar o reconhecimento. */
export function canMeterMic(ua: string): boolean {
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

/** Barramento do nível: quem mede publica; o avatar lê a cada quadro. */
export class VoiceLevel {
  private value = 0;
  private at = -Infinity;
  /** Nível medido (microfone). */
  set(v: number, now: number) {
    this.value = Math.min(1, Math.max(0, v));
    this.at = now;
  }
  /** Um impulso (uma palavra falada, um trecho reconhecido): sobe o nível e decai sozinho. */
  pulse(amount: number, now: number) {
    const cur = this.read(now);
    this.value = Math.min(1, Math.max(cur < 0 ? 0 : cur, amount));
    this.at = now;
  }
  /** Nível atual, com decaimento desde o último sinal; -1 quando não há sinal recente (use a animação própria). */
  read(now: number): number {
    const age = now - this.at;
    if (!(age >= 0) || age > STALE_MS) return -1;
    return this.value * (1 - age / STALE_MS);
  }
  reset() {
    this.value = 0;
    this.at = -Infinity;
  }
}

export const voiceLevel = new VoiceLevel();
