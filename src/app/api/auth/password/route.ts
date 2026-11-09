import { z } from "zod";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

// Login com e-mail e senha. A mesma mensagem de erro para qualquer falha,
// para não revelar se o e-mail existe. O Supabase limita tentativas por IP.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "E-mail ou senha incorretos." }, { status: 400 });
  const { email, password } = parsed.data;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || !(await accessOf(supabase, data.user)).ok) {
    if (data?.user) await supabase.auth.signOut();
    const wait = error && /rate|too many/i.test(error.message);
    return Response.json(
      { error: wait ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha incorretos." },
      { status: wait ? 429 : 401 },
    );
  }
  return Response.json({ ok: true });
}
