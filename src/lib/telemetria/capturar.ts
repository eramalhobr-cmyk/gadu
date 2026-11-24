import { avaliarEAvisar } from "./avisar";
import { telemetriaEnabled } from "./flag.ts";
import { registrarErro } from "./registrar";
import { localDaPilha, protegerEvento, sanitizeCode, sanitizeName, sanitizeRoute, sanitizeStatus, type EventoErro } from "./sanitize.ts";

export type OpcoesCaptura = {
  /** Rota ou nome estável da origem ("/api/chat"). Query string e ids são limpos. */
  rota: string;
  /** Pessoa da sessão, se houver. Nunca vem do corpo da requisição. */
  userId?: string | null;
  /** Status HTTP que a rota respondeu (padrão 500). */
  status?: number;
};

/** Monta o evento só com campos seguros: a MENSAGEM do erro nunca é lida. */
export function eventoDoServidor(err: unknown, o: OpcoesCaptura): EventoErro {
  const e = err as { name?: unknown; code?: unknown; stack?: unknown } | null;
  return protegerEvento({
    origem: "servidor", rota: sanitizeRoute(o.rota), nome: sanitizeName(e?.name), codigo: sanitizeCode(e?.code),
    status: sanitizeStatus(o.status ?? 500), local: localDaPilha(e?.stack),
  });
}

/** Roda em segundo plano depois da resposta (Next `after`); fora de uma requisição, só dispara e segue. */
async function emSegundoPlano(tarefa: () => Promise<unknown>) {
  try {
    const m = (await import("next/server")) as { after?: (f: () => Promise<unknown>) => void; default?: { after?: (f: () => Promise<unknown>) => void } };
    const depois = m.after ?? m.default?.after;
    if (!depois) throw new Error("sem after");
    depois(tarefa);
  } catch {
    void tarefa().catch(() => {});
  }
}

/**
 * Ponto único de captura de erro do servidor (rotas, IA, 3D, cron, `onRequestError`). NUNCA lança e nunca atrasa a resposta
 * além do insert: respeita TELEMETRIA_ENABLED, sanitiza (sem mensagem, sem query, ids viram :id), passa pelo detector
 * de dado sensível e grava; o alerta (push ao administrador, com throttle) roda em segundo plano depois do insert.
 * Erros de gravação e de alerta são engolidos: monitoramento nunca derruba o app.
 */
export async function capturarErroServidor(err: unknown, o: OpcoesCaptura): Promise<void> {
  try {
    if (!telemetriaEnabled()) return;
    const evento = eventoDoServidor(err, o);
    if (evento.rota.startsWith("/api/telemetria")) return; // nunca registra a si mesma
    const r = await registrarErro(o.userId ?? null, evento);
    if (r === "gravado") await emSegundoPlano(() => avaliarEAvisar(evento));
  } catch {
    // telemetria nunca derruba a resposta
  }
}
