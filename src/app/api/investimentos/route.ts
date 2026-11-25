import { signedIn } from "../google/_auth";
import { ACOMPANHADOS, cotacao, resumirCotacao } from "@/lib/investimentos/cotacoes";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await signedIn())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const token = process.env.BRAPI_TOKEN;
  if (!token) return Response.json({ error: "fonte_desligada" }, { status: 503 });

  const cotacoes = await Promise.all(ACOMPANHADOS.map(async (ativo) => {
    try {
      const url = new URL(`https://brapi.dev/api/quote/${ativo.ticker}`);
      url.search = new URLSearchParams({ range: "2y", interval: "1d" }).toString();
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(6500),
      });
      if (!r.ok) return null;
      const resposta = await r.json();
      const parsed = cotacao.safeParse(Array.isArray(resposta?.results) ? resposta.results[0] : null);
      if (!parsed.success || parsed.data.symbol !== ativo.ticker) return null;
      return resumirCotacao(ativo, parsed.data);
    } catch {
      return null;
    }
  }));
  return Response.json({ cotacoes }, { headers: { "cache-control": "private, no-store" } });
}
