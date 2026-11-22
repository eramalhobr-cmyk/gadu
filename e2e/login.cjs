// Cria a sessão do usuário de TESTE pelo login de senha do próprio app (/api/auth/password).
// A senha vem só do ambiente (E2E_PASSWORD) e nunca é gravada no repositório nem impressa.
// A sessão vai para um arquivo temporário fora do repositório, apagado no fim do processo.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

async function login(base, email, password) {
  const proxy = process.env.HTTPS_PROXY && base.startsWith("https") ? { proxy: { server: process.env.HTTPS_PROXY } } : {};
  const b = await chromium.launch(proxy);
  try {
    const ctx = await b.newContext();
    const r = await ctx.request.post(`${base}/api/auth/password`, { data: { email, password } });
    if (r.status() !== 200) throw new Error(`Login do usuário de teste falhou (HTTP ${r.status()}).`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gadu-e2e-"));
    const file = path.join(dir, "sessao.json");
    await ctx.storageState({ path: file });
    process.on("exit", () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
    return file;
  } finally {
    await b.close();
  }
}

module.exports = { login };
