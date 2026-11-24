// Resumo da "Saúde do sistema" para o painel do Admin e para a voz. Contas puras sobre os registros reais de error_events:
// nenhum número inventado e nenhum texto de pessoa (a tabela nem guarda). Dia = dia de Brasília (UTC-3).
import { sensivel } from "./privado.ts";
import { agrupar, type GrupoErro, type LinhaErro } from "./agrupar.ts";

export type PontoDia = { label: string; value: number; dia: string };
export type GrupoSaude = { impressao: string; origem: string; rota: string; nome: string; status: number | null; local: string | null; vezes: number; ultima: string };
export type Saude = {
  ligado: boolean;
  disponivel: boolean;
  total24h: number;
  total7d: number;
  servidor24h: number;
  cliente24h: number;
  hoje: { total: number; grupos: number; recente: { nome: string; rota: string; vezes: number } | null };
  grupos: GrupoSaude[];
  porDia: PontoDia[];
};

const BRT = 3 * 3_600_000;
const diaDe = (t: number) => new Date(t - BRT).toISOString().slice(0, 10);

/** Texto de um grupo só entra no painel e na voz se o detector de privacidade não marcar (registros antigos incluídos). */
function limpar(g: GrupoErro): GrupoSaude {
  const ruim = (v: string | null) => v !== null && sensivel(v);
  return { impressao: g.impressao, origem: g.origem, rota: ruim(g.rota) ? "/" : g.rota, nome: ruim(g.nome) ? "Error" : g.nome, status: g.status, local: ruim(g.local) ? null : g.local, vezes: g.vezes, ultima: g.ultima };
}

export function saudeVazia(ligado: boolean, disponivel: boolean): Saude {
  return { ligado, disponivel, total24h: 0, total7d: 0, servidor24h: 0, cliente24h: 0, hoje: { total: 0, grupos: 0, recente: null }, grupos: [], porDia: [] };
}

/** `linhas`: erros dos últimos 7 dias. Totais exatos (contagem no banco) podem vir de fora; sem eles, contam-se as linhas. */
export function resumirSaude(linhas: LinhaErro[], agora: Date, totais?: { d24h?: number | null; d7d?: number | null }): Saude {
  const t = agora.getTime();
  const l24 = linhas.filter((l) => new Date(l.created_at).getTime() >= t - 86_400_000);
  const hojeKey = diaDe(t);
  const doDia = linhas.filter((l) => diaDe(new Date(l.created_at).getTime()) === hojeKey);
  const gruposHoje = agrupar(doDia, 1000);
  const rec = gruposHoje[0];
  const porDia: PontoDia[] = [];
  for (let i = 6; i >= 0; i--) {
    const k = diaDe(t - i * 86_400_000);
    const d = new Date(`${k}T12:00:00-03:00`);
    const label = i === 0 ? "hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");
    porDia.push({ label, dia: k, value: linhas.filter((l) => diaDe(new Date(l.created_at).getTime()) === k).length });
  }
  return {
    ligado: true, disponivel: true,
    total24h: totais?.d24h ?? l24.length, total7d: totais?.d7d ?? linhas.length,
    servidor24h: l24.filter((l) => l.origem === "servidor").length, cliente24h: l24.filter((l) => l.origem === "cliente").length,
    hoje: { total: doDia.length, grupos: gruposHoje.length, recente: rec ? { nome: limpar(rec).nome, rota: limpar(rec).rota, vezes: rec.vezes } : null },
    grupos: agrupar(linhas, 10).map(limpar),
    porDia,
  };
}
