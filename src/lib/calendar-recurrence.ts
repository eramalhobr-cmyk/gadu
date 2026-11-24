import { z } from "zod";

export const Recurrence = z.object({
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(52).optional(),
  // Sempre com fim: série sem número de repetições não é aceita (evita encher a agenda para sempre).
  count: z.number().int().min(2).max(365),
}).strict();

export type Recurrence = z.infer<typeof Recurrence>;

export function recurrenceRule(rule: Recurrence): string {
  return `RRULE:FREQ=${rule.frequency}${rule.interval && rule.interval > 1 ? `;INTERVAL=${rule.interval}` : ""};COUNT=${rule.count}`;
}

export function recurrenceLabel(rule: Recurrence): string {
  const interval = rule.interval ?? 1;
  const units = { DAILY: ["dia", "dias"], WEEKLY: ["semana", "semanas"], MONTHLY: ["mês", "meses"], YEARLY: ["ano", "anos"] };
  const [one, many] = units[rule.frequency];
  return `${interval === 1 ? `a cada ${one}` : `a cada ${interval} ${many}`}, por ${rule.count} vezes no total`;
}
