import { NextResponse } from "next/server";
import { signedIn } from "../../google/_auth";
import { telemetriaEnabled } from "@/lib/telemetria/flag";
import { registrarErro } from "@/lib/telemetria/registrar";
import { ErroClienteBody, eventoDoCliente } from "@/lib/telemetria/sanitize";

export const dynamic = "force-dynamic";

// O navegador avisa que uma tela quebrou. Só entra: rota (sem query), nome do erro, código e "arquivo:linha".
// NÃO entra mensagem, e-mail, IP nem conteúdo (`.strict()` recusa campo desconhecido). Exige sessão: o user_id vem dela, nunca do corpo.
// Limite de taxa por pessoa em registrarErro. Telemetria nunca devolve erro ao app: gravou, descartou ou falhou, a resposta é 204 (exceto 401/400/413/429).
export async function POST(request: Request) {
  if (!telemetriaEnabled()) return new NextResponse(null, { status: 204 });
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 2000) return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  const parsed = ErroClienteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const r = await registrarErro(a.user.id, eventoDoCliente(parsed.data));
  if (r === "limitado") return NextResponse.json({ error: "Muitos avisos de erro. Tente mais tarde." }, { status: 429, headers: { "retry-after": "600" } });
  return new NextResponse(null, { status: 204 });
}
