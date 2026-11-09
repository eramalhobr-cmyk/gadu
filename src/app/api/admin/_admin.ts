import { signedIn } from "../google/_auth";

/** Só administradores passam. */
export async function adminOnly() {
  const a = await signedIn();
  return a && a.admin ? a : null;
}
