# GaDu · Design System

Versão 1, de 13/11/2026. Este documento descreve **o que está no código**. Os tokens ficam em `:root`, no `src/app/globals.css`. A especificação inicial do PR #1 (identidade e cobertura) foi incorporada aqui.

## Identidade (decisão oficial, não muda sem aprovação)
- Nome **GaDu**, com G e D maiúsculos.
- Logo original aprovado (`public/avatar/logo*.webp`, `public/icons/*`) e o avatar holográfico animado (`src/components/avatar-engine.ts`, `RobotFace.tsx`) são preservados.
- Fundo azul-marinho quase preto; elementos holográficos em ciano e azul; detalhes em violeta e laranja.
- Inteligência digital com traços humanoides, não pele realista.

## Tokens
| Grupo | Tokens | Uso |
|---|---|---|
| Superfícies | `--bg` `--panel` `--deep` | fundo, cartões, áreas profundas |
| Texto | `--ink` `--ink-2` `--ink-3` | principal, secundário, apoio |
| Sinal e estados | `--sig` (ciano) `--hot` (laranja) `--bad` (erro) | ação principal, atenção, erro |
| Acentos | `--c-sig` `--c-hot` `--c-violet` `--c-blue` `--c-green` `--c-pink` | cor por projeto e agente (`colorVar()` em `src/components/ui.tsx`) |
| Holográfico | `--holo` (gradiente ciano → azul → violeta), `--glow` | marca de item ativo, destaques |
| Linhas | `--line` `--line-2` `--wash` | bordas e fundos sutis |
| Espaço | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 · `--s-10` 40 | margens e espaçamentos |
| Raio | `--r-sm` 8 · `--r-md` 12 · `--r-lg` 16 · `--r-xl` 20 · `--r-pill` | cantos |
| Texto (tamanho) | `--fs-xs` 12 · `--fs-sm` 14 · `--fs-md` 16 · `--fs-lg` 18 · `--fs-xl` 22 · `--fs-2xl` 30 | escala tipográfica |
| Fontes | `--display` (Michroma), `--body` (Instrument Sans), `--mono` (IBM Plex Mono) | títulos, texto, rótulos |
| Movimento | `--dur` 0,18 s · `--ease` | transições; tudo para com "reduzir movimento" |
| Camadas | `--z-nav` `--z-fab` `--z-drawer` `--z-skip` | ordem de sobreposição |
| Toque | `--touch` 44 px | altura mínima de alvos de toque |
| Layout | `--side-w` 248 px (272 px a partir de 1440) | largura do menu lateral |

Regra: valor novo de cor, espaço, raio ou movimento entra como token, não fixo no componente. Os estilos inline antigos migram aos poucos (há cerca de 140 hoje, mais da metade em Ajustes, Hoje e Agenda).

## Componentes (classes em `globals.css`)
- **Botões:** `.btn` (48 px), `.btn-pri` (ação principal, uma por área), `.btn-sm` (40 px), `.icon-btn` (44 px), `.link-btn`, `.chip` (40 px).
- **Campos:** `.field`.
- **Superfícies:** `.card` (vidro), `.notice` (aviso), `.banner` (faixa de sistema).
- **Navegação:** `.tabs` e `.tab` (menu de baixo, no celular), `.side`, `.side-item` e `.side-nav` (menu lateral, no computador), `.drawer` (menu ☰ e conversas), `.seg` (abas internas), `.skip` (atalho de teclado).
- **Voz:** `.fab` (botão flutuante), `.dock` (painel compacto), `.mic`, `.talk-bar`.
- **Erros:** `ErrorScreen` (`src/components/ErrorScreen.tsx`); mensagens em `src/lib/errors.ts`.

## Navegação e layout
| Largura | Navegação | Layout |
|---|---|---|
| até 699 px (celular) | menu de baixo fixo, ☰ com menu e conversas, voz flutuante | uma coluna; o conteúdo nunca fica atrás do botão de voz |
| 700 a 1023 px (tablet) | menu de baixo | Hoje em duas colunas; conversa com o avatar ao lado a partir de 900 px |
| 1024 a 1279 px | **menu lateral fixo** (abas, Nova conversa, Conversas anteriores, Guia, Como funciona, estado do GaDu); cabeçalho com o título da tela | Hoje em duas colunas; conversa com o avatar em 38% e a leitura centralizada (máx. 760 px) |
| 1280 px ou mais | menu lateral | Hoje em três colunas |

## Acessibilidade
- Foco visível em tudo (`:focus-visible` ciano).
- Atalho "Pular para o conteúdo" no primeiro Tab.
- Alvos de toque com no mínimo 40 px (meta: 44 px).
- `aria-current` na aba ativa; diálogos com `aria-modal`; textos de estado com `role="status"`.
- Respeita "reduzir movimento".

## Como verificar uma mudança visual
1. `npm run dev` e abrir as telas em **390, 768, 1024 e 1440 px**. Para as telas do app sem login, use uma prévia local com dados fictícios, fora do commit.
2. Conferir: sem rolagem horizontal, nada escondido atrás do menu de baixo ou da voz flutuante, foco visível, alvos de toque.
3. Conferir o console: nenhum erro de hidratação. O que depende do aparelho (voz, microfone) é detectado em `useEffect`, nunca durante a renderização.

## Próximos passos
- Migrar estilos inline de Ajustes, Hoje e Agenda para classes e tokens.
- Componentes React compartilhados (`Button`, `Card`, `Field`) quando o número de telas crescer.
- Aplicar o mesmo sistema aos módulos novos (Finanças, 3D Studio, Agent Office).
