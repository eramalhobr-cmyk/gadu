import { ACOMPANHADOS, cotacao, resumirCotacao } from "./cotacoes.ts";

/** A lista e o host são do servidor. O provedor recebe apenas símbolos públicos. */
export async function carregarCotacoes(token: string, consultar: typeof fetch = fetch) {
  return Promise.all(ACOMPANHADOS.map(async (ativo) => {
    try {
      const url = new URL(`https://brapi.dev/api/quote/${ativo.ticker}`);
      url.search = new URLSearchParams({ range: "2y", interval: "1d" }).toString();
      const r = await consultar(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
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
}
