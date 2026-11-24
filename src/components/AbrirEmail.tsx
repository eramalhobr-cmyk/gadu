"use client";
import { useEffect, useState } from "react";
import { ehAndroid, gmailAndroidLink } from "@/lib/gmail-link";

/** No Android, tenta abrir a conversa no app e oferece o link web na conta conectada. */
export function AbrirEmail({ href, className = "btn btn-sm" }: { href: string; className?: string }) {
  const [android, setAndroid] = useState(false);
  useEffect(() => { setAndroid(ehAndroid(navigator.userAgent)); }, []);
  const app = android ? gmailAndroidLink(href) : null;
  return (
    <>
      <a className={className} href={app ?? href} target={app ? undefined : "_blank"} rel="noopener noreferrer">Abrir e-mail</a>
      {app && <a className={className} href={href} target="_blank" rel="noopener noreferrer">Abrir no navegador</a>}
    </>
  );
}
