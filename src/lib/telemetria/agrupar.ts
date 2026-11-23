// Junta os registros de erro iguais (mesma impressão digital) para o Admin e para o resumo diário.
export type LinhaErro = {
  created_at: string; origem: string; rota: string; nome: string; status: number | null;
  local_codigo: string | null; versao: string | null; impressao: string;
};
export type GrupoErro = {
  impressao: string; origem: string; rota: string; nome: string; status: number | null; local: string | null;
  versao: string | null; vezes: number; primeira: string; ultima: string;
};

/** Mais recentes primeiro. `versao` e `status` são os do registro mais recente do grupo. */
export function agrupar(linhas: LinhaErro[], max = 30): GrupoErro[] {
  const mapa = new Map<string, GrupoErro>();
  for (const l of linhas) {
    const g = mapa.get(l.impressao);
    if (!g) {
      mapa.set(l.impressao, { impressao: l.impressao, origem: l.origem, rota: l.rota, nome: l.nome, status: l.status, local: l.local_codigo, versao: l.versao, vezes: 1, primeira: l.created_at, ultima: l.created_at });
      continue;
    }
    g.vezes++;
    if (l.created_at < g.primeira) g.primeira = l.created_at;
    if (l.created_at > g.ultima) { g.ultima = l.created_at; g.status = l.status; g.versao = l.versao; }
  }
  return [...mapa.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0)).slice(0, max);
}
