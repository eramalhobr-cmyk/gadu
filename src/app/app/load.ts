import { redirect } from "next/navigation";
import type { Msg } from "@/components/GaduApp";
import { TABS, type Tab } from "@/lib/tabs";
import { APP_VERSION } from "@/lib/config";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

export type AppParams = { google?: string; tab?: string; start?: string };

/** Dados que toda tela do app precisa (cabeçalho, menu, conversa, voz). Redireciona para o login sem acesso. */
export async function loadApp({ google, tab, start }: AppParams = {}) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const access = await accessOf(supabase, user);
  if (!user || !access.ok) redirect("/login");

  // Abre na última conversa, para continuar de onde parou.
  const [profile, convo] = await Promise.all([
    supabase.from("profiles").select("display_name, settings").eq("id", user.id).maybeSingle(),
    supabase.from("conversations").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let messages: Msg[] = [];
  if (convo.data) {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, provider")
      .eq("conversation_id", convo.data.id)
      .order("created_at", { ascending: false })
      .limit(30);
    messages = (data ?? []).reverse().map((m) => ({ id: String(m.id), role: m.role as "user" | "assistant", content: m.content as string, via: (m.provider as string) || undefined }));
  }
  const settings = (profile.data?.settings ?? {}) as { blocked?: unknown; morningLink?: unknown; tips?: unknown };
  const morning = typeof settings.morningLink === "string" && /^https:\/\//.test(settings.morningLink) ? settings.morningLink : "";
  const name = String(profile.data?.display_name ?? user.user_metadata?.full_name ?? "").split(" ")[0];

  return {
    supabase,
    props: {
      name,
      email: user.email ?? "",
      initialConversationId: (convo.data?.id as number) ?? null,
      initialMessages: messages,
      initialBlocked: Array.isArray(settings.blocked) ? settings.blocked.map(String) : [],
      version: APP_VERSION,
      morningLink: morning,
      initialTab: (TABS.includes(tab as Tab) ? tab : tab === "memoria" || tab === "ajustes" || tab === "admin" ? "perfil" : google ? "conversa" : "hoje") as Tab,
      initialProfile: (tab === "ajustes" ? "ajustes" : tab === "admin" && access.admin ? "admin" : "memoria") as "memoria" | "ajustes" | "admin",
      admin: access.admin,
      seenTips: Array.isArray(settings.tips) ? settings.tips.map(String).slice(0, 20) : [],
      autoStart: (start === "briefing" || start === "review" ? start : null) as "briefing" | "review" | null,
      flash: typeof google === "string" ? google.slice(0, 20) : null,
    },
  };
}
