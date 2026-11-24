import assert from "node:assert/strict";
import { test } from "node:test";
import { collectEmail } from "./sources/email.ts";
import { fakeDb, fakeGoogle, SCOPE_MAIL } from "./testing.ts";
import type { Mail } from "../google-format.ts";

const A = "00000000-0000-0000-0000-00000000000a";
const mail: Mail = { thread: "18c2f0a1b2c3d4e5", from: "Banco Exemplo", subject: "Fatura", snippet: "", date: "", important: true };

test("fonte de e-mail: link abre o e-mail na conta Google conectada, em qualquer pasta", async () => {
  const g = fakeGoogle({ scopes: [SCOPE_MAIL], mails_: [mail] });
  const ctx = { db: fakeDb(A, {}).db, userId: A, now: new Date(), day: "2026-11-24", dayStart: new Date(), dayEnd: new Date(), blocked: [] };
  const r = await collectEmail(ctx, g.reader, { connected: true, scopes: [SCOPE_MAIL], email: "pessoa@exemplo.test" });
  assert.equal(r.facts[0]?.href, "https://mail.google.com/mail/?authuser=pessoa%40exemplo.test#all/18c2f0a1b2c3d4e5");
});
