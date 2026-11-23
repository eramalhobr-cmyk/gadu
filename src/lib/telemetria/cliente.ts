// Lado do navegador: avisa o servidor que algo quebrou. Manda SÓ rota, nome do erro e "arquivo:linha" (nunca a mensagem).
// No máximo MAX_POR_PAGINA avisos por carregamento e nunca o mesmo erro duas vezes. Falha em silêncio.
import { localDaPilha, sanitizeName, sanitizeRoute } from "./sanitize.ts";

const MAX_POR_PAGINA = 5;
const enviados = new Set<string>();

export function montarAviso(erro: unknown, rota: string): { rota: string; nome: string; local?: string } {
  const e = erro as { name?: unknown; stack?: unknown } | null;
  const local = localDaPilha(e?.stack);
  return { rota: sanitizeRoute(rota), nome: sanitizeName(e && typeof e === "object" ? e.name : undefined), ...(local ? { local } : {}) };
}

export function avisarErro(erro: unknown): void {
  try {
    if (typeof window === "undefined" || enviados.size >= MAX_POR_PAGINA) return;
    const aviso = montarAviso(erro, window.location.pathname);
    const chave = `${aviso.rota}|${aviso.nome}|${aviso.local ?? ""}`;
    if (enviados.has(chave)) return;
    enviados.add(chave);
    void fetch("/api/telemetria/erro", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(aviso), keepalive: true }).catch(() => {});
  } catch {
    // nunca atrapalha a tela
  }
}
