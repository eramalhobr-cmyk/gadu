import { z } from "zod";
import { isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

// Envia um código de 6 dígitos para o e-mail. Só e-mails convidados recebem.
// A resposta é a mesma para qualquer e-mail, para não revelar quem tem acesso.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
  const { email } = parsed.data;
  if (isAllowed(email)) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      const wait = /rate|seconds|security purposes/i.test(error.message);
      return Response.json(
        { error: wait ? "Aguarde um minuto antes de pedir outro código." : "Não consegui enviar o código agora. Tente de novo." },
        { status: wait ? 429 : 502 },
      );
    }
  }
  return Response.json({ ok: true });
}
