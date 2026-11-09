# GaDu · regras do projeto

- Leia ROADMAP.md antes de começar e **atualize o checklist em toda entrega**.
- Mobile first: teste sempre em largura de celular (390px) antes do desktop.
- Segurança primeiro: chaves só no servidor, RLS em toda tabela nova (com `(select auth.uid())`), validação com zod em toda rota.
- Toda tabela nova pertence a um usuário (`user_id`) — o app precisa servir outras pessoas sem mudar código.
- Nada do empregador de ninguém entra aqui (cada pessoa bloqueia termos em Ajustes); o negócio próprio da pessoa pode entrar. Nenhum dado pessoal no código ou nos testes.
- Migrações novas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`; nunca editar uma já aplicada.
- Antes de subir: `npm run typecheck && npm test && npm run build`.
- Textos da interface em português do Brasil, frases curtas e diretas.
