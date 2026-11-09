import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminOnly } from "../_admin";

export const dynamic = "force-dynamic";

const count = (r: { count: number | null }) => r.count ?? 0;

// Pessoas e convites. Privacidade: o admin vê só o estado da configuração (contagens), nunca o conteúdo.
export async function GET() {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  const [{ data: members }, { data: invites }, { data: users }] = await Promise.all([
    db.from("members").select("user_id, role, access, created_at").order("created_at"),
    db.from("invites").select("id, email, name, expires_at, used_at, created_at").eq("created_by", a.user.id).is("used_at", null).order("created_at", { ascending: false }),
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  const byId = new Map((users?.users ?? []).map((u) => [u.id, u]));
  const people = await Promise.all(
    (members ?? []).map(async (m) => {
      const id = m.user_id as string;
      const u = byId.get(id);
      const q = (t: string) => db.from(t).select("*", { count: "exact", head: true }).eq("user_id", id);
      const [google, push, agents, projects, memories, tasks, convs, prof] = await Promise.all([
        q("google_connections"), q("push_subscriptions"), q("agents"), q("projects"),
        db.from("memories").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "approved"),
        db.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "open"),
        q("conversations"),
        db.from("profiles").select("display_name").eq("id", id).maybeSingle(),
      ]);
      return {
        id, me: id === a.user.id, role: m.role, access: m.access,
        name: (prof.data?.display_name as string | null) ?? (u?.user_metadata?.full_name as string | undefined) ?? null,
        email: u?.email ?? null, since: m.created_at, lastSeen: u?.last_sign_in_at ?? null,
        setup: { password: true, google: count(google) > 0, push: count(push) > 0, agents: count(agents), projects: count(projects), memories: count(memories), tasks: count(tasks), conversations: count(convs) },
      };
    }),
  );
  return NextResponse.json({ people, invites: invites ?? [] }, { headers: { "cache-control": "no-store" } });
}

const Patch = z.object({ userId: z.string().uuid(), access: z.enum(["active", "blocked"]) }).strict();

// Bloqueia ou libera o acesso de alguém (nunca o próprio admin).
export async function PATCH(request: Request) {
  const a = await adminOnly();
  if (!a) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = Patch.safeParse(await request.json().catch(() => null));
  if (!p.success || p.data.userId === a.user.id) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { error } = await supabaseAdmin().from("members").update({ access: p.data.access }).eq("user_id", p.data.userId);
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
