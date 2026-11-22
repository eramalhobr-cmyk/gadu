"use client";
import { useEffect, useState } from "react";
import { Icon } from "./ui";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

/** Botão de tema claro/escuro para páginas fora do app (home pública). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(readTheme()); }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="icon-btn" onClick={() => { applyTheme(next); setTheme(next); }} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
