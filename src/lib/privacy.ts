// Regra de privacidade: dado sensível nunca vai para um provedor externo.
// Enquanto não houver modelo local, a mensagem simplesmente não é enviada.
// Detecção por DADO, não por palavra (23/11/2026): falar de "senha", "cpf", "Pix" ou "cartão de crédito" é conversa comum;
// o que bloqueia é o número ou a chave em si — CPF e CNPJ (com dígitos verificadores), cartão (Luhn), agência e conta,
// chave Pix (com a palavra Pix por perto), Pix copia e cola, senha/código com valor, chaves de API e tokens.
// Saúde continua por palavra (laudo, prontuário, diagnóstico e exame médico): dado de saúde é sensível na LGPD mesmo sem número.

const digitos = (s: string) => s.replace(/\D/g, "");
const repetido = (d: string) => /^(\d)\1+$/.test(d);

/** CPF válido pelos dois dígitos verificadores. */
export function cpfValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 11 || repetido(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** CNPJ válido pelos dois dígitos verificadores. */
export function cnpjValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 14 || repetido(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/** Número de cartão (13 a 19 dígitos) que passa no Luhn. */
export function luhn(v: string): boolean {
  const d = digitos(v);
  if (d.length < 13 || d.length > 19 || repetido(d)) return false;
  let s = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    s += n;
  }
  return s % 10 === 0;
}

const CPF_FORMATADO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
const CNPJ_FORMATADO = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
const PIX = /\bpix\b/i;
const EVP = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const TELEFONE = /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/;

const PADROES: RegExp[] = [
  CPF_FORMATADO,
  CNPJ_FORMATADO,
  // Agência e conta com número: "ag 1234 cc 12345-6", "agência: 0001, conta corrente 98765-4", "conta poupança 1234567-8".
  /\bag(?:[eê]ncia|\.)?\s*(?:n[ºo°.]?\s*)?:?\s*\d{3,5}(?:-\s?[\dxX])?\b[\s\S]{0,40}?\b(?:c\/?c|conta(?:\s+(?:corrente|poupan[cç]a|sal[aá]rio))?)\s*(?:n[ºo°.]?\s*)?:?\s*\d{4,13}(?:-\s?[\dxX])?/i,
  /\bconta\s+(?:corrente|poupan[cç]a|sal[aá]rio|banc[aá]ria)\s*(?:n[ºo°.]?\s*)?:?\s*\d{4,13}-\s?[\dxX]\b/i,
  // Pix copia e cola (BR Code).
  /000201[\s\S]{0,200}br\.gov\.bcb\.pix/i,
  // Senha, PIN, CVV ou código com o valor junto.
  /\b(?:senha|password|pin)\b[^.\n?]{0,30}?(?:\s[ée]\s|:|=)\s*["']?\S{3,}/i,
  /\b(?:senha|password|pin)\b(?:\s+(?:do|da|de|of|the)\s+[^\s\d]+)?\s+["']?(?=[^\s]*\d)[^\s?.,]{3,}/i, // "senha do wifi 123", "senha 4321"
  /\b(?:cvv|cvc|c[oó]digo de seguran[cç]a)\b\D{0,15}\d{3,4}\b/i,
  // Documentos com número: RG, CNH, passaporte.
  /\brg\b\D{0,12}\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]\b/i,
  /\bcnh\b\D{0,12}\d{11}\b/i,
  /\bpassaporte\b\D{0,12}[A-Z]{2}\d{6}\b/i,
  // Chaves de API e tokens.
  /\bsk-[A-Za-z0-9_-]{12,}/,
  /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\b(?:token|api[ _-]?key|chave de api)\b[^.\n?]{0,20}?(?::|=|\s[ée]\s)\s*["']?[A-Za-z0-9_\-.]{16,}/i,
  // Saúde (LGPD): por palavra.
  /\b(diagn[oó]stico m[eé]dico|exame m[eé]dico|laudo|prontu[aá]rio)\b/i,
];

function temNumeroValido(text: string): boolean {
  // Sequências de dígitos (com pontos, traços, espaços e barras no meio), testadas uma a uma.
  for (const m of text.matchAll(/\d[\d.\-\/ ]{9,30}\d/g)) {
    const bruto = m[0];
    const d = digitos(bruto);
    if (d.length === 11 && cpfValido(d)) return true;
    if (d.length === 14 && cnpjValido(d)) return true;
    // Cartão: também as partes, para não perder um cartão colado a outro número.
    for (const parte of bruto.split(/[.\-\/]/)) if (luhn(parte)) return true;
    if (luhn(bruto)) return true;
  }
  return false;
}

/** Chave Pix: com a palavra Pix na mensagem, um e-mail, telefone, chave aleatória ou CPF/CNPJ conta como chave. */
function temChavePix(text: string): boolean {
  if (!PIX.test(text)) return false;
  return EVP.test(text) || EMAIL.test(text) || TELEFONE.test(text);
}

export function isSensitive(text: string): boolean {
  return PADROES.some((r) => r.test(text)) || temNumeroValido(text) || temChavePix(text);
}

export function blockedTerm(text: string, blocked: string[]): string | null {
  const t = text.toLowerCase();
  return blocked.find((b) => b && t.includes(b.toLowerCase())) ?? null;
}
