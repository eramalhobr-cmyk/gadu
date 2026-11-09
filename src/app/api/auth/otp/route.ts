import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

// Envia o link de acesso. Só contas existentes (convidadas) recebem: cadastro novo é desligado no Supabase.
// A resposta é a mesma para qualquer e-mail, para não revelar quem tem acesso.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
  const { email } = parsed.data;
  {
    const supabase = await supabaseServer();
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` } });
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
