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

/** Fala em frases conforme o texto chega, para responder mais rápido. */
export class Speaker {
  private buffer = "";
  private queue = 0;
  onIdle: () => void = () => {};
  onStart: () => void = () => {};
  private voice(): SpeechSynthesisVoice | undefined {
    const vs = window.speechSynthesis.getVoices();
    return vs.find((v) => /pt[-_]BR/i.test(v.lang) && /google|natural|luciana|felipe/i.test(v.name)) ?? vs.find((v) => /pt[-_]BR/i.test(v.lang));
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
    const m = this.buffer.match(/^([\s\S]*?[.!?…:\n])\s+/);
    if (m) {
      this.say(m[1]);
      this.buffer = this.buffer.slice(m[0].length);
      this.push("");
    }
  }
  flush() {
    if (this.buffer.trim()) this.say(this.buffer);
    this.buffer = "";
    if (this.queue === 0) this.onIdle();
  }
  cancel() {
    this.buffer = "";
    this.queue = 0;
    if (canSpeak()) window.speechSynthesis.cancel();
  }
  private say(text: string) {
    const clean = text.replace(/[*#`>|_]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean || !canSpeak()) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "pt-BR";
    u.rate = 1.05;
    const v = this.voice();
    if (v) u.voice = v;
    this.queue++;
    if (this.queue === 1) this.onStart();
    u.onend = u.onerror = () => {
      this.queue = Math.max(0, this.queue - 1);
      if (this.queue === 0 && !this.buffer) this.onIdle();
    };
    window.speechSynthesis.speak(u);
  }
}
