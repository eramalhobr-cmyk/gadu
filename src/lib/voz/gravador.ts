"use client";
// Microfone com transcrição na nuvem (opcional, Ajustes). Mesmo contrato do reconhecimento do aparelho
// (createRecognizer em speech.ts): start/stop/abort e avisos onText/onEnd/onError, para o app trocar um pelo outro.
// Grava PCM na memória, para sozinho quando a pessoa fica em silêncio, monta um WAV curto e manda para
// /api/voz/transcrever. Nada é guardado no aparelho nem no servidor: só o texto volta.
import { voiceLevel } from "../voice-level.ts";
import { montarWav, reduzirTaxa, volume } from "./wav.ts";

/** Volume a partir do qual conta como fala. */
const LIMIAR = 0.02;
/** Silêncio depois de falar que encerra a gravação. */
const SILENCIO_MS = 1600;
/** Sem fala nenhuma nesse tempo: desiste ("não ouvi nada"). */
const ESPERA_MS = 7000;

export function canRecord(): boolean {
  if (typeof window === "undefined" || window.isSecureContext === false) return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof navigator.mediaDevices?.getUserMedia === "function" && Boolean(w.AudioContext || w.webkitAudioContext);
}

type Handlers = {
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (code: string, detalhe?: string) => void;
  /** Parou de ouvir e está transcrevendo (para a tela avisar). */
  onProcessing?: () => void;
};

export type CloudRec = { start: () => void; stop: () => void; abort: () => void };

export function createCloudRecognizer(h: Handlers, endpoint = "/api/voz/transcrever"): CloudRec {
  let fase: "nova" | "ouvindo" | "fim" = "nova";
  let abortado = false;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let proc: ScriptProcessorNode | null = null;
  const blocos: Float32Array[] = [];
  let taxa = 48_000;
  let falou = false;
  let inicio = 0;
  let ultimaFala = 0;

  const desmontar = () => {
    try { proc?.disconnect(); } catch {}
    if (proc) proc.onaudioprocess = null;
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => {});
    proc = null; stream = null; ctx = null;
    voiceLevel.reset();
  };

  const terminar = async () => {
    if (fase === "fim") return;
    const estava = fase;
    fase = "fim";
    desmontar();
    if (abortado || estava === "nova") { h.onEnd(); return; }
    if (!falou) { h.onError("no-speech"); h.onEnd(); return; }
    h.onProcessing?.();
    let total = 0;
    for (const b of blocos) total += b.length;
    const tudo = new Float32Array(total);
    let o = 0;
    for (const b of blocos) { tudo.set(b, o); o += b.length; }
    blocos.length = 0;
    const wav = montarWav(reduzirTaxa(tudo, taxa));
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "audio/wav" }, body: wav as BodyInit, signal: AbortSignal.timeout(35_000) });
      const j: { texto?: unknown; message?: unknown } = await r.json().catch(() => ({}));
      if (abortado) { h.onEnd(); return; }
      if (!r.ok) { h.onError(`cloud-${r.status}`, typeof j.message === "string" ? j.message : undefined); h.onEnd(); return; }
      const texto = typeof j.texto === "string" ? j.texto.trim() : "";
      if (texto) h.onText(texto, true);
      else h.onError("no-speech");
    } catch {
      if (!abortado) h.onError("cloud-network");
    }
    h.onEnd();
  };

  return {
    start() {
      if (fase !== "nova") return;
      fase = "ouvindo";
      inicio = performance.now();
      void (async () => {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
          if (fase !== "ouvindo") { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s;
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ctx = new AC();
          if (ctx.state === "suspended") await ctx.resume().catch(() => {});
          taxa = ctx.sampleRate;
          const fonte = ctx.createMediaStreamSource(s);
          // ScriptProcessor: antigo, mas funciona em todos os navegadores (AudioWorklet exigiria outro arquivo e CSP própria).
          proc = ctx.createScriptProcessor(4096, 1, 1);
          proc.onaudioprocess = (e) => {
            if (fase !== "ouvindo") return;
            const bloco = new Float32Array(e.inputBuffer.getChannelData(0));
            blocos.push(bloco);
            const agora = performance.now();
            const v = volume(bloco);
            voiceLevel.set(Math.min(1, v * 8), agora);
            if (v > LIMIAR) { falou = true; ultimaFala = agora; }
            if (falou ? agora - ultimaFala > SILENCIO_MS : agora - inicio > ESPERA_MS) void terminar();
          };
          fonte.connect(proc);
          proc.connect(ctx.destination); // sem saída conectada o Chrome não entrega o áudio (a saída é silêncio)
        } catch (e) {
          const nome = (e as { name?: string })?.name;
          fase = "fim";
          desmontar();
          h.onError(nome === "NotAllowedError" || nome === "SecurityError" ? "not-allowed" : nome === "NotFoundError" ? "audio-capture" : "cloud-mic");
          h.onEnd();
        }
      })();
    },
    stop() { void terminar(); },
    abort() { abortado = true; void terminar(); },
  };
}
