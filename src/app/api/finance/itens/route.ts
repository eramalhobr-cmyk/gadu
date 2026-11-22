import { ITEM_COLS, loadMes, toItem } from "@/lib/finance/load";
import { mesclarItens } from "@/lib/finance/month";
import { ItemCreate, MesQuery } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, ok, readJson } from "../_guard";
import { checarVinculos, gravarMeses } from "../_itens";

export const dynamic = "force-dynamic";

// Lista as contas e receitas com o valor do mês pedido.
export async function GET(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const q = MesQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Mês inválido.");
  try {
    const d = await loadMes(g.a.supabase, g.a.user.id, q.data.ano, q.data.mes);
    return ok({ itens: mesclarItens(d.itens, d.meses, q.data.ano, q.data.mes) });
  } catch {
    return dbFail(null);
  }
}

// Cria uma conta ou receita (e, se vier `inicial`, o valor do mês). user_id = sessão; qualquer user_id do corpo é descartado.
export async function POST(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const p = ItemCreate.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira nome, tipo e valor.");
  const { inicial, ...campos } = p.data;
  const db = g.a.supabase;
  const v = await checarVinculos(db, campos.tipo, campos.cartao_id, campos.segue_id);
  if (v === "db") return dbFail(null);
  if (v === "invalid") return invalid("Vínculo inválido.");
  const { data, error } = await db.from("fin_itens").insert({ ...campos, user_id: g.a.user.id }).select(ITEM_COLS).single();
  if (error || !data) return dbFail(error);
  if (inicial) {
    const r = await gravarMeses(db, g.a.user.id, data.id as string, inicial.ano, inicial.mes, inicial.valor, inicial.escopo, {});
    if (r.error) {
      await db.from("fin_itens").delete().eq("id", data.id as string); // não deixa item sem o valor pedido
      return dbFail(r.error);
    }
  }
  return ok({ item: toItem(data as Record<string, unknown>) }, 201);
}
