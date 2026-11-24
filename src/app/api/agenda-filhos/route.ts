import { z } from "zod";
import { consultarData, dataValida, fimsDeSemana, sabadoDe } from "@/lib/filhos/agenda";
import { CONFIG_COLS, carregarAgenda, toConfig } from "@/lib/filhos/carregar";
import { falha, filhosGuard, hojeIso, resposta } from "./_guard";

export const dynamic = "force-dynamic";

const Data = z.string().refine((v) => dataValida(v) !== null);
const Query = z.object({ semanas: z.coerce.number().int().min(1).max(52).default(12), desde: Data.optional(), consulta: Data.optional() }).strict();
const Config = z.object({ ancora: Data, inicio: z.enum(["sexta", "sabado"]), fim: z.enum(["domingo", "segunda"]), feriadoSegue: z.boolean() }).strict();

/** Configuração, ajustes, os próximos fins de semana já calculados e, se pedida, a consulta de uma data. */
export async function GET(request: Request) {
  const g = await filhosGuard();
  if (!g.ok) return g.res;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return resposta({ error: "invalid" }, 400);
  try {
    const { config, ajustes } = await carregarAgenda(g.a.supabase, g.a.user.id);
    const hoje = hojeIso();
    if (!config) return resposta({ config: null, ajustes: [], hoje, fins: [], consulta: null });
    return resposta({
      config, ajustes, hoje,
      fins: fimsDeSemana(q.data.desde ?? hoje, q.data.semanas, config, ajustes),
      consulta: q.data.consulta ? consultarData(q.data.consulta, config, ajustes) : null,
    });
  } catch {
    return falha();
  }
}

/** Define ou muda a referência. A data escolhida vira o sábado daquele fim de semana. */
export async function PUT(request: Request) {
  const g = await filhosGuard();
  if (!g.ok) return g.res;
  const input = Config.safeParse(await request.json().catch(() => null));
  if (!input.success) return resposta({ message: "Escolha uma data válida para a referência." }, 400);
  const row = { ancora: sabadoDe(input.data.ancora), inicio: input.data.inicio, fim: input.data.fim, feriado_segue: input.data.feriadoSegue, updated_at: new Date().toISOString() };
  const db = g.a.supabase;
  const upd = await db.from("filhos_agenda_config").update(row).eq("user_id", g.a.user.id).select(CONFIG_COLS).maybeSingle();
  if (upd.error) return falha(upd.error);
  if (upd.data) return resposta({ config: toConfig(upd.data) });
  const ins = await db.from("filhos_agenda_config").insert({ user_id: g.a.user.id, ...row }).select(CONFIG_COLS).single();
  return ins.error || !ins.data ? falha(ins.error) : resposta({ config: toConfig(ins.data) }, 201);
}
