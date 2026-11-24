import type { Report } from "./checks.ts";
import { ERRO_MAX } from "./limits.ts";

// Qualidade depois da IA: funções puras que dizem se a peça montada merece UMA correção automática
// (partes soltas, malha aberta, parede fina, medida que não bate, "N mm mais alto" que não subiu N mm).
// O servidor nunca roda o OpenSCAD: quem mede é o navegador, que então pede a correção uma única vez.

/** Quanto o Z total deve mudar, se o pedido é simples ("2 mm mais alto", "deixa 3mm mais baixo"). Null = não é esse tipo de pedido. */
export function deltaAlturaPedido(pedido: string): number | null {
  const t = pedido.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, " ").replace(/\s+/g, " ");
  const n = "(\\d+(?:[.,]\\d+)?)\\s*(?:mm|milimetros?)";
  const num = (s: string) => Number(s.replace(",", "."));
  // "2 mm mais alto / mais baixa / mais grosso", "2 mm a mais de altura"
  let m = new RegExp(`${n}\\s*(?:de\\s+)?(?:a\\s+)?(mais|menos)\\s*(?:de\\s+)?(alt|baix|gros|fin|altura)`).exec(t);
  if (m) {
    const sinal = m[2] === "mais" ? (/^(alt|gros)/.test(m[3]) ? 1 : -1) : (/^(alt|gros)/.test(m[3]) ? -1 : 1);
    if (m[3] === "fin") return null;
    return sinal * num(m[1]);
  }
  // "aumenta a altura em 5 mm", "diminui a altura em 3 mm", "sobe 2 mm", "abaixa 2 mm"
  m = new RegExp(`(aument\\w*|suba?\\w*|eleva\\w*|diminu\\w*|reduz\\w*|abaix\\w*|baixa\\w*)\\s+(?:a\\s+)?(?:altura\\s+)?(?:em\\s+|uns\\s+)?${n}`).exec(t);
  if (m) return (/^(aument|sub|eleva)/.test(m[1]) ? 1 : -1) * num(m[2]);
  // "mais 2 mm de altura", "menos 3 mm de altura"
  m = new RegExp(`(mais|menos)\\s+${n}\\s+de\\s+(?:altura|espessura)`).exec(t);
  if (m) return (m[1] === "mais" ? 1 : -1) * num(m[2]);
  return null;
}

/** Tolerância no Z: um bico de 0,2 mm não enxerga menos que isso; peças grandes aceitam 5%. */
export const tolAltura = (delta: number) => Math.max(0.15, Math.abs(delta) * 0.05);

/** Mensagem se o Z total não mudou perto do pedido; null se está certo (ou se o pedido não é de altura). */
export function problemaAltura(pedido: string, zAntes: number, zDepois: number): string | null {
  const d = deltaAlturaPedido(pedido);
  if (d === null || !(zAntes > 0) || !(zDepois > 0)) return null;
  const real = zDepois - zAntes;
  if (Math.abs(real - d) <= tolAltura(d)) return null;
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `O pedido era ${d > 0 ? "+" : "−"}${f(Math.abs(d))} mm na altura, mas o Z total da peça foi de ${f(zAntes)} para ${f(zDepois)} mm (${real >= 0 ? "+" : "−"}${f(Math.abs(real))} mm). Mude o parâmetro que rege a altura TOTAL (ou o comprimento do apoio inclinado, para o Z total subir exatamente ${f(Math.abs(d))} mm), não só um detalhe interno como aba, ranhura ou relevo. Z total desejado: ${f(zAntes + d)} mm.`;
}

/** O pedido pede paredes finas de propósito? Aí a parede < 1,2 mm não dispara correção. */
export const pedeParedeFina = (pedido: string) => /\b(fin[oa]s?|delgad[oa]s?|fininh[oa]s?|bem\s+fin)/i.test(pedido.normalize("NFD").replace(/[̀-ͯ]/g, "")) || /parede[^.]{0,20}\b0[.,][0-9]/i.test(pedido);

export type EntradaQualidade = { report: Report | null; pedido: string; zAntes?: number | null; zDepois?: number | null };

/** Problemas que justificam a correção automática; lista vazia = nada a fazer. */
export function problemasQualidade({ report, pedido, zAntes, zDepois }: EntradaQualidade): string[] {
  const out: string[] = [];
  if (report) {
    for (const c of report.checks) {
      if (c.id === "partes" && c.status === "erro") out.push(`${c.mensagem} ${c.sugestao ?? ""}`.trim());
      else if (c.id === "malha" && c.status === "erro") out.push(`${c.mensagem} ${c.sugestao ?? ""}`.trim());
      else if (c.id === "tamanho" && c.status === "erro") out.push(`${c.mensagem} ${c.sugestao ?? ""}`.trim());
      else if (c.id === "medidas" && c.status === "aviso") out.push(`${c.mensagem} ${c.sugestao ?? ""}`.trim());
      else if (c.id === "parede" && c.status === "aviso" && !pedeParedeFina(pedido)) out.push(`${c.mensagem} Parede, nervura, ponta de gancho, margem de furo e traço de texto em relevo precisam de pelo menos 1,2 mm (para texto: Liberation Sans:style=Bold, size 9 ou mais).`);
    }
  }
  if (typeof zAntes === "number" && typeof zDepois === "number") {
    const a = problemaAltura(pedido, zAntes, zDepois);
    if (a) out.push(a);
  }
  return out;
}

/** Texto enviado à IA em modo "corrigir" (causa "qualidade"), cabendo no limite do campo. */
export function mensagemQualidade(problemas: string[]): string {
  return problemas.map((p, i) => `${i + 1}. ${p}`).join("\n").slice(0, ERRO_MAX);
}
