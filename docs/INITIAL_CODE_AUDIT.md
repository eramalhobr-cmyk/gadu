# GaDu — auditoria técnica inicial (leitura estática)
Data: 2026-11-12. Escopo: inspeção inicial de arquivos da branch main. **Não foram executados testes, build, deploy nem consultas ao banco remoto.** Não equivale a auditoria de segurança concluída.

## Evidências confirmadas no código
- Next.js 16, React 19, TypeScript, Zod, Supabase e Vercel constam em package.json.
- Rotas de chat, agenda, pesquisa, uso, administração, convites, autenticação, cron e push estão presentes.
- Há migrações SQL versionadas e testes unitários em src/lib.
- `src/app/api/chat/route.ts` valida payload com Zod, consulta autenticação e acesso, aplica cota e teto de custo, consulta contexto e inicia streaming.
- `src/app/api/usage/route.ts` retorna gastos por provedor e orçamento do próprio usuário, além de consultar créditos do AI Gateway.
- `src/app/api/admin/people/route.ts` lista membros e contagens de configuração e permite bloquear/liberar acesso, mas não fornece relatório consolidado de consumo por usuário.
- `src/components/ui.tsx` contém componentes compartilhados básicos, mas ainda não comprova um Design System abrangente.

## Lacunas e verificações prioritárias
1. **Administração de créditos por usuário — parcial:** existe consumo individual e painel de pessoas; falta confirmar visão administrativa consolidada, cotas individuais, créditos concedidos/consumidos/saldo e segregação de dados.
2. **Design System — parcial:** inventariar tokens e componentes em `globals.css` e nas telas; validar navegação, contraste, acessibilidade, responsividade mobile/tablet/desktop e uso da área útil.
3. **Segurança multiusuário — a validar:** revisar todas as políticas RLS, funções SQL, rotas com service role, convites, escopos OAuth, isolamento de dados, controles de abuso e testes de acesso cruzado.
4. **Custos e concorrência — a validar:** examinar atomicidade de cotas e limites mensais sob requisições simultâneas, registro de consumo, falhas e discrepâncias de preço.
5. **Privacidade — a validar:** revisar filtros de dados sensíveis, armazenamento, logs e acesso administrativo; regras textuais não garantem bloqueio completo.
6. **UX e arquitetura — a validar:** identificar componentes grandes, duplicação, acoplamento, estados de erro e desempenho antes de propor refatoração.
7. **GaDu Finance e 3D Studio — planejados nesta visão:** não encontrados módulos específicos na listagem inicial de arquivos; confirmar com busca detalhada antes de declarar ausência de funcionalidades.
8. **Documentação — parcial:** ROADMAP.md contém checklists históricos; reconciliar item por item com implementação e testes antes de alterar status.

## Plano de execução sugerido
- Etapa A: matriz de rastreabilidade (requisito → código → teste → status → risco).
- Etapa B: revisão de segurança de APIs, RLS, migrações e custos; priorizar riscos críticos.
- Etapa C: inventário de UX e Design System, com critérios para 390, 768, 1024 e 1440px.
- Etapa D: ADRs e refatorações incrementais em PRs pequenos, com testes.
- Etapa E: atualizar ROADMAP.md com evidências verificadas e registrar handoff.

## Limitações
Análise estática parcial, sem prova de execução ou de políticas efetivamente aplicadas no Supabase. Nenhuma vulnerabilidade explorável foi confirmada nesta etapa.
