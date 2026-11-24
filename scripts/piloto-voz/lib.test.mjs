import assert from "node:assert/strict";
import { test } from "node:test";
import { cabecalhos, canonico, custo, duracaoWav, FRASES, normalizar, taxaErro, tipoAudio } from "./lib.mjs";

test("taxa de erro de palavras: ignora acento, pontuação e caixa; conta troca, falta e sobra", () => {
  assert.equal(taxaErro("Coloca café na lista.", "coloca cafe na lista"), 0);
  assert.equal(taxaErro("vamos ao parque hoje", "vamos ao parque"), 0.25, "faltou uma palavra");
  assert.equal(taxaErro("vamos ao parque hoje", "vamos no parque hoje"), 0.25, "uma trocada");
  assert.equal(taxaErro("vamos hoje", "vamos ao parque hoje"), 1, "duas sobrando em duas esperadas");
  assert.deepEqual(normalizar("Às 8h, café!"), ["as", "8h", "cafe"]);
});

test("custo pelo preço por segundo do Gateway; sem preço por segundo, null", () => {
  assert.equal(custo(60, { transcription_duration_cost_per_second: "0.000075" }).toFixed(4), "0.0045");
  assert.equal(custo(10, { audio_input_token_cost: "0.000002" }), null);
});

test("tipo e duração do áudio; cabeçalhos do endpoint de áudio", () => {
  const wav = Buffer.alloc(44 + 32000);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + 32000, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(32000, 40);
  assert.equal(tipoAudio(wav), "audio/wav");
  assert.equal(duracaoWav(wav), 1);
  assert.equal(tipoAudio(Buffer.from("ID3abcdefghijk")), "audio/mpeg");
  assert.equal(tipoAudio(Buffer.from("nada de audio aqui")), null);
  const h = cabecalhos("k", "openai/gpt-transcribe", "transcription");
  assert.equal(h["ai-transcription-model-specification-version"], "4");
  assert.equal(h["ai-model-id"], "openai/gpt-transcribe");
});

test("frases do piloto são fictícias e curtas", () => {
  for (const f of FRASES) {
    assert.ok(f.texto.length < 140, f.id);
    assert.doesNotMatch(f.texto, /@|\d{4,}/, "sem e-mail nem número longo");
  }
});

test("comparação justa: número por extenso = dígito, R$ e contrações não contam como erro", () => {
  assert.deepEqual(canonico(normalizar("cinquenta e dois reais")), ["52", "reais"]);
  assert.deepEqual(canonico(normalizar("R$52")), ["52", "reais"]);
  assert.deepEqual(canonico(normalizar("cento e vinte e três")), ["123"]);
  assert.equal(taxaErro("Gastei cinquenta e dois reais no mercado hoje.", "Gastei R$52 no mercado hoje"), 0);
  assert.equal(taxaErro("ligar para o dentista às oito", "ligar pro dentista às 8"), 0);
  assert.ok(taxaErro("Gastei cinquenta e dois reais", "Gastei 52 reais", false) > 0, "sem a forma justa, a formatação conta");
  assert.equal(taxaErro("comprar dois pães", "comprar doze pães"), 1 / 3, "número errado continua sendo erro");
});
