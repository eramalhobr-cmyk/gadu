import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Criptografia dos tokens de terceiros (AES-256-GCM). A chave fica só no servidor (GOOGLE_TOKEN_KEY, 32 bytes em base64).
// O identificador da pessoa entra como dado autenticado: um token copiado para outra conta não abre.

function key(raw = process.env.GOOGLE_TOKEN_KEY ?? ""): Buffer {
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("GOOGLE_TOKEN_KEY ausente ou inválida");
  return k;
}

export function hasTokenKey(): boolean {
  try { key(); return true; } catch { return false; }
}

export function seal(plain: string, owner: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(rawKey), iv);
  c.setAAD(Buffer.from(owner));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed: string, owner: string, rawKey?: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("formato inválido");
  const d = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(owner));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
