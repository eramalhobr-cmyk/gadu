import assert from "node:assert/strict";
import { test } from "node:test";
import { deviceLabel, permissionMessage, pushSupport } from "./push-client.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 16; SM-S938B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";
const all = { hasServiceWorker: true, hasPushManager: true, hasNotification: true };

test("Android com Chrome: suporte pleno, instalado ou não", () => {
  assert.equal(pushSupport({ ua: ANDROID, standalone: false, ...all }), "ok");
  assert.equal(pushSupport({ ua: ANDROID, standalone: true, ...all }), "ok");
});
test("iPhone no Safari comum: pede para instalar; instalado com iOS novo: ok; instalado sem push: iOS antigo", () => {
  assert.equal(pushSupport({ ua: IPHONE, standalone: false, hasServiceWorker: true, hasPushManager: false, hasNotification: false }), "install");
  assert.equal(pushSupport({ ua: IPHONE, standalone: true, ...all }), "ok");
  assert.equal(pushSupport({ ua: IPHONE, standalone: true, hasServiceWorker: true, hasPushManager: false, hasNotification: false }), "ios-old");
});
test("Notification indefinido (navegador embutido ou antigo): sem suporte, sem quebrar", () => {
  assert.equal(pushSupport({ ua: ANDROID, standalone: false, hasServiceWorker: true, hasPushManager: true, hasNotification: false }), "no");
  assert.equal(pushSupport({ ua: ANDROID, standalone: false, hasServiceWorker: false, hasPushManager: false, hasNotification: false }), "no");
});
test("permissão: granted não avisa nada; denied explica onde liberar; default pede para escolher", () => {
  assert.equal(permissionMessage("granted"), null);
  assert.match(permissionMessage("denied")!, /bloqueadas/);
  assert.match(permissionMessage("default")!, /Permitir/);
});
test("rótulo do aparelho", () => {
  assert.equal(deviceLabel(IPHONE), "iPhone");
  assert.equal(deviceLabel(ANDROID), "Android");
  assert.equal(deviceLabel("Mozilla/5.0 (X11; Linux x86_64)"), "Computador");
});
