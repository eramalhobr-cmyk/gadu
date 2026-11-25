import { ACOMPANHADOS, cotacao, resumirCotacao } from "./cotacoes.ts";

const JANELAS = ["2y", "1y", "3mo", null] as const;

/** A lista e o host são do servidor. O provedor recebe apenas símbolos públicos. */
export async function carregarCotacoes(token: string, consultar: typeof fetch = fetch) {
  return Promise.all(ACOMPANHADOS.map(async (ativo) => {
    try {
      const url = new URL(`https://brapi.dev/api/quote/${ativo.ticker}`);
      const signal = AbortSignal.timeout(6500);
      for (const janela of JANELAS) {
        url.search = janela ? new URLSearchParams({ range: janela, interval: "1d" }).toString() : "";
        const r = await consultar(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          redirect: "error",
          next: { revalidate: 900 },
          signal,
        });
        if (!r.ok) {
          void r.body?.cancel().catch(() => {});
          // A brapi responde 400 se o plano não incluir a janela pedida.
          // Credencial, cota e falha do provedor não melhoram com uma janela menor.
          if (r.status === 400 && janela) continue;
          return null;
        }
        const resposta = await r.json();
        const parsed = cotacao.safeParse(Array.isArray(resposta?.results) ? resposta.results[0] : null);
        if (!parsed.success || parsed.data.symbol !== ativo.ticker) return null;
        return resumirCotacao(ativo, parsed.data);
      }
    } catch {
      return null;
    }
    return null;
  }));
}
