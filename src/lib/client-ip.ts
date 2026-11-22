import { createHash } from "node:crypto";

/**
 * IP de quem chamou. Na Vercel, `x-real-ip` e `x-forwarded-for` são reescritos pela borda com o IP real
 * (o cliente não consegue forjar). Fora da Vercel, só confie nisso atrás de um proxy seu.
 * Sem IP legível devolve null (o limite por IP é pulado; o limite por e-mail continua valendo).
 */
export function clientIp(headers: Headers): string | null {
  const raw = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ip = raw.trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip.toLowerCase() : null;
}

/** Hash estável da chave (e-mail, IP ou token): o banco nunca recebe o valor puro. */
export function keyHash(scope: string, value: string): string {
  return createHash("sha256").update(`gadu:rl:${scope}:${value.trim().toLowerCase()}`).digest("hex");
}
