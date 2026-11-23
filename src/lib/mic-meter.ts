"use client";
// Medidor do microfone (UX-7): enquanto o GaDu ouve, publica o volume em `voiceLevel` para o avatar reagir.
// Só no computador (ver `canMeterMic`) e só se o microfone já estiver liberado: nunca pede permissão nova.
// Qualquer falha só desliga o medidor; o reconhecimento continua e o avatar usa a animação própria.
// Nenhum áudio é gravado nem enviado: só o volume do momento, na memória do navegador.
import { canMeterMic, rmsLevel, smoothLevel, voiceLevel } from "./voice-level.ts";

/** Liga o medidor e devolve a função que desliga (pode ser chamada antes de ele terminar de ligar). */
export function startMicMeter(): () => void {
  let stopped = false;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let raf = 0;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void ctx?.close().catch(() => {});
    ctx = null;
    voiceLevel.reset();
  };
  if (typeof window === "undefined" || !canMeterMic(navigator.userAgent)) return stop;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || !navigator.mediaDevices?.getUserMedia || !navigator.permissions?.query) return stop;
  void (async () => {
    try {
      const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (perm.state !== "granted" || stopped) return;
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      ctx = new AC();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let level = 0;
      let last = performance.now();
      const loop = (now: number) => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        an.getByteTimeDomainData(buf);
        level = smoothLevel(level, rmsLevel(buf), (now - last) / 1000);
        last = now;
        voiceLevel.set(level, now);
      };
      raf = requestAnimationFrame(loop);
    } catch {
      stop();
    }
  })();
  return stop;
}
