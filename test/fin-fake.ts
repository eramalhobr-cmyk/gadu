// Supabase falso e EM MEMÓRIA para os testes de integração de Finanças (dados sintéticos).
// Imita o que importa para segurança: a RLS (cada sessão só enxerga e altera linhas com o próprio user_id; inserir com
// outro user_id dá 42501), o default user_id = auth.uid(), upsert por chave, cascata ao apagar item e `select` encadeável.
type Row = Record<string, unknown>;
export type FinStore = Record<string, Row[]>;

let seq = 0;
// Padrões que o banco aplicaria (colunas com default). Só para as tabelas de Metas.
const DEFAULTS: Record<string, () => Row> = {
  goals: () => ({ status: "ativa", concluida_em: null, created_at: new Date().toISOString() }),
  goal_progress: () => ({ created_at: new Date().toISOString() }),
  goal_milestones: () => ({ ordem: 0, concluido_em: null }),
  pecas_3d: () => ({ valores: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  pecas_3d_versoes: () => ({ created_at: new Date(Date.now() + seq++).toISOString() }),
};
const UNIQUE: Record<string, string[]> = { goal_tasks: ["goal_id", "task_id"], goal_projects: ["goal_id", "project_id"], fin_tetos: ["user_id", "categoria"] };
const KEYS: Record<string, string[]> = { fin_item_meses: ["item_id", "ano", "mes"], fin_config: ["user_id"] };

export function makeFinDb(store: FinStore, user: () => string | null, log: { tables: string[]; writes: { table: string; op: string; rows: Row[] }[] }) {
  return {
    from(table: string) {
      log.tables.push(table);
      let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
      let payload: Row | Row[] = [];
      let conflict: string[] = [];
      let wantRows = false;
      let limitN = Infinity;
      let orderBy: [string, boolean] | null = null;
      const filters: ((r: Row) => boolean)[] = [];
      const visible = () => (store[table] ??= []).filter((r) => user() !== null && r.user_id === user());

      const exec = (): { data: unknown; error: { code: string; message: string } | null } => {
        const uid = user();
        if (uid === null) return { data: null, error: { code: "42501", message: "sem sessão" } };
        const tbl = (store[table] ??= []);
        if (op === "select") {
          let rows = visible().filter((r) => filters.every((f) => f(r)));
          if (orderBy) { const [c, asc] = orderBy; rows = [...rows].sort((a, b) => (a[c]! < b[c]! ? -1 : a[c]! > b[c]! ? 1 : 0) * (asc ? 1 : -1)); }
          return { data: rows.slice(0, limitN).map((r) => ({ ...r })), error: null };
        }
        if (op === "insert" || op === "upsert") {
          const out: Row[] = [];
          for (const p of [payload].flat() as Row[]) {
            const row: Row = { id: crypto.randomUUID(), user_id: uid, ...(DEFAULTS[table]?.() ?? {}), ...p };
            if (row.user_id !== uid) return { data: null, error: { code: "42501", message: "RLS" } };
            const uniq = UNIQUE[table];
            if (op === "insert" && uniq && tbl.some((r) => uniq.every((k) => r[k] === row[k]))) return { data: null, error: { code: "23505", message: "duplicado" } };
            const key = op === "upsert" ? conflict : [];
            const existing = key.length ? tbl.find((r) => r.user_id === uid && key.every((k) => r[k] === row[k])) : undefined;
            if (existing) { Object.assign(existing, p); out.push(existing); }
            else { tbl.push(row); out.push(row); }
          }
          log.writes.push({ table, op, rows: out.map((r) => ({ ...r })) });
          return { data: out.map((r) => ({ ...r })), error: null };
        }
        const hit = visible().filter((r) => filters.every((f) => f(r)));
        if (op === "update") {
          const p = payload as Row;
          if ("user_id" in p && p.user_id !== uid) return { data: null, error: { code: "42501", message: "RLS" } };
          for (const r of hit) Object.assign(r, p);
          log.writes.push({ table, op, rows: hit.map((r) => ({ ...r })) });
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        // delete
        store[table] = tbl.filter((r) => !hit.includes(r));
        if (table === "fin_itens") {
          const ids = new Set(hit.map((r) => r.id));
          store.fin_item_meses = (store.fin_item_meses ?? []).filter((m) => !ids.has(m.item_id));
          for (const r of store.fin_itens) for (const c of ["cartao_id", "segue_id"]) if (ids.has(r[c])) r[c] = null;
        }
        if (table === "pecas_3d") {
          const ids = new Set(hit.map((r) => r.id));
          store.pecas_3d_versoes = (store.pecas_3d_versoes ?? []).filter((r) => !ids.has(r.peca_id));
        }
        if (table === "goals") {
          const ids = new Set(hit.map((r) => r.id));
          for (const t of ["goal_progress", "goal_milestones", "goal_tasks"]) store[t] = (store[t] ?? []).filter((r) => !ids.has(r.goal_id));
        }
        log.writes.push({ table, op, rows: hit.map((r) => ({ ...r })) });
        return { data: hit.map((r) => ({ ...r })), error: null };
      };
      const result = (single?: "one" | "maybe") => {
        const r = exec();
        if (r.error || single === undefined) return r;
        const rows = (r.data as Row[]) ?? [];
        if (single === "one" && rows.length !== 1) return { data: null, error: { code: "PGRST116", message: "0 linhas" } };
        return { data: rows[0] ?? null, error: null };
      };
      const b: Record<string, unknown> = {
        select: () => { wantRows = true; return b; },
        insert: (p: Row | Row[]) => { op = "insert"; payload = p; return b; },
        upsert: (p: Row | Row[], o?: { onConflict?: string }) => { op = "upsert"; payload = p; conflict = (o?.onConflict ?? "").split(",").filter(Boolean); return b; },
        update: (p: Row) => { op = "update"; payload = p; return b; },
        delete: () => { op = "delete"; return b; },
        eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return b; },
        in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return b; },
        gte: (c: string, v: number) => { filters.push((r) => (r[c] as number) >= v); return b; },
        lte: (c: string, v: number) => { filters.push((r) => (r[c] as number) <= v); return b; },
        order: (c: string, o?: { ascending?: boolean }) => { orderBy = [c, o?.ascending !== false]; return b; },
        limit: (n: number) => { limitN = n; return b; },
        maybeSingle: () => Promise.resolve(result("maybe")),
        single: () => Promise.resolve(result("one")),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
      };
      void wantRows; void KEYS;
      return b;
    },
  };
}
