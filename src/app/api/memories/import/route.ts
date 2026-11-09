import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowed, readBudgets } from "@/lib/config";
import { IMPORT_MAX_CHARS, IMPORT_MAX_ITEMS, looksLikeList, parseImport } from "@/lib/importer";
import { complete } from "@/lib/llm/complete";
import type { ProviderId } from "@/lib/llm/types";
import { AREAS } from "@/lib/meta";
import { blockedTerm, isSensitive } from "@/lib/privacy";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(IMPORT_MAX_CHARS),
  origin: z.enum(["Claude", "ChatGPT", "Gemini", "Outra"]),
  area: z.enum(AREAS).optional(),
}).strict();

// Importa memórias de outra IA. Tudo entra como pendente: a pessoa aprova uma a uma (ou em lote).
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user || !isAllowed(user.email)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid", message: "Texto vazio ou grande demais (máximo 30 mil caracteres)." }, { status: 400 });
  const { text, origin } = parsed.data;

  const [{ data: profile }, { data: existing }, { data: spend }] = await Promise.all([
    supabase.from("profiles").select("settings").eq("id", user.id).maybeSingle(),
    supabase.from("memories").select("content"),
    supabase.rpc("month_spend_by_provider"),
  ]);
  const settings = (profile?.settings ?? {}) as { blocked?: unknown };
  const blocked = Array.isArray(settings.blocked) ? settings.blocked.map(String) : [];

  let items: { content: string; area: string }[];
  let usedAi = false;
  if (looksLikeList(text)) {
    items = parseImport(text).map((c) => ({ content: c, area: parsed.data.area ?? "Pessoal" }));
  } else {
    // Texto livre: o modelo barato extrai fatos duráveis. Respeita os limites de gasto.
    const budgets = readBudgets(profile?.settings);
    const skip = new Set<ProviderId>();
    for (const r of (spend ?? []) as { provider: ProviderId; cost_usd: number | string }[]) {
      if ((r.provider === "anthropic" || r.provider === "gateway") && Number(r.cost_usd) >= budgets[r.provider]) skip.add(r.provider);
    }
    try {
      const r = await complete(
        `Extraia do texto abaixo fatos duráveis sobre a pessoa (preferências, rotina, projetos pessoais, pessoas próximas, objetivos). ` +
          `Ignore dados sensíveis (documentos, senhas, banco, saúde) e qualquer assunto da empresa onde ela trabalha. ` +
          `Responda só com JSON: {"memorias":[{"texto":"frase curta em português","area":"${AREAS.join("|")}"}]}, no máximo 40 itens.\n\nTexto:\n${text}`,
        { maxTokens: 3000, skip },
      );
      usedAi = true;
      await supabase.from("usage_events").insert({ provider: r.provider, model: r.model.slice(0, 80), kind: "import", input_tokens: r.input, output_tokens: r.output, cost_usd: r.cost });
      const json = r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1);
      const list = (JSON.parse(json) as { memorias?: { texto?: unknown; area?: unknown }[] }).memorias ?? [];
      items = list
        .map((m) => ({
          content: typeof m.texto === "string" ? m.texto.trim().slice(0, 400) : "",
          area: typeof m.area === "string" && (AREAS as readonly string[]).includes(m.area) ? m.area : "Pessoal",
        }))
        .filter((m) => m.content.length >= 8);
    } catch {
      return NextResponse.json({ error: "ai", message: "Não consegui ler esse texto agora. Tente colar como lista, uma informação por linha." }, { status: 502 });
    }
  }

  const seen = new Set((existing ?? []).map((m) => String(m.content).toLowerCase()));
  let skipped = 0;
  const rows: { content: string; area: string; origin: string; status: "pending" }[] = [];
  for (const it of items.slice(0, IMPORT_MAX_ITEMS)) {
    const key = it.content.toLowerCase();
    if (seen.has(key) || isSensitive(it.content) || blockedTerm(it.content, blocked)) { skipped++; continue; }
    seen.add(key);
    rows.push({ content: it.content, area: it.area, origin: `Importado · ${origin}`.slice(0, 40), status: "pending" });
  }
  if (rows.length) {
    const { error } = await supabase.from("memories").insert(rows);
    if (error) return NextResponse.json({ error: "save", message: "Não consegui salvar. Tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ added: rows.length, skipped, usedAi });
}
