// Piloto de transcrição pelo Vercel AI Gateway: funções puras (sem rede), testadas em lib.test.mjs.
// Decisão de 24/11/2026 (Eduardo): o piloto usa o AI Gateway (mesma autenticação do chat), não a chave da OpenAI.

export const GATEWAY = "https://ai-gateway.vercel.sh";
export const MODELOS_PADRAO = ["openai/gpt-transcribe", "microsoft/mai-transcribe-2", "elevenlabs/scribe-v2"];
export const MAX_BYTES = 2 * 1024 * 1024;

/** Cabeçalhos do endpoint de áudio do Gateway (docs: modalities/speech-to-text e text-to-speech). */
export function cabecalhos(chave, modelo, tipo) {
  return {
    Authorization: `Bearer ${chave}`,
    "ai-gateway-protocol-version": "0.0.1",
    [`ai-${tipo}-model-specification-version`]: "4",
    "ai-model-id": modelo,
    "Content-Type": "application/json",
  };
}

/** Tipo do áudio pelo conteúdo: WAV (RIFF/WAVE), MP3 (ID3 ou quadro MPEG) ou null. */
export function tipoAudio(buf) {
  if (buf.length < 12) return null;
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (buf.toString("ascii", 0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

/** Texto normalizado para comparar: minúsculas, sem acento nem pontuação, números por extenso não são convertidos. */
export function normalizar(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

const UNID = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZ = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CEM = { cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };

/** Forma "do que foi dito" (para não punir formatação): números por extenso viram dígitos ("cinquenta e dois" → 52),
 * "r$ 52"/"r 52" vira "52 reais", e "pro"/"pra"/"pros" contam como "para o"/"para"/"para os". */
export function canonico(palavras) {
  const out = [];
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i];
    const v = (x) => CEM[x] ?? DEZ[x] ?? UNID[x];
    if (v(w) !== undefined) {
      let total = v(w), j = i + 1;
      while (j + 1 < palavras.length && palavras[j] === "e" && v(palavras[j + 1]) !== undefined && v(palavras[j + 1]) < total) { total += v(palavras[j + 1]); j += 2; }
      out.push(String(total)); i = j - 1; continue;
    }
    if (w === "r" && /^\d+$/.test(palavras[i + 1] ?? "")) { out.push(palavras[i + 1], "reais"); i++; continue; }
    if (w === "pro") { out.push("para", "o"); continue; }
    if (w === "pros") { out.push("para", "os"); continue; }
    if (w === "pra") { out.push("para"); continue; }
    out.push(w);
  }
  return out;
}

/** Taxa de erro de palavras (WER): edições (troca, falta, sobra) ÷ palavras esperadas. 0 = perfeito.
 * `justa` (padrão) compara a forma canônica: números e contrações não contam como erro. */
export function taxaErro(esperado, obtido, justa = true) {
  const f = (t) => (justa ? canonico(normalizar(t)) : normalizar(t));
  const a = f(esperado), b = f(obtido);
  if (!a.length) return b.length ? 1 : 0;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = cur;
  }
  return ant[b.length] / a.length;
}

/** Custo estimado em US$ pelo preço ao vivo do Gateway (/v1/models): por segundo de áudio, quando houver. */
export function custo(segundos, pricing) {
  const porSeg = Number(pricing?.transcription_duration_cost_per_second);
  return Number.isFinite(porSeg) && porSeg > 0 ? segundos * porSeg : null;
}

/** Duração de um WAV PCM pelo cabeçalho (bytes de dados ÷ bytes por segundo); null se não der para ler. */
export function duracaoWav(buf) {
  if (tipoAudio(buf) !== "audio/wav" || buf.length < 44) return null;
  const bps = buf.readUInt32LE(28);
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4), tam = buf.readUInt32LE(pos + 4);
    if (id === "data") return bps > 0 ? Math.min(tam, buf.length - pos - 8) / bps : null;
    pos += 8 + tam + (tam % 2);
  }
  return null;
}

/** Frases fictícias do GaDu para o piloto (sem nome real, e-mail ou dado pessoal). */
export const FRASES = [
  { id: "lista", texto: "Coloca café, leite e pão integral na lista de compras." },
  { id: "compras", texto: "Quando chega o meu pedido da loja de eletrônicos?" },
  { id: "agenda-filhos", texto: "Pego na sexta e devolvo na segunda de manhã, o fim de semana de cinco de dezembro é comigo." },
  { id: "gasto", texto: "Gastei cinquenta e dois reais no mercado hoje." },
  { id: "lembrete", texto: "Me lembra amanhã às oito da manhã de ligar para o dentista." },
  { id: "evento", texto: "Marca pilates toda segunda às sete da manhã por dez semanas." },
];
