# GaDu — instruções compartilhadas para agentes de desenvolvimento

Este arquivo é a porta de entrada para Codex, Claude Code e outros agentes. A fonte oficial é o GitHub, não o histórico privado de conversas.

## Ordem de leitura
1. `docs/PROJECT_CONTEXT.md`
2. `ROADMAP.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SECURITY.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/DEVELOPMENT_HANDOFF.md`
7. Código, migrações e testes reais.

## Regras obrigatórias
- Distinguir sempre **implementado (validado no código)**, **parcial**, **planejado** e **a validar**. Checklists históricos não substituem auditoria.
- Não alterar produção, executar migrações remotas, publicar deploys, mudar credenciais ou permissões sem aprovação explícita.
- Usar branch e pull request; não fazer push direto para main. Revisão, testes e aprovação antes do merge.
- Nunca registrar segredos, dados pessoais ou conteúdo de usuários em commits, logs ou documentação.
- Preservar isolamento multiusuário, RLS, validação de entradas, menor privilégio e consentimento nas integrações.
- Mobile first, mas experiência desktop dedicada; acessibilidade, responsividade e uso efetivo do espaço.
- Seguir design system central e identidade GaDu; evitar duplicação de componentes.
- Em cada entrega: atualizar documentação, decisões, status e handoff; executar testes pertinentes ou registrar o que não foi executado.
- Ler também `CLAUDE.md` quando disponível; em caso de conflito, registrar e solicitar decisão, sem escolher silenciosamente.

## Início de sessão
Verificar branch, diff, últimas mudanças, documentos e código; resumir estado atual, riscos e próxima tarefa. Nunca presumir acesso automático ao histórico de outro agente.
