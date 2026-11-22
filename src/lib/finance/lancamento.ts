// Lançar gasto pela conversa: validação da PROPOSTA que o modelo devolve no bloco de controle (<<<META>>>).
// A proposta nunca grava sozinha: o app mostra um cartão e a pessoa confirma (POST /api/finance/gastos, com a sessão dela).
import { hojeSP, isoDia, lerData, ordinal } from "./datas.ts";
import { parseValor } from "./money.ts";
import { CATEGORIAS, type Meio } from "./types.ts";

export type GastoProposta = { valor: number; categoria: string; descricao: string; meio: Meio; data: string };

const sem = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const CAT = new Map<string, string>(CATEGORIAS.map((c) => [sem(c), c]));
// Apelidos comuns que o modelo pode devolver.
const CAT_ALIAS: Record<string, string> = { supermercado: "Mercado", feira: "Mercado", restaurante: "Restaurantes", lanche: "Restaurantes", gasolina: "Combustível", farmacia: "Farmácia e saúde", saude: "Farmácia e saúde", uber: "Transporte", onibus: "Transporte" };

/** Categoria da lista padrão (sem acento nem maiúscula, com apelidos) ou null. */
export function categoriaConhecida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = sem(v);
  return CAT.get(k) ?? CAT_ALIAS[k] ?? null;
}

/** Categoria da lista padrão ou "Outros". Texto livre fora da lista não é aceito aqui. */
export function normalizarCategoria(v: unknown): string {
  return categoriaConhecida(v) ?? "Outros";
}

/** "débito", "Pix", "cartão de crédito"… para o meio do banco. Sem indicação: débito. */
export function normalizarMeio(v: unknown): Meio {
  const k = typeof v === "string" ? sem(v) : "";
  if (k.includes("pix")) return "pix";
  if (k.includes("credito")) return "credito";
  if (k.includes("reserva") || k.includes("poupanca")) return "reserva";
  return "debito";
}

/**
 * Proposta válida: valor positivo; data AAAA-MM-DD existente, de até 1 ano atrás até hoje (padrão: hoje, em Brasília).
 * Devolve null se o valor ou a data forem inválidos (o app não propõe nada em vez de adivinhar).
 */
export function validGasto(o: { valor?: unknown; categoria?: unknown; descricao?: unknown; meio?: unknown; data?: unknown }, now: number = Date.now()): GastoProposta | null {
  const valor = parseValor(o.valor);
  if (valor === null) return null;
  const hoje = hojeSP(now);
  let data = hoje;
  if (o.data !== undefined && o.data !== null && o.data !== "") {
    const d = lerData(o.data);
    if (!d) return null;
    const dif = ordinal(hoje) - ordinal(d);
    if (dif < 0 || dif > 366) return null;
    data = d;
  }
  const descricao = typeof o.descricao === "string" ? o.descricao.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  return { valor, categoria: normalizarCategoria(o.categoria), descricao, meio: normalizarMeio(o.meio), data: isoDia(data) };
}
