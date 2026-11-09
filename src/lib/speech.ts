"use client";
// Voz grátis do próprio aparelho: reconhecimento (ouvir) e síntese (falar).
// Se o navegador não suportar, o app continua por texto.

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function canListen(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createRecognizer(handlers: {
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (code: string) => void;
}): Rec | null {
  const w = window as unknown as Record<string, new () => Rec>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "pt-BR";
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    handlers.onText((finalText + interim).trim(), false);
  };
  rec.onend = () => {
    if (finalText.trim()) handlers.onText(finalText.trim(), true);
    finalText = "";
    handlers.onEnd();
  };
  rec.onerror = (e) => handlers.onError(e.error);
  return rec;
}

export type VoicePrefs = { voiceURI: string; rate: number };
export const DEFAULT_VOICE: VoicePrefs = { voiceURI: "", rate: 1 };

/** Nota de naturalidade: vozes neurais/online soam bem menos robóticas que as locais antigas. */
function score(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 50; // Edge e Windows: "Francisca Online (Natural)"
  if (/premium|enhanced|aprimorad|melhorad/.test(n)) s += 40; // iPhone e Mac: versões de alta qualidade
  if (/google/.test(n)) s += 30; // Chrome
  if (/luciana|felipe|francisca|antonio|thalita|daniel|leila/.test(n)) s += 10;
  if (/pt[-_]br/i.test(v.lang)) s += 20;
  if (/compact|espeak/.test(n)) s -= 40;
  return s;
}

/** Vozes em português, das mais naturais para as menos. A lista pode chegar depois do carregamento. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => /^pt/i.test(v.lang))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

export function voiceLabel(v: SpeechSynthesisVoice): string {
  const name = v.name.replace(/^(Microsoft|Google|Apple)\s+/i, "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s*-\s*Portuguese.*$/i, "").trim();
  const tags = [/pt[-_]PT/i.test(v.lang) ? "Portugal" : "", score(v) >= 60 ? "natural" : "", v.localService ? "" : "online"].filter(Boolean);
  return tags.length ? `${name} · ${tags.join(", ")}` : name;
}

/** Prepara o texto para soar como fala: tira marcação, links e emojis; troca símbolos por palavras. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, " ")
    .replace(/[*#`>|_~]/g, " ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/(\d)\s*%/g, "$1 por cento")
    .replace(/R\$\s*([\d.,]+)/g, "$1 reais")
    .replace(/US\$\s*([\d.,]+)/g, "$1 dólares")
    .replace(/\be\.g\.|\bex\.:/gi, "por exemplo")
    .replace(/(\p{L})\s*\/\s*(\p{L})/gu, "$1 ou $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fala enquanto o texto chega. A 1ª frase sai logo; as seguintes são agrupadas para soar contínuo. */
export class Speaker {
  private buffer = "";
  private queue = 0;
  private spoken = 0;
  prefs: VoicePrefs = DEFAULT_VOICE;
  onIdle: () => void = () => {};
  onStart: () => void = () => {};
  private voice(): SpeechSynthesisVoice | undefined {
    const vs = listVoices();
    return (this.prefs.voiceURI && vs.find((v) => v.voiceURI === this.prefs.voiceURI)) || vs[0];
  }
  /** iOS só libera a voz depois de um toque: chame dentro do clique. */
  unlock() {
    if (!canSpeak()) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
  push(delta: string) {
    this.buffer += delta;
    // Frases curtas são juntadas (até ~220 caracteres): menos pausas e entonação mais natural.
    const min = this.spoken === 0 ? 1 : 90;
    const re = /[.!?…:\n](?=\s)/g;
    let cut = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buffer))) {
      const end = m.index + 1;
      if (end >= min) { cut = end; if (end >= 120 || this.spoken === 0) break; }
      if (end > 220) break;
    }
    if (cut > 0) {
      this.say(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut).replace(/^\s+/, "");
      this.push("");
    }
  }
  flush() {
    if (this.buffer.trim()) this.say(this.buffer);
    this.buffer = "";
    if (this.queue === 0) { this.spoken = 0; this.onIdle(); }
  }
  cancel() {
    this.buffer = "";
    this.queue = 0;
    this.spoken = 0;
    if (canSpeak()) window.speechSynthesis.cancel();
  }
  /** Frase de teste para a tela de Ajustes. */
  test(text = "Oi! Esta é a minha voz. Posso falar mais rápido ou mais devagar, como você preferir.") {
    this.cancel();
    this.say(text);
  }
  private say(text: string) {
    const clean = speakable(text);
    if (!clean || !/[\p{L}\p{N}]/u.test(clean) || !canSpeak()) return;
    const u = new SpeechSynthesisUtterance(clean);
    const v = this.voice();
    u.lang = v?.lang || "pt-BR";
    if (v) u.voice = v;
    u.rate = Math.min(1.6, Math.max(0.7, this.prefs.rate || 1));
    u.pitch = 1;
    this.queue++;
    this.spoken++;
    if (this.queue === 1) this.onStart();
    u.onend = u.onerror = () => {
      this.queue = Math.max(0, this.queue - 1);
      if (this.queue === 0 && !this.buffer) { this.spoken = 0; this.onIdle(); }
    };
    window.speechSynthesis.speak(u);
  }
}
