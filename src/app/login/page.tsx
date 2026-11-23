import { redirect } from "next/navigation";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";
import { EmailLogin } from "./EmailLogin";
import { LoginFace } from "./LoginFace";

const GOOGLE = process.env.GOOGLE_LOGIN_ENABLED === "1";

const ERRORS: Record<string, string> = {
  acesso: "Esta conta não tem acesso ao GaDu. Por enquanto ele é só para convidados.",
  google: "O login não foi concluído. Peça um novo link e abra no mesmo aparelho e navegador.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  // Quem já entrou vai direto para o app.
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!erro && (await accessOf(supabase, data.user)).ok) redirect("/app");
  return (
    <main className="shell dots page-center">
      <div className="login-face">
        <LoginFace />
      </div>
      <h1 className="brand login-title">GaDu</h1>
      <p className="muted m0 mw-340">Seu assistente pessoal, por voz e texto. Entre com o seu e-mail e senha.</p>
      {erro && ERRORS[erro] && <div className="notice mw-360" role="alert">{ERRORS[erro]}</div>}
      <EmailLogin />
      {GOOGLE && (
        <a className="btn minw-260" href="/auth/login">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#04110F" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" /></svg>
        Entrar com Google
      </a>
      )}
      <p className="mono muted m0">Acesso por convite · seus dados ficam só com você</p>
      <p className="muted m0 fs-14"><a href="/">Sobre o GaDu</a> · <a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a></p>
    </main>
  );
}
