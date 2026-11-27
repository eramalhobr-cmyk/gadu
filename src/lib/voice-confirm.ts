import { recurrenceLabel, type Recurrence } from "./calendar-recurrence.ts";
// Confirmações faladas (UX-3): depois de uma resposta por voz que propõe gravar algo (gasto, meta, evento)
// ou que já criou um lembrete, o GaDu lê o que vai gravar e aceita "sim", "não" ou "muda para…" por voz.
// O cartão continua na tela para quem prefere tocar. Só funções puras aqui; o microfone e a fala ficam no app.

export type ConfirmKind = "gasto" | "meta" | "evento" | "lembrete";
export type Answer = { kind: "yes" } | { kind: "no" } | { kind: "change"; text: string } | null;

const TZ = "America/Sao_Paulo";

/** Normaliza para comparar: minúsculas, sem acento, sem pontuação. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const YES = /^(sim|pode|pode sim|isso|isso mesmo|isso ai|confirmo|confirma|confirmado|ok|okay|beleza|claro|certo|ta certo|esta certo|correto|positivo|exato|perfeito|fechado|manda|manda ver|lanca|lancar|cria|criar|registra|registrar|salva|salvar|grava|gravar|pode lancar|pode criar|pode registrar|pode salvar|pode gravar|com certeza|uhum|aham)\b/;
const NO = /^(nao|cancela|cancelar|cancele|descarta|descartar|descarte|deixa|deixa pra la|esquece|negativo|nada|errado|ta errado|apaga|apagar|desfaz|desfazer|tira)\b/;
const CHANGE = /\b(muda|mude|mudar|troca|troque|trocar|altera|altere|alterar|corrige|corrija|corrigir|na verdade|e sim|era)\b/;

/** Entende a resposta falada. "muda para 60 reais" e "não, foi 60" viram troca (o texto vai para a conversa). */
export function parseAnswer(text: string): Answer {
  const t = norm(text);
  if (!t) return null;
  if (CHANGE.test(t)) return { kind: "change", text: text.trim() };
  if (NO.test(t)) {
    // "não, foi 60 reais": negação seguida de um conteúdo novo = troca.
    const rest = t.replace(NO, "").replace(/^(nao|obrigado|valeu)\b/, "").trim();
    return rest.split(" ").filter(Boolean).length >= 2 && /\d|\b(dia|hora|reais|real|amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(rest) ? { kind: "change", text: text.trim() } : { kind: "no" };
  }
  if (YES.test(t)) {
    // "claro que não", "sim, espera": um "sim" com negação ou pedido de pausa NÃO grava; pergunta de novo.
    return /\b(nao|nunca|espera|calma|pera|perai|mas)\b/.test(t) ? null : { kind: "yes" };
  }
  return null;
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
/** "hoje", "amanhã", "ontem" ou "sexta, dia 28". `ymd` = AAAA-MM-DD. */
export function spokenDay(ymd: string, now = new Date()): string {
  const today = dayKey(now);
  if (ymd === today) return "hoje";
  if (ymd === dayKey(new Date(now.getTime() + 86_400_000))) return "amanhã";
  if (ymd === dayKey(new Date(now.getTime() - 86_400_000))) return "ontem";
  const d = new Date(`${ymd}T12:00:00-03:00`);
  const wd = d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long" }).replace("-feira", "");
  return `${wd}, dia ${Number(ymd.slice(8, 10))}`;
}
/** "às 9h", "às 14h30". */
export function spokenTime(iso: string): string {
  const [h, m] = new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return `às ${h}h${m ? String(m).padStart(2, "0") : ""}`;
}
export function spokenMoney(n: number): string {
  const reais = Math.floor(n);
  const cent = Math.round((n - reais) * 100);
  const r = `${reais.toLocaleString("pt-BR")} ${reais === 1 ? "real" : "reais"}`;
  return cent ? `${r} e ${cent} centavos` : r;
}
function spokenNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export type ConfirmItem =
  | { kind: "gasto"; valor: number; categoria: string; descricao: string; data: string }
  | { kind: "meta"; titulo: string; acao: "registrar" | "concluir"; valor: number | null; unidade: string | null }
  | { kind: "evento"; title: string; start: string; recurrence?: Recurrence }
  | { kind: "lembrete"; text: string; dueAt: string };

const ASK = "Diga sim ou não.";

/** A pergunta falada (e mostrada em letra grande). Curta: o detalhe está no cartão. */
export function confirmQuestion(item: ConfirmItem, now = new Date()): string {
  switch (item.kind) {
    case "gasto": {
      const quando = spokenDay(item.data, now);
      const oque = item.descricao ? `${item.categoria}, ${item.descricao}` : item.categoria;
      return `Lanço o gasto de ${spokenMoney(item.valor)} em ${oque}, ${quando}?`;
    }
    case "meta":
      if (item.acao === "concluir" || item.valor === null) return `Marco a meta ${item.titulo} como concluída?`;
      return `Registro ${spokenNum(item.valor)}${item.unidade ? (item.unidade === "%" ? " por cento" : ` ${item.unidade}`) : ""} na meta ${item.titulo}?`;
    case "evento":
      return `Crio na agenda: ${item.title}, ${spokenDay(dayKey(new Date(item.start)), now)} ${spokenTime(item.start)}${item.recurrence ? `, repetindo ${recurrenceLabel(item.recurrence)}` : ""}?`;
    case "lembrete":
      return `Anotei o lembrete ${item.text}, ${spokenDay(dayKey(new Date(item.dueAt)), now)} ${spokenTime(item.dueAt)}. Está certo?`;
  }
}
export function confirmPrompt(item: ConfirmItem, now = new Date()): string {
  return `${confirmQuestion(item, now)} ${ASK}`;
}

/** O que o GaDu fala depois da resposta. */
export function resultLine(kind: string, answer: "yes" | "no", ok = true, reason = ""): string {
  if (!ok) return `${reason || "Não consegui gravar."} O cartão ficou na tela. Toque em tentar de novo.`;
  if (answer === "no") return kind === "lembrete" ? "Tudo bem, apaguei o lembrete." : kind === "tarefa_criada" ? "Tudo bem, desfiz a tarefa." : "Tudo bem, descartei.";
  const lines: Record<string, string> = { gasto: "Pronto, gasto lançado.", meta: "Pronto, meta atualizada.", evento: "Pronto, está na agenda.", lembrete: "Combinado.", tarefa_criada: "Combinado.", meta_nova: "Pronto, meta criada.", conta_paga: "Pronto, conta marcada como paga.", tarefa_ok: "Pronto, tarefa feita.", lembrete_ok: "Pronto, lembrete concluído.", projeto: "Pronto, projeto criado." };
  return lines[kind] ?? "Pronto.";
}
export const RETRY_LINE = "Não entendi. Diga sim ou não.";
export const GIVE_UP_LINE = "Tudo bem. O cartão ficou na tela para você decidir depois.";
