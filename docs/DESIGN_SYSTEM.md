# GaDu · Design System

Versão 2.1, de 14/11/2026 (Sprint UX/UI v2.1). Este documento descreve **o que está no código**. Os tokens ficam em `src/app/v2.css`; o estilo das telas de conteúdo, em `src/app/v2-pages.css`. A especificação inicial do PR #1 (identidade e cobertura) foi incorporada aqui.

## Identidade (decisão oficial, não muda sem aprovação)
- Nome **GaDu**, com G e D maiúsculos.
- Logo original aprovado (`public/avatar/logo*.webp`, `public/icons/*`) e o avatar holográfico animado (`src/components/avatar-engine.ts`, `RobotFace.tsx`) são preservados.
- Fundo azul-marinho e grafite (não preto puro); ciano, azul e laranja como cores de identidade; violeta só como acento. Menos neon: brilho apenas em estado real (ouvindo, falando).
- O avatar representa o **assistente** (orbe da barra, painel, conversa, saudação do Hoje). A **marca** nos cabeçalhos é o nome GaDu em texto (`.brand`). O personagem não substitui a marca.
- **Logo novo (três movimentos fluidos em azul, ciano e laranja + GaDu): asset pendente.** O arquivo não está no repositório; quando chegar, entra em `public/brand/` e substitui o texto `.brand`.
- Inteligência digital com traços humanoides, não pele realista.

## Arquivos
- `src/app/v2.css`: tokens dos dois temas, estrutura do app, navegação, assistente, painel, conversa, ajustes e home (v2).
- `src/app/globals.css`: componentes de base e telas anteriores, já usando os tokens.
- `src/lib/modules.ts`: módulos, telas e status. `src/lib/theme.ts`: tema. `src/lib/assistant-context.ts`: contexto do assistente.

## Temas
- **Escuro** é o padrão e a identidade da marca. **Claro** é opcional (Perfil e ajustes › Aparência, ou o botão de sol/lua).
- A escolha fica no cookie `gadu_theme`; o servidor aplica `data-theme` no `<html>`, sem piscar.
- O avatar, o menu lateral e o destaque do painel ficam sempre sobre fundo escuro (classe `.on-dark`), nos dois temas.
- Regra: nenhuma cor fixa em componente. Cores com transparência usam os trios `--*-rgb`: `rgb(var(--sig-rgb) / 0.2)`.

## Tokens
| Grupo | Tokens | Uso |
|---|---|---|
| Trios RGB | `--bg-rgb` `--panel-rgb` `--raise-rgb` `--deep-rgb` `--sig-rgb` `--line-rgb` `--hot-rgb` `--violet-rgb` `--hi-rgb` `--shadow-rgb` | cores com transparência, por tema |
| Superfícies | `--bg` `--panel` `--deep` `--surface` `--surface-2` | fundo, cartões, campos |
| Texto | `--ink` `--ink-2` `--ink-3` | principal, secundário, apoio |
| Sinal e estados | `--sig` `--sig-ink` `--hot` `--bad` `--ok` | ação principal, atenção, erro, sucesso |
| Acentos | `--c-sig` `--c-hot` `--c-violet` `--c-blue` `--c-green` `--c-pink` | cor por módulo, projeto e agente (`colorVar()`) |
| Efeitos | `--holo` `--glow` `--elev` | gradiente holográfico, brilho, elevação |
| Linhas | `--line` `--line-2` `--wash` | bordas e fundos sutis |
| Espaço | `--s-1` 4 a `--s-10` 40 | margens e espaçamentos |
| Raio | `--r-sm` 8 · `--r-md` 12 · `--r-lg` 16 · `--r-xl` 22 · `--r-pill` | cantos |
| Texto (tamanho) | `--fs-xs` 12 a `--fs-3xl` 40 | escala tipográfica |
| Fontes | `--brand-font` (Michroma, só marca e título da home), `--display` = `--body` (Instrument Sans), `--mono` (IBM Plex Mono, números) | títulos especiais, texto e títulos, números. Rótulos sem caixa alta espaçada |
| Movimento | `--dur` · `--ease` | transições; tudo para com "reduzir movimento" |
| Camadas | `--z-nav` `--z-assist` `--z-sheet` `--z-skip` | sobreposição |
| Layout | `--nav-w` 264 · `--assist-w` 384 · `--bar-h` 60 · `--dock-h` 58 · `--touch` 44 | estrutura |

## Módulos e status
Seis módulos: Pessoal, Financeiro, Agent Office, Agent Office Studio, 3D Studio, Plataforma. O status vem de `modules.ts` e aparece no selo `.pill`: **Disponível** (verde), **Beta** (laranja, status `parcial`), **Em desenvolvimento**, **Planejado** (tracejado). Módulo planejado nunca mostra ação: abre a `ModulePage`, que diz que ele ainda não existe. Um teste garante que módulo planejado não lista nada como disponível.

## Componentes
- **Estrutura:** `.app`, `.nav` (menu lateral), `.frame`, `.bar` (cabeçalho), `.dockbar` (barra de baixo), `.sheet` (folha de módulos).
- **Kit React (`src/components/kit.tsx`):** `PageHeader` (`.ph`), `Panel` (`.panel`, `.panel-head`), `EmptyState` (`.empty`). Listas: `.rows` e `.row-i`; grade `.grid-2`.
- **Navegação:** `.nav-grp` (grupo recolhível, estado salvo em `localStorage` `gadu.nav`), `.nav-item`, `.nav-count`, `.nav-extra`, `.nav-user`, `.dock-item`, `.dock-orb` (anéis `.s-listening`, `.s-thinking`, `.s-speaking`), `.pill`, `.skip`.
- **Assistente Universal:** `.assist` (painel), `.assist-head`, `.assist-log`, `.assist-composer`, `.orb-fab`, `.round` (botões redondos).
- **Mensagens:** `.bub.u` (pessoa), `.bub.b` (GaDu), `.notice`.
- **Conversa:** `.chat2`, `.chat-stage` (palco do avatar), `.chat-log`, `.chat-box`.
- **Painel Hoje:** `.greet` (saudação compacta por horário), `.stats` e `.stat`, `.attn` (Precisa de atenção), `.recs` (recomendações), `.mods` e `.mod`.
- **Conversa (v2.1):** palco compacto no celular (avatar de 44 px), `.chat-empty` com `.sug-grid`, `.listening-bar`, microfone dentro do campo.
- **Ajustes:** `.set-head`, `.set-nav`, `.set-group`, `.set-cards`, `.theme-opt`.
- **Base (globals.css):** `.btn`, `.btn-pri`, `.btn-sm`, `.icon-btn`, `.chip`, `.field`, `.card`, `.banner`, `.seg`, `.drawer`.
- **Erros:** `ErrorScreen`; mensagens em `src/lib/errors.ts`.

## Navegação e layout
| Largura | Navegação | Layout |
|---|---|---|
| até 699 px | barra de baixo: Hoje, Conversas, assistente (centro), Tarefas, Módulos; a folha Módulos tem grupos recolhíveis e não repete o que está na barra | uma coluna; assistente como painel de baixo, que expande e sobe com o teclado |
| 700 a 1023 px | barra de baixo | painel em duas colunas; assistente flutuante à direita |
| 1024 px ou mais | menu lateral com grupos recolhíveis; cabeçalho com módulo e tela | assistente como coluna à direita (384 px, ou 520 a 600 px quando alargado); conversa com palco do avatar e leitura de até 780 px |
| 1280 px ou mais | igual | painel em três colunas (duas com o assistente aberto, três a partir de 1500 px) |

## Assistente Universal
- Uma conversa só: o painel e a tela Conversa mostram as mesmas mensagens.
- O app envia `context: { module, view }` em cada mensagem. O servidor valida (a tela precisa pertencer ao módulo; campos extras são recusados) e acrescenta uma linha ao contexto do modelo.
- O contexto é um rótulo. Não carrega dados, não identifica organização nem cliente e não amplia o acesso (`scopesFor` devolve sempre `["pessoal"]`).
- Cruzar informações entre módulos, organizações ou clientes depende da arquitetura de isolamento e da auditoria de segurança do Agent Office. Não implementado. Arquitetura futura: [CORE_CONTEXTUAL.md](CORE_CONTEXTUAL.md).

## Voz (regras)
- Um controle de voz por contexto: orbe da barra (fora da Conversa), microfone dentro do campo (Conversa e painel).
- O microfone só liga por ação da pessoa; nunca escuta enquanto o GaDu fala; tocar de novo interrompe.
- A escuta para sozinha em até 20 s (trava de segurança).
- A transcrição pode ser revisada antes de enviar: desligue "Enviar sozinho o que eu falar" em Configurações.

## Acessibilidade
- Foco visível em tudo (`:focus-visible` ciano).
- Atalho "Pular para o conteúdo" no primeiro Tab.
- Alvos de toque com no mínimo 44 px (`--touch`), auditados em 360 a 1920 px.
- Contraste medido (WCAG): texto principal 15:1 ou mais nos dois temas; texto de apoio 6,8:1 (escuro) e 5,3:1 (claro); ciano de ação 10,8:1 (escuro) e 4,7:1 (claro); botão principal claro 5,2:1.
- `aria-current` na aba ativa; diálogos com `aria-modal`; textos de estado com `role="status"`.
- Respeita "reduzir movimento".

## Como verificar uma mudança visual
1. `npm run build && npm start` e abrir as telas em **360, 390, 412, 768, 1024, 1440 e 1920 px**. Para as telas do app sem login, use uma prévia local com dados fictícios, fora do commit.
2. Conferir: sem rolagem horizontal, nada escondido atrás do menu de baixo ou da voz flutuante, foco visível, alvos de toque.
3. Conferir o console: nenhum erro de hidratação. O que depende do aparelho (voz, microfone) é detectado em `useEffect`, nunca durante a renderização.

## Próximos passos
- Receber o asset do logo novo e trocar o texto `.brand`.
- Migrar estilos inline restantes de Ajustes e Hoje para classes.
- Componentes React compartilhados para botão e campo (`Button`, `Field`).
- Aplicar o sistema aos módulos novos quando forem construídos.
