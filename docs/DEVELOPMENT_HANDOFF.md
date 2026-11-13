# GaDu — transferência de contexto entre ChatGPT, Codex e Claude Code

## Início de qualquer sessão
1. Atualize a cópia local e confira a branch e mudanças não commitadas.
2. Leia `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_CONTEXT.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md` e `docs/DESIGN_SYSTEM.md`.
3. Inspecione código, migrações e testes pertinentes; não tome documentação histórica como prova de funcionamento.
4. Resuma implementado, parcial, planejado, riscos, decisões pendentes e próximo passo antes de executar mudanças.

## Fim de qualquer entrega
- Atualize o roadmap e contexto se houver mudança de escopo.
- Registre decisões arquiteturais em `docs/adr/` quando necessário.
- Registre o que mudou, testes executados e resultados, riscos e próximos passos na descrição do pull request.
- Não publicar produção nem alterar bancos/segredos sem autorização específica.

## Prompt curto de retomada
“Continue o GaDu a partir do GitHub. Leia AGENTS.md e os documentos centrais, confira código e estado da branch, identifique diferenças entre documentação e implementação e proponha a próxima tarefa. Não altere produção nem execute operações sensíveis sem minha aprovação.”

## Observação
Históricos privados de chat não são sincronizados automaticamente; apenas informações registradas no repositório são compartilhadas de forma confiável.
