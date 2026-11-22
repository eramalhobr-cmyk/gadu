"use client";
import { summarizeSources, type SourceItem } from "@/lib/core/format";
import type { ViewId } from "@/lib/modules";

export type SourcesData = { items: SourceItem[]; unavailable: string[] };

const VIEW_NAME: Partial<Record<ViewId, string>> = { tarefas: "Tarefas", agenda: "Agenda", hoje: "Hoje", financeiro: "Financeiro" };

/** "Fontes" sob a resposta do assistente: detalhe recolhível com o que o Core consultou e link para a tela de origem. */
export function SourcesDetail({ data, onOpen }: { data: SourcesData; onOpen: (view: ViewId) => void }) {
  if (!data.items.length && !data.unavailable.length) return null;
  const summary = summarizeSources(data.items);
  return (
    <details className="srcs">
      <summary>Fontes{summary ? ` · ${summary}` : " · nada encontrado"}</summary>
      <ul>
        {data.items.map((s) => (
          <li key={s.tag}>
            <span className="mono tag">{s.tag}</span>
            <span className="grow"><b>{s.label}</b> · {s.text}</span>
            {s.href
              ? <a className="link" href={s.href} target="_blank" rel="noopener noreferrer">Gmail</a>
              : <button className="link-btn" onClick={() => onOpen(s.view)}>{VIEW_NAME[s.view] ?? "Abrir"}</button>}
          </li>
        ))}
        {data.unavailable.map((u) => <li key={u} className="muted">{u}</li>)}
      </ul>
    </details>
  );
}
