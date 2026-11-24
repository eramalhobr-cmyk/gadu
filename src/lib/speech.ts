"use client";
import { voiceLevel } from "./voice-level.ts";
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
  // O reconhecimento só funciona em HTTPS (ou localhost): fora disso o microfone nem é oferecido.
  if (window.isSecureContext === false) return false;
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
  let rec: Rec;
  try { rec = new Ctor(); } catch { return null; }
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

/** Tira as etiquetas de origem do Core ([T1], [L2], [A1], [E3], também agrupadas como [T1, A2]). Só para a voz: o texto exibido as mantém. */
export function stripSourceTags(text: string): string {
  return text
    .replace(/\[\s*[TLAE]\d+(?:\s*[,;]\s*[TLAE]\d+)*\s*\]/g, " ")
    .replace(/\s+([.,;:!?…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

/** Prepara o texto para soar como fala: tira etiquetas de origem, marcação, links e emojis; troca símbolos por palavras. */
export function speakable(text: string): string {
  return stripSourceTags(text)
    .replace(/\bGaDu\b/g, "Gadu")
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

/** Tempo máximo esperado para falar um trecho: se o aparelho não avisar o fim, seguimos mesmo assim. */
export function speakTimeout(text: string, rate = 1): number {
  const perSecond = 13 * Math.min(1.6, Math.max(0.7, rate || 1)); // ~13 caracteres por segundo em pt-BR
  return Math.round(4000 + (text.length / perSecond) * 1000);
}

/** Chrome do computador para de falar depois de ~15 s se não for "acordado" (pause + resume).
 * Não vale para o iPhone (não precisa) nem para o Android: lá pause() equivale a cancelar a fala, então o
 * "despertador" mataria a resposta. No Android o corte é evitado dividindo o texto em trechos curtos. */
export function needsKeepAlive(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /Chrome|Chromium|CriOS|Edg\//.test(ua) && !/iPhone|iPad|iPod|Android/.test(ua);
}

/** Respostas faladas curtas: cerca de 20 s de fala. Depois disso, o GaDu avisa que o resto está na tela. */
export const SHORT_REPLY = 280;
export const TAIL_LINE = "O resto está na tela.";

/** Tamanho máximo de um trecho falado. O Chrome do Android corta falas longas (~200 a 300 caracteres). */
export const MAX_UTTERANCE = 170;

/** Divide o texto em trechos de até `max` caracteres, preferindo o fim de frase, depois vírgula/ponto e vírgula, depois espaço.
 * Nunca perde texto: juntar os trechos com espaço devolve o texto original (sem espaços sobrando). */
export function splitForSpeech(text: string, max = MAX_UTTERANCE): string[] {
  const out: string[] = [];
  let rest = text.replace(/\s+/g, " ").trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = -1;
    // [expressão, 1 = o sinal fica no trecho; 0 = o corte é no próprio espaço]
    for (const [re, keep] of [[/[.!?…:](?=\s)/g, 1], [/[,;](?=\s)/g, 1], [/\s/g, 0]] as const) {
      let m: RegExpExecArray | null;
      let last = -1;
      while ((m = re.exec(win))) last = m.index + keep;
      if (last >= max * 0.4) { cut = last; break; }
    }
    if (cut < 0) cut = max; // palavra gigante sem espaço: corta duro
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** Fala enquanto o texto chega. A 1ª frase sai logo; as seguintes são agrupadas para soar contínuo.
 * Estabilidade: "terminou" só depois que a resposta inteira chegou (flush) e a fila esvaziou; cada trecho
 * tem um prazo (o iPhone às vezes não avisa o fim); no Chrome, um "despertador" evita que a voz trave. */
export class Speaker {
  private buffer = "";
  private queue = 0;
  private spoken = 0;
  private open = false;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  prefs: VoicePrefs = DEFAULT_VOICE;
  /** Respostas faladas curtas (UX-3): limite de caracteres falados por resposta (0 = fala tudo). O resto fica na tela. */
  maxChars = 0;
  private chars = 0;
  private cut = false;
  onIdle: () => void = () => {};
  onStart: () => void = () => {};
  private voice(): SpeechSynthesisVoice | undefined {
    const vs = listVoices();
    return (this.prefs.voiceURI && vs.find((v) => v.voiceURI === this.prefs.voiceURI)) || vs[0];
  }
  /** iOS só libera a voz depois de um toque: chame dentro do clique. */
  unlock() {
    if (!canSpeak()) return;
    window.speechSynthesis.getVoices(); // no Chrome a lista de vozes só carrega depois da primeira consulta (evento voiceschanged)
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
  /** Voltou do segundo plano (ou do bloqueio de tela): se a fala ficou em pausa, continua. */
  resumeIfPaused() {
    if (canSpeak() && this.queue > 0 && window.speechSynthesis.paused) window.speechSynthesis.resume();
  }
  /** Está falando ou ainda esperando o resto da resposta. */
  get active(): boolean {
    return this.open || this.queue > 0;
  }
  push(delta: string) {
    if (!this.open) {
      this.open = true;
      if (this.queue === 0) { this.chars = 0; this.cut = false; }
      // Voz presa de uma resposta anterior (acontece no Chrome): limpa antes de começar.
      if (this.queue === 0 && canSpeak() && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    }
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
  /** A resposta terminou de chegar: fala o que sobrou e avisa quando acabar. */
  flush() {
    if (this.buffer.trim()) this.say(this.buffer);
    this.buffer = "";
    if (this.cut) this.sayChunk(TAIL_LINE);
    this.cut = false;
    this.open = false;
    this.maybeIdle();
  }
  cancel() {
    this.chars = 0;
    this.cut = false;
    this.buffer = "";
    this.queue = 0;
    this.spoken = 0;
    this.open = false;
    this.stopTimers();
    if (canSpeak()) window.speechSynthesis.cancel();
  }
  private maybeIdle() {
    if (this.queue === 0 && !this.open && !this.buffer) {
      this.spoken = 0;
      this.stopTimers();
      this.onIdle();
    }
  }
  private stopTimers() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
  /** Frase de teste para a tela de Ajustes. */
  test(text = "Oi! Esta é a minha voz. Posso falar mais rápido ou mais devagar, como você preferir.") {
    this.cancel();
    this.say(text);
  }
  /** Fala uma frase do próprio app (confirmações, avisos), sem limite de tamanho; entra na fila depois do que já está sendo falado. */
  announce(text: string) {
    const clean = speakable(text);
    if (!clean || !canSpeak()) return;
    for (const chunk of splitForSpeech(clean)) this.sayChunk(chunk);
  }
  private say(text: string) {
    let clean = speakable(text);
    if (!clean || !/[\p{L}\p{N}]/u.test(clean) || !canSpeak() || this.cut) return;
    if (this.maxChars > 0) {
      if (this.chars > 0 && this.chars + clean.length > this.maxChars) { this.cut = true; return; }
      // Primeiro trecho já longo demais: fala só a primeira frase dele.
      if (this.chars === 0 && clean.length > this.maxChars * 1.3) { clean = splitForSpeech(clean, this.maxChars)[0]; this.cut = true; }
      this.chars += clean.length;
    }
    // Trechos curtos: o Chrome do Android corta falas longas.
    for (const chunk of splitForSpeech(clean)) this.sayChunk(chunk);
  }
  private sayChunk(clean: string) {
    if (!/[\p{L}\p{N}]/u.test(clean)) return;
    const u = new SpeechSynthesisUtterance(clean);
    const v = this.voice();
    u.lang = v?.lang || "pt-BR";
    if (v) u.voice = v;
    u.rate = Math.min(1.6, Math.max(0.7, this.prefs.rate || 1));
    u.pitch = 1;
    this.queue++;
    this.spoken++;
    if (this.queue === 1) this.onStart();
    let done = false;
    const finish = () => {
      // Um onend/onerror que chega depois de cancelar não pertence à nova fila.
      if (done || !this.timers.delete(timer)) return;
      done = true;
      this.queue = Math.max(0, this.queue - 1);
      this.maybeIdle();
    };
    // O prazo conta a partir de agora e soma a fila: trechos esperam os anteriores.
    const timer = setTimeout(finish, speakTimeout(clean, u.rate) * this.queue);
    this.timers.add(timer);
    u.onend = u.onerror = finish;
    // Palco de voz (UX-7): cada palavra falada é um impulso para o avatar. Aparelho sem esse aviso: o avatar usa a animação própria.
    u.onboundary = () => voiceLevel.pulse(0.85, performance.now());
    if (needsKeepAlive() && !this.keepAlive) {
      this.keepAlive = setInterval(() => {
        const s = window.speechSynthesis;
        if (s.speaking && !s.paused) { s.pause(); s.resume(); }
      }, 10_000);
    }
    window.speechSynthesis.speak(u);
  }
}
