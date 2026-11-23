// Design system v2 (UX-7 · G3): vitrine dos componentes do tema JARVIS, para revisão e para os testes visuais do CI.
// Os números são EXEMPLOS fixos e estão marcados como tal; a página não lê dados de ninguém.
// Desligada em produção: só abre com GADU_DESIGN_PAGE=1 (CI) ou em desenvolvimento.
import { notFound } from "next/navigation";
import { DesignShowcase } from "@/components/DesignShowcase";

export const dynamic = "force-dynamic";
export const metadata = { title: "GaDu · Design system v2", robots: { index: false, follow: false } };

export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.GADU_DESIGN_PAGE !== "1") notFound();
  return <DesignShowcase />;
}
