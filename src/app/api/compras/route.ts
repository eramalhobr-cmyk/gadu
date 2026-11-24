import { NextResponse } from "next/server";
import { comprasEnabled } from "@/lib/compras/flag";
import { carregarPedidos } from "@/lib/compras/carregar";
import { calendarioEntregas, diaSP } from "@/lib/compras/pedidos";
import { GoogleError } from "@/lib/google";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

// Compras: pedidos já feitos, lidos dos e-mails da própria pessoa (Gmail, só leitura). Nada é gravado.
export async function GET() {
  const a = await signedIn();
  if (!a) return json({ error: "unauthorized" }, 401);
  if (!comprasEnabled()) return json({ error: "disabled" }, 404);
  try {
    const { pedidos, omitidos, conta } = await carregarPedidos(a.supabase, a.user.id);
    return json({ connected: true, hoje: diaSP(new Date()), conta, pedidos, calendario: calendarioEntregas(pedidos), omitidos });
  } catch (e) {
    const kind = e instanceof GoogleError ? e.kind : "api";
    return json({ connected: kind !== "not_connected", error: kind }, kind === "not_connected" ? 200 : 502);
  }
}
