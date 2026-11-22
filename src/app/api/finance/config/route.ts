import { CONFIG_COLS, toConfig } from "@/lib/finance/load";
import { ConfigBody } from "@/lib/finance/schemas";
import { dbFail, financeGuard, invalid, ok, readJson } from "../_guard";

export const dynamic = "force-dynamic";

// Configuração da pessoa (uma linha): dias de recebimento (padrão 15 e 1), adiantamento, receita principal e cartão principal.
export async function GET() {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const { data, error } = await g.a.supabase.from("fin_config").select(CONFIG_COLS).maybeSingle();
  if (error) return dbFail(error);
  return ok({ config: toConfig((data as Record<string, unknown> | null) ?? null), salva: Boolean(data) });
}

export async function PUT(request: Request) {
  const g = await financeGuard();
  if ("res" in g) return g.res;
  const p = ConfigBody.safeParse(await readJson(request));
  if (!p.success) return invalid("Confira os dias e a porcentagem.");
  const db = g.a.supabase;
  // Receita principal precisa ser uma receita; cartão principal, uma despesa. Ambos da própria pessoa.
  for (const [id, tipo] of [[p.data.receita_principal_id, "receita"], [p.data.cartao_principal_id, "despesa"]] as const) {
    if (!id) continue;
    const { data, error } = await db.from("fin_itens").select("id, tipo").eq("id", id).maybeSingle();
    if (error) return dbFail(error);
    if (!data || data.tipo !== tipo) return invalid("Item inválido para esta escolha.");
  }
  const atual = await db.from("fin_config").select(CONFIG_COLS).maybeSingle();
  if (atual.error) return dbFail(atual.error);
  const juntos = { ...toConfig((atual.data as Record<string, unknown> | null) ?? null), ...Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined)) };
  const { data, error } = await db.from("fin_config").upsert({ ...juntos, user_id: g.a.user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select(CONFIG_COLS).single();
  if (error || !data) return dbFail(error);
  return ok({ config: toConfig(data as Record<string, unknown>), salva: true });
}
