// Gancho do Next para erros do servidor sem tratamento (rota ou página que lançou). Só registra no runtime Node.
// Detalhes e limites de privacidade: src/lib/telemetria/servidor.ts e docs/OBSERVABILIDADE.md.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarErroDeRequisicao } = await import("./lib/telemetria/servidor");
  await registrarErroDeRequisicao(err, request);
}
