import { MES_COLS, loadMes } from "@/lib/finance/load";
import { idsParaMarcar } from "@/lib/finance/pagamento";
import { IdParam, ItemMesBody } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, notFound, ok, readJson } from "../../../_guard";
import { gravarMeses } from "../../../_itens";

export const dynamic = "force-dynamic";

// Valor e estado de UM item em UM mês: mudar o valor (só este mês ou deste até dezembro), zerar (valor 0 tira o item do mês),
// marcar pago/em aberto (com os vínculos de cartão e "segue"), via reserva e nota.
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const id = IdParam.safeParse((await ctx.params).id);
  if (!id.success) return invalid("Item inválido.");
  const p = ItemMesBody.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira o mês e o valor.");
  const { ano, mes, valor, pago, via_reserva, nota, escopo } = p.data;
  const db = g.a.supabase;
  const uid = g.a.user.id;

  let itens;
  try { itens = (await loadMes(db, uid, ano, mes)).itens; } catch { return dbFail(null); }
  if (!itens.some((i) => i.id === id.data)) return notFound();

  // 1. Valor: 0 remove o item do mês (ou dos próximos); > 0 grava mantendo o estado das linhas que já existem.
  if (valor === 0) {
    const del = db.from("fin_item_meses").delete().eq("item_id", id.data).eq("ano", ano);
    const { error } = await (escopo === "proximos" ? del.gte("mes", mes) : del.eq("mes", mes));
    if (error) return dbFail(error);
    return ok({ ok: true, atualizados: [id.data] });
  }
  if (valor !== undefined) {
    const r = await gravarMeses(db, uid, id.data, ano, mes, valor, escopo, { via_reserva, nota });
    if (r.error) return dbFail(r.error);
  }

  // 2. Demais campos do mês: a linha precisa existir (sem valor neste mês não há o que marcar).
  const linha = await db.from("fin_item_meses").select(MES_COLS).eq("item_id", id.data).eq("ano", ano).eq("mes", mes).maybeSingle();
  if (linha.error) return dbFail(linha.error);
  if (!linha.data) return conflitoSemValor();
  const agora = new Date().toISOString();
  const atualizados = new Set<string>([id.data]);
  if (valor === undefined && (via_reserva !== undefined || nota !== undefined)) {
    const campos: Record<string, unknown> = { updated_at: agora };
    if (via_reserva !== undefined) campos.via_reserva = via_reserva;
    if (nota !== undefined) campos.nota = nota;
    const { error } = await db.from("fin_item_meses").update(campos).eq("item_id", id.data).eq("ano", ano).eq("mes", mes);
    if (error) return dbFail(error);
  }
  if (pago !== undefined) {
    const ids = idsParaMarcar(itens, id.data) ?? [id.data];
    const { data, error } = await db.from("fin_item_meses").update({ pago, updated_at: agora }).eq("ano", ano).eq("mes", mes).in("item_id", ids).select("item_id");
    if (error) return dbFail(error);
    for (const r of (data ?? []) as { item_id: string }[]) atualizados.add(r.item_id);
  }
  return ok({ ok: true, atualizados: [...atualizados] });
}

function conflitoSemValor() {
  return Response.json({ error: "no_value", message: "Este item não tem valor neste mês. Informe o valor primeiro." }, { status: 409, headers: { "cache-control": "no-store" } });
}
