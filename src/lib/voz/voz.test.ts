import assert from "node:assert/strict";
import { test } from "node:test";
import { infoWav, montarWav, reduzirTaxa, volume } from "./wav.ts";
import { custoTranscricao, estimativa, modelosTranscricao, MODELOS_PADRAO, PRECO_DESCONHECIDO, transcrever, TranscricaoFalhou, transcricaoEnabled } from "./transcricao.ts";

test("WAV: monta mono 16 bits e o servidor mede a duração pelo tamanho dos dados", () => {
  const wav = montarWav(new Float32Array(16_000 * 2), 16_000);
  assert.equal(wav.length, 44 + 64_000);
  assert.deepEqual(infoWav(wav), { taxa: 16_000, canais: 1, segundos: 2 });
});

test("WAV: recusa o que não é PCM 16 bits (webm, cabeçalho falso, taxa absurda)", () => {
  assert.equal(infoWav(new Uint8Array(10)), null);
  assert.equal(infoWav(new TextEncoder().encode("\x1aE\xdf\xa3 isto parece webm e não wav, nada a ver aqui.....")), null);
  const ruim = montarWav(new Float32Array(100));
  new DataView(ruim.buffer).setUint32(24, 200_000, true);
  assert.equal(infoWav(ruim), null);
  const oito = montarWav(new Float32Array(100));
  new DataView(oito.buffer).setUint16(34, 8, true);
  assert.equal(infoWav(oito), null, "8 bits não");
});

test("WAV: reduzir de 48 kHz para 16 kHz guarda 1/3 das amostras e a média", () => {
  const r = reduzirTaxa(new Float32Array([0.3, 0.3, 0.3, 0.6, 0.6, 0.6]), 48_000);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0] - 0.3) < 1e-6 && Math.abs(r[1] - 0.6) < 1e-6);
  const igual = new Float32Array([1, 2]);
  assert.equal(reduzirTaxa(igual, 16_000), igual);
});

test("volume: silêncio é 0, onda cheia é alta", () => {
  assert.equal(volume(new Float32Array(100)), 0);
  assert.ok(volume(new Float32Array(100).fill(0.5)) > 0.49);
});

test("modelos: padrão Microsoft com OpenAI de reserva; troca pela configuração, nomes estranhos ignorados", () => {
  assert.deepEqual(modelosTranscricao({}), MODELOS_PADRAO);
  assert.deepEqual(modelosTranscricao({ TRANSCRIBE_MODELS: "openai/gpt-transcribe" }), ["openai/gpt-transcribe"]);
  assert.deepEqual(modelosTranscricao({ TRANSCRIBE_MODELS: " x , elevenlabs/scribe-v2, http://mal/x, elevenlabs/scribe-v2" }), ["elevenlabs/scribe-v2"]);
  assert.deepEqual(modelosTranscricao({ TRANSCRIBE_MODELS: "a/b,c/d,e/f,g/h" }).length, 3);
  assert.equal(transcricaoEnabled({}), true);
  assert.equal(transcricaoEnabled({ TRANSCRIBE_ENABLED: "0" }), false);
});

test("custo: por segundo arredondado para cima; modelo sem preço usa o teto; reserva pelo pior caso", () => {
  assert.equal(custoTranscricao("microsoft/mai-transcribe-2", 2.1), 3 * 0.00002778);
  assert.equal(custoTranscricao("x/y", 1), PRECO_DESCONHECIDO);
  assert.equal(estimativa(MODELOS_PADRAO, 10), 10 * 0.000075);
});

const resp = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });

test("transcrever: usa o principal; se falhar, a reserva; nada responde → erro", async () => {
  const chamados: string[] = [];
  const ok = await transcrever(new Uint8Array(50), {
    modelos: ["a/um", "b/dois"], credencial: "k", segundos: 2,
    fetchImpl: (async (_u: string, init: RequestInit) => {
      const m = (init.headers as Record<string, string>)["ai-model-id"];
      chamados.push(m);
      return m === "a/um" ? resp(400, { error: "x" }) : resp(200, { text: " Oi ", durationInSeconds: 2.5 });
    }) as typeof fetch,
  });
  assert.deepEqual(chamados, ["a/um", "b/dois"]);
  assert.equal(ok.texto, "Oi");
  assert.equal(ok.modelo, "b/dois");
  assert.equal(ok.segundos, 2.5);
  assert.equal(ok.tentativas, 2);
  await assert.rejects(transcrever(new Uint8Array(50), { modelos: ["a/um"], credencial: "k", segundos: 1, fetchImpl: (async () => { throw new Error("rede"); }) as typeof fetch }), TranscricaoFalhou);
});
