// Google (Agenda e Gmail), só leitura. Fluxo OAuth com PKCE; token de renovação guardado criptografado.
import { createHash, randomBytes } from "node:crypto";
import { hasTokenKey, open, seal } from "@/lib/crypto";
import type { supabaseServer } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  // Criar eventos (sempre com confirmação da pessoa). Opcional: quem conectou antes continua lendo.
  "https://www.googleapis.com/auth/calendar.events",
];
export const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/gmail.readonly"];
export const WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TZ = "America/Sao_Paulo";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && hasTokenKey());
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("base64url") };
}

export function authUrl(redirectUri: string, state: string, challenge: string, loginHint?: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return u.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", ...params }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (!r.ok || !j.access_token) throw new GoogleError(j.error === "invalid_grant" ? "revoked" : "token");
  return j;
}

export class GoogleError extends Error {
  constructor(public kind: "revoked" | "token" | "api" | "not_connected" | "scope") { super(kind); }
}

/** E-mail da conta Google, lido do id_token que veio direto do Google por TLS. */
function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from((idToken ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string };
    return typeof payload.email === "string" ? payload.email.slice(0, 320) : null;
  } catch {
    return null;
  }
}

export async function connect(db: Db, userId: string, code: string, verifier: string, redirectUri: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri });
  if (!t.refresh_token) throw new GoogleError("token");
  const { error } = await db.from("google_connections").upsert({
    user_id: userId,
    google_email: emailFromIdToken(t.id_token),
    scopes: (t.scope ?? "").slice(0, 2000),
    refresh_token_enc: seal(t.refresh_token, userId),
  });
  if (error) throw new GoogleError("api");
  cache.set(userId, { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 });
}

export async function disconnect(db: Db, userId: string) {
  const { data } = await db.from("google_connections").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (data?.refresh_token_enc) {
    try {
      const rt = open(data.refresh_token_enc as string, userId);
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: rt }), signal: AbortSignal.timeout(8000) });
    } catch { /* desconecta mesmo se a revogação falhar */ }
  }
  cache.delete(userId);
  await db.from("google_connections").delete().eq("user_id", userId);
}

// Token de acesso em memória por alguns minutos (a instância é reaproveitada entre requisições).
const cache = new Map<string, { token: string; until: number }>();

export async function accessToken(db: Db, userId: string): Promise<string> {
  const c = cache.get(userId);
  if (c && c.until > Date.now()) return c.token;
  const { data } = await db.from("google_connections").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (!data) throw new GoogleError("not_connected");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(data.refresh_token_enc as string, userId) });
  cache.set(userId, { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 });
  return t.access_token;
}

async function gget<T>(token: string, url: string): Promise<T> {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (r.status === 401) throw new GoogleError("revoked");
  if (!r.ok) throw new GoogleError("api");
  return (await r.json()) as T;
}

import type { CalEvent, Mail } from "@/lib/google-format";
export type { CalEvent, Mail };
export { formatEvents, formatMails, googleIntent } from "@/lib/google-format";



export async function events(token: string, from: Date, to: Date): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    singleEvents: "true", orderBy: "startTime", maxResults: "120", timeZone: TZ,
    timeMin: from.toISOString(), timeMax: to.toISOString(),
    fields: "items(id,summary,start,end,location,hangoutLink,status,colorId,attendees(self,responseStatus))",
  });
  type Item = { id?: string; colorId?: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string; hangoutLink?: string; status?: string; attendees?: { self?: boolean; responseStatus?: string }[] };
  const j = await gget<{ items?: Item[] }>(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
  return (j.items ?? [])
    .filter((i) => i.status !== "cancelled")
    .map((i) => ({
      id: i.id,
      title: (i.summary ?? "(sem título)").slice(0, 160),
      start: i.start?.dateTime ?? i.start?.date ?? "",
      end: i.end?.dateTime ?? i.end?.date ?? "",
      allDay: !i.start?.dateTime,
      where: i.location?.slice(0, 120),
      meet: Boolean(i.hangoutLink),
      declined: Boolean(i.attendees?.find((a) => a.self)?.responseStatus === "declined"),
    }));
}



export async function inbox(token: string, query = "in:inbox is:unread newer_than:2d -category:promotions -category:social -category:forums", max = 12): Promise<Mail[]> {
  const list = await gget<{ messages?: { id: string }[] }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`);
  const ids = (list.messages ?? []).map((m) => m.id);
  type Msg = { threadId?: string; snippet?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };
  const msgs = await Promise.all(
    ids.map((id) =>
      gget<Msg>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&fields=threadId,snippet,labelIds,payload/headers`).catch(() => null),
    ),
  );
  return msgs.filter((m): m is Msg => Boolean(m)).map((m) => {
    const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    return {
      thread: /^[0-9a-f]{6,32}$/i.test(m.threadId ?? "") ? m.threadId : undefined,
      from: h("from").replace(/<[^>]+>/, "").replace(/"/g, "").trim().slice(0, 80) || h("from").slice(0, 80),
      subject: h("subject").slice(0, 160) || "(sem assunto)",
      snippet: decodeEntities(m.snippet ?? "").slice(0, 220),
      date: h("date"),
      important: Boolean(m.labelIds?.includes("IMPORTANT")),
    };
  });
}

function decodeEntities(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}


/** Cria um evento na agenda principal. Só é chamado depois que a pessoa confirma. */
export async function createEvent(token: string, ev: { title: string; start: string; end: string; location?: string; description?: string }) {
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?fields=id,htmlLink,summary,start,end", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: ev.title,
      location: ev.location || undefined,
      description: ev.description || "Criado pelo GaDu.",
      start: { dateTime: ev.start, timeZone: TZ },
      end: { dateTime: ev.end, timeZone: TZ },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (r.status === 401) throw new GoogleError("revoked");
  if (r.status === 403) throw new GoogleError("scope");
  if (!r.ok) throw new GoogleError("api");
  return (await r.json()) as { id: string; htmlLink: string };
}
