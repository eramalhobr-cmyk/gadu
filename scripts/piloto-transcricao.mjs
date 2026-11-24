// Piloto local: uma gravação sintética ou autorizada, sem integrar o chat ou persistir áudio.
import { open } from "node:fs/promises";

const args = process.argv.slice(2);
const executar = args[0] === "--enviar";
const caminho = executar ? args[1] : args[0];
const MAX = 44 + 20 * 16000 * 2;

async function carregarOnda() {
  const arquivo = await open(caminho, "r");
  try {
    const buffer = Buffer.alloc(MAX + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await arquivo.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    return buffer.subarray(0, total);
  } finally {
    await arquivo.close();
  }
}

async function main() {
  if (!caminho || args.length !== (executar ? 2 : 1)) {
    throw new Error("Uso: node scripts/piloto-transcricao.mjs [--enviar] amostra.wav");
  }
  const audio = await carregarOnda();
  if (audio.length <= 44 || audio.length > MAX || audio.length % 2 ||
      audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 16) !== "WAVEfmt " ||
      audio.readUInt32LE(4) !== audio.length - 8 || audio.readUInt32LE(16) !== 16 ||
      audio.readUInt16LE(20) !== 1 || audio.readUInt16LE(22) !== 1 ||
      audio.readUInt32LE(24) !== 16000 || audio.readUInt32LE(28) !== 32000 ||
      audio.readUInt16LE(32) !== 2 || audio.readUInt16LE(34) !== 16 ||
      audio.toString("ascii", 36, 40) !== "data" || audio.readUInt32LE(40) !== audio.length - 44) {
    throw new Error("Use WAV PCM mono de 16 kHz e 16 bits, de até 20 segundos, sem metadados extras.");
  }
  const segundos = (audio.length - 44) / 32000;
  console.log(`Áudio: ${segundos.toFixed(2)} s. Estimativa de transcrição: US$ ${(segundos * 0.0045 / 60).toFixed(5)}.`);
  if (!executar) return;
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("Configure OPENAI_API_KEY no ambiente de teste para enviar o áudio.");
  const form = new FormData();
  form.set("model", "gpt-transcribe");
  form.set("language", "pt");
  form.set("file", new Blob([audio], { type: "audio/wav" }), "amostra.wav");
  const inicio = performance.now();
  const resposta = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!resposta.ok) throw new Error(`A OpenAI respondeu com HTTP ${resposta.status}.`);
  const { text } = await resposta.json();
  if (typeof text !== "string" || !text.trim()) throw new Error("A resposta não trouxe uma transcrição.");
  console.log(`Transcrição em ${((performance.now() - inicio) / 1000).toFixed(2)} s: ${text}`);
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
