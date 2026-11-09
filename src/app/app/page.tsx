import { redirect } from "next/navigation";
import { GaduApp, type Msg } from "@/components/GaduApp";
import { TABS, type Tab } from "@/lib/tabs";
import { APP_VERSION, isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ google?: string; tab?: string; start?: string }> }) {
  const { google, tab, start } = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !isAllowed(user.email)) redirect("/login");

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
  const settings = (profile.data?.settings ?? {}) as { blocked?: unknown; morningLink?: unknown };
  const morning = typeof settings.morningLink === "string" && /^https:\/\//.test(settings.morningLink) ? settings.morningLink : "";
  const name = String(profile.data?.display_name ?? user.user_metadata?.full_name ?? "").split(" ")[0];

  return (
    <GaduApp
      name={name}
      email={user.email ?? ""}
      initialConversationId={(convo.data?.id as number) ?? null}
      initialMessages={messages}
      initialBlocked={Array.isArray(settings.blocked) ? settings.blocked.map(String) : []}
      version={APP_VERSION}
      morningLink={morning}
      initialTab={TABS.includes(tab as Tab) ? (tab as Tab) : tab === "memoria" || tab === "ajustes" ? "perfil" : google ? "conversa" : "hoje"}
      initialProfile={tab === "ajustes" ? "ajustes" : "memoria"}
      autoStart={start === "briefing"}
      flash={typeof google === "string" ? google.slice(0, 20) : null}
    />
  );
}
