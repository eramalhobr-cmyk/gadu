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

const { Speaker, speakTimeout, speakable, stripSourceTags } = await import("./speech.ts");

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
