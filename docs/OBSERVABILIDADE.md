# GaDu · Observabilidade e alerta de erros (gratuito, sem serviço novo)

Atualizado em 23/11/2026 (Cursor e Claude Code: monitoramento e alerta de erro). Interruptor: `TELEMETRIA_ENABLED=0` na Vercel desliga tudo abaixo.

## O que existe
| Peça | Onde | O que faz |
|---|---|---|
| Tabela `error_events` | `supabase/migrations/20261123110001_telemetria_erros.sql` (aplicada pelo Cursor em 23/11) | Só o servidor escreve; só administrador lê (RLS). Sem coluna de mensagem, e-mail, IP ou corpo |
| `POST /api/telemetria/erro` | `src/app/api/telemetria/erro/route.ts` | O navegador avisa um erro. Exige sessão, zod `.strict()`, até 2 KB, 30 avisos por pessoa em 10 min (429 depois) |
| Captura do servidor | `src/lib/telemetria/capturar.ts` (`capturarErroServidor`) | Helper único: nunca lança, respeita o interruptor, sanitiza, passa pelo detector de privacidade e grava. Usado pelo `onRequestError` do Next (`src/instrumentation.ts` → `servidor.ts`, erro não tratado) e pelos `catch` de `/api/chat`, `/api/3d/generate`, `/api/cron/tick` e `/api/cron/telemetria-resumo` (inclusive o que a rota captura e responde 500/502/504). Sem sessão (cron, sistema, página pública), entra com `user_id` nulo |
| Captura do navegador | `src/components/ErrorReporter.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` | `error`, `unhandledrejection` e as telas de erro. Máximo 5 por carregamento, sem repetir |
| Admin › Saúde do sistema | `src/components/AdminPage.tsx` (`PainelSaude`), `GET /api/admin/saude` (só administrador) | Totais de 24 h e 7 dias, servidor × cliente, grupos recentes (tipo, rota, vezes, hora de Brasília) e erros por dia. Só dados reais; diz com clareza se o registro está desligado ou o banco indisponível. `GET /api/admin/erros` segue existindo |
| Alerta por push | `src/lib/telemetria/alerta.ts` (decisão e texto), `avisar.ts` (estado, throttle e envio), tabelas `error_alert_state` e `error_alert_dia` | Avisa os administradores ativos pelo push que o app já tem (`sendPush`). Não depende de `TELEMETRIA_TOKEN` |
| Voz | `src/lib/saude-voz.ts` | "Teve algum erro hoje?", "o que quebrou?", "abre a saúde do sistema": comando local, sem modelo |
| Alerta diário | `.github/workflows/alerta-erros.yml`, `POST /api/cron/telemetria-resumo` | Todo dia 08:00 (Brasília) abre ou atualiza uma issue se houve erro nas últimas 24 h. O GitHub avisa por e-mail |

## Alerta de erro para o administrador (push + painel)
Quando um erro é gravado, o alerta roda **em segundo plano** (Next `after`), depois do insert, sem segurar a resposta. Avisa quando aparece:
- **grupo novo:** primeira vez daquela impressão digital, ou primeira nos últimos 7 dias; ou
- **pico:** 5 ou mais ocorrências do mesmo grupo em 15 minutos (`PICO_MIN` e `PICO_JANELA_MIN` em `alerta.ts`).

Texto, em português e sem dado pessoal: "O GaDu teve um erro novo: TypeError em /api/chat (3 vezes)." (ou "O GaDu está com erros em sequência: …"). Tag estável por grupo (`erro-<16 primeiros hex>`), para o aparelho agrupar. Toque abre `/app?tab=admin#painel-saude`. Só vai para quem tem `members.role = 'admin'` e `access = 'active'`. Sem push configurado, sem administrador com aparelho ou sem as tabelas novas: silêncio (o erro continua gravado e aparece no painel).

**Throttle persistido (obrigatório):**
- no máximo **1 push por grupo a cada 6 horas** (`error_alert_state.ultimo_alerta`, tomado com `update … where ultimo_alerta is null or < agora − 6 h`, atômico);
- no máximo **4 pushes de erro por dia de Brasília** (`error_alert_dia`: a vaga (dia, 1 a 4) é tomada com `insert`; a chave primária impede duas execuções de pegarem a mesma);
- se o dia estiver cheio, ou se nenhum aparelho receber, o aviso do grupo é devolvido. Se o banco falhar ao conferir o throttle, **não envia** (fail closed).

**Rede de segurança no cron `tick`** (já usa `CRON_SECRET`, sem token novo): a cada minuto olha os erros dos últimos 30 minutos (no máximo 3 grupos por rodada, 1 consulta e poucas escritas) e avisa o que o caminho imediato perdeu (por exemplo, função encerrada antes do aviso), com o mesmo throttle. O `tick` também faz a **retenção de 30 dias** (erros, estado dos grupos e vagas), uma vez por hora; ela roda mesmo sem push configurado.

## Voz (regra 8.1)
Comandos locais, no aparelho, sem modelo e sem custo (`src/lib/saude-voz.ts`, gancho curto no `send()` do `GaduApp.tsx`): "teve algum erro hoje?", "o que quebrou (hoje)?", "algum erro hoje?", "mostra/abre a saúde do sistema". Administrador: abre Administração, leva o painel à vista e fala, por exemplo, "Hoje houve 3 erros em 2 grupos. O mais recente é TypeError em /api/chat, 2 vezes." ou "Nenhum erro registrado hoje." Quem não é administrador ouve "Isso é só para administrador." (a API também responde 403). "Abre a administração" só abre a tela. Só leitura: não grava nada, então não tem cartão de confirmação.

## Migração `20261123200001_alerta_erros.sql` (aditiva, **ainda não aplicada em produção**)
`error_events.user_id` deixa de ser `not null` (FK e cascata continuam valendo); tabelas novas `error_alert_state` e `error_alert_dia` (sistema, sem `user_id` e sem dado pessoal, RLS ligado, sem política, só `service_role`). Sem aplicar, o app funciona: erro sem sessão não é gravado, o alerta se cala e o painel continua mostrando os erros de quem está logado. Testes: `supabase/tests/81_alerta_erros.test.sql` (e a lista de tabelas de sistema em `30_isolamento.test.sql`).

## Privacidade (o que nunca é guardado)
Só entram: origem, rota (sem query, ids viram `:id`), nome do erro (só identificador; texto livre vira `Error`), código curto, status HTTP, "arquivo:linha" do primeiro quadro da pilha, versão do deploy (12 primeiros caracteres do commit) e uma impressão digital (SHA-256) para agrupar. **A mensagem do erro e a pilha completa nunca são lidas nem enviadas.** O banco também recusa rota com `?`, `#` ou espaço. Os registros somem junto com a conta (`on delete cascade`) e os com mais de 30 dias são apagados pelo cron `tick` (uma vez por hora, minuto 07) e também pelo resumo diário. Última barreira: `protegerEvento` (rota, nome, código e local) usa o detector `isSensitive` (PR #94) mais um teste de e-mail; campo marcado é descartado (rota vira `/`, nome vira `Error`, código e local viram nulos). O mesmo vale para o texto do push, do painel e da frase falada: marcado vira o texto genérico "O GaDu registrou um erro. Abra Administração para ver." ou é omitido.

## Alerta diário por issue do GitHub (opcional; passo do Eduardo, movido para o fim do roadmap)
O alerta por push acima **não** precisa disto. A issue diária continua existindo e só liga com o `TELEMETRIA_TOKEN`.

1. Gere um valor aleatório de 32+ caracteres (`openssl rand -hex 24`).
2. Vercel › Settings › Environment Variables: `TELEMETRIA_TOKEN` = esse valor (Production) e redeploy.
3. GitHub › Settings › Secrets and variables › Actions: segredo `TELEMETRIA_TOKEN` = o mesmo valor.
4. Teste: `gh workflow run alerta-erros.yml`. Sem o segredo, o job só mostra um aviso e termina. Sem a variável na Vercel, a rota responde 404.
O token só lê o resumo (não é o `CRON_SECRET`). Rotacione a cada 90 dias trocando os dois lugares.

## O que a Vercel já oferece de graça (conferido em vercel.com/docs/limits, atualizada em 16/09/2026)
- **Runtime Logs** no painel (Logs): ficam **1 hora no plano Hobby, 1 dia no Pro, 3 dias no Enterprise**. Serve para investigar na hora; não serve como histórico. Por isso a tabela própria.
- **Build logs** de cada deploy e o status do deploy no GitHub (já usado na conferência pós-merge).
- Log Drains (enviar logs para fora) existem na API, mas dependem do plano; não usados aqui.
- Alertas por e-mail de falha de deploy: vêm das notificações da conta Vercel (Settings › Notifications), sem custo.
Não conferi qual é o plano do projeto `gadu-agent` (sem acesso ao painel).

## Limites conhecidos
- Só as rotas ligadas ao helper (`/api/chat`, `/api/3d/generate`, os dois crons) registram o erro que elas mesmas capturam e respondem; as demais só registram o erro não tratado (`onRequestError`). Ligar outra rota é uma linha: `await capturarErroServidor(e, { rota, userId })`.
- Erro sem sessão só é gravado depois que a migração `20261123200001` for aplicada.
- O limite de taxa do servidor (30 em 10 min) vale por pessoa e, para os erros sem pessoa, num balde só.
- Se a tabela sumir ou o banco falhar, a telemetria se cala e o app segue.
- Regra 8.1: a consulta por voz é só leitura e está na seção 11 da matriz.
