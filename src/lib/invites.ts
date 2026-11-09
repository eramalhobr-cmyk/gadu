import { createHash, randomBytes } from "node:crypto";

// Código do convite: 32 bytes aleatórios no link; no banco só o hash SHA-256.
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export const INVITE_DAYS = 7;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
