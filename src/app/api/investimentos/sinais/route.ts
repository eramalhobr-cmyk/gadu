import { z } from "zod";
import { signedIn } from "../../google/_auth";
import { carregarGrupo, carregarSinais } from "@/lib/investimentos/analise";
import { sinaisEnabled } from "@/lib/investimentos/flag";
import { acharAtivo } from "@/lib/investimentos/universo";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const Query = z.object({
  grupo: z.enum(["acompanhados", "ia", "brasil"]).default("acompanhados"),
  ticker: z.string().regex(/^[A-Za-z0-9]{2,6}$/).optional(),
}).strict();

// Sinais por grupo do universo fixo (ou de um papel). Sessão + acesso (401), interruptor (404), zod nos parâmetros (400).
// Nenhum dado da pessoa vai ao provedor: só os símbolos públicos da lista do servidor.
export async function GET(request: Request) {
  if (!sinaisEnabled()) return Response.json({ error: "disabled" }, { status: 404, headers: NO_STORE });
  if (!(await signedIn())) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  const opts = { brapiToken: process.env.BRAPI_TOKEN || undefined };
  if (q.data.ticker) {
    const ativo = acharAtivo(q.data.ticker);
    if (!ativo) return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
    return Response.json({ grupo: null, ...(await carregarSinais([ativo], opts)) }, { headers: NO_STORE });
  }
  return Response.json(await carregarGrupo(q.data.grupo, opts), { headers: NO_STORE });
}
