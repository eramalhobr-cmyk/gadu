// S-06: quem pode ser bloqueado. Nunca outro admin, nem e-mail de ADMIN_EMAILS, nem a própria pessoa.
export type BlockTarget = { id: string; role: string | null; email: string | null };

export type BlockRefusal = { status: 400 | 403; message: string };

export function refuseBlock(actorId: string, target: BlockTarget, adminEmails: string[]): BlockRefusal | null {
  if (target.id === actorId) return { status: 400, message: "Você não pode bloquear a si mesmo." };
  const email = (target.email ?? "").trim().toLowerCase();
  if (target.role === "admin" || (email && adminEmails.map((e) => e.trim().toLowerCase()).includes(email))) {
    return { status: 403, message: "Administradores não podem ser bloqueados por aqui. Troque o papel antes, direto no banco." };
  }
  return null;
}
