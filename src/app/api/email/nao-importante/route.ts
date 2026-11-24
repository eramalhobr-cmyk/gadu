import { NextResponse } from "next/server";
import { z } from "zod";
import { termoDoRemetente, textoRegra } from "@/lib/email-regras";
import { signedIn } from "../../google/_auth";

export const dynamic = "force-dynamic";

// "Isso não é importante": grava uma memória JÁ aprovada com a regra de e-mail (a própria pessoa pediu, por toque ou voz).
// Sessão obrigatória; grava com o cliente da sessão (RLS e política de escrita valem). Sem chave secreta.
const Body = z
  .object({ de: z.string().trim().min(1).max(120).optional(), termo: z.string().trim().min(2).max(120).optional() })
  .strict()
  .refine((b) => (b.de === undefined) !== (b.termo === undefined), { message: "informe só um: de ou termo" });

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Não entendi de quem é o e-mail." }, { status: 400, headers: NO_STORE });
  const termo = body.data.de !== undefined ? termoDoRemetente(body.data.de) : body.data.termo!.replace(/\s+/g, " ");
  if (!termo) return NextResponse.json({ error: "Não consegui ver o endereço desse e-mail." }, { status: 400, headers: NO_STORE });
  const texto = textoRegra(termo);

  // Já existe a mesma regra? Então não duplica.
  const { data: iguais, error: errLeitura } = await a.supabase.from("memories").select("id").eq("content", texto).limit(1);
  if (errLeitura) return NextResponse.json({ error: "Não consegui salvar agora. Tente de novo." }, { status: 503, headers: NO_STORE });
  if (!iguais?.length) {
    const { error } = await a.supabase.from("memories").insert({ content: texto, area: "Preferências", origin: "Regra de e-mail", status: "approved" });
    if (error) {
      // Política de escrita (S-05): quem não pode gravar recebe 403.
      const negado = error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "");
      return NextResponse.json(
        { error: negado ? "Sua conta não pode salvar isso agora." : "Não consegui salvar agora. Tente de novo." },
        { status: negado ? 403 : 503, headers: NO_STORE },
      );
    }
  }
  return NextResponse.json({ ok: true, termo, texto }, { headers: NO_STORE });
}
