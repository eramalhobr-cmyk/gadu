// Tipos e constantes de Finanças (base: Contas e Dia a dia). Sem dependência de banco nem de interface.
export type Tipo = "despesa" | "receita";
export type Meio = "debito" | "pix" | "credito" | "reserva";
export type Origem = "manual" | "conversa" | "voz" | "print" | "extrato";

export const MEIOS: readonly Meio[] = ["debito", "pix", "credito", "reserva"];
export const MEIO_LABEL: Record<Meio, string> = { debito: "Débito", pix: "Pix", credito: "Crédito", reserva: "Reserva" };

/** Categorias padrão do dia a dia (especificação §3.2). Texto livre também é aceito; estas são as sugestões. */
export const CATEGORIAS = [
  "Mercado", "Restaurantes", "Combustível", "Carro", "Farmácia e saúde", "Cuidados pessoais", "Transporte", "Casa",
  "Filhos", "Presentes", "Vestuário", "Lazer", "Loteria", "Trabalho", "Compras", "Outros",
] as const;

/** Grupos sugeridos para contas fixas e receitas. */
export const GRUPOS = ["Moradia", "Família", "Pessoal", "Assinaturas", "Veículo", "Projetos", "Negócio próprio", "Receitas"] as const;

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;

export type Item = {
  id: string;
  tipo: Tipo;
  grupo: string;
  nome: string;
  nota: string | null;
  ordem: number;
  dia: number | null;
  dia_estimado: boolean;
  movivel: boolean;
  nao_caixa: boolean;
  cartao_id: string | null;
  segue_id: string | null;
};

/** Valor e estado de um item em um mês. Sem linha = o item não existe naquele mês. */
export type ItemMes = { item_id: string; ano: number; mes: number; valor: number; pago: boolean; via_reserva: boolean; nota: string | null };

export type Gasto = { id: string; ano: number; mes: number; dia: number; valor: number; categoria: string; descricao: string; meio: Meio; origem: Origem };

export type Config = {
  dia_adiantamento: number;
  dia_restante: number;
  adiantamento_pct: number;
  receita_principal_id: string | null;
  cartao_principal_id: string | null;
};

export const CONFIG_PADRAO: Config = { dia_adiantamento: 15, dia_restante: 1, adiantamento_pct: 0, receita_principal_id: null, cartao_principal_id: null };

export type YM = { ano: number; mes: number };
export type YMD = YM & { dia: number };
