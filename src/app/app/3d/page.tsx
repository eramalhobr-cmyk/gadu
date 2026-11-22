import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GaduApp } from "@/components/GaduApp";
import { Studio3D } from "@/components/studio3d/Studio3D";
import { modeling3dEnabled } from "@/lib/3d/flag";
import { loadApp } from "../load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "3D · GaDu" };

// 3D Studio (Beta). MODELING_3D_ENABLED diferente de "1": a tela não existe (404), antes de ler qualquer dado da pessoa.
export default async function Page() {
  if (!modeling3dEnabled()) notFound();
  const { props } = await loadApp({ tab: "modulos" });
  return <GaduApp {...props} page={<Studio3D />} />;
}
