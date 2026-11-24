"use client";
import { useEffect, useState } from "react";
import { ehAndroid, GMAIL_APP_ANDROID } from "@/lib/gmail-link";

/** "Abrir e-mail" (o e-mail certo, no navegador) e, no Android, "App do Gmail" (abre o app na caixa de entrada,
 * porque o app não aceita link para um e-mail específico). */
export function AbrirEmail({ href, className = "btn btn-sm" }: { href: string; className?: string }) {
  const [android, setAndroid] = useState(false);
  useEffect(() => { setAndroid(ehAndroid(navigator.userAgent)); }, []);
  return (
    <>
      <a className={className} href={href} target="_blank" rel="noopener noreferrer">Abrir e-mail</a>
      {android && <a className={className} href={GMAIL_APP_ANDROID} aria-label="Abrir o app do Gmail na caixa de entrada">App do Gmail</a>}
    </>
  );
}
