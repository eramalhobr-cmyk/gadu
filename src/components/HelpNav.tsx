// Alternância entre as páginas de ajuda (mesmo visual dos segmentos de Perfil).
export function HelpNav({ active }: { active: "guia" | "sobre" }) {
  return (
    <nav className="seg help-nav" aria-label="Ajuda">
      <a href="/app/guia" aria-current={active === "guia" ? "page" : undefined}>Guia</a>
      <a href="/app/sobre" aria-current={active === "sobre" ? "page" : undefined}>Como funciona</a>
    </nav>
  );
}
