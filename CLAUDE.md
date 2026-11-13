# GaDu · regras do projeto

- Leia ROADMAP.md antes de começar e **atualize o checklist em toda entrega**.
- Mobile first: teste sempre em largura de celular (390px) antes do desktop.
- Segurança primeiro: chaves só no servidor, RLS em toda tabela nova (com `(select auth.uid())`), validação com zod em toda rota.
- Toda tabela nova pertence a um usuário (`user_id`) — o app precisa servir outras pessoas sem mudar código.
- Nada do empregador de ninguém entra aqui (cada pessoa bloqueia termos em Ajustes); o negócio próprio da pessoa pode entrar. Nenhum dado pessoal no código ou nos testes.
- Migrações novas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`; nunca editar uma já aplicada.
- Antes de subir: `npm run typecheck && npm test && npm run build`.
- Textos da interface em português do Brasil, frases curtas e diretas.

## GaDu Fast Track (13/11/2026)
- Siga `docs/FAST_TRACK.md`: **baixo risco** (interface, experiência, funcionalidades reversíveis, docs) usa processo simplificado com CI verde e validação em produção; **alto risco** (banco, autenticação, permissões, credenciais, segurança, consumo financeiro) mantém testes completos, plano de rollback e aprovação explícita a cada passo sensível.
- Na dúvida, trate como alto risco.

## Documentação central (13/11/2026)
- `PROJECT_STATUS.md`: situação atual, produção e ponto de retomada. Leia primeiro e atualize ao fim de cada ciclo.
- `ROADMAP.md`: visão por módulo e histórico. `docs/FEATURE_MATRIX.md`: status real por funcionalidade, com arquivos.
- `CHANGELOG.md`: cada entrega diz se está desenvolvida, testada ou publicada, com commit e evidência.
- `docs/ARCHITECTURE.md`: arquitetura e decisões oficiais de produto. Não contrarie essas decisões sem aprovação do Eduardo.
- Só registre teste ou publicação que tenha sido executado de fato. Nada de credenciais ou dados pessoais nos documentos.
