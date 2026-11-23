# DESIGN.md · GaDu

Guia curto para quem (pessoa ou IA) desenha ou muda uma tela do GaDu. O detalhe do que já está no código fica em `docs/DESIGN_SYSTEM.md`; as referências de terceiros, revisadas e só em texto, ficam em `docs/design/` (ver `docs/design/README.md`).

## O produto
- **O que é:** assistente pessoal por voz e texto, em português do Brasil. Organiza o dia (tarefas, agenda, lembretes), metas, projetos, finanças, memória e agentes.
- **Para quem:** o Eduardo e pessoas convidadas, no celular primeiro (uma mão, com interrupções) e no computador.
- **Trabalho principal de cada tela:** dizer o que importa agora e deixar falar com o GaDu em um toque.

## Princípios
1. **Voz primeiro.** Toda função tem o seu comando de voz e uma frase de exemplo visível ("Diga: …"). Um microfone por tela.
2. **Uma coisa por vez.** Uma ação principal e até duas secundárias à vista; o resto em "Mais opções" (≤ 4 escolhas por ponto de decisão).
3. **Mostrar as ligações.** Meta ↔ projeto ↔ tarefa ↔ agenda aparecem como selos e no Mapa do GaDu.
4. **O avatar é o assistente; o nome GaDu é a marca.** O avatar cresce quando o GaDu ouve, pensa ou fala.
5. **Linguagem da pessoa.** Verbos simples, frases curtas, sem jargão técnico, erro diz o que fazer.
6. **Nada escondido atrás de cor.** Estado sempre com texto ou ícone também.

## Temas e tokens
- **Claro é o padrão** (desde 23/11/2026); escuro é opção salva no cookie `gadu_theme`. Os dois usam os mesmos nomes de token em `src/app/v2.css`.
- Nenhuma cor fixa em componente; transparência pelos trios `--*-rgb`. Superfícies grandes nunca forçam o escuro (`.on-dark` só no disco do avatar).

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` | `#f1f5fa` | `#0a111e` | fundo e `theme-color` |
| `--panel` | `#ffffff` | `#101a2a` | cartões e painéis |
| `--ink` / `--ink-2` / `--ink-3` | `#0f1c2e` / `#2c3d55` / `#56677e` | `#e9eff7` / `#c4d0de` / `#8d9db3` | texto |
| `--sig` | `#00788c` | `#3ed6e8` | ação principal, foco |
| `--hot` | `#a65000` | `#ff9a48` | atenção, atraso |
| `--c-blue` / `--c-green` / `--c-violet` | `#1f63c8` / `#1b7a44` / `#6048c4` | `#5b9dff` / `#5fdc9a` / `#a08cfa` | cor por área |

Tipografia: Instrument Sans para texto e títulos; Michroma só na marca; IBM Plex Mono só em números. Espaço em múltiplos de 4 (`--s-*`), raios `--r-*`, alvos de toque ≥ 44 px.

## Movimento
- Só para mostrar causa e efeito (ouvir, pensar, falar, abrir, confirmar). Nada anima em ações repetidas o dia todo.
- Entrar/sair: ease-out forte `cubic-bezier(0.23, 1, 0.32, 1)`; mover na tela: `cubic-bezier(0.77, 0, 0.175, 1)`. UI abaixo de 300 ms; folhas e modais até 500 ms. Nunca `scale(0)` nem `transition: all`.
- Só `transform` e `opacity` (fora exceções medidas). "Reduzir movimento" sempre respeitado.
- Referência: `docs/design/emilkowalski-animation/STANDARDS.md`.

## Piso de qualidade (todo PR de interface)
- Teclado e foco visível; nomes acessíveis em botões só de ícone; `aria-live` para avisos.
- Celular 390 px e computador 1440 px sem rolagem lateral; áreas seguras respeitadas.
- Estados vazio, carregando, erro e muito texto desenhados.
- Capturas antes e depois a 390 e 1440 px, nos dois temas quando mexer em cor.
- Referência: `docs/design/vercel-web-interface-guidelines/GUIDELINES.md`.

## Processo
1. **Plano curto antes do código** (cores, tipo, layout em ASCII, princípios) e revisão contra o pedido: se parecer padrão genérico, mude e diga por quê (`docs/design/anthropic-frontend-design/GUIDANCE.md`).
2. **Construir** com os tokens e componentes do kit; voz e testes junto (AGENTS.md).
3. **Criticar** com a rubrica (`docs/design/impeccable/critique-rubric.md`): carga cognitiva, 10 heurísticas (0 a 4) e 2 ou 3 personas. Registrar o resultado em `docs/design/critica-*.md`.

## Evitar
- Cartões idênticos para tudo, sombra cinza igual em tudo, degradê só de enfeite.
- Rótulo em CAIXA ALTA acima de cada título; "→" no fim de botões.
- Dois microfones na mesma tela; ícone sem texto na navegação.

## Direção visual
Em escolha: três direções simuladas (A Aurora de vidro, B Neon orbital, C Calma clara) em `/workspace/gadu-review/visual-direcoes/` (máquina do Grok Bot). Nada disso entra no código antes da escolha do Eduardo; quando ele escolher, os tokens desta página mudam aqui primeiro.
