"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { micErrorMessage } from "@/lib/errors";
import { cleanName, nextStep, ONBOARDING_STEPS, prevStep, STEPS, VOICE_TEXT, type OnboardingStatus, type OnboardingStep } from "@/lib/onboarding";
import { canListen, canSpeak, createRecognizer, type Speaker } from "@/lib/speech";
import { Icon } from "./ui";

type Rec = NonNullable<ReturnType<typeof createRecognizer>>;

/** Primeiro uso guiado e falado, em 3 passos (UX-4): nome, testar microfone e voz, conectar o Google.
 * Pode ser pulado a qualquer momento; o Voltar do Android fecha (uma camada no histórico, em GaduApp).
 * O que a pessoa faz aqui grava só o nome (perfil) e a marca de "guia feito" (settings). */
export function Onboarding(props: {
  name: string;
  speaker: Speaker | null;
  /** A pessoa deixou a voz do GaDu ligada nas preferências. */
  voiceOn: boolean;
  /** Grava o nome no perfil; devolve false se não gravou. */
  onSaveName: (name: string) => Promise<boolean>;
  /** Fecha o guia. "done" = chegou ao fim; "skipped" = pulou ou voltou. */
  onClose: (status: OnboardingStatus) => void;
}) {
  const [step, setStep] = useState<OnboardingStep>("nome");
  const [name, setName] = useState(props.name);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [mic, setMic] = useState<{ state: "idle" | "listening" | "heard" | "none" | "error"; text: string }>({ state: "idle", text: "" });
  const [google, setGoogle] = useState<null | boolean>(null);
  const recRef = useRef<Rec | null>(null);
  const idx = ONBOARDING_STEPS.indexOf(step) + 1;
  const def = STEPS[step];
  // Só depois de montar: no servidor não há `window`, e ler isso no primeiro desenho quebraria a hidratação.
  const [caps, setCaps] = useState({ voiceOk: false, micOk: false });
  useEffect(() => { setCaps({ voiceOk: canSpeak(), micOk: canListen() }); }, []);
  const { voiceOk, micOk } = caps;

  const stopMic = useCallback(() => { try { recRef.current?.abort(); } catch {} recRef.current = null; }, []);
  useEffect(() => stopMic, [stopMic]);

  // O GaDu fala cada passo ao abrir (se a voz está ligada). Mudar de passo corta a fala e o teste do microfone.
  useEffect(() => {
    stopMic();
    setMic({ state: "idle", text: "" });
    setErr("");
    if (props.voiceOn && canSpeak() && props.speaker) { props.speaker.cancel(); props.speaker.announce(STEPS[step].say); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, props.speaker]);
  useEffect(() => () => { props.speaker?.cancel(); }, [props.speaker]);

  useEffect(() => {
    if (step !== "google") return;
    fetch("/api/google/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j: { connected?: boolean } | null) => setGoogle(j ? Boolean(j.connected) : null)).catch(() => setGoogle(null));
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose("skipped"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  function testVoice() {
    if (!props.speaker || !voiceOk) return;
    props.speaker.test("Oi! Esta é a minha voz. Se você me ouve bem, é só seguir.");
  }
  function testMic() {
    if (mic.state === "listening") return stopMic();
    props.speaker?.cancel();
    const rec = createRecognizer({
      onText: (text, final) => setMic({ state: final ? "heard" : "listening", text }),
      onEnd: () => setMic((m) => (m.state === "listening" ? (m.text ? { state: "heard", text: m.text } : { state: "none", text: "" }) : m)),
      onError: (code) => { const t = micErrorMessage(code); setMic(t && code !== "no-speech" ? { state: "error", text: t } : { state: "none", text: "" }); },
    });
    if (!rec) return setMic({ state: "error", text: VOICE_TEXT.noMic });
    recRef.current = rec;
    setMic({ state: "listening", text: "" });
    setTimeout(() => { if (recRef.current === rec) { try { rec.stop(); } catch {} } }, 10_000);
    try { rec.start(); } catch { setMic({ state: "error", text: micErrorMessage("") }); }
  }

  async function next() {
    if (step === "nome") {
      const n = cleanName(name);
      if (n && n !== props.name) {
        setSaving(true);
        const ok = await props.onSaveName(n);
        setSaving(false);
        if (!ok) return setErr("Não consegui salvar o nome. Toque em Continuar para tentar de novo ou em Pular.");
      }
    }
    const n = nextStep(step);
    if (n) setStep(n); else props.onClose("done");
  }
  const back = () => { const p = prevStep(step); if (p) setStep(p); };

  return (
    <div className="listen-wrap" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="listen onb">
        <button className="icon-btn listen-x" onClick={() => props.onClose("skipped")} aria-label="Pular o guia"><Icon name="x" /></button>
        <p className="listen-status" role="status">Passo {idx} de {ONBOARDING_STEPS.length}</p>
        <div className="onb-dots" aria-hidden="true">{ONBOARDING_STEPS.map((s) => <i key={s} className={s === step ? "on" : ""} />)}</div>
        <h2 className="listen-text" id="ob-title">{def.title}</h2>
        <p className="onb-text">{def.text}</p>

        {step === "nome" && (
          <label className="onb-field">
            <span className="sr">Seu nome</span>
            <input className="field" value={name} maxLength={40} autoComplete="given-name" autoFocus placeholder="Seu nome" onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void next(); } }} />
          </label>
        )}

        {step === "voz" && (
          <div className="onb-acts">
            <button className="btn" onClick={testVoice} disabled={!voiceOk}><Icon name="chat" size={20} />Ouvir a voz do GaDu</button>
            {!voiceOk && <span className="onb-note">{VOICE_TEXT.noVoice}</span>}
            <button className={`btn ${mic.state === "listening" ? "btn-pri" : ""}`} onClick={testMic} disabled={!micOk}><Icon name="mic" size={20} />{mic.state === "listening" ? "Parar" : "Falar"}</button>
            {!micOk && <span className="onb-note">{VOICE_TEXT.noMic}</span>}
            <p className="onb-result" role="status" aria-live="polite">
              {mic.state === "listening" ? (mic.text ? `“${mic.text}”` : VOICE_TEXT.listening)
                : mic.state === "heard" ? VOICE_TEXT.heard(mic.text)
                : mic.state === "none" ? VOICE_TEXT.nothing
                : mic.state === "error" ? mic.text : ""}
            </p>
          </div>
        )}

        {step === "google" && (
          <div className="onb-acts">
            {google ? <p className="onb-result" role="status">O Google já está conectado. Está tudo certo.</p>
              : <a className="btn btn-pri" href="/api/google/connect" onClick={() => props.onClose("done")}><Icon name="link" size={20} />Conectar o Google</a>}
          </div>
        )}

        {err && <p className="evc-err" role="alert">{err}</p>}

        <div className="onb-nav">
          {prevStep(step) ? <button className="btn" onClick={back}>Voltar</button> : <span />}
          <button className="btn btn-pri" onClick={() => void next()} disabled={saving}>{step === "google" ? (google ? "Concluir" : "Agora não") : "Continuar"}</button>
        </div>
        <div className="onb-foot">
          {props.voiceOn && voiceOk && props.speaker && <button className="link-btn" onClick={() => { props.speaker?.cancel(); props.speaker?.announce(def.say); }}>Ouvir de novo</button>}
          <button className="link-btn" onClick={() => props.onClose("skipped")}>Pular o guia</button>
        </div>
        <span className="listen-cap">Você pode ver este guia de novo em Configurações, ou dizer “me mostra o guia de novo”.</span>
      </div>
    </div>
  );
}
