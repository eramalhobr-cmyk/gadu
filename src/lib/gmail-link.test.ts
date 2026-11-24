import assert from "node:assert/strict";
import { test } from "node:test";
import { ehAndroid, GMAIL_APP_ANDROID, gmailLink } from "./gmail-link.ts";

test("link do Gmail: conta conectada (authuser) e #all/ para achar o e-mail em qualquer pasta", () => {
  assert.equal(gmailLink("18c2f0a1b2c3d4e5", "pessoa@exemplo.test"), "https://mail.google.com/mail/?authuser=pessoa%40exemplo.test#all/18c2f0a1b2c3d4e5");
  assert.equal(gmailLink("18c2f0a1b2c3d4e5", null), "https://mail.google.com/mail/u/0/#all/18c2f0a1b2c3d4e5");
  assert.equal(gmailLink(null, "pessoa@exemplo.test"), "https://mail.google.com/mail/?authuser=pessoa%40exemplo.test#inbox");
  assert.equal(gmailLink("../../x", null), "https://mail.google.com/mail/u/0/#inbox", "id estranho não entra no link");
});

test("app do Gmail no Android: intent com o pacote do Gmail e volta para o navegador sem o app", () => {
  assert.match(GMAIL_APP_ANDROID, /^intent:\/\/mail\.google\.com\/mail\/#Intent;scheme=https;package=com\.google\.android\.gm;S\.browser_fallback_url=https%3A%2F%2Fmail\.google\.com%2Fmail%2F;end$/);
  assert.equal(ehAndroid("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36"), true);
  assert.equal(ehAndroid("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), false);
});
