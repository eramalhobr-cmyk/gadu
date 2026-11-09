import type { Metadata } from "next";
import { hashToken, TOKEN_RE } from "@/lib/invites";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LoginFace } from "../../login/LoginFace";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Convite · GaDu", robots: { index: false } };

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invite: { email: string; name: string | null } | null = null;
  if (TOKEN_RE.test(token)) {
    try {
      const { data } = await supabaseAdmin().from("invites").select("email, name, expires_at, used_at").eq("token_hash", hashToken(token)).maybeSingle();
      if (data && !data.used_at && new Date(data.expires_at as string).getTime() > Date.now()) invite = { email: data.email as string, name: (data.name as string | null) ?? null };
    } catch {
      invite = null;
    }
  }
  return (
    <main className="shell dots" style={{ alignItems: "center", justifyContent: "center", padding: 24, gap: 18, textAlign: "center", overflowY: "auto" }}>
      <div style={{ position: "relative", width: "min(60vw, 240px)", height: "min(60vw, 240px)", flex: "none" }}><LoginFace /></div>
      <h1 className="brand" style={{ fontSize: 28, margin: 0 }}>GaDu</h1>
      {invite ? (
        <>
          <p className="muted" style={{ margin: 0, maxWidth: 360 }}>Você foi convidado para usar o GaDu, um assistente pessoal por voz e texto. Seus dados ficam só com você.</p>
          <AcceptForm token={token} email={invite.email} name={invite.name ?? ""} />
        </>
      ) : (
        <div className="notice" role="alert" style={{ maxWidth: 360 }}>Este convite expirou ou já foi usado. Peça um novo para quem te convidou.</div>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 14 }}><a href="/privacidade">Privacidade</a> · <a href="/termos">Termos</a></p>
    </main>
  );
}
