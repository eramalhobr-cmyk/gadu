import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { VENDOR_CSP } from "./csp.ts";
import { modeling3dEnabled } from "./flag.ts";

test("MODELING_3D_ENABLED: desligado por padrão; só o valor 1 liga", () => {
  assert.equal(modeling3dEnabled({}), false);
  for (const v of ["", "0", "true", "on", "sim", "2", "yes"]) assert.equal(modeling3dEnabled({ MODELING_3D_ENABLED: v }), false, v);
  assert.equal(modeling3dEnabled({ MODELING_3D_ENABLED: "1" }), true);
  assert.equal(modeling3dEnabled({ MODELING_3D_ENABLED: " 1 " }), true);
});

test("CSP do worker: sem rede, WebAssembly só aqui; a CSP das páginas não é afrouxada", () => {
  assert.match(VENDOR_CSP, /connect-src 'none'/);
  assert.match(VENDOR_CSP, /default-src 'none'/);
  assert.match(VENDOR_CSP, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(VENDOR_CSP.replace("'wasm-unsafe-eval'", ""), /unsafe-eval|unsafe-inline|\*|https?:|blob:|data:/);
  const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(proxy, /wasm-unsafe-eval/, "as páginas não ganham wasm-unsafe-eval");
  assert.match(proxy, /worker-src 'self'"/, "worker-src das páginas continua só 'self'");
  assert.match(proxy, /\(\?!_next\/static[^`"]*vendor\//, "o proxy não mexe em /vendor/");
  const cfg = readFileSync(new URL("../../../next.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /\/vendor\/openscad\/:path\*/);
  assert.match(cfg, /VENDOR_CSP/);
});
