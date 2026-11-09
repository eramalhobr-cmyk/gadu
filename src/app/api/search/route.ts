import { NextResponse } from "next/server";
import { z } from "zod";
import { embed, embeddingsAvailable, toVector } from "@/lib/embeddings";
import { signedIn } from "../google/_auth";

export const dynamic = "force-dynamic";

const Query = z.object({ q: z.string().trim().min(2).max(300) });

// Busca por significado: memórias, conversas, tarefas e projetos da própria pessoa (RLS + filtro na função).
export async function GET(request: Request) {
  const a = await signedIn();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!embeddingsAvailable()) return NextResponse.json({ results: [], semantic: false });
  try {
    const [v] = await embed([p.data.q]);
    const { data, error } = await a.supabase.rpc("search_similar", { query_embedding: toVector(v), match_count: 12 });
    if (error) throw error;
    const results = ((data ?? []) as { kind: string; ref_id: number; content: string; similarity: number }[]).filter((r) => r.similarity > 0.25);
    return NextResponse.json({ results, semantic: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("busca falhou", e instanceof Error ? e.message.slice(0, 120) : "erro");
    return NextResponse.json({ results: [], semantic: false });
  }
}
