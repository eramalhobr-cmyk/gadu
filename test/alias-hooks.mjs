// Carregador só para testes: resolve "@/..." para src/ e imports sem extensão para .ts (como o Next faz).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const EXTS = [".ts", ".tsx", "/index.ts"];

function withExt(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && !path.endsWith("/")) return url;
  for (const e of EXTS) if (existsSync(path + e)) return pathToFileURL(path + e).href;
  return null;
}

export async function resolve(specifier, context, next) {
  // O pacote "next" não tem mapa de exports: no Node puro, "next/server" precisa da extensão.
  if (specifier === "next/server") return next("next/server.js", context);
  if (specifier.startsWith("@/")) {
    const hit = withExt(new URL(specifier.slice(2), SRC).href);
    if (hit) return { url: hit, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.includes("/src/")) {
    const hit = withExt(new URL(specifier, context.parentURL).href);
    if (hit) return { url: hit, shortCircuit: true };
  }
  return next(specifier, context);
}
