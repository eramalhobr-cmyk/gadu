# GaDu · Claude Code

**Leia primeiro o [AGENTS.md](AGENTS.md).** Ele traz as regras do projeto para qualquer IA: stack, verificações, branch e PR, migrações, interruptores, segurança e o que atualizar depois de cada entrega. Depois leia o [docs/HANDOFF.md](docs/HANDOFF.md) e revise os itens abertos da IA anterior antes de começar.

## Lembretes rápidos
- Leia o ROADMAP.md antes de começar e **atualize o checklist em toda entrega**.
- Celular primeiro: teste a 390 px antes do computador.
- Segurança primeiro: chaves só no servidor, RLS em toda tabela nova (com `(select auth.uid())`) e validação com zod em toda rota.
- Toda tabela nova pertence a um usuário (`user_id`), para o app servir outras pessoas sem mudar o código.
- Nada do empregador de ninguém entra aqui (cada pessoa bloqueia termos em Ajustes). O negócio próprio da pessoa pode entrar. Nenhum dado pessoal no código ou nos testes.
- Migrações novas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`. Nunca edite uma já aplicada.
- Antes de subir: `npm run typecheck && npm test && npm run build && bash scripts/test-db.sh`.
- Textos da interface em português do Brasil, com frases curtas e diretas.
- Processo por risco: [docs/FAST_TRACK.md](docs/FAST_TRACK.md). Na dúvida, trate como alto risco.
- Decisões oficiais de produto: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Não as contrarie sem aprovação do Eduardo.

## Específico do Claude Code
- Assine os commits com o trailer `Co-Authored-By: Claude …`, como já é feito, e preencha "Feito por (IA): Claude Code" no PR.
- A cota de uso é de 5 horas. Quando estiver perto do fim, siga a seção 10 do AGENTS.md: commit `wip:`, push e registro no HANDOFF.
