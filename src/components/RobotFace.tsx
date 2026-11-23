"use client";
import { useEffect, useRef } from "react";
import { AvatarFx } from "./avatar-engine";
import type { FaceMode } from "./robot-engine";

/** Camada animada do avatar (canvas). Pausa quando a aba some e respeita "reduzir movimento". */
function Visual({ mode, compact = false, label }: { mode: FaceMode; compact?: boolean; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<{ mode: FaceMode; step: (dt: number) => void; draw: () => void } | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const e = new AvatarFx(canvas.current, { compact });
    e.mode = mode;
    engine.current = e;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let still: ReturnType<typeof setInterval> | null = null;
    if (reduce) {
      const draw = () => { for (let i = 0; i < 30; i++) e.step(0.05); e.draw(); };
      draw();
      still = setInterval(draw, 1500);
    } else {
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        e.step(dt);
        e.draw();
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (still) clearInterval(still);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  useEffect(() => {
    if (engine.current) engine.current.mode = mode;
  }, [mode]);

  return <canvas ref={canvas} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}

/** Avatar oficial do GaDu: a ilustração + uma camada animada que reage à voz (escutar, pensar, falar). */
export function Avatar({ mode, compact = false, label = "GaDu" }: { mode: FaceMode; compact?: boolean; label?: string }) {
  return (
    <div className={`avatar m-${mode}`} role="img" aria-label={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={compact ? "/avatar/gadu-480.webp" : "/avatar/gadu.webp"} alt="" decoding="async" draggable={false} />
      <Visual mode={mode} compact={compact} label="" />
    </div>
  );
}
