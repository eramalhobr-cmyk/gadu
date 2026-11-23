# Plano · Spotify pela API: tocar o Update Diário do dia, também por voz

**Status:** só plano (23/11/2026, Cursor). Nada implementado. Item do ROADMAP: "Spotify pela API (tocar o episódio do dia direto)".
Hoje o GaDu já tem o botão "Ouvir o Update Diário" (link configurável em Ajustes, abre o Spotify). Este plano troca o "abrir" por "tocar o episódio de hoje", sem perder o link como reserva.

Fontes oficiais consultadas em 23/11/2026: [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [Migration guide fev/2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [blog fev/2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security), [blog jul/2026](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates), [Redirect URIs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [Get Show Episodes](https://developer.spotify.com/documentation/web-api/reference/get-a-shows-episodes), [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk).

## 1. O que o Spotify exige em 2026

| Tema | Regra atual | Efeito no GaDu |
|---|---|---|
| Modo do app | Todo app novo nasce em **Development Mode**. O Extended Quota só é aceito para **empresas** com serviço lançado e **≥ 250 mil usuários ativos por mês** (desde 15/05/2025). | O GaDu fica em Development Mode para sempre. Serve para uso pessoal (Eduardo + família). |
| Premium | Desde 09/03/2026, o **dono do app precisa ter Premium**; se o Premium cair, o app para até voltar. | Eduardo precisa de Spotify Premium na conta que cria o app. |
| Usuários | Até **5 usuários** por app, cada um **adicionado à allowlist** no painel (nome + e-mail da conta Spotify). Sem estar na lista, a API responde 403. | Eduardo, Gabi e mais 3. Cada pessoa nova = passo manual no painel. |
| Apps por conta | 25 Client IDs por conta de desenvolvedor (jul/2026); a cota é **compartilhada por conta**. 429 com `"reason": "QUOTA_EXCEEDED"` = cota, diferente de limite de taxa. | Um app só ("GaDu"). Tratar 429 nos dois casos. |
| Endpoints em Dev Mode | Lote (`GET /episodes?ids=`, `GET /shows?ids=`) removido; busca com no máximo 10 resultados; `GET /me` sem `product` e `email`. `GET /shows/{id}/episodes`, `GET /episodes/{id}` e o Player continuam. | Achar o episódio do dia por `GET /shows/{id}/episodes?limit=5` (mais recente primeiro) e conferir `release_date`. Sem `product`, o Premium de cada pessoa só aparece quando o Player responde 403. |
| Tocar | `PUT /me/player/play` **só funciona para Premium** e precisa de `user-modify-playback-state`. A documentação cita `uris` de faixas; episódio (`spotify:episode:…`) funciona na prática, mas **validar no spike**. | Cada pessoa que quiser "tocar direto" precisa de Premium. Sem Premium, o GaDu cai no link. |
| Redirect URI | Tem que ser **HTTPS** e bater exatamente; `localhost` é proibido (loopback só como `http://127.0.0.1:PORTA`). | `https://gadu-agent.vercel.app/api/spotify/callback` (produção) e `http://127.0.0.1:3000/api/spotify/callback` (dev). |
| Autorização | O fluxo recomendado é **Authorization Code com PKCE**. O token de renovação pode mudar a cada renovação (guardar o novo quando vier). | PKCE no servidor do GaDu: sem client secret para guardar. |
| Políticas | Não pode streaming comercial, alterar o áudio, sincronizar com vídeo nem transmitir; metadados e capas precisam de link para o Spotify. | Uso pessoal; o cartão do episódio mostra nome e capa com link "Abrir no Spotify". |

## 2. Como tocar no Galaxy S26 Ultra (e no computador)

| Caminho | Como funciona | Prós | Contras | Decisão |
|---|---|---|---|---|
| **A · Spotify Connect** (Web API) | O GaDu pede `GET /me/player/devices`, escolhe o celular (ou o dispositivo ativo) e chama `PUT /me/player/play?device_id=…` com o episódio. O som sai do **app do Spotify** no celular. | Toca no app que ele já usa, com tela bloqueada, fone e carro; funciona igual no computador. | O celular só aparece na lista de dispositivos com o app do Spotify ativo ou usado há pouco (comportamento observado, não documentado em detalhe; validar no spike). | **Principal.** |
| **B · Web Playback SDK** | O GaDu vira um "dispositivo" dentro do navegador. | Toca dentro do GaDu sem o app. | Há relatos de o áudio parar quando o Chrome do Android vai para segundo plano ou a tela apaga (economia de bateria; a documentação oficial não garante tocar em segundo plano, validar no spike); precisa de Premium e de um toque da pessoa para começar; vídeo-podcast não é suportado. Pior para "ouvir enquanto se arruma". | Só no computador, depois, se fizer falta. |
| **C · Link direto** (reserva) | `https://open.spotify.com/episode/{id}` (o Android abre o app do Spotify pelo App Link) ou `spotify:episode:{id}`. | Sempre funciona, sem Premium e sem conexão. | Abre o episódio; a pessoa toca em Play. | **Reserva obrigatória** quando A falhar (sem Premium, sem dispositivo, 403/429, conexão expirada). |

Fluxo "tocar o Update Diário" (A com reserva C):
1. Token válido? Se não, renova. Sem conexão: link.
2. Episódio do dia: `GET /shows/{show_id}/episodes?limit=5&market=BR`; o mais recente com `release_date` = hoje (Brasília) e `is_playable`. Sem episódio de hoje: avisa "o de hoje ainda não saiu" e oferece o mais recente.
3. Dispositivo: o ativo; senão o celular ("Smartphone") da lista; senão o link (o app abre e a pessoa diz "toca" de novo, ou toca no Play).
4. `PUT /me/player/play` com `{"uris":["spotify:episode:…"]}`. 204 = "Tocando o Update Diário de hoje no seu celular". 403 (sem Premium) ou 404 (sem dispositivo): link.

O `show_id` vem do link que já está em Ajustes (`open.spotify.com/show/…` ou de um episódio dele, via `GET /episodes/{id}` → `show.id`).

## 3. O que o Eduardo precisa fazer (manual, uma vez)

1. Ter **Spotify Premium** ativo na conta dele (obrigatório para o app funcionar e para tocar).
2. Entrar em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) com essa conta e criar o app **"GaDu"** (uso pessoal, não comercial), marcando **Web API**.
3. Cadastrar os Redirect URIs: `https://gadu-agent.vercel.app/api/spotify/callback` e `http://127.0.0.1:3000/api/spotify/callback`.
4. Em **User Management**, adicionar quem vai usar (nome + e-mail da conta Spotify; até 5).
5. Passar o **Client ID** para a Vercel como `SPOTIFY_CLIENT_ID` (não é segredo, mas fica no servidor). Com PKCE **não há client secret** para cadastrar.
6. Conferir em Ajustes que o link do Update Diário aponta para o programa certo.

## 4. Segurança dos tokens

- **Fluxo:** PKCE iniciado no servidor (`/api/spotify/conectar`): `code_verifier` e `state` aleatórios num cookie httpOnly, Secure, SameSite=Lax, válido por 10 min; o callback confere o `state`, troca o código no servidor e apaga o cookie. Nada de token no navegador nem em `localStorage`.
- **Escopos mínimos:** `user-read-playback-state` (ver dispositivos) e `user-modify-playback-state` (tocar). Opcional depois: `user-read-playback-position` (retomar de onde parou). Nada de biblioteca, e-mail ou playlists.
- **Guarda:** tabela nova `spotify_connections` igual à `google_connections`: `user_id` = dona, `refresh_token_enc` com **AES-256-GCM** (`src/lib/crypto.ts`, com o `user_id` como dado autenticado), `scopes`, `spotify_user_id`, datas. O token de acesso (1 h) fica só na memória do servidor durante a requisição.
- **RLS:** dona lê e apaga a própria linha; **gravação só pelo servidor** (sem insert/update pelo cliente), restritivas S-05 com `can_write()`, entradas em `30_isolamento` e `85_s05`. É migração aditiva: aplicar via MCP depois do merge.
- **Chave:** reaproveitar `GOOGLE_TOKEN_KEY` exige renomear o conceito; mais limpo criar `SPOTIFY_TOKEN_KEY` (32 bytes, só na Vercel). Decisão na implementação; nenhuma chave no repositório.
- **Desconectar:** botão em Ajustes apaga a linha e manda a pessoa para a página de apps da conta Spotify para revogar o acesso (o Spotify não tem endpoint de revogação para PKCE).
- **Privacidade:** o GaDu só lê o programa configurado e a lista de dispositivos; não guarda histórico de escuta.

## 5. Voz (AGENTS.md 8.1)

| Frase | Ação | Confirmação |
|---|---|---|
| "toca o Update Diário", "quero ouvir as notícias" | `spotify_tocar` (episódio de hoje do programa configurado) | Não precisa (não grava nada); diz onde vai tocar. |
| "pausa", "continua" | `spotify_pausar` / `spotify_continuar` (`PUT /me/player/pause` / `play` sem corpo) | Não. |
| "volta 30 segundos", "avança 1 minuto" | `spotify_pular` (`PUT /me/player/seek`) | Não. |
| "toca o de ontem" | `spotify_tocar` com data | Não. |
| "conecta meu Spotify" / "desconecta" | abre Ajustes › Spotify / cartão "Desconectar?" | Desconectar com cartão; "Desfazer" = conectar de novo (aviso claro). |

No "Começar o dia", depois do briefing falado, a pergunta "Quer ouvir as notícias agora?" passa a tocar direto quando há conexão, e continua com o link quando não há.

## 6. Esforço

| Etapa | O que | Estimativa |
|---|---|---|
| 0 · Spike (com o app do Eduardo) | Confirmar no S26 Ultra: episódio por `uris`, celular aparecendo em `devices` com o app em segundo plano, 403 sem Premium | 2 h |
| 1 · Migração `spotify_connections` | Tabela, RLS, S-05, testes SQL | 2 h |
| 2 · Conectar/desconectar | Rotas PKCE, callback, criptografia, Ajustes | 4 h |
| 3 · Tocar | Episódio do dia, dispositivo, play/pause/seek, reserva por link, erros 401/403/404/429 | 4 h |
| 4 · Voz e briefing | Ações, cartões, "Começar o dia", testes de integração | 4 h |
| 5 · Docs e e2e | ROADMAP, CHANGELOG, MATRIX §11, HANDOFF, e2e simulado | 2 h |
| **Total** | 5 PRs pequenos | **~18 h** (2 a 3 dias de trabalho) |

## 7. Riscos

- **Política do Spotify muda de novo** (já mudou em fev e jul/2026): o modo de desenvolvimento pode perder endpoints. Mitigação: o link continua como reserva sempre.
- **Premium:** sem Premium do Eduardo o app inteiro para; sem Premium de outra pessoa, só o link funciona para ela.
- **Celular fora da lista de dispositivos** quando o app do Spotify está fechado há muito tempo (Android mata o processo). Mitigação: abrir pelo link e oferecer "tocar" de novo.
- **Episódio por `uris`** está documentado para faixas; se não funcionar para episódio, a reserva é o link (resolvido no spike, antes de qualquer código).
- **Limite de 5 usuários** e allowlist manual.
- **Cota compartilhada** da conta de desenvolvedor: uso pessoal fica longe dela; tratar 429 sem repetir em laço.
- **Termos:** uso não comercial; se o GaDu virar produto pago, essa integração precisa ser revista.

## 8. Decisões para o Eduardo

1. Confirmar que tem (ou vai assinar) **Spotify Premium**.
2. Criar o app no painel (passos da seção 3) e mandar o Client ID.
3. Quem entra na allowlist (até 5).
4. Aprovar a migração aditiva `spotify_connections` e a chave nova `SPOTIFY_TOKEN_KEY`.
