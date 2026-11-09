import { GaduApp } from "@/components/GaduApp";
import { loadApp, type AppParams } from "./load";

export const dynamic = "force-dynamic";

export default async function AppPage({ searchParams }: { searchParams: Promise<AppParams> }) {
  const { props } = await loadApp(await searchParams);
  return <GaduApp {...props} />;
}
