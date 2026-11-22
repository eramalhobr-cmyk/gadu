import { hojeSP } from "@/lib/finance/datas";
import { loadMes } from "@/lib/finance/load";
import { mesclarItens } from "@/lib/finance/month";
import { previsaoRecebimento } from "@/lib/finance/previsao";
import { MesQuery } from "@/lib/finance/schemas";
import { resumoMensal } from "@/lib/finance/summary";
import { dbFail, financeGuard, invalid, ok } from "../_guard";

export const dynamic = "force-dynamic";

// Tudo o que a tela Financeiro precisa de um mês: itens com o valor do mês, gastos, config, resumo e previsão. Só leitura.
export async function GET(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const q = MesQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return invalid("Mês inválido.");
  const { ano, mes } = q.data;
  try {
    const d = await loadMes(g.a.supabase, g.a.user.id, ano, mes);
    const hoje = hojeSP();
    return ok({
      enabled: true, ano, mes,
      config: d.config, configSalva: d.configSalva,
      itens: mesclarItens(d.itens, d.meses, ano, mes),
      gastos: d.gastos,
      resumo: resumoMensal({ itens: d.itens, meses: d.meses, gastos: d.gastos, config: d.config, ano, mes }),
      // Previsão só para o mês atual: olha daqui até o próximo recebimento.
      previsao: hoje.ano === ano && hoje.mes === mes ? previsaoRecebimento({ hoje, itens: d.itens, meses: d.meses, config: d.config }) : null,
    });
  } catch {
    return dbFail(null);
  }
}
