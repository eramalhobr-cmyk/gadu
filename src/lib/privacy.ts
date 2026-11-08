// Regra de privacidade: dado sensível nunca vai para um provedor externo.
// Enquanto não houver modelo local, a mensagem simplesmente não é enviada.

const PATTERNS: RegExp[] = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, // CNPJ
  /\b(?:\d[ -]?){13,19}\b/, // cartão
  /\bsk-[A-Za-z0-9_-]{12,}/, // chave de API
  /\b(senha|password|cvv|cpf|rg|cnh|passaporte|chave pix|conta banc[aá]ria|ag[eê]ncia e conta|saldo banc[aá]rio|extrato banc[aá]rio|imposto de renda|cart[aã]o de cr[eé]dito|token de acesso|api[ _-]?key|diagn[oó]stico m[eé]dico|exame m[eé]dico|laudo|prontu[aá]rio)\b/i,
];

export function isSensitive(text: string): boolean {
  return PATTERNS.some((r) => r.test(text));
}

export function blockedTerm(text: string, blocked: string[]): string | null {
  const t = text.toLowerCase();
  return blocked.find((b) => b && t.includes(b.toLowerCase())) ?? null;
}
