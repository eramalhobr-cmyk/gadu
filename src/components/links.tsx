"use client";
// Ligações visíveis (UX-7): chip "Meta: …" nas tarefas e nos projetos. Só leitura; a ligação se faz na meta ou pela voz.
import { createContext, useContext, useEffect, useState } from "react";
import { goalChip, goalsByItem, type GoalLink, type GoalRef } from "@/lib/ligacoes";
import type { ViewId } from "@/lib/modules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Icon } from "./ui";

export type Links = { goals: boolean; open: (view: ViewId) => void };
const LinksContext = createContext<Links>({ goals: false, open: () => {} });
export const LinksProvider = LinksContext.Provider;
export const useLinks = () => useContext(LinksContext);

/** Metas ligadas a cada tarefa ou projeto da pessoa (RLS). Com Metas desligado (GOALS_ENABLED=0), nada. */
export function useGoalLinks(kind: "tasks" | "projects", reload: unknown): Map<number, string[]> {
  const { goals } = useLinks();
  const [map, setMap] = useState<Map<number, string[]>>(new Map());
  useEffect(() => {
    if (!goals) { setMap(new Map()); return; }
    let live = true;
    void (async () => {
      try {
        const db = supabaseBrowser();
        const col = kind === "tasks" ? "task_id" : "project_id";
        const { data: rows, error } = await db.from(kind === "tasks" ? "goal_tasks" : "goal_projects").select(`goal_id, ${col}`).limit(500);
        if (error || !rows?.length) { if (live) setMap(new Map()); return; }
        const links: GoalLink[] = (rows as unknown as Record<string, unknown>[]).map((r) => ({ goal_id: String(r.goal_id), item: Number(r[col]) }));
        const ids = [...new Set(links.map((l) => l.goal_id))];
        const { data: gs } = await db.from("goals").select("id, titulo, status").in("id", ids);
        if (live) setMap(goalsByItem(links, (gs ?? []) as GoalRef[]));
      } catch {
        if (live) setMap(new Map());
      }
    })();
    return () => { live = false; };
  }, [goals, kind, reload]);
  return map;
}

/** Chip da meta ligada. `asButton` abre a tela Metas; dentro de um cartão que já é botão, fica só o texto. */
export function GoalChip({ titles, asButton = true }: { titles?: string[]; asButton?: boolean }) {
  const { open } = useLinks();
  if (!titles?.length) return null;
  const label = `Meta: ${titles.join(", ")}`;
  const inner = <><Icon name="target" size={13} />{goalChip(titles)}</>;
  return asButton
    ? <button type="button" className="tl-tag link-chip" onClick={() => open("metas")} aria-label={`${label}. Abrir Metas`} title={label}>{inner}</button>
    : <span className="tl-tag link-chip" title={label} aria-label={label}>{inner}</span>;
}
