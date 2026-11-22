import { blockedTerm, isSensitive } from "../privacy.ts";

/** Texto com termo bloqueado ou dado sensível não entra no Core com conteúdo. */
export function hidden(text: string, blocked: string[]): boolean {
  return isSensitive(text) || Boolean(blockedTerm(text, blocked));
}
