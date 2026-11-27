import { z } from "zod";
import { MSG } from "@/lib/errors";
import { horarioFuturo, LEMBRETE_COLS, lerQuando, textoLembrete } from "@/lib/lembretes";
import { falha, lembretesGuard, resposta } from "../_guard";

type Contexto = { params: Promise<{ id: string }> };
const Id = z.string().regex(/^[1-9]\d{0,15}$/).transform(Number);
/**
 * Muda texto, horário e/ou situação. Horário novo rearma o aviso (pendente, sem aviso enviado), como o "adiar" da conversa.
 * `desfazer: true` só vem do botão Desfazer: aceita voltar a um horário que já passou.
 */
const Alteracao = z.object({
  texto: z.string().max(2000).optional(),
  quando: z.string().max(40).optional(),
  status: z.enum(["pending", "sent", "done", "cancelled"]).optional(),
  desfazer: z.literal(true).optional(),
}).strict().refine((o) => o.texto !== undefined || o.quando !== undefined || o.status !== undefined);

export async function PATCH(request: Request, { params }: Contexto) {
  const g = await lembretesGuard();
  if (!g.ok) return g.res;
  const id = Id.safeParse((await params).id);
  const input = Alteracao.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return resposta({ error: "invalid" }, 400);
  const mud: Record<string, unknown> = {};
  if (input.data.texto !== undefined) {
    const texto = textoLembrete(input.data.texto);
    if (!texto) return resposta({ error: "invalid", message: "Escreva o lembrete, até 300 letras." }, 400);
    mud.text = texto;
  }
  if (input.data.quando !== undefined) {
    const quando = lerQuando(input.data.quando);
    const ok = quando && (input.data.desfazer ? Math.abs(Date.parse(quando) - Date.now()) <= 3 * 366 * 86_400_000 : horarioFuturo(quando));
    if (!ok) return resposta({ error: "invalid", message: "Escolha um horário no futuro." }, 400);
    mud.due_at = quando;
    mud.status = input.data.status ?? "pending";
  }
  if (input.data.status !== undefined) mud.status = input.data.status;
  if (mud.status === "pending") mud.sent_at = null;
  const { data, error } = await g.a.supabase.from("reminders").update(mud)
    .eq("user_id", g.a.user.id).eq("id", id.data).select(LEMBRETE_COLS).maybeSingle();
  if (error) return falha(error);
  return data ? resposta({ lembrete: data }) : resposta({ error: "not_found", message: MSG.notFound }, 404);
}
