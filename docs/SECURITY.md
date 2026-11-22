# Segurança

- **Login:** Google OAuth com PKCE via Supabase Auth. Lista de convidados checada no callback, no proxy e em cada chamada de API.
- **Dados:** RLS em todas as tabelas. Funções `security definer` com `search_path` vazio. Orçamento de IA (reserva, liquidação, liberação) só pelo servidor, com o id da sessão (`server_*`, só `service_role`). A pessoa só lê a própria situação (`budget_status`) e a cota diária (`consume_daily_quota`). `anon` não tem acesso a nada no schema `public`. Ver [SEGURANCA_P1_MANUAL.md](SEGURANCA_P1_MANUAL.md).
- **Chaves:** só nas variáveis de ambiente do servidor. A chave publicável do Supabase é pública por design.
- **Navegador:** CSP com nonce por requisição e `strict-dynamic`, HSTS, `X-Frame-Options: DENY`, `Permissions-Policy` liberando só o microfone para o próprio site.
- **Privacidade:** mensagens com dado sensível não são enviadas a nenhuma IA nem gravadas. Termos bloqueados impedem memórias corporativas.
- **Custo:** cota diária por pessoa, teto mensal com reserva atômica (só o servidor liquida), resposta cortada liquidada por estimativa.
- **Login:** limite de tentativas por IP e por e-mail (hash) em `/api/auth/*` e no convite. Bloquear alguém encerra as sessões; um admin não bloqueia outro admin. Proteção contra senhas vazadas é configuração do painel do Supabase (manual).
- **Dependências:** versões fixas, `ignore-scripts=true` no npm (nenhum script de instalação roda).
- **Service worker:** nunca guarda respostas de API, login ou dados da pessoa.

## Reportar um problema

Abra uma issue privada ou fale direto com o mantenedor.
