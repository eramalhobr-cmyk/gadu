// Compara modelos de transcrição do AI Gateway nas frases do piloto: erro de palavras, tempo e custo (preço ao vivo).
// Uso: AI_GATEWAY_API_KEY=... node scripts/piloto-voz/comparar.mjs [pasta] [modelo1,modelo2,...]
// Não guarda áudio nem transcrição em lugar nenhum além da saída do terminal (e do resumo em Markdown, se pedido com --md).
import { readFile } from "node:fs/promises";
import { cabecalhos, custo, FRASES, GATEWAY, MAX_BYTES, MODELOS_PADRAO, taxaErro, tipoAudio } from "./lib.mjs";

const args = process.argv.slice(2).filter((a) => a !== "--md");
const md = process.argv.includes("--md");
const [pasta = ".piloto-voz", lista] = args;
const modelos = lista ? lista.split(",") : MODELOS_PADRAO;
const chave = process.env.AI_GATEWAY_API_KEY;
if (!chave) { console.error("Configure AI_GATEWAY_API_KEY (chave do AI Gateway) no ambiente de teste."); process.exit(1); }

const precos = Object.fromEntries(((await (await fetch(`${GATEWAY}/v1/models`)).json()).data ?? []).map((m) => [m.id, m.pricing]));
const linhas = [];
for (const modelo of modelos) {
  const r = { modelo, erros: [], brutos: [], tempos: [], custos: [], falhas: 0, exemplos: [] };
  for (const f of FRASES) {
    const audio = await readFile(`${pasta}/${f.id}.mp3`).catch(() => null);
    if (!audio || audio.length > MAX_BYTES || !tipoAudio(audio)) { r.falhas++; continue; }
    const t0 = performance.now();
    const resp = await fetch(`${GATEWAY}/v4/ai/transcription-model`, {
      method: "POST", headers: cabecalhos(chave, modelo, "transcription"),
      body: JSON.stringify({ audio: audio.toString("base64"), mediaType: tipoAudio(audio) }), signal: AbortSignal.timeout(60_000),
    });
    const seg = (performance.now() - t0) / 1000;
    if (!resp.ok) { r.falhas++; console.error(`${modelo} ${f.id}: HTTP ${resp.status} ${(await resp.text()).slice(0, 160)}`); continue; }
    const j = await resp.json();
    const texto = String(j.text ?? "");
    r.erros.push(taxaErro(f.texto, texto)); r.brutos.push(taxaErro(f.texto, texto, false)); r.tempos.push(seg);
    const c = custo(Number(j.durationInSeconds) || 0, precos[modelo]); if (c !== null) r.custos.push(c);
    r.exemplos.push({ id: f.id, texto });
    console.log(`${modelo} · ${f.id} · erro ${(taxaErro(f.texto, texto) * 100).toFixed(0)}% · ${seg.toFixed(2)} s · "${texto}"`);
  }
  linhas.push(r);
}
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
console.log("\nResumo");
const tabela = ["| Modelo | Erro de palavras (justo) | Erro bruto | Tempo médio | Custo (6 frases) | Falhas |", "|---|---|---|---|---|---|",
  ...linhas.map((r) => `| \`${r.modelo}\` | ${(media(r.erros) * 100).toFixed(1)}% | ${(media(r.brutos) * 100).toFixed(1)}% | ${media(r.tempos).toFixed(2)} s | ${r.custos.length ? `US$ ${r.custos.reduce((a, b) => a + b, 0).toFixed(5)}` : "—"} | ${r.falhas} |`)];
console.log(tabela.join("\n"));
if (md) console.log(`\n<!-- exemplos -->\n${linhas.map((r) => `- \`${r.modelo}\`: ${r.exemplos.map((e) => `${e.id}: "${e.texto}"`).join(" · ")}`).join("\n")}`);
