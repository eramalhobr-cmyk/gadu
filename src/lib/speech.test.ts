// Estabilidade da voz: o Speaker roda com uma síntese de voz simulada.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

type Utt = { text: string; onend: (() => void) | null; onerror: (() => void) | null; rate: number; lang: string; voice: unknown; pitch: number; volume: number };
const spoken: Utt[] = [];
let speaking = false;
let cancels = 0;
const synth = {
  speaking: false, paused: false,
  getVoices: () => [],
  speak: (u: Utt) => { spoken.push(u); speaking = true; synth.speaking = true; },
  cancel: () => { cancels++; synth.speaking = false; },
  pause: () => {}, resume: () => {},
};
const g = globalThis as Record<string, unknown>;
g.window = { speechSynthesis: synth };
g.SpeechSynthesisUtterance = class { text: string; onend = null; onerror = null; rate = 1; lang = ""; voice = null; pitch = 1; volume = 1; constructor(t: string) { this.text = t; } };

const { Speaker, SHORT_REPLY, TAIL_LINE, speakTimeout, speakable, stripSourceTags, splitForSpeech, MAX_UTTERANCE, needsKeepAlive, canListen, createRecognizer } = await import("./speech.ts");

beforeEach(() => { spoken.length = 0; speaking = false; cancels = 0; synth.speaking = false; });
void speaking;

test("não avisa 'terminou' no meio da resposta (modo conversa não volta a ouvir antes da hora)", () => {
  const s = new Speaker();
  let idle = 0;
  s.onIdle = () => idle++;
  s.push("Primeira frase. ");
  assert.equal(spoken.length, 1);
  spoken[0].onend?.();           // a 1ª frase acabou, mas a resposta ainda está chegando
  assert.equal(idle, 0, "ainda não terminou");
  s.push("Segunda parte da resposta que chega depois.");
  s.flush();
  assert.equal(idle, 0, "falta falar o resto");
  spoken.at(-1)?.onend?.();
  assert.equal(idle, 1, "terminou uma vez só");
  spoken.at(-1)?.onend?.();      // aviso duplicado do navegador não conta de novo
  assert.equal(idle, 1);
});

test("sem aviso de fim do aparelho, o prazo encerra a fala", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const s = new Speaker();
    let idle = 0;
    s.onIdle = () => idle++;
    s.push("Oi.");
    s.flush();
    assert.equal(idle, 0);
    mock.timers.tick(speakTimeout("Oi.") + 10);
    assert.equal(idle, 1, "seguiu mesmo sem onend");
  } finally {
    mock.timers.reset();
  }
});

test("cancelar limpa a fila e não dispara 'terminou' depois", () => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    const s = new Speaker();
    let idle = 0;
    s.onIdle = () => idle++;
    s.push("Uma frase longa o bastante. ");
    s.cancel();
    assert.equal(s.active, false);
    mock.timers.tick(60_000);
    assert.equal(idle, 0);
  } finally {
    mock.timers.reset();
  }
});

test("callback de fala cancelada não termina a resposta nova", () => {
  const speaker = new Speaker();
  let idle = 0;
  speaker.onIdle = () => idle++;
  speaker.announce("Confirmação antiga");
  const antiga = spoken[0];
  speaker.cancel();
  speaker.announce("Nova resposta");
  const nova = spoken[1];
  antiga.onerror?.();
  assert.equal(speaker.active, true);
  assert.equal(idle, 0);
  nova.onend?.();
  assert.equal(idle, 1);
});

test("voz presa de antes é limpa ao começar uma resposta nova", () => {
  synth.speaking = true;
  const s = new Speaker();
  s.push("Nova resposta. ");
  assert.equal(cancels, 1);
});

test("prazo cresce com o texto e respeita a velocidade", () => {
  assert.ok(speakTimeout("a".repeat(260)) > speakTimeout("a".repeat(26)));
  assert.ok(speakTimeout("a".repeat(260), 1.5) < speakTimeout("a".repeat(260), 1));
});

test("voz: etiquetas de origem do Core saem do texto falado, o texto original não muda", () => {
  const shown = "Você tem [T1] uma tarefa atrasada, [L2] um lembrete às 18h e [A1] reunião às 14h [E3]. Também [T1, A2] e [T1][L2].";
  assert.equal(stripSourceTags(shown), "Você tem uma tarefa atrasada, um lembrete às 18h e reunião às 14h. Também e.");
  assert.ok(!/\[[TLAE]\d+/.test(speakable(shown)));
  assert.equal(speakable("Pague o boleto [T1]."), "Pague o boleto.");
  // Colchetes que não são etiquetas ficam.
  assert.equal(stripSourceTags("Veja [anexo] e [X1] e [T]"), "Veja [anexo] e [X1] e [T]");
  assert.equal(shown.includes("[T1]"), true);
});

test("voz: o Speaker fala sem etiquetas, mesmo se chegarem em pedaços", () => {
  spoken.length = 0;
  const sp = new Speaker();
  for (const part of ["Tarefa atrasada [", "T1", "] pagar boleto. E o lembrete [L", "2] às 18h.", " Fim"]) sp.push(part);
  sp.flush();
  assert.ok(spoken.length > 0);
  assert.ok(spoken.every((u) => !/\[|T1|L2/.test(u.text)), spoken.map((u) => u.text).join(" | "));
});

test("TTS: frase longa sem pontuação vira trechos curtos e nada se perde", () => {
  const long = Array.from({ length: 70 }, (_, i) => `palavra${i}`).join(" "); // ~600 caracteres, uma "frase" só
  const parts = splitForSpeech(long);
  assert.ok(parts.length >= 4);
  assert.ok(parts.every((p) => p.length <= MAX_UTTERANCE), "todos cabem no limite");
  assert.equal(parts.join(" "), long);
});

test("TTS: prefere cortar em fim de frase e depois em vírgula", () => {
  const a = "Primeira frase bem comprida que ocupa boa parte do espaço disponível aqui. ";
  const b = "Segunda frase também comprida, com vírgula no meio, e que continua por mais um tempo até passar do limite.";
  const parts = splitForSpeech(a + b, 100);
  assert.ok(parts[0].endsWith("aqui."), parts[0]);
  assert.ok(parts.every((p) => p.length <= 100));
  assert.equal(parts.join(" "), (a + b).trim());
  assert.deepEqual(splitForSpeech("Curta."), ["Curta."]);
  assert.deepEqual(splitForSpeech(""), []);
  // palavra gigante sem espaço: corte duro, sem loop infinito
  assert.ok(splitForSpeech("x".repeat(500)).every((p) => p.length <= MAX_UTTERANCE));
});

test("TTS: o Speaker fala resposta longa em vários trechos, todos curtos", () => {
  const sp = new Speaker();
  sp.push("Um dois três quatro cinco seis sete oito nove dez ".repeat(20));
  sp.flush();
  assert.ok(spoken.length >= 3);
  assert.ok(spoken.every((u) => u.text.length <= MAX_UTTERANCE));
});

test("TTS: o 'despertador' pause/resume só no Chrome do computador (no Android pause() cancela a fala)", () => {
  assert.equal(needsKeepAlive("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36"), true);
  assert.equal(needsKeepAlive("Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36"), false);
  assert.equal(needsKeepAlive("Mozilla/5.0 (Linux; Android 16) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36"), false);
  assert.equal(needsKeepAlive("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605 Version/18 Safari/604"), false);
  assert.equal(needsKeepAlive("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/130 Mobile Safari/604"), false);
});

test("voz: sem reconhecimento (Firefox, iOS antigo) o app segue por texto; em HTTP sem contexto seguro também", () => {
  const w = g.window as Record<string, unknown>;
  assert.equal(canListen(), false);
  assert.equal(createRecognizer({ onText() {}, onEnd() {}, onError() {} }), null);
  w.webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
  assert.equal(canListen(), true);
  w.isSecureContext = false;
  assert.equal(canListen(), false, "HTTP puro: microfone não é oferecido");
  w.isSecureContext = true;
  w.webkitSpeechRecognition = class { constructor() { throw new Error("bloqueado"); } };
  assert.equal(createRecognizer({ onText() {}, onEnd() {}, onError() {} }), null, "construtor que falha não derruba o app");
  delete w.webkitSpeechRecognition;
  delete w.isSecureContext;
});

test("voz: o reconhecedor usa pt-BR e repassa o código de erro", () => {
  const w = g.window as Record<string, unknown>;
  let inst: { lang: string; onerror: ((e: { error: string }) => void) | null } | null = null;
  w.SpeechRecognition = class { lang = ""; onerror = null; start() {} stop() {} abort() {} constructor() { inst = this as never; } };
  const errs: string[] = [];
  const rec = createRecognizer({ onText() {}, onEnd() {}, onError: (c) => errs.push(c) });
  assert.ok(rec);
  assert.equal(inst!.lang, "pt-BR");
  for (const c of ["not-allowed", "no-speech", "network"]) inst!.onerror!({ error: c });
  assert.deepEqual(errs, ["not-allowed", "no-speech", "network"]);
  delete w.SpeechRecognition;
});

test("TTS: voltar do segundo plano retoma a fala pausada", () => {
  const sp = new Speaker();
  sp.push("Estou falando uma frase. ");
  let resumed = 0;
  synth.paused = true; synth.resume = () => { resumed++; };
  sp.resumeIfPaused();
  assert.equal(resumed, 1);
  synth.paused = false;
});

test("respostas curtas: fala o começo e avisa que o resto está na tela", () => {
  const s = new Speaker();
  s.maxChars = SHORT_REPLY;
  let idle = 0;
  s.onIdle = () => idle++;
  const frase = "Esta é uma frase de tamanho médio, com umas dez palavras. ";
  for (let i = 0; i < 12; i++) s.push(frase);
  s.flush();
  const falado = spoken.map((u) => u.text);
  assert.equal(falado.at(-1), TAIL_LINE);
  const total = falado.slice(0, -1).join(" ").length;
  assert.ok(total <= SHORT_REPLY + 10, `falou ${total} caracteres`);
  assert.ok(total > 50, "falou o começo");
  for (const u of [...spoken]) u.onend?.();
  assert.equal(idle, 1);
  s.cancel();
});

test("respostas curtas: resposta curta é falada inteira, sem o aviso", () => {
  const s = new Speaker();
  s.maxChars = SHORT_REPLY;
  s.push("Pronto. Lancei o gasto de 50 reais em mercado.");
  s.flush();
  assert.ok(!spoken.some((u) => u.text === TAIL_LINE));
  assert.equal(spoken.map((u) => u.text).join(" "), "Pronto. Lancei o gasto de 50 reais em mercado.");
  s.cancel();
});

test("respostas curtas: limite zerado a cada resposta; maxChars 0 fala tudo", () => {
  const s = new Speaker();
  s.maxChars = 60;
  s.push("Uma frase com mais ou menos quarenta letras. Outra frase que passaria do limite de sessenta. ");
  s.flush();
  assert.equal(spoken.at(-1)?.text, TAIL_LINE);
  for (const u of [...spoken]) u.onend?.();
  spoken.length = 0;
  s.push("Nova resposta curta.");
  s.flush();
  assert.deepEqual(spoken.map((u) => u.text), ["Nova resposta curta."]);
  for (const u of [...spoken]) u.onend?.();
  spoken.length = 0;
  s.maxChars = 0;
  s.push("Uma frase com mais ou menos quarenta letras. Outra frase que passaria do limite de sessenta. ");
  s.flush();
  assert.ok(!spoken.some((u) => u.text === TAIL_LINE));
  s.cancel();
});

test("announce fala frases do app sem limite e avisa o fim", () => {
  const s = new Speaker();
  s.maxChars = 10;
  let idle = 0;
  s.onIdle = () => idle++;
  s.announce("Lanço o gasto de 50 reais em Mercado, hoje? Diga sim ou não.");
  assert.equal(spoken.length, 1);
  assert.match(spoken[0].text, /Diga sim ou não/);
  spoken[0].onend?.();
  assert.equal(idle, 1);
  s.cancel();
});
