// Apoio dos testes do Core (dados sintéticos, sem rede). Não é importado pelo app.
import type { CalEvent, Mail } from "../google-format.ts";
import type { GoogleReader, SessionDb } from "./types.ts";

export type Call = { table: string; op: string; args: unknown[] };

/** Cliente falso do Supabase. Imita a RLS: só devolve linhas do usuário da sessão. `eq` filtra por igualdade. */
export function fakeDb(session: string, tables: Record<string, Record<string, unknown>[]>, opts: { error?: string[]; noRls?: boolean } = {}) {
  const calls: Call[] = [];
  const db: SessionDb = {
    from(table: string) {
      const eqs: [string, unknown][] = [];
      const rows = () => (tables[table] ?? []).filter((r) => (opts.noRls || r.user_id === session) && eqs.every(([c, v]) => r[c] === v));
      const result = () => (opts.error?.includes(table) ? { data: null, error: { message: "falha" } } : { data: rows(), error: null });
      const b: Record<string, unknown> = {};
      for (const op of ["select", "or", "order", "limit", "in", "gte", "lte", "lt", "gt", "neq", "not"]) {
        b[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return b; };
      }
      b.eq = (...args: unknown[]) => { calls.push({ table, op: "eq", args }); eqs.push([String(args[0]), args[1]]); return b; };
      b.maybeSingle = async () => { const r = result(); return { data: r.data ? (r.data as unknown[])[0] ?? null : null, error: r.error }; };
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
      return b;
    },
  };
  return { db, calls };
}

export const SCOPE_CAL = "https://www.googleapis.com/auth/calendar.readonly";
export const SCOPE_MAIL = "https://www.googleapis.com/auth/gmail.readonly";

export function fakeGoogle(over: Partial<GoogleReader> & { events_?: CalEvent[]; mails_?: Mail[]; scopes?: string[]; connected?: boolean } = {}) {
  const spy = { events: 0, inbox: 0, inboxMax: 0 };
  const reader: GoogleReader = {
    status: over.status ?? (async () => ({ connected: over.connected ?? true, scopes: over.scopes ?? [SCOPE_CAL, SCOPE_MAIL] })),
    events: over.events ?? (async () => { spy.events++; return over.events_ ?? []; }),
    inbox: over.inbox ?? (async (max: number) => { spy.inbox++; spy.inboxMax = max; return over.mails_ ?? []; }),
  };
  return { reader, spy };
}
