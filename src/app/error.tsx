"use client";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";

// Erro inesperado numa tela: mostra uma mensagem clara e deixa tentar de novo sem perder o app.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("tela com erro", error.digest ?? ""); }, [error]);
  return (
    <ErrorScreen
      title="Algo deu errado nesta tela"
      text="Não foi culpa sua. Tente de novo; se continuar, feche e abra o GaDu."
      code={error.digest ? `código ${error.digest.slice(0, 10)}` : undefined}
      action={<button className="btn btn-pri" onClick={reset}>Tentar de novo</button>}
    />
  );
}
