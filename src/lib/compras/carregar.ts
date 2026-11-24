// Busca e agrupa os pedidos da pessoa logada. Usado pela rota /api/compras e pela conversa.
// Só leitura: token do Google da própria pessoa (cifrado no banco), nada gravado.
import { accessToken, pedidosEmails } from "@/lib/google";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { agruparPedidos, GMAIL_QUERY_PEDIDOS, type Pedido } from "./pedidos";

type Db = Parameters<typeof accessToken>[0];

export async function carregarPedidos(db: Db, userId: string): Promise<{ pedidos: Pedido[]; omitidos: number }> {
  const token = await accessToken(db, userId);
  const [emails, perfil] = await Promise.all([
    pedidosEmails(token, GMAIL_QUERY_PEDIDOS),
    db.from("profiles").select("settings").eq("id", userId).maybeSingle(),
  ]);
  const settings = (perfil.data as { settings?: { blocked?: unknown } } | null)?.settings;
  const blocked = Array.isArray(settings?.blocked) ? (settings.blocked as unknown[]).map(String) : [];
  // Regra de privacidade: e-mail com termo bloqueado ou assunto sensível nem entra no agrupamento.
  const permitidos = emails.filter((e) => !isSensitive(`${e.from} ${e.subject}`) && !blockedTerm(`${e.from} ${e.subject} ${e.text}`, blocked));
  return { pedidos: agruparPedidos(permitidos), omitidos: emails.length - permitidos.length };
}
