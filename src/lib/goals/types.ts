// Tipos e constantes de Metas (base). Sem dependência de banco nem de interface.
export const CATEGORIAS = ["financeira", "familiar", "profissional", "saude", "desenvolvimento", "educacao", "personalizada"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const CATEGORIA_LABEL: Record<Categoria, string> = {
  financeira: "Financeira", familiar: "Familiar", profissional: "Profissional", saude: "Saúde e bem-estar",
  desenvolvimento: "Desenvolvimento pessoal", educacao: "Educação", personalizada: "Personalizada",
};

export const MEDICOES = ["numerica", "percentual", "marcos", "tarefas"] as const;
export type Medicao = (typeof MEDICOES)[number];
export const MEDICAO_LABEL: Record<Medicao, string> = { numerica: "Número com alvo", percentual: "Percentual", marcos: "Marcos (checklist)", tarefas: "Tarefas vinculadas" };

export const STATUS = ["ativa", "pausada", "concluida", "arquivada"] as const;
export type Status = (typeof STATUS)[number];
export const STATUS_LABEL: Record<Status, string> = { ativa: "Ativa", pausada: "Pausada", concluida: "Concluída", arquivada: "Arquivada" };

export type Agregacao = "soma" | "ultimo";
export type Origem = "manual" | "conversa" | "tarefa";
export const ORIGEM_LABEL: Record<Origem, string> = { manual: "Manual", conversa: "Conversa", tarefa: "Tarefa" };

export type Goal = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: Categoria;
  categoria_nome: string | null;
  medicao: Medicao;
  unidade: string | null;
  agregacao: Agregacao;
  valor_inicial: number;
  valor_alvo: number | null;
  inicio: string;
  prazo: string | null;
  status: Status;
  concluida_em: string | null;
};
export type Registro = { id: string; goal_id: string; valor: number; data: string; origem: Origem; nota: string | null; created_at?: string };
export type Marco = { id: string; goal_id: string; titulo: string; data_alvo: string | null; ordem: number; concluido_em: string | null };
export type TarefaVinculada = { goal_id: string; task_id: number; title: string; status: "open" | "done" | "cancelled"; due_date: string | null };

export type Situacao = "no_ritmo" | "atrasada" | "vencida" | "sem_prazo" | "sem_dados" | "batida" | "concluida" | "pausada" | "arquivada";
export const SITUACAO_LABEL: Record<Situacao, string> = {
  no_ritmo: "No ritmo", atrasada: "Atrasada", vencida: "Prazo vencido", sem_prazo: "Sem prazo", sem_dados: "Sem registros",
  batida: "Meta atingida", concluida: "Concluída", pausada: "Pausada", arquivada: "Arquivada",
};

export type Progresso = {
  /** Nenhum registro, marco ou tarefa que sustente um número: a interface diz "sem registros", nunca "0%" como se fosse medição. */
  semDados: boolean;
  /** Valor atual (numérica e percentual) ou itens feitos (marcos e tarefas). */
  atual: number;
  /** Valor alvo (numérica; 100 no percentual) ou total de itens (marcos e tarefas). */
  alvo: number;
  /** 0 a 100, arredondado. */
  pct: number;
  /** Fração exata 0 a 1 (sem arredondar), usada no ritmo. */
  fracao: number;
  /** O que falta, em unidades da meta (ou itens). Nunca negativo. */
  restante: number;
  /** Data (AAAA-MM-DD) do último registro com origem, quando existe. */
  ultimoRegistro: string | null;
};

export type Ritmo = {
  situacao: Situacao;
  /** Dias até o prazo (negativo = vencido); null sem prazo. */
  diasRestantes: number | null;
  /** Quanto do tempo já passou (0 a 100); null sem prazo. */
  esperadoPct: number | null;
  /** Quanto precisa por dia e por semana até o prazo; null sem prazo, sem dados úteis ou meta já atingida/vencida. */
  porDia: number | null;
  porSemana: number | null;
};

export type MetaView = { goal: Goal; progresso: Progresso; ritmo: Ritmo };

/** Proposta de atualização vinda da conversa, já com o id real da meta (resolvido no servidor). Só grava quando a pessoa confirma. */
export type MetaDraft = { goalId: string; titulo: string; unidade: string | null; acao: "registrar" | "concluir"; valor: number | null; data: string | null; agregacao: Agregacao };
