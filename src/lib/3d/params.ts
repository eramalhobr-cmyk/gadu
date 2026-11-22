// Parâmetros do OpenSCAD no estilo Customizer: ficam no topo do arquivo, um por linha:
//   largura = 70;   // [30:1:200] Largura da base (mm)
//   arredondar = true;   // [true] Bordas arredondadas
//   acabamento = "liso";   // ["liso", "texturizado"] Acabamento
// Só as linhas com comentário entre colchetes viram controle. Funções puras, sem DOM.

export type NumberParam = { kind: "number"; name: string; value: number; min: number; max: number; step: number; label: string };
export type BoolParam = { kind: "bool"; name: string; value: boolean; label: string };
export type ChoiceParam = { kind: "choice"; name: string; value: string | number; options: (string | number)[]; label: string };
export type Param = NumberParam | BoolParam | ChoiceParam;
export type ParamValues = Record<string, number | boolean | string>;

const LINE = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)([^;]+?)(\s*;)(\s*\/\/\s*)(\[[^\]]*\])?(.*)$/;
const NUM = /^[-+]?(\d+\.?\d*|\.\d+)$/;

const stripQuotes = (s: string) => s.replace(/^"(.*)"$/, "$1");
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

/** Passo padrão: inteiro quando os limites e o valor são inteiros, senão 0,1. */
function defaultStep(min: number, max: number, value: number): number {
  return Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(value) ? 1 : 0.1;
}

function parseRange(inner: string, value: number): { min: number; max: number; step: number } | null {
  const parts = inner.split(":").map((s) => s.trim());
  if (!parts.every((p) => NUM.test(p))) return null;
  const n = parts.map(Number);
  let min: number, max: number, step: number;
  if (n.length === 1) { min = Math.min(0, value); max = n[0]; step = defaultStep(min, max, value); }
  else if (n.length === 2) { [min, max] = n; step = defaultStep(min, max, value); }
  else if (n.length === 3) { [min, step, max] = n; }
  else return null;
  if (!(max > min) || !(step > 0) || step > max - min) return null;
  return { min, max, step };
}

/** Lê os parâmetros do topo do código. Para na primeira linha que não é atribuição, comentário ou vazia. */
export function parseParams(scad: string): Param[] {
  const out: Param[] = [];
  const seen = new Set<string>();
  for (const raw of scad.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    const m = LINE.exec(raw);
    if (!m) { if (/^[A-Za-z_$][\w$]*\s*=/.test(line)) continue; break; }
    const [, , name, , valueRaw, , , bracket, rest] = m;
    if (!bracket || seen.has(name)) continue;
    const inner = bracket.slice(1, -1).trim();
    const label = rest.trim() || name;
    const v = valueRaw.trim();
    if (v === "true" || v === "false") { seen.add(name); out.push({ kind: "bool", name, value: v === "true", label }); continue; }
    if (NUM.test(v) && inner) {
      const r = parseRange(inner, Number(v));
      if (r) { seen.add(name); out.push({ kind: "number", name, value: Number(v), ...r, label }); continue; }
    }
    if (inner.includes(",") || /^".*"$/.test(v)) {
      const options = inner.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (NUM.test(s) ? Number(s) : stripQuotes(s)));
      const value = /^".*"$/.test(v) ? stripQuotes(v) : NUM.test(v) ? Number(v) : null;
      if (options.length >= 2 && options.length <= 12 && value !== null && options.includes(value)) { seen.add(name); out.push({ kind: "choice", name, value, options, label }); }
    }
  }
  return out;
}

export function defaultValues(params: Param[]): ParamValues {
  return Object.fromEntries(params.map((p) => [p.name, p.value]));
}

/** Valor seguro para um parâmetro: número dentro dos limites e no passo, booleano ou uma das opções. null = descartar. */
export function sanitizeValue(p: Param, v: unknown): number | boolean | string | null {
  if (p.kind === "number") {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const clamped = Math.min(p.max, Math.max(p.min, v));
    return tidy(Math.min(p.max, p.min + Math.round((clamped - p.min) / p.step) * p.step));
  }
  if (p.kind === "bool") return typeof v === "boolean" ? v : null;
  return (typeof v === "string" || typeof v === "number") && p.options.includes(v) ? v : null;
}

const literal = (v: number | boolean | string) => (typeof v === "string" ? `"${v.replace(/[\\"\r\n]/g, "")}"` : String(v));

/** Troca os valores dos parâmetros no código. Só mexe nos parâmetros declarados; valor inválido é ignorado. */
export function applyParams(scad: string, values: ParamValues): string {
  const params = new Map(parseParams(scad).map((p) => [p.name, p]));
  return scad.split(/\r?\n/).map((raw) => {
    const m = LINE.exec(raw);
    if (!m) return raw;
    const p = params.get(m[2]);
    if (!p || !(p.name in values)) return raw;
    const v = sanitizeValue(p, values[p.name]);
    if (v === null) return raw;
    return `${m[1]}${m[2]}${m[3]}${literal(v)}${m[5]}${m[6]}${m[7] ?? ""}${m[8]}`;
  }).join("\n");
}
