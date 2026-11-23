import { clientIp, keyHash } from "@/lib/client-ip";
import { supabaseAdmin } from "@/lib/supabase/admin";

// S-03: limite de tentativas por IP e por e-mail nas rotas de login e convite. Janela fixa de 10 minutos, contada
// no banco (public.auth_rate_limit_hit, só service_role). Estourou: 429 em português com Retry-After.
//
// Contador indisponível (sem chave do servidor, banco fora, função ausente): NÃO trava o login de todos (fail open).
// Quem tenta adivinhar senha ainda esbarra no limite do próprio Supabase Auth, e o erro vai para o log.
// Trade-off do limite por e-mail: quem digita o e-mail de outra pessoa muitas vezes bloqueia o login dela por até
// 10 minutos. Aceito: o app é de convidados e o limite é por janela curta. Veja docs/SEGURANCA_P1_MANUAL.md.
export const WINDOW_SECONDS = 600;

export type Bucket = "password" | "otp" | "verify" | "invite";
// Máximo de tentativas por janela: [por IP, por chave (e-mail ou token do convite)].
export const LIMITS: Record<Bucket, { ip: number; key: number }> = {
  password: { ip: 20, key: 8 },
  otp: { ip: 10, key: 5 },
  verify: { ip: 20, key: 10 },
  invite: { ip: 10, key: 10 },
};

type Hit = { allowed?: unknown; retry_after?: unknown };

async function hit(db: ReturnType<typeof supabaseAdmin>, bucket: string, hash: string, limit: number): Promise<{ allowed: boolean; retryAfter: number } | null> {
  const { data, error } = await db.rpc("auth_rate_limit_hit", { p_bucket: bucket, p_key_hash: hash, p_limit: limit, p_window_seconds: WINDOW_SECONDS });
  if (error || !data || typeof data !== "object") return null;
  const d = data as Hit;
  if (typeof d.allowed !== "boolean") return null;
  return { allowed: d.allowed, retryAfter: typeof d.retry_after === "number" && d.retry_after > 0 ? Math.ceil(d.retry_after) : WINDOW_SECONDS };
}

/**
 * Conta a tentativa. Devolve uma resposta 429 pronta se passou do limite; senão null.
 * `key` é o e-mail (login) ou o token do convite; vai para o banco só com hash.
 */
export async function limitAttempts(request: Request, bucket: Bucket, key: string | null): Promise<Response | null> {
  try {
    const db = supabaseAdmin();
    const ip = clientIp(request.headers);
    const checks: Promise<{ allowed: boolean; retryAfter: number } | null>[] = [];
    if (ip) checks.push(hit(db, `${bucket}_ip`, keyHash("ip", ip), LIMITS[bucket].ip));
    if (key) checks.push(hit(db, bucket === "invite" ? "invite_token" : `${bucket}_email`, keyHash(bucket === "invite" ? "token" : "email", key), LIMITS[bucket].key));
    const results = await Promise.all(checks);
    if (results.some((r) => r === null)) console.error("limite de tentativas indisponível (seguindo sem contar)");
    const blocked = results.filter((r) => r && !r.allowed) as { allowed: boolean; retryAfter: number }[];
    if (!blocked.length) return null;
    const retryAfter = Math.max(...blocked.map((b) => b.retryAfter));
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    return Response.json(
      { error: `Muitas tentativas. Aguarde ${minutes} ${minutes === 1 ? "minuto" : "minutos"} e tente de novo.` },
      { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } },
    );
  } catch {
    console.error("limite de tentativas indisponível (seguindo sem contar)");
    return null;
  }
}

// Revisão de 23/11 (PR #22): a busca por significado chama embeddings pagos a cada pesquisa. Limite por pessoa
// (hash do id) na mesma tabela de janelas. Aqui é FAIL CLOSED: sem contador ou acima do limite, a rota não chama a
// IA e a tela segue só com a busca por texto (que não custa nada).
export const SEARCH_LIMIT = 60;

export async function allowPaidSearch(userId: string): Promise<boolean> {
  try {
    const r = await hit(supabaseAdmin(), "search_user", keyHash("user", userId), SEARCH_LIMIT);
    return r?.allowed === true;
  } catch {
    return false;
  }
}
