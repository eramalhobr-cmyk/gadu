import { redirect } from "next/navigation";
import { accessOf } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  redirect((await accessOf(supabase, data.user)).ok ? "/app" : "/login");
}
