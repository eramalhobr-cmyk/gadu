// Zip mínimo, sem dependências: escrita sem compressão (método 0) e leitura de entradas "stored" ou "deflate".
// Serve ao 3MF (que é um zip). Entradas lidas de um modelo-base voltam byte a byte, sem recomprimir.

export type ZipEntry = { name: string; method: 0 | 8; crc: number; size: number; raw: Uint8Array };

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const storedEntry = (name: string, data: Uint8Array): ZipEntry => ({ name, method: 0, crc: crc32(data), size: data.length, raw: data });

const DOS_TIME = 0, DOS_DATE = (1 << 5) | 1; // 1980-01-01 00:00: o mesmo arquivo gera o mesmo zip

export function writeZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const names = entries.map((e) => enc.encode(e.name));
  let size = 22;
  entries.forEach((e, i) => { size += 30 + names[i].length + e.raw.length + 46 + names[i].length; });
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let o = 0;
  const offsets: number[] = [];
  entries.forEach((e, i) => {
    offsets.push(o);
    v.setUint32(o, 0x04034b50, true); v.setUint16(o + 4, 20, true); v.setUint16(o + 6, 0x0800, true); v.setUint16(o + 8, e.method, true);
    v.setUint16(o + 10, DOS_TIME, true); v.setUint16(o + 12, DOS_DATE, true); v.setUint32(o + 14, e.crc, true);
    v.setUint32(o + 18, e.raw.length, true); v.setUint32(o + 22, e.size, true); v.setUint16(o + 26, names[i].length, true); v.setUint16(o + 28, 0, true);
    out.set(names[i], o + 30); out.set(e.raw, o + 30 + names[i].length);
    o += 30 + names[i].length + e.raw.length;
  });
  const cdStart = o;
  entries.forEach((e, i) => {
    v.setUint32(o, 0x02014b50, true); v.setUint16(o + 4, 20, true); v.setUint16(o + 6, 20, true); v.setUint16(o + 8, 0x0800, true); v.setUint16(o + 10, e.method, true);
    v.setUint16(o + 12, DOS_TIME, true); v.setUint16(o + 14, DOS_DATE, true); v.setUint32(o + 16, e.crc, true);
    v.setUint32(o + 20, e.raw.length, true); v.setUint32(o + 24, e.size, true); v.setUint16(o + 28, names[i].length, true);
    v.setUint32(o + 42, offsets[i], true);
    out.set(names[i], o + 46);
    o += 46 + names[i].length;
  });
  v.setUint32(o, 0x06054b50, true); v.setUint16(o + 8, entries.length, true); v.setUint16(o + 10, entries.length, true);
  v.setUint32(o + 12, o - cdStart, true); v.setUint32(o + 16, cdStart, true);
  return out;
}

/** Lê o diretório do zip. Lança erro se não for um zip simples (sem zip64 nem criptografia). */
export function readZip(data: Uint8Array): ZipEntry[] {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65_535); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Arquivo zip inválido.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Arquivo zip inválido.");
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true), comp = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    if ((flags & 1) || (method !== 0 && method !== 8)) throw new Error("Zip com recurso não suportado.");
    const name = dec.decode(data.subarray(p + 46, p + 46 + nl));
    if (v.getUint32(off, true) !== 0x04034b50) throw new Error("Arquivo zip inválido.");
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    out.push({ name, method: method as 0 | 8, crc, size, raw: data.slice(start, start + comp) });
    p += 46 + nl + xl + cl;
  }
  return out;
}
