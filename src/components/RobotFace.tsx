"use client";
import { useEffect, useRef } from "react";
import { Robot, pointer, type FaceMode } from "./robot-engine";

/** Canvas animado do rosto. Pausa sozinho quando a aba some ou o usuário prefere menos movimento. */
export function RobotFace({ mode, compact = false, label = "Rosto do Gadu" }: { mode: FaceMode; compact?: boolean; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const robot = useRef<Robot | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const r = new Robot(canvas.current, { compact });
    robot.current = r;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      pointer.y = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    let raf = 0;
    let last = 0;
    let still: ReturnType<typeof setInterval> | null = null;
    if (reduce) {
      const draw = () => { for (let i = 0; i < 20; i++) r.step(0.05); r.draw(); };
      draw();
      still = setInterval(draw, 1500);
    } else {
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        r.step(dt);
        r.draw();
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (still) clearInterval(still);
      window.removeEventListener("pointermove", onMove);
    };
  }, [compact]);

  useEffect(() => {
    if (robot.current) robot.current.mode = mode;
  }, [mode]);

  return <canvas ref={canvas} role="img" aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
