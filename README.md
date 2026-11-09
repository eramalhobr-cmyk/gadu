# GaDu

Assistente pessoal por voz e texto. Mobile first, multiusuário (cada pessoa vê só os próprios dados), feito para rodar de graça na Vercel + Supabase.

- O que está pronto e o que falta: [ROADMAP.md](ROADMAP.md)
- Como funciona por dentro: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Segurança: [docs/SECURITY.md](docs/SECURITY.md)

## Rodar no computador

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
npm test                     # testes
```

## Publicar (primeira vez)

1. **Banco:** crie um projeto no Supabase e rode `supabase/migrations/*.sql` no SQL Editor (em ordem).
2. **Login:** por padrão, link enviado ao e-mail (nada a configurar além do Site URL e Redirect URLs no Supabase). Para o botão do Google (opcional):
   1. No Google Cloud Console, crie um projeto, configure a tela de consentimento OAuth (tipo *Externo*, modo *Teste*, adicione seu e-mail como usuário de teste).
   2. Crie uma credencial *ID do cliente OAuth* do tipo *Aplicativo da Web*, com o URI de redirecionamento autorizado:
      `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   3. No Supabase: *Authentication → Sign In / Providers → Google*: ative e cole o Client ID e o Client Secret.
   4. No Supabase: *Authentication → URL Configuration*: em *Site URL* coloque a URL da Vercel e em *Redirect URLs* adicione `https://SUA-URL/auth/callback` (e `http://localhost:3000/auth/callback` para desenvolvimento).
3. **Vercel:** importe o repositório e cadastre as variáveis de `.env.example`. Na Vercel, a IA usa o AI Gateway com token automático: não precisa de chave.
4. Abra a URL, entre com o Google e pronto.

## Instalar para outra pessoa

Cada instalação é independente: um projeto Supabase + um projeto Vercel + as chaves da própria pessoa. Nenhum dado do Eduardo vai junto: os dados vivem só no banco, nunca no código.
