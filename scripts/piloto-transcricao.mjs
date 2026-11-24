// Piloto local de transcrição pelo Vercel AI Gateway (decisão de 24/11/2026: Gateway, não chave da OpenAI).
// Uso: node scripts/piloto-transcricao.mjs [--enviar] [--modelo provedor/modelo] amostra.(wav|mp3)
// Sem --enviar, só mede o áudio e estima o custo pelo preço ao vivo do Gateway. Não guarda áudio nem transcrição.
import { readFile } from "node:fs/promises";
import { cabecalhos, custo, duracaoWav, GATEWAY, MAX_BYTES, tipoAudio } from "./piloto-voz/lib.mjs";

const args = process.argv.slice(2);
const enviar = args.includes("--enviar");
const iModelo = args.indexOf("--modelo");
const modelo = iModelo >= 0 ? args[iModelo + 1] : "openai/gpt-transcribe";
const caminho = args.filter((a, i) => !a.startsWith("--") && !(iModelo >= 0 && i === iModelo + 1)).pop();

async function main() {
  if (!caminho) throw new Error("Uso: node scripts/piloto-transcricao.mjs [--enviar] [--modelo provedor/modelo] amostra.wav");
  const audio = await readFile(caminho);
  const tipo = tipoAudio(audio);
  if (!tipo || audio.length > MAX_BYTES) throw new Error("Use WAV ou MP3 de até 2 MB.");
  const precos = Object.fromEntries(((await (await fetch(`${GATEWAY}/v1/models`)).json()).data ?? []).map((m) => [m.id, m.pricing]));
  const seg = duracaoWav(audio);
  const est = seg !== null ? custo(seg, precos[modelo]) : null;
  console.log(`Áudio ${tipo}${seg !== null ? `, ${seg.toFixed(2)} s` : ""}. Modelo ${modelo}.${est !== null ? ` Estimativa: US$ ${est.toFixed(5)}.` : ""}`);
  if (!enviar) return;
  const chave = process.env.AI_GATEWAY_API_KEY;
  if (!chave) throw new Error("Configure AI_GATEWAY_API_KEY (chave do AI Gateway) no ambiente de teste.");
  const t0 = performance.now();
  const r = await fetch(`${GATEWAY}/v4/ai/transcription-model`, {
    method: "POST", headers: cabecalhos(chave, modelo, "transcription"),
    body: JSON.stringify({ audio: audio.toString("base64"), mediaType: tipo }), signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`O Gateway respondeu HTTP ${r.status}.`);
  const j = await r.json();
  if (typeof j.text !== "string" || !j.text.trim()) throw new Error("A resposta não trouxe transcrição.");
  console.log(`Transcrição em ${((performance.now() - t0) / 1000).toFixed(2)} s (${j.language ?? "?"}): ${j.text}`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
