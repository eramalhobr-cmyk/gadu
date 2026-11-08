import { z } from "zod";
import { isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  token: z.string().trim().regex(/^\d{6,10}$/),
});

// Confere o código e cria a sessão (cookies seguros, httpOnly, gerenciados pelo Supabase).
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Código inválido." }, { status: 400 });
  const { email, token } = parsed.data;
  if (!isAllowed(email)) return Response.json({ error: "Código inválido ou expirado." }, { status: 401 });
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user || !isAllowed(data.user.email)) {
    if (data?.user) await supabase.auth.signOut();
    return Response.json({ error: "Código inválido ou expirado. Peça um novo." }, { status: 401 });
  }
  return Response.json({ ok: true });
}
