"use client";
// Núcleo do modo voz imersivo (UX-7 · G1, tema JARVIS): o avatar no centro de anéis que reagem ao som real.
// Um laço por quadro lê o voiceLevel e escreve só a variável --lvl e os traços do espectro (sem re-render do React).
// Com "reduzir movimento", os anéis não giram e o espectro só muda de altura.
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { voiceLevel } from "@/lib/voice-level";
import { espectro, nivelVisual, type ModoNucleo } from "@/lib/nivel-visual";

const N = 60;

/** Escreve --lvl (0 a 1) no elemento enquanto ele existe; também serve para os anéis do avatar da Conversa e do Hoje. */
export function useNivel(ref: RefObject<HTMLElement | null>, modo: ModoNucleo, onFrame?: (lvl: number, t: number) => void) {
  const modoRef = useRef(modo);
  modoRef.current = modo;
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el || document.hidden) return;
      const t = (now - t0) / 1000;
      const lvl = nivelVisual(voiceLevel.read(now), modoRef.current, t);
      el.style.setProperty("--lvl", lvl.toFixed(3));
      frameRef.current?.(lvl, t);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

export function VoiceCore(props: { modo: ModoNucleo; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const linhas = useRef<(SVGLineElement | null)[]>([]);
  useNivel(ref, props.modo, (lvl, t) => {
    const e = espectro(N, lvl, t);
    for (let i = 0; i < N; i++) linhas.current[i]?.setAttribute("y1", String(20 - e[i] * 15));
  });
  return (
    <div className="vcore" ref={ref} data-modo={props.modo} aria-hidden="true">
      <svg className="vcore-svg" viewBox="0 0 200 200">
        <circle className="vc-r3" cx="100" cy="100" r="97" />
        <circle className="vc-r2" cx="100" cy="100" r="89" />
        <circle className="vc-r1" cx="100" cy="100" r="80" />
        <g className="vc-spec">
          {Array.from({ length: N }, (_, i) => (
            <line key={i} ref={(el) => { linhas.current[i] = el; }} x1="100" x2="100" y1="20" y2="21" transform={`rotate(${(i * 360) / N} 100 100)`} />
          ))}
        </g>
      </svg>
      <div className="vcore-ava">{props.children}</div>
    </div>
  );
}
