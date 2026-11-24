import { z } from "zod";
import { dataValida, sabadoDe } from "@/lib/filhos/agenda";
import { AJUSTE_COLS } from "@/lib/filhos/carregar";
import { falha, filhosGuard, resposta } from "../_guard";

export const dynamic = "force-dynamic";

const Ajuste = z.object({ tipo: z.enum(["troca", "recorrencia"]), data: z.string().refine((v) => dataValida(v) !== null), comigo: z.boolean() }).strict();

/** Cria ou muda um ajuste do fim de semana daquela data. Devolve o valor anterior, para o Desfazer. */
export async function POST(request: Request) {
  const g = await filhosGuard();
  if (!g.ok) return g.res;
  const input = Ajuste.safeParse(await request.json().catch(() => null));
  if (!input.success) return resposta({ message: "Escolha uma data válida." }, 400);
  const db = g.a.supabase;
  const uid = g.a.user.id;
  const cfg = await db.from("filhos_agenda_config").select("user_id").eq("user_id", uid).maybeSingle();
  if (cfg.error) return falha(cfg.error);
  if (!cfg.data) return resposta({ message: "Configure primeiro o fim de semana de referência." }, 409);
  const data = sabadoDe(input.data.data);
  const atual = await db.from("filhos_agenda_ajustes").select(AJUSTE_COLS).eq("user_id", uid).eq("tipo", input.data.tipo).eq("data", data).maybeSingle();
  if (atual.error) return falha(atual.error);
  if (atual.data) {
    const anterior = Boolean(atual.data.comigo);
    const upd = await db.from("filhos_agenda_ajustes").update({ comigo: input.data.comigo }).eq("user_id", uid).eq("id", atual.data.id).select(AJUSTE_COLS).maybeSingle();
    return upd.error || !upd.data ? falha(upd.error) : resposta({ ajuste: upd.data, anterior });
  }
  const ins = await db.from("filhos_agenda_ajustes").insert({ user_id: uid, tipo: input.data.tipo, data, comigo: input.data.comigo }).select(AJUSTE_COLS).single();
  return ins.error || !ins.data ? falha(ins.error) : resposta({ ajuste: ins.data, anterior: null }, 201);
}
