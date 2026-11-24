import { z } from "zod";
import { ITEM_COLS, ITENS_POR_PAGINA, nomeItem } from "@/lib/lista-compras/types";
import { falha, listaGuard, resposta } from "./_guard";

export const dynamic = "force-dynamic";

const Query = z.object({ pagina: z.coerce.number().int().min(0).max(100_000).default(0) }).strict();
const Novo = z.object({ nome: z.string() }).strict();

export async function GET(request: Request) {
  const g = await listaGuard();
  if ("res" in g) return g.res;
  const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return resposta({ error: "invalid" }, 400);
  const inicio = query.data.pagina * ITENS_POR_PAGINA;
  const { data, error } = await g.a.supabase.from("lista_compras_itens").select(ITEM_COLS)
    .eq("user_id", g.a.user.id).order("comprado").order("created_at", { ascending: false }).order("id")
    .range(inicio, inicio + ITENS_POR_PAGINA);
  if (error || !data) return falha(error);
  return resposta({ itens: data.slice(0, ITENS_POR_PAGINA), temMais: data.length > ITENS_POR_PAGINA });
}

export async function POST(request: Request) {
  const g = await listaGuard();
  if ("res" in g) return g.res;
  const input = Novo.safeParse(await request.json().catch(() => null));
  const nome = input.success ? nomeItem(input.data.nome) : null;
  if (!nome) return resposta({ message: "Digite o nome do item, até 120 caracteres." }, 400);
  const { data, error } = await g.a.supabase.from("lista_compras_itens")
    .insert({ user_id: g.a.user.id, nome }).select(ITEM_COLS).single();
  return error || !data ? falha(error) : resposta({ item: data }, 201);
}
