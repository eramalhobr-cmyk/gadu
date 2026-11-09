"use client";
import { useEffect, useRef } from "react";
import { Brain } from "./brain-engine";
import { Bot } from "./bot-engine";
import { Robot, pointer, type FaceMode } from "./robot-engine";

type Kind = "brain" | "robot" | "bot";

/** Canvas animado (cérebro ou rosto). Pausa quando a aba some e respeita "reduzir movimento". */
export function Visual({ kind, mode, compact = false, icon = false, label }: { kind: Kind; mode: FaceMode; compact?: boolean; icon?: boolean; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<{ mode: FaceMode; step: (dt: number) => void; draw: () => void } | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const e = kind === "brain" ? new Brain(canvas.current, { compact, icon, hud: !compact && !icon }) : kind === "bot" ? new Bot(canvas.current, { compact }) : new Robot(canvas.current, { compact });
    e.mode = mode;
    engine.current = e;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (ev: PointerEvent) => {
      pointer.x = (ev.clientX / (window.innerWidth || 1)) * 2 - 1;
      pointer.y = (ev.clientY / (window.innerHeight || 1)) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
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
      window.removeEventListener("pointermove", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, compact]);

  useEffect(() => {
    if (engine.current) engine.current.mode = mode;
  }, [mode]);

  return <canvas ref={canvas} role="img" aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}

/** Compatibilidade: rosto humanoide. */
export function RobotFace({ mode, compact = false, label = "Rosto do GaDu" }: { mode: FaceMode; compact?: boolean; label?: string }) {
  return <Visual kind="robot" mode={mode} compact={compact} label={label} />;
}
