import { GASTO_COLS, toGasto } from "@/lib/finance/load";
import { GastoCreate, MesQuery } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, ok, readJson } from "../_guard";

export const dynamic = "force-dynamic";

// Gastos do dia a dia de um mês, do mais recente para o mais antigo.
export async function GET(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const q = MesQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Mês inválido.");
  const { data, error } = await g.a.supabase.from("fin_gastos").select(GASTO_COLS).eq("ano", q.data.ano).eq("mes", q.data.mes).order("dia", { ascending: false }).limit(1000);
  if (error) return dbFail(error);
  return ok({ gastos: ((data ?? []) as Record<string, unknown>[]).map(toGasto) });
}

// Lança um gasto. user_id = sessão (o do corpo é descartado). Usado pela tela e pelo "Lançar" do cartão de confirmação da conversa.
export async function POST(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const p = GastoCreate.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira valor, dia e meio de pagamento.");
  const { data, error } = await g.a.supabase.from("fin_gastos").insert({ ...p.data, user_id: g.a.user.id }).select(GASTO_COLS).single();
  if (error || !data) return dbFail(error);
  return ok({ gasto: toGasto(data as Record<string, unknown>) }, 201);
}
