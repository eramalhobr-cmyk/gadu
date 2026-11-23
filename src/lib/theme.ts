// Tema claro ou escuro. O padrão é o claro (pedido do Eduardo, 23/11/2026); o escuro continua como opção. A escolha fica num cookie, para o servidor
// já entregar a página no tema certo (sem piscar), e vale em todas as telas, inclusive a home pública.
export type Theme = "dark" | "light";
export const THEME_COOKIE = "gadu_theme";

export function parseTheme(v: unknown): Theme {
  return v === "dark" ? "dark" : "light";
}

/** Cor da barra do sistema (meta theme-color) de cada tema: o fundo da página. */
export const THEME_COLOR: Record<Theme, string> = { light: "#eef4f9", dark: "#050f1a" };

/** Tema em uso no navegador (o que o servidor aplicou no <html>). */
export function readTheme(fallback: Theme = "light"): Theme {
  if (typeof document === "undefined") return fallback;
  return parseTheme(document.documentElement.dataset.theme ?? fallback);
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.style.colorScheme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.removeAttribute("media"); m.setAttribute("content", THEME_COLOR[t]); });
}
