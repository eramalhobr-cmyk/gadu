"use client";
import { useEffect, useRef } from "react";
import type { ViewId } from "@/lib/modules";
import { sayHere } from "@/lib/o-que-dizer";
import { Icon } from "./ui";

/** "O que posso dizer aqui" (UX-7 · M5): frases de exemplo da tela atual. Tocar numa frase põe o texto no campo
 *  para você conferir antes de enviar (nada é executado sozinho). */
export function SayHere({ view, onPick, onClose }: { view: ViewId; onPick: (s: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button.say-item")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="say-pop" role="dialog" aria-label="O que posso dizer aqui" ref={ref}>
      <div className="say-head">
        <b>Você pode dizer</b>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar as dicas"><Icon name="x" size={18} /></button>
      </div>
      <ul>
        {sayHere(view).map((s) => (
          <li key={s}><button type="button" className="say-item" onClick={() => onPick(s)}><span aria-hidden="true">“</span>{s}<span aria-hidden="true">”</span></button></li>
        ))}
      </ul>
      <p className="say-foot">Toque numa frase para levá-la ao campo, ou fale pelo microfone. Em qualquer tela: “abre finanças”, “desfaz”.</p>
    </div>
  );
}
