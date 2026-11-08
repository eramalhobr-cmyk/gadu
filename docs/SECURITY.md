# Segurança

- **Login:** Google OAuth com PKCE via Supabase Auth. Lista de convidados checada no callback, no proxy e em cada chamada de API.
- **Dados:** RLS em todas as tabelas. Funções `security definer` com `search_path` vazio. A única exposta (`consume_quota`) só incrementa o contador da própria pessoa (aviso conhecido do linter do Supabase, aceito).
- **Chaves:** só nas variáveis de ambiente do servidor. A chave publicável do Supabase é pública por design.
- **Navegador:** CSP com nonce por requisição e `strict-dynamic`, HSTS, `X-Frame-Options: DENY`, `Permissions-Policy` liberando só o microfone para o próprio site.
- **Privacidade:** mensagens com dado sensível não são enviadas a nenhuma IA nem gravadas. Termos bloqueados impedem memórias corporativas.
- **Custo:** cota diária por pessoa.
- **Dependências:** versões fixas, `ignore-scripts=true` no npm (nenhum script de instalação roda).
- **Service worker:** nunca guarda respostas de API, login ou dados da pessoa.

## Reportar um problema

Abra uma issue privada ou fale direto com o mantenedor.
