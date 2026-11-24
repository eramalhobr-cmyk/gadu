import { isSensitive } from "../privacy.ts";

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

/** Detector de dado sensível do app (`isSensitive`, PR #94) mais e-mail, que o detector só marca junto de "Pix". Texto marcado nunca é gravado, enviado nem falado. */
export function sensivel(texto: string): boolean {
  return isSensitive(texto) || EMAIL.test(texto);
}
