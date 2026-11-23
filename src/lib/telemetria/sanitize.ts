import { createHash } from "node:crypto";
import { z } from "zod";

// Telemetria de erros SEM dado pessoal. Nada de texto de mensagem, e-mail, IP, corpo de requisição ou conteúdo da pessoa.
// Só entram: de onde veio (servidor/cliente), a rota (sem query string e com ids trocados por :id), o nome do erro
// (só letras, números e _.$-), um código curto, o status HTTP, o local do código ("arquivo:linha") e a versão do deploy.

export const ORIGENS = ["servidor", "cliente"] as const;
export type Origem = (typeof ORIGENS)[number];

export type EventoErro = {
  origem: Origem;
  rota: string;
  nome: string;
  codigo: string | null;
  status: number | null;
  local: string | null;
};

const SEGMENTO_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{3,}|[A-Za-z0-9_-]{20,})$/i;

/** Só o caminho: sem endereço, query string, âncora; ids (uuid, números longos, tokens) viram `:id`. Até 200 caracteres. */
export function sanitizeRoute(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  let path = raw.trim();
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split(/[?#]/)[0];
  if (!path.startsWith("/")) return "/";
  const parts = path.split("/").map((s) => (s && SEGMENTO_ID.test(s) ? ":id" : s.replace(/[^\w@.\-~:[\]()%]/g, "")));
  const out = parts.join("/").replace(/\/{2,}/g, "/").slice(0, 200);
  return out || "/";
}

/** Nome do erro: `TypeError`, `ChunkLoadError`… Qualquer coisa diferente disso vira `Error` (o nome nunca carrega texto livre). */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "Error";
  const n = raw.trim();
  return /^[A-Za-z][A-Za-z0-9_.$-]{0,79}$/.test(n) ? n : "Error";
}

export function sanitizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim();
  return /^[A-Za-z0-9_.:-]{1,40}$/.test(c) ? c : null;
}

export function sanitizeStatus(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 100 && raw <= 599 ? raw : null;
}

/** "arquivo:linha" do primeiro quadro da pilha. Sem endereço do site, sem query, sem coluna. Qualquer outra forma vira nulo. */
export function sanitizeLocal(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").replace(/\?[^:]*/, "").replace(/^file:\/\//, "");
  const m = /^(\/?[\w@./\-[\]()~]{1,170}):(\d{1,6})(?::\d{1,6})?$/.exec(s);
  return m ? `${m[1]}:${m[2]}`.slice(0, 200) : null;
}

/** Primeiro quadro com arquivo e linha de uma pilha (`err.stack`). A MENSAGEM da pilha nunca é usada. */
export function localDaPilha(stack: unknown): string | null {
  if (typeof stack !== "string") return null;
  for (const line of stack.split("\n").slice(0, 12)) {
    const m = /(?:\(|\s)((?:https?:\/\/|file:\/\/)?[^\s()]+:\d+(?::\d+)?)\)?\s*$/.exec(line.trim());
    if (m) { const l = sanitizeLocal(m[1]); if (l) return l; }
  }
  return null;
}

/** Corpo que o navegador manda. `.strict()`: campo desconhecido (como `message`) é recusado, não ignorado. */
export const ErroClienteBody = z.object({
  rota: z.string().max(400),
  nome: z.string().max(200),
  codigo: z.string().max(100).optional(),
  local: z.string().max(400).optional(),
}).strict();

export function eventoDoCliente(body: z.infer<typeof ErroClienteBody>): EventoErro {
  return { origem: "cliente", rota: sanitizeRoute(body.rota), nome: sanitizeName(body.nome), codigo: sanitizeCode(body.codigo), status: null, local: sanitizeLocal(body.local) };
}

/** Impressão digital para agrupar erros iguais: hash de origem, rota, nome e local. Não é reversível para nenhum dado da pessoa. */
export function impressao(e: Pick<EventoErro, "origem" | "rota" | "nome" | "local">): string {
  return createHash("sha256").update([e.origem, e.rota, e.nome, e.local ?? ""].join("|")).digest("hex");
}

/** Versão do deploy (primeiros 12 caracteres do commit na Vercel) ou nulo. */
export function versaoDoDeploy(env: Record<string, string | undefined> = process.env): string | null {
  const v = (env.VERCEL_GIT_COMMIT_SHA ?? "").trim().slice(0, 12);
  return /^[0-9a-f]{7,12}$/i.test(v) ? v : null;
}
