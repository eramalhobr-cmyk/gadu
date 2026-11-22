# GaDu Fast Track — modelo de desenvolvimento

Adotado em 13/11/2026 pelo Eduardo. Vale para ChatGPT, Codex e Claude Code.

## Por quê
O GaDu tem hoje um único usuário. O objetivo é usar o GaDu no dia a dia o quanto antes, com entregas pequenas e frequentes validadas em produção, aceitando riscos controlados. Segurança, dados, credenciais, limites financeiros e rollback não entram nessa flexibilização.

## Princípios
1. Entregas pequenas, frequentes e reversíveis.
2. Testes automatizados essenciais sempre: `npm test`, `npm run typecheck`, `npm run build` (e `npm run test:db` quando houver SQL).
3. Produção valida o que é reversível; o que não é reversível passa por validação antes.
4. Problema em produção: corrigir rápido ou reverter o deploy (Vercel guarda as versões anteriores).
5. Não comprometer a arquitetura futura: multiusuário, RLS, `user_id` em toda tabela e independência de provedor de IA continuam obrigatórios.

## Classificação de risco

### Baixo risco: processo simplificado
Interface, textos, experiência, navegação, componentes visuais, funcionalidades novas reversíveis que não mexem em banco, autenticação ou custo, melhorias incrementais e documentação.

- Branch curta → PR → CI verde → **merge pelo Eduardo** (pode ser na hora, sem revisão cruzada).
- Validação direta em produção, com rollback pela Vercel se algo quebrar.
- Registro no próprio PR: o que mudou e como validar.

### Alto risco: validações e aprovações específicas
Banco de dados (migrações, funções, RLS, dados), autenticação e acesso, permissões, credenciais e segredos, segurança, consumo financeiro (limites de IA, cotas, orçamentos, provedores pagos) e integrações que agem em nome do usuário (enviar e-mail, criar eventos, notificações).

- Branch e PR com testes de unidade, integração e, quando houver SQL, `test:db` (Postgres local, inclusive concorrência).
- Plano de implantação, backup quando houver migração e rollback escritos no PR.
- **Aprovação explícita do Eduardo para cada passo sensível**: merge, aplicação de migração no Supabase, mudança de variáveis, segredos ou permissões.
- Revisão cruzada (ChatGPT/Codex/Claude Code) recomendada.
- Migrações: sempre novas (nunca editar uma aplicada), aditivas quando possível, em duas etapas quando trocam algo em uso (cria o novo → publica o app → remove o antigo).

### Dúvida sobre a classe
Tratar como alto risco e perguntar.

## Ritual de cada entrega
1. Ler `ROADMAP.md`, o handoff mais recente e o PR anterior.
2. Implementar na menor fatia útil.
3. Rodar os testes; anotar no PR o que foi e o que não foi executado.
4. Atualizar `ROADMAP.md` (status: implementado, parcial, planejado, a validar) e o handoff.
5. Abrir o PR (rascunho em alto risco) e informar o próximo passo.

## Limites que não mudam
- Nada de segredos, dados pessoais ou conteúdo de usuários em commits, logs ou docs.
- Cada pessoa só vê os próprios dados.
- Teto de gasto com IA sempre ativo e fail closed quando não puder ser verificado.
- Nenhuma ação externa em nome do usuário sem confirmação dele.
