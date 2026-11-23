// Fontes permitidas em `connect-src` para falar com o Supabase.
// Produção (https): só https e wss do host. Supabase LOCAL (http em localhost, 127.0.0.1 ou [::1], usado só no e2e com login do CI):
// também http e ws desse mesmo host. Nunca abre http para um host que não seja da própria máquina.
export function supabaseConnectSources(supabaseUrl: string | undefined | null): string[] {
  if (!supabaseUrl) return [];
  let u: URL;
  try { u = new URL(supabaseUrl); } catch { return []; }
  const out = [`https://${u.host}`, `wss://${u.host}`];
  if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) out.push(`http://${u.host}`, `ws://${u.host}`);
  return out;
}
