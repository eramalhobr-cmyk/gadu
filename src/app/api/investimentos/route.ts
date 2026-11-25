import { signedIn } from "../google/_auth";
import { carregarCotacoes } from "@/lib/investimentos/fonte";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await signedIn())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const token = process.env.BRAPI_TOKEN;
  if (!token) return Response.json({ error: "fonte_desligada" }, { status: 503 });
  return Response.json({ cotacoes: await carregarCotacoes(token) }, { headers: { "cache-control": "private, no-store" } });
}
