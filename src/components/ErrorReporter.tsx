"use client";
import { useEffect } from "react";
import { avisarErro } from "@/lib/telemetria/cliente";

/** Escuta erros não tratados do navegador (só na área logada) e avisa o servidor, sem mensagem nem conteúdo. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => avisarErro(ev.error ?? { name: "Error" });
    const onRejection = (ev: PromiseRejectionEvent) => avisarErro(ev.reason ?? { name: "UnhandledRejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
