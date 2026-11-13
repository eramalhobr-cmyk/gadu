import { ErrorScreen } from "@/components/ErrorScreen";

export default function NotFound() {
  return <ErrorScreen code="404" title="Página não encontrada" text="O endereço pode ter mudado ou estar incompleto." />;
}
