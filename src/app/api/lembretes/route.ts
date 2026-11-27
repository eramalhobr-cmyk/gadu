import { z } from "zod";
import { horarioFuturo, LEMBRETE_COLS, lerQuando, RECENTES_DIAS, textoLembrete } from "@/lib/lembretes";
import { falha, lembretesGuard, resposta } from "./_guard";

export const dynamic = "force-dynamic";

const Query = z.object({}).strict();
const Novo = z.object({ texto: z.string().max(2000), quando: z.string().max(40) }).strict();

/** Pendentes (próximos e atrasados) e, dos últimos 7 dias, os avisados e concluídos. Sempre da pessoa da sessão. */
export async function GET(request: Request) {
  const g = await lembretesGuard();
  if (!g.ok) return g.res;
  if (!Query.safeParse(Object.fromEntries(new URL(request.url).searchParams)).success) return resposta({ error: "invalid" }, 400);
  const db = g.a.supabase;
  const desde = new Date(Date.now() - RECENTES_DIAS * 86_400_000).toISOString();
  const [pend, rec] = await Promise.all([
    db.from("reminders").select(LEMBRETE_COLS).eq("user_id", g.a.user.id).eq("status", "pending").order("due_at").limit(200),
    db.from("reminders").select(LEMBRETE_COLS).eq("user_id", g.a.user.id).in("status", ["sent", "done"]).gte("due_at", desde).order("due_at", { ascending: false }).limit(50),
  ]);
  if (pend.error || rec.error || !pend.data || !rec.data) return falha(pend.error ?? rec.error, true);
  return resposta({ lembretes: [...pend.data, ...rec.data] });
}

export async function POST(request: Request) {
  const g = await lembretesGuard();
  if (!g.ok) return g.res;
  const input = Novo.safeParse(await request.json().catch(() => null));
  if (!input.success) return resposta({ error: "invalid", message: "Escreva o lembrete e escolha dia e hora." }, 400);
  const texto = textoLembrete(input.data.texto);
  if (!texto) return resposta({ error: "invalid", message: "Escreva o lembrete, até 300 letras." }, 400);
  const quando = lerQuando(input.data.quando);
  if (!quando || !horarioFuturo(quando)) return resposta({ error: "invalid", message: "Escolha um horário no futuro." }, 400);
  const { data, error } = await g.a.supabase.from("reminders")
    .insert({ user_id: g.a.user.id, text: texto, due_at: quando }).select(LEMBRETE_COLS).single();
  return error || !data ? falha(error) : resposta({ lembrete: data }, 201);
}
