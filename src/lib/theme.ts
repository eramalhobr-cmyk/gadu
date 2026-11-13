// Tema claro ou escuro. O padrão é o escuro (identidade do GaDu). A escolha fica num cookie, para o servidor
// já entregar a página no tema certo (sem piscar), e vale em todas as telas, inclusive a home pública.
export type Theme = "dark" | "light";
export const THEME_COOKIE = "gadu_theme";

export function parseTheme(v: unknown): Theme {
  return v === "light" ? "light" : "dark";
}

/** Tema em uso no navegador (o que o servidor aplicou no <html>). */
export function readTheme(fallback: Theme = "dark"): Theme {
  if (typeof document === "undefined") return fallback;
  return parseTheme(document.documentElement.dataset.theme ?? fallback);
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f2f6f8" : "#05080b");
}
