// Agenda de filhos: fins de semana alternados. Puro (sem banco nem rede); datas em AAAA-MM-DD (dia local, sem fuso).
// Regra: a referência é um sábado em que as crianças ficam com a pessoa; a partir dele, alterna a cada semana, para
// frente e para trás. Uma "recorrencia" recomeça a alternância naquele sábado (mudança permanente daí em diante);
// uma "troca" muda só aquele fim de semana e não mexe na alternância.

export type Inicio = "sexta" | "sabado";
export type Fim = "domingo" | "segunda";
export type ConfigFilhos = { ancora: string; inicio: Inicio; fim: Fim; feriadoSegue: boolean };
export type AjusteFilhos = { id: string; tipo: "troca" | "recorrencia"; data: string; comigo: boolean };
export type Origem = "padrao" | "troca" | "recorrencia";
export type Feriado = { data: string; nome: string };
export type FimDeSemana = { sabado: string; de: string; ate: string; comigo: boolean; origem: Origem; feriados: Feriado[] };
export type Consulta = { dia: string; feriado: string | null; sabado: string | null; comigo: boolean | null; motivo: string };

const DIA = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const somaDias = (d: string, n: number) => toIso(toMs(d) + n * DIA);
/** 0 = domingo … 6 = sábado. */
export const diaDaSemana = (d: string) => new Date(toMs(d)).getUTCDay();

/** Data válida AAAA-MM-DD (rejeita 31/02 e afins). */
export function dataValida(v: unknown): string | null {
  if (typeof v !== "string" || !ISO.test(v)) return null;
  return toIso(toMs(v)) === v ? v : null;
}

/** Sábado do fim de semana de uma data: sexta → sábado seguinte; domingo e segunda → sábado anterior;
 * terça a quinta → o próximo sábado ("o fim de semana" daquela semana). */
export function sabadoDe(d: string): string {
  const w = diaDaSemana(d);
  const delta = w === 6 ? 0 : w === 0 ? -1 : w === 1 ? -2 : 6 - w;
  return somaDias(d, delta);
}

const semanas = (de: string, ate: string) => Math.round((toMs(ate) - toMs(de)) / (7 * DIA));

/** De quem é o fim de semana deste sábado, e por quê. */
export function comigoNo(sabado: string, cfg: ConfigFilhos, ajustes: AjusteFilhos[]): { comigo: boolean; origem: Origem } {
  const troca = ajustes.find((a) => a.tipo === "troca" && a.data === sabado);
  if (troca) return { comigo: troca.comigo, origem: "troca" };
  // Recorrência mais recente que já começou; antes de qualquer uma, vale a referência (também para trás).
  const rec = ajustes.filter((a) => a.tipo === "recorrencia" && a.data <= sabado).sort((a, b) => b.data.localeCompare(a.data))[0];
  const base = rec ? { data: rec.data, comigo: rec.comigo } : { data: cfg.ancora, comigo: true };
  const par = ((semanas(base.data, sabado) % 2) + 2) % 2 === 0;
  return { comigo: par ? base.comigo : !base.comigo, origem: rec ? "recorrencia" : "padrao" };
}

/** Páscoa (calendário gregoriano, algoritmo anônimo). */
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Feriados nacionais (e o Carnaval, ponto facultativo nacional). Feriados estaduais e municipais não entram. */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano);
  const fixos: [string, string][] = [["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"], ["09-07", "Independência"], ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"], ["11-15", "Proclamação da República"], ["11-20", "Consciência Negra"], ["12-25", "Natal"]];
  return [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome })),
    { data: somaDias(p, -48), nome: "Carnaval (segunda)" },
    { data: somaDias(p, -47), nome: "Carnaval (terça)" },
    { data: somaDias(p, -2), nome: "Sexta-feira Santa" },
    { data: somaDias(p, 60), nome: "Corpus Christi" },
  ].sort((x, y) => x.data.localeCompare(y.data));
}

export function feriadoEm(d: string): string | null {
  return feriadosNacionais(+d.slice(0, 4)).find((f) => f.data === d)?.nome ?? null;
}

/** Dias que o fim de semana ocupa (sexta ou sábado até domingo ou segunda). */
export function periodo(sabado: string, cfg: ConfigFilhos): { de: string; ate: string } {
  return { de: cfg.inicio === "sexta" ? somaDias(sabado, -1) : sabado, ate: cfg.fim === "segunda" ? somaDias(sabado, 2) : somaDias(sabado, 1) };
}

/** Feriado colado que estende o fim de semana: o dia antes do início ou o dia depois do fim. */
function feriadosColados(sabado: string, cfg: ConfigFilhos): Feriado[] {
  const { de, ate } = periodo(sabado, cfg);
  return [somaDias(de, -1), de, ate, somaDias(ate, 1)].flatMap((d) => { const n = feriadoEm(d); return n ? [{ data: d, nome: n }] : []; });
}

/** Próximos `n` fins de semana a partir da data (inclusive o fim de semana em curso). */
export function fimsDeSemana(desde: string, n: number, cfg: ConfigFilhos, ajustes: AjusteFilhos[]): FimDeSemana[] {
  const primeiro = sabadoDe(desde);
  return Array.from({ length: n }, (_, i) => {
    const sabado = somaDias(primeiro, 7 * i);
    return { sabado, ...periodo(sabado, cfg), ...comigoNo(sabado, cfg, ajustes), feriados: feriadosColados(sabado, cfg) };
  });
}

/** Com quem as crianças ficam numa data. Dia de semana sem feriado colado não tem regra (responde nulo). */
export function consultarData(dia: string, cfg: ConfigFilhos, ajustes: AjusteFilhos[]): Consulta {
  const feriado = feriadoEm(dia);
  const w = diaDaSemana(dia);
  // Candidatos: o fim de semana que termina logo antes (segunda/terça) e o que começa logo depois (quinta/sexta).
  const candidatos = w >= 2 && w <= 5 ? [somaDias(dia, 6 - w)] : [sabadoDe(dia)];
  if (w === 1 || w === 2) candidatos.push(somaDias(dia, -(w + 1)));
  for (const sabado of candidatos) {
    const { de, ate } = periodo(sabado, cfg);
    if (dia >= de && dia <= ate) {
      const c = comigoNo(sabado, cfg, ajustes);
      return { dia, feriado, sabado, comigo: c.comigo, motivo: c.origem === "troca" ? "troca combinada para esse fim de semana" : "fim de semana" };
    }
    if (feriado && cfg.feriadoSegue && (dia === somaDias(de, -1) || dia === somaDias(ate, 1))) {
      const c = comigoNo(sabado, cfg, ajustes);
      return { dia, feriado, sabado, comigo: c.comigo, motivo: "feriado colado ao fim de semana" };
    }
  }
  return { dia, feriado, sabado: null, comigo: null, motivo: feriado ? "feriado no meio da semana, sem regra definida" : "dia de semana, sem regra definida" };
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const rotuloData = (d: string) => `${DIAS_CURTOS[diaDaSemana(d)]} ${ddmm(d)}`;

/** Pergunta sobre a agenda dos filhos ("o fim de semana que vem é meu?", "as crianças ficam comigo no feriado?"). */
export function pedeFilhos(mensagem: string): boolean {
  const t = mensagem.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /\b(filhos?|filhas?|criancas?|meninos?|meninas?|guarda compartilhada|agenda de filhos)\b/.test(t)
    || (/\b(fim|fins|final|finais) de semana\b/.test(t) && /\b(meu|comigo|pego|pegar|busco|buscar|fica|ficam|revez\w*|altern\w*|troc\w*|guarda|mae dele|mae dela|pai dele|pai dela)\b/.test(t));
}

/** Bloco de contexto para o modelo: os próximos fins de semana e feriados próximos, com a regra. Só fatos calculados. */
export function blocoFilhos(cfg: ConfigFilhos | null, ajustes: AjusteFilhos[], hoje: string): string {
  const proximos = Array.from({ length: 10 }, (_, i) => somaDias(sabadoDe(hoje), 7 * i)).map((s) => `sáb ${ddmm(s)} (${s})`).join(", ");
  const calendario = `Hoje é ${DIAS_LONGOS[diaDaSemana(hoje)]}, ${ddmm(hoje)} (${hoje}). Sábados dos próximos fins de semana, em ordem: ${proximos}. O primeiro da lista é o fim de semana em curso (ou o que vem primeiro, num dia de semana); o que já passou foi o de sáb ${ddmm(somaDias(sabadoDe(hoje), -7))}.`;
  if (!cfg) return `AGENDA DE FILHOS: ainda não configurada. ${calendario}\nSe a pessoa contar com quem as crianças estão, PROPONHA a configuração pela ação "filhos_configurar" (um fim de semana com ela, mais início e fim); não mande ir para a tela. Não invente datas.`;
  const fs = fimsDeSemana(hoje, 8, cfg, ajustes).map((f) =>
    `- ${rotuloData(f.de)} a ${rotuloData(f.ate)}: ${f.comigo ? "com você" : "com o outro responsável"}${f.origem === "troca" ? " (troca)" : ""}${f.feriados.length ? ` · feriado: ${f.feriados.map((x) => `${x.nome} ${ddmm(x.data)}`).join(", ")}${cfg.feriadoSegue ? " (segue o fim de semana)" : ""}` : ""}`);
  const feriados = [...feriadosNacionais(+hoje.slice(0, 4)), ...feriadosNacionais(+hoje.slice(0, 4) + 1)].filter((f) => f.data >= hoje && f.data <= somaDias(hoje, 90))
    .map((f) => { const c = consultarData(f.data, cfg, ajustes); return `- ${rotuloData(f.data)} ${f.nome}: ${c.comigo === null ? "sem regra (dia de semana)" : c.comigo ? "com você" : "com o outro responsável"}`; });
  return `AGENDA DE FILHOS (calculada pelo app; responda só com isto, sem inventar). ${calendario}\nReferência atual: fim de semana de ${ddmm(cfg.ancora)} com você, de ${cfg.inicio} a ${cfg.fim}${cfg.feriadoSegue ? ", feriado colado segue o fim de semana" : ""}.\nPróximos fins de semana:\n${fs.join("\n")}${feriados.length ? `\nFeriados nacionais nos próximos 90 dias:\n${feriados.join("\n")}` : ""}`;
}

export type DiaCalendario = {
  dia: string;
  doMes: boolean;
  hoje: boolean;
  /** Com quem as crianças ficam (só dias de fim de semana e feriados colados); nulo = dia comum. */
  comigo: boolean | null;
  /** Sábado do fim de semana a que o dia pertence (para tocar e trocar). */
  sabado: string | null;
  troca: boolean;
  feriado: string | null;
  /** Posição na faixa do fim de semana: primeiro, meio ou último dia (para desenhar a faixa contínua). */
  faixa: "inicio" | "meio" | "fim" | "unico" | null;
};

/** Semanas (domingo a sábado) do mês, com o dono de cada dia de fim de semana. Mês de 1 a 12. */
export function mesCalendario(ano: number, mes: number, cfg: ConfigFilhos, ajustes: AjusteFilhos[], hoje: string): DiaCalendario[][] {
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const inicio = somaDias(primeiro, -diaDaSemana(primeiro));
  const ultimo = somaDias(`${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01`, -1);
  const fim = somaDias(ultimo, 6 - diaDaSemana(ultimo));
  const dias: DiaCalendario[] = [];
  for (let d = inicio; d <= fim; d = somaDias(d, 1)) {
    const c = consultarData(d, cfg, ajustes);
    const sabado = c.comigo === null ? null : c.sabado;
    dias.push({
      dia: d, doMes: d.slice(5, 7) === primeiro.slice(5, 7), hoje: d === hoje, comigo: sabado ? c.comigo : null, sabado,
      troca: Boolean(sabado && ajustes.some((a) => a.tipo === "troca" && a.data === sabado)), feriado: c.feriado, faixa: null,
    });
  }
  // Faixa contínua: dias seguidos do mesmo fim de semana, dentro da mesma linha (semana).
  for (let i = 0; i < dias.length; i++) {
    const x = dias[i];
    if (!x.sabado) continue;
    const antes = i % 7 > 0 && dias[i - 1].sabado === x.sabado;
    const depois = i % 7 < 6 && dias[i + 1]?.sabado === x.sabado;
    x.faixa = antes && depois ? "meio" : antes ? "fim" : depois ? "inicio" : "unico";
  }
  return Array.from({ length: dias.length / 7 }, (_, s) => dias.slice(s * 7, s * 7 + 7));
}

/** Resumo do mês: fins de semana (por sábado no mês) com cada responsável. */
export function resumoMes(semanas: DiaCalendario[][]): { comigo: number; outro: number } {
  const sabados = new Map<string, boolean>();
  for (const d of semanas.flat()) if (d.doMes && d.sabado && d.dia === d.sabado) sabados.set(d.sabado, Boolean(d.comigo));
  const v = [...sabados.values()];
  return { comigo: v.filter(Boolean).length, outro: v.filter((x) => !x).length };
}
