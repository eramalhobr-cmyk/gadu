# GaDu · Observabilidade e alerta de erros (gratuito, sem serviço novo)

Atualizado em 23/11/2026 (Claude Code). Interruptor: `TELEMETRIA_ENABLED=0` na Vercel desliga tudo abaixo.

## O que existe
| Peça | Onde | O que faz |
|---|---|---|
| Tabela `error_events` | `supabase/migrations/20261123110001_telemetria_erros.sql` (aplicada pelo Cursor em 23/11) | Só o servidor escreve; só administrador lê (RLS). Sem coluna de mensagem, e-mail, IP ou corpo |
| `POST /api/telemetria/erro` | `src/app/api/telemetria/erro/route.ts` | O navegador avisa um erro. Exige sessão, zod `.strict()`, até 2 KB, 30 avisos por pessoa em 10 min (429 depois) |
| Captura do servidor | `src/instrumentation.ts` → `src/lib/telemetria/servidor.ts` | `onRequestError` do Next: erro não tratado de rota ou página, só de quem está logado (pelo cookie) |
| Captura do navegador | `src/components/ErrorReporter.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` | `error`, `unhandledrejection` e as telas de erro. Máximo 5 por carregamento, sem repetir |
| Admin › Erros recentes | `src/components/AdminPage.tsx`, `GET /api/admin/erros` | Erros agrupados (mesma impressão digital): tipo, tela, vezes, hora, "arquivo:linha" |
| Alerta diário | `.github/workflows/alerta-erros.yml`, `POST /api/cron/telemetria-resumo` | Todo dia 08:00 (Brasília) abre ou atualiza uma issue se houve erro nas últimas 24 h. O GitHub avisa por e-mail |

## Privacidade (o que nunca é guardado)
Só entram: origem, rota (sem query, ids viram `:id`), nome do erro (só identificador; texto livre vira `Error`), código curto, status HTTP, "arquivo:linha" do primeiro quadro da pilha, versão do deploy (12 primeiros caracteres do commit) e uma impressão digital (SHA-256) para agrupar. **A mensagem do erro e a pilha completa nunca são lidas nem enviadas.** O banco também recusa rota com `?`, `#` ou espaço. Os registros somem junto com a conta (`on delete cascade`) e os com mais de 30 dias são apagados pelo resumo diário.

## Como ligar o alerta (passo do Eduardo, uma vez)
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
- O servidor só registra erro de quem está logado (a tabela exige `user_id`); erro em página pública (login) não entra.
- Erro que a própria rota captura e responde (ex.: 500 tratado) não passa pelo `onRequestError`; só o não tratado.
- Se a tabela sumir ou o banco falhar, a telemetria se cala e o app segue.
- Regra 8.1 ("tudo por voz"): a lista de erros é só leitura, no Admin (que também não tem navegação por voz hoje); não grava nada na conversa. Registrado na matriz.
