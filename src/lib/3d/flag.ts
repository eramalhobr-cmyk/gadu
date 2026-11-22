// Interruptor do 3D Studio (servidor). DESLIGADO por padrão: só liga com MODELING_3D_ENABLED=1.
// Desligado: a entrada "3D" some do Mais, a tela /app/3d responde 404 e as rotas /api/3d/* respondem 404.
// (O contrário de FINANCE_ENABLED e GOALS_ENABLED, que são ligados por padrão: o 3D é Beta e começa fechado.)
export function modeling3dEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.MODELING_3D_ENABLED ?? "").trim() === "1";
}
