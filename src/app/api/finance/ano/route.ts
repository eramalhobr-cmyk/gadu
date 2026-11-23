import { z } from "zod";
import { hojeSP } from "@/lib/finance/datas";
import { GASTO_COLS, toGasto } from "@/lib/finance/load";
import { acumuladoAno, nomeCategoria } from "@/lib/finance/tetos";
import { dbFail, financeGuard, invalid, ok } from "../_guard";

export const dynamic = "force-dynamic";

const Query = z.object({ ano: z.coerce.number().int().min(2000).max(2100).optional(), categoria: z.string().trim().min(1).max(40).optional() });

// Totais do dia a dia no ano até hoje (por categoria e por mês). Ano passado: o ano inteiro. Só leitura, sessão + .eq("user_id").
export async function GET(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const { supabase, user } = g.a;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Ano inválido.");
  const hoje = hojeSP();
  const ano = q.data.ano ?? hoje.ano;
  if (ano > hoje.ano) return invalid("Ano no futuro.");
  const ateMes = ano === hoje.ano ? hoje.mes : 12;
  const r = await supabase.from("fin_gastos").select(GASTO_COLS).eq("user_id", user.id).eq("ano", ano).lte("mes", ateMes).limit(20000);
  if (r.error) return dbFail(r.error);
  const gastos = ((r.data ?? []) as Record<string, unknown>[]).map(toGasto);
  return ok(acumuladoAno(gastos, ano, ateMes, q.data.categoria ? nomeCategoria(q.data.categoria) : null));
}
