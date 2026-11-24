// Gera clipes de teste com as frases fictícias do piloto, por voz sintética do AI Gateway (custo de centavos).
// Uso: AI_GATEWAY_API_KEY=... node scripts/piloto-voz/gerar-audios.mjs [pasta] [modelo] [voz]
import { mkdir, writeFile } from "node:fs/promises";
import { cabecalhos, FRASES, GATEWAY } from "./lib.mjs";

const [pasta = ".piloto-voz", modelo = "openai/tts-1", voz = "alloy"] = process.argv.slice(2);
const chave = process.env.AI_GATEWAY_API_KEY;
if (!chave) { console.error("Configure AI_GATEWAY_API_KEY (chave do AI Gateway) no ambiente de teste."); process.exit(1); }
await mkdir(pasta, { recursive: true });
for (const f of FRASES) {
  const r = await fetch(`${GATEWAY}/v4/ai/speech-model`, {
    method: "POST", headers: cabecalhos(chave, modelo, "speech"),
    body: JSON.stringify({ text: f.texto, voice: voz, outputFormat: "mp3" }), signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) { console.error(`${f.id}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); process.exitCode = 1; continue; }
  const { audio } = await r.json();
  await writeFile(`${pasta}/${f.id}.mp3`, Buffer.from(audio, "base64"));
  console.log(`${f.id}.mp3 salvo`);
}
