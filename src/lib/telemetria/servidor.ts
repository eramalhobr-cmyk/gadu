import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";
import { capturarErroServidor } from "./capturar";
import { telemetriaEnabled } from "./flag.ts";

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
 * Usa o helper único `capturarErroServidor`. Sem sessão no cookie, o erro entra com user_id nulo. Nunca lança.
 */
export async function registrarErroDeRequisicao(err: unknown, request: Requisicao, statusHttp = 500): Promise<void> {
  try {
    if (!telemetriaEnabled()) return;
    const userId = await pessoaDaRequisicao(request.headers).catch(() => null);
    await capturarErroServidor(err, { rota: request.path, userId, status: statusHttp });
  } catch {
    // telemetria nunca derruba a resposta
  }
}
