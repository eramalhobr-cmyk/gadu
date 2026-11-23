"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { paletaItens, type PaletaItem } from "@/lib/paleta";
import type { ViewId } from "@/lib/modules";
import { Icon } from "./ui";

const ICON: Record<PaletaItem["kind"], string> = { tela: "chevron", comando: "spark", frase: "chat", perguntar: "send" };

/** Paleta do computador (UX-7 · M6): Ctrl+K. Um campo para ir a uma tela, rodar um comando ou perguntar ao GaDu;
 *  o botão de microfone troca para a voz. Setas escolhem, Enter executa, Esc fecha. */
export function CommandPalette(props: {
  views: ViewId[]; frases: string[]; navMini: boolean; theme: "light" | "dark"; voiceOk: boolean;
  onRun: (it: PaletaItem) => void; onVoice: () => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const itens = useMemo(() => paletaItens(q, props), [q, props]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setSel(0); }, [q]);
  const run = (it: PaletaItem | undefined) => { if (it && (it.kind !== "perguntar" || it.text)) props.onRun(it); };
  return (
    <div className="pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="pal-in">
          <Icon name="spark" size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vá a uma tela, rode um comando ou pergunte ao GaDu"
            aria-label="Comando ou pergunta" aria-controls="pal-list" aria-activedescendant={itens[sel] ? `pal-${itens[sel].id}` : undefined} role="combobox" aria-expanded="true" autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(itens.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(itens[sel]); }
              else if (e.key === "Escape") { e.preventDefault(); props.onClose(); }
            }} />
          {props.voiceOk && <button type="button" className="icon-btn pal-mic" onClick={props.onVoice} aria-label="Falar em vez de escrever" title="Falar"><Icon name="mic" size={18} /></button>}
          <kbd className="pal-kbd">Esc</kbd>
        </div>
        <ul id="pal-list" role="listbox" aria-label="Resultados">
          {itens.map((it, i) => (
            <li key={it.id} id={`pal-${it.id}`} role="option" aria-selected={i === sel} className={`pal-i ${i === sel ? "on" : ""}`}
              onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); run(it); }}>
              <Icon name={ICON[it.kind]} size={17} /><span className="pal-l">{it.label}</span><span className="pal-h">{it.hint}</span>
            </li>
          ))}
        </ul>
        <p className="pal-foot"><kbd>↑</kbd><kbd>↓</kbd> escolher · <kbd>Enter</kbd> executar · <kbd>Ctrl</kbd>+<kbd>K</kbd> abre de qualquer tela</p>
      </div>
    </div>
  );
}
