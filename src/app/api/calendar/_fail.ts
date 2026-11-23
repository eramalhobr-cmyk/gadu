import { NextResponse } from "next/server";
import { GoogleError } from "@/lib/google";

/** Resposta de erro das rotas da agenda (sem detalhes internos). */
export function fail(e: unknown) {
  const kind = e instanceof GoogleError ? e.kind : "api";
  const status = kind === "not_connected" ? 409 : kind === "scope" ? 403 : kind === "gone" ? 404 : 502;
  const message = {
    gone: "Não encontrei esse evento na agenda. Ele pode já ter sido apagado.",
    not_connected: "Conecte o Google em Perfil › Ajustes › Conexões.",
    scope: "Falta permissão para mudar a agenda. Reconecte o Google em Perfil › Ajustes › Conexões.",
    revoked: "O acesso ao Google expirou. Reconecte em Perfil › Ajustes › Conexões.",
  }[kind as string] ?? "Não consegui falar com o Google agora. Tente de novo.";
  return NextResponse.json({ error: kind, message }, { status });
}
