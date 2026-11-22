import { metasAtencao, ritmoTexto } from "@/lib/goals/calc";
import { loadMetas } from "@/lib/goals/load";
import { goalsGuard, hojeIso, ok, unavailable } from "../_guard";

export const dynamic = "force-dynamic";

// Resumo para a tela Hoje: contagens e as metas que pedem atenção (atrasadas, vencidas ou com prazo próximo). Sem IA.
export async function GET() {
  const g = await goalsGuard();
  if ("res" in g) return g.res;
  try {
    const metas = await loadMetas(g.a.supabase, g.a.user.id, hojeIso());
    const ativas = metas.filter((m) => m.goal.status === "ativa");
    return ok({
      enabled: true,
      total: metas.length,
      ativas: ativas.length,
      pausadas: metas.filter((m) => m.goal.status === "pausada").length,
      concluidas: metas.filter((m) => m.goal.status === "concluida").length,
      atrasadas: ativas.filter((m) => m.ritmo.situacao === "atrasada" || m.ritmo.situacao === "vencida").length,
      atencao: metasAtencao(ativas).map((m) => ({ id: m.goal.id, titulo: m.goal.titulo, situacao: m.ritmo.situacao, pct: m.progresso.pct, semDados: m.progresso.semDados, prazo: m.goal.prazo, texto: ritmoTexto(m) })),
    });
  } catch {
    return unavailable();
  }
}
