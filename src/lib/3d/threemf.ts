import { boundingBox, triangleCount, type Mesh } from "./mesh.ts";
import { readZip, storedEntry, writeZip, type ZipEntry } from "./zip.ts";

// Exportação 3MF (especificação 3MF Core): um zip com [Content_Types].xml, _rels/.rels e 3D/3dmodel.model, em milímetros.
// Também há a injeção da malha num projeto-modelo do Bambu Studio (A1, PLA, bico 0.4). Essa parte está pronta e
// testada com um modelo FICTÍCIO, mas fica DESLIGADA na interface até o Eduardo enviar o projeto real
// (veja docs/FEATURE-3D.md, "Como enviar o modelo de projeto").

const enc = new TextEncoder();
const dec = new TextDecoder();
const NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";

export const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
export const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

const num = (n: number) => String(Math.round(n * 1e4) / 1e4);
const SNAP = 1e4;

/** Solda os vértices repetidos da sopa de triângulos e devolve vértices e índices. */
export function indexMesh(mesh: Mesh): { vertices: number[]; triangles: number[] } {
  const ids = new Map<string, number>();
  const vertices: number[] = [];
  const triangles: number[] = [];
  const p = mesh.positions;
  for (let t = 0; t < triangleCount(mesh); t++) {
    const tri: number[] = [];
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3;
      const key = `${Math.round(p[i] * SNAP)},${Math.round(p[i + 1] * SNAP)},${Math.round(p[i + 2] * SNAP)}`;
      let id = ids.get(key);
      if (id === undefined) { id = ids.size; ids.set(key, id); vertices.push(p[i], p[i + 1], p[i + 2]); }
      tri.push(id);
    }
    if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) triangles.push(...tri);
  }
  return { vertices, triangles };
}

/** Trecho `<object>` com a malha, usado nos dois modos (3MF comum e injeção no modelo). */
export function objectXml(mesh: Mesh, name: string): string {
  const { vertices, triangles } = indexMesh(mesh);
  const v: string[] = [];
  for (let i = 0; i < vertices.length; i += 3) v.push(`<vertex x="${num(vertices[i])}" y="${num(vertices[i + 1])}" z="${num(vertices[i + 2])}"/>`);
  const t: string[] = [];
  for (let i = 0; i < triangles.length; i += 3) t.push(`<triangle v1="${triangles[i]}" v2="${triangles[i + 1]}" v3="${triangles[i + 2]}"/>`);
  return `<object id="1" name="${escapeXml(name)}" type="model"><mesh><vertices>${v.join("")}</vertices><triangles>${t.join("")}</triangles></mesh></object>`;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

const BUILD = `<build><item objectid="1"/></build>`;

export function modelXml(mesh: Mesh, name = "Peça GaDu"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${NS}"><metadata name="Application">GaDu 3D Studio</metadata><resources>${objectXml(mesh, name)}</resources>${BUILD}</model>`;
}

/** 3MF comum, aceito por qualquer fatiador. Unidade: milímetro. */
export function build3mf(mesh: Mesh, name = "Peça GaDu"): Uint8Array {
  if (!boundingBox(mesh)) throw new Error("A peça está vazia.");
  return writeZip([
    storedEntry("[Content_Types].xml", enc.encode(CONTENT_TYPES)),
    storedEntry("_rels/.rels", enc.encode(ROOT_RELS)),
    storedEntry("3D/3dmodel.model", enc.encode(modelXml(mesh, name))),
  ]);
}

export type Inflate = (raw: Uint8Array) => Promise<Uint8Array>;

/**
 * Troca só a geometria de um projeto-modelo 3MF (os demais arquivos, como Metadata/*, voltam intactos) e
 * mantém as configurações de impressora, filamento e processo. Lança erro se o modelo não tiver a estrutura esperada.
 * `inflate` descomprime entradas "deflate" (no navegador: DecompressionStream; no Node: zlib.inflateRaw).
 */
export async function injectIntoTemplate(template: Uint8Array, mesh: Mesh, inflate: Inflate, name = "Peça GaDu"): Promise<Uint8Array> {
  const entries = readZip(template);
  const idx = entries.findIndex((e) => e.name === "3D/3dmodel.model");
  if (idx < 0) throw new Error("O modelo de projeto não tem 3D/3dmodel.model.");
  const e = entries[idx];
  const xml = dec.decode(e.method === 8 ? await inflate(e.raw) : e.raw);
  if (!/<resources[\s>]/.test(xml) && !/<resources\/>/.test(xml)) throw new Error("O modelo de projeto não tem <resources>.");
  let out = xml.replace(/<resources\s*\/>|<resources[^>]*>[\s\S]*?<\/resources>/, `<resources>${objectXml(mesh, name)}</resources>`);
  out = /<build\s*\/>|<build[^>]*>[\s\S]*?<\/build>/.test(out) ? out.replace(/<build\s*\/>|<build[^>]*>[\s\S]*?<\/build>/, BUILD) : out.replace("</model>", `${BUILD}</model>`);
  const next: ZipEntry[] = entries.slice();
  next[idx] = storedEntry(e.name, enc.encode(out));
  return writeZip(next);
}

/** O botão "3MF A1 PLA 0.4" só liga quando houver um modelo de projeto real. Enquanto isso: desativado. */
export const A1_TEMPLATE_AVAILABLE = false;
export const A1_TEMPLATE_PENDING_TEXT = "Aguardando o modelo de projeto do Eduardo";
