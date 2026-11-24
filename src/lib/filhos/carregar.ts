// Lê a configuração e os ajustes da própria pessoa (cliente da sessão + filtro por user_id, além da RLS).
import type { AjusteFilhos, ConfigFilhos } from "./agenda.ts";
import type { SessionDb } from "../core/types.ts";

export const CONFIG_COLS = "ancora, inicio, fim, feriado_segue";
export const AJUSTE_COLS = "id, tipo, data, comigo";
export const AJUSTES_MAX = 500;
export const AGENDA_FILHOS_ATUALIZADA = "gadu:agenda-filhos-atualizada";

type ConfigRow = { ancora: string; inicio: ConfigFilhos["inicio"]; fim: ConfigFilhos["fim"]; feriado_segue: boolean };
export const toConfig = (r: ConfigRow): ConfigFilhos => ({ ancora: r.ancora, inicio: r.inicio, fim: r.fim, feriadoSegue: r.feriado_segue });

export async function carregarAgenda(db: SessionDb, userId: string): Promise<{ config: ConfigFilhos | null; ajustes: AjusteFilhos[] }> {
  const [c, a] = await Promise.all([
    db.from("filhos_agenda_config").select(CONFIG_COLS).eq("user_id", userId).maybeSingle(),
    db.from("filhos_agenda_ajustes").select(AJUSTE_COLS).eq("user_id", userId).order("data").limit(AJUSTES_MAX),
  ]);
  if (c.error || a.error) throw new Error("agenda_filhos_db");
  return { config: c.data ? toConfig(c.data as ConfigRow) : null, ajustes: (a.data ?? []) as AjusteFilhos[] };
}
