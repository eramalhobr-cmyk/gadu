import { test } from "node:test";
import assert from "node:assert/strict";
import { rmsLevel, smoothLevel, canMeterMic, VoiceLevel, STALE_MS } from "./voice-level.ts";

test("rmsLevel: silêncio é 0, ruído baixo é cortado, som alto chega a 1", () => {
  assert.equal(rmsLevel(new Uint8Array(256).fill(128)), 0);
  assert.equal(rmsLevel([]), 0);
  const quiet = Uint8Array.from({ length: 256 }, (_, i) => 128 + (i % 2 ? 1 : -1));
  assert.equal(rmsLevel(quiet), 0);
  const loud = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 255 : 0));
  assert.equal(rmsLevel(loud), 1);
  const mid = Uint8Array.from({ length: 256 }, (_, i) => 128 + (i % 2 ? 20 : -20));
  const v = rmsLevel(mid);
  assert.ok(v > 0 && v < 1, `nível médio ${v}`);
});

test("smoothLevel: sobe mais rápido do que desce e fica entre 0 e 1", () => {
  const up = smoothLevel(0, 1, 0.016);
  const down = 1 - smoothLevel(1, 0, 0.016);
  assert.ok(up > down, "ataque mais rápido que soltura");
  assert.equal(smoothLevel(0.5, 1, 10), 1);
  assert.equal(smoothLevel(0.5, 0.5, 0.1), 0.5);
  assert.equal(smoothLevel(0.2, 2, 10), 1);
  assert.equal(smoothLevel(0.2, 0, -1), 0.2);
});

test("canMeterMic: só no computador", () => {
  assert.equal(canMeterMic("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130"), true);
  assert.equal(canMeterMic("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605"), true);
  assert.equal(canMeterMic("Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile"), false);
  assert.equal(canMeterMic("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), false);
  assert.equal(canMeterMic("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), false);
});

test("VoiceLevel: sem sinal devolve -1; o impulso decai até sumir", () => {
  const b = new VoiceLevel();
  assert.equal(b.read(1000), -1);
  b.pulse(0.8, 1000);
  assert.equal(b.read(1000), 0.8);
  const later = b.read(1000 + STALE_MS / 2);
  assert.ok(later > 0.3 && later < 0.5, `decaimento ${later}`);
  assert.equal(b.read(1000 + STALE_MS + 1), -1);
  b.set(1.5, 2000);
  assert.equal(b.read(2000), 1);
  b.pulse(0.3, 2000);
  assert.equal(b.read(2000), 1, "impulso menor não derruba o nível atual");
  b.reset();
  assert.equal(b.read(2000), -1);
  assert.equal(b.read(Number.NaN), -1);
});
