// Plano do Core: qual é a intenção da mensagem e quanto contexto cabe. Regra simples, sem IA.
export type Intent = "atencao_hoje";

export type Plan = {
  intent: Intent;
  /** Máximo de fatos e de caracteres do bloco enviado ao modelo. */
  maxFacts: number;
  maxChars: number;
};

export const ATENCAO_HOJE: Plan = { intent: "atencao_hoje", maxFacts: 30, maxChars: 6000 };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Frases (já sem acento nem pontuação) que pedem a visão de atenção do dia.
const ATENCAO: RegExp[] = [
  /\bo que (merece|pede|precisa de|requer|exige) (a |de )?(minha )?atencao\b/,
  /\bo que (mais )?(merece|pede|precisa de) (de )?atencao\b/,
  /\bcomo (esta|ta|vai|anda) (o )?meu dia\b/,
  /\bcomo (esta|ta|vai) (o )?(meu )?dia de hoje\b/,
  /\bo que (esta|ta|anda|tenho|tem|ha) (de )?atrasad[oa]s?\b/,
  /\bo que (eu )?(tenho|tem|ha) (de |pra |para )?(atrasad[oa]s?)\b/,
  /\b(minhas )?(tarefas|coisas|pendencias) atrasadas\b/,
  /\bo que (ainda )?(falta|faltou) (eu )?(fazer )?(hoje|pra hoje|para hoje)\b/,
  /\bo que (e|eh) (mais )?(importante|urgente|prioridade|prioritario) (pra |para )?(hoje|agora)\b/,
  /\bo que (eu )?(preciso|devo|tenho que|tenho de) (ver|fazer|resolver|olhar) (primeiro )?(hoje|agora)\b/,
  /\bpriorizar (o )?meu dia\b/,
  /\bme ajuda a priorizar (o )?meu dia\b/,
];

/** Intenção da mensagem, ou null. Não usa o contexto da tela nem nada vindo do cliente além do texto. */
export function detectIntent(message: string): Intent | null {
  const t = norm(message.slice(0, 400));
  return ATENCAO.some((r) => r.test(t)) ? "atencao_hoje" : null;
}

export function planFor(intent: Intent, over: Partial<Pick<Plan, "maxFacts" | "maxChars">> = {}): Plan {
  void intent;
  return { ...ATENCAO_HOJE, ...over };
}
