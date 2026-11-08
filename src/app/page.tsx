import { redirect } from "next/navigation";
import { isAllowed } from "@/lib/config";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  redirect(data.user && isAllowed(data.user.email) ? "/app" : "/login");
}
