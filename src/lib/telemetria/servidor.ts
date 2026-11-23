import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";
import { telemetriaEnabled } from "./flag.ts";
import { registrarErro } from "./registrar.ts";
import { localDaPilha, sanitizeCode, sanitizeName, sanitizeRoute, type EventoErro } from "./sanitize.ts";

type Requisicao = { path: string; method?: string; headers: Record<string, string | string[] | undefined> };

/** Pessoa da sessão pelo cookie da requisição que falhou (o servidor só registra erro de quem está logado). */
async function pessoaDaRequisicao(headers: Requisicao["headers"]): Promise<string | null> {
  const bruto = headers.cookie;
  const cookie = Array.isArray(bruto) ? bruto.join("; ") : bruto ?? "";
  if (!cookie || !SUPABASE_URL) return null;
  const pares = cookie.split(/;\s*/).map((p) => { const i = p.indexOf("="); return i < 0 ? null : { name: p.slice(0, i), value: p.slice(i + 1) }; }).filter((x): x is { name: string; value: string } => x !== null);
  const db = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll: () => pares, setAll: () => {} } });
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Chamado pelo `onRequestError` do Next (src/instrumentation.ts) quando uma rota ou página lança erro sem tratamento.
 * Guarda só nome, rota sem query, "arquivo:linha" e a versão. A mensagem do erro NÃO é lida. Nunca lança.
 */
export async function registrarErroDeRequisicao(err: unknown, request: Requisicao, statusHttp = 500): Promise<void> {
  try {
    if (!telemetriaEnabled()) return;
    const rota = sanitizeRoute(request.path);
    if (rota.startsWith("/api/telemetria")) return; // nunca registra a si mesma
    const userId = await pessoaDaRequisicao(request.headers);
    if (!userId) return;
    const e = err as { name?: unknown; code?: unknown; stack?: unknown } | null;
    const evento: EventoErro = { origem: "servidor", rota, nome: sanitizeName(e?.name), codigo: sanitizeCode(e?.code), status: statusHttp, local: localDaPilha(e?.stack) };
    await registrarErro(userId, evento);
  } catch {
    // telemetria nunca derruba a resposta
  }
}
