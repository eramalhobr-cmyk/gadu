// Alternância entre as páginas de ajuda (Guia e Como funciona).
export function HelpNav({ active }: { active: "guia" | "sobre" }) {
  return (
    <nav className="help-tabs" aria-label="Ajuda">
      <a href="/app/guia" aria-current={active === "guia" ? "page" : undefined}>Guia</a>
      <a href="/app/sobre" aria-current={active === "sobre" ? "page" : undefined}>Como funciona</a>
    </nav>
  );
}
