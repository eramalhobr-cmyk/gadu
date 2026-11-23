# Guias de design de terceiros (só texto, revisados)

Regra de segurança do Eduardo (23/11/2026): antes de adotar uma skill de design, ler **todos os arquivos** que entram; recusar qualquer coisa com scripts, hooks, comandos de instalação, chamadas de rede, passos com `curl`/`npx` ou instruções para enviar dados ou rodar código. Nada instalado globalmente, nenhum instalador rodado. Só o **texto** útil é copiado para cá, com autoria, licença e o commit exato revisado.

Os arquivos foram renomeados (`SKILL.md` → `GUIDANCE.md`, `AGENTS.md` → `GUIDELINES.md`) para que nenhuma ferramenta de IA os carregue sozinha como skill ou instrução de agente: são material de consulta, lidos quando o `DESIGN.md` manda.

## O que entrou

| Pasta | Origem (commit revisado) | Arquivo de origem | Licença |
|---|---|---|---|
| `anthropic-frontend-design/` | [anthropics/skills@e4bb5d9](https://github.com/anthropics/skills/tree/e4bb5d960d87126ff3b3a8af1a104b7db67560ba/skills/frontend-design) | `skills/frontend-design/SKILL.md` → `GUIDANCE.md` | Apache-2.0 (`LICENSE.txt` da própria pasta) |
| `impeccable/` | [pbakaus/impeccable@b49177d](https://github.com/pbakaus/impeccable/tree/b49177d32788f2dc585c42831d845dacf1ebed2c/plugin/skills/impeccable/reference) | `plugin/skills/impeccable/reference/critique-rubric.md` | Apache-2.0 (`LICENSE` e `NOTICE.md` do repositório) |
| `vercel-web-interface-guidelines/` | [vercel-labs/web-interface-guidelines@434b7f9](https://github.com/vercel-labs/web-interface-guidelines/tree/434b7f91364665f2f733b310ec54809bf8f37937) | `AGENTS.md` → `GUIDELINES.md` | MIT (`LICENSE`, Vercel Labs) |
| `emilkowalski-animation/` | [emilkowalski/skills@64eb3de](https://github.com/emilkowalski/skills/tree/64eb3deb9a5fbfa041faf783e0bc3fd635872e9c/skills/review-animations) | `skills/review-animations/STANDARDS.md` | MIT (`LICENSE`, Emil Kowalski) |

Cópias exatas, sem edição (SHA-256 abaixo), para dar para conferir contra a origem.

```
d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3  anthropic-frontend-design/GUIDANCE.md
2d2c28e9fe98dd55a879bafa1684827c812eb31f6b63fe578141d3978ddc664e  emilkowalski-animation/STANDARDS.md
ba070404e3f61c62b40c25a5d096b803825408de12a0fbb559b1587c89692866  impeccable/critique-rubric.md
35411b4a2dcfa651fd33706a92cc860947364b521643107fbf3116abe3826d44  vercel-web-interface-guidelines/GUIDELINES.md
```

## Revisão (23/11/2026, Cursor · Grok Bot)

Cada arquivo copiado foi lido inteiro e também varrido por `curl`, `wget`, `npx`, `npm install`, `bash`, URLs, `fetch(`, `exec`, `eval(`, hooks, tokens/segredos e frases do tipo "ignore as instruções".

- **anthropic-frontend-design/GUIDANCE.md**: só orientação de direção visual, tipografia, processo e escrita. Sem comandos, sem rede. **Aceito.**
- **impeccable/critique-rubric.md**: rubrica de carga cognitiva, 10 heurísticas de Nielsen (0 a 4) e personas. Cita `critique.md` e `impeccable init`/`PRODUCT.md` só como texto (não vieram junto, nada é executado). **Aceito.**
- **vercel-web-interface-guidelines/GUIDELINES.md**: regras MUST/SHOULD/NEVER de interação, acessibilidade, animação, layout e performance. Só links de referência (WAI-ARIA, APCA). **Aceito.**
- **emilkowalski-animation/STANDARDS.md**: valores de easing, duração e regras de movimento. Só links de referência (easing.dev, easings.co). **Aceito.**

### Recusado (não copiado)
- **Impeccable, a skill em si** (`plugin/skills/impeccable/SKILL.md` e os demais 62 arquivos da pasta): o `SKILL.md` manda rodar `scripts/impeccable` (CLI), ligar **hooks** de detecção e capturas com navegador; a pasta traz `scripts/impeccable`, `scripts/live-browser.js` (566 KB), `modern-screenshot.umd.js` e um índice de fontes de 1,1 MB. O repositório também tem `hooks.json` em `.cursor/` e `.agents/`. Fere a regra (scripts, hooks). Só a rubrica de texto entrou. `reference/polish.md` também foi recusado: manda rodar o CLI.
- **Vercel `web-design-guidelines`** (`vercel-labs/agent-skills@5a37a63`, `skills/web-design-guidelines/SKILL.md`): o passo 2 é `curl -fsSL https://raw.githubusercontent.com/... -o references/command.md`. Fere a regra (curl/rede). O repositório `agent-skills` não tem licença na raiz. No lugar, entrou o texto das diretrizes direto do repositório MIT `web-interface-guidelines`, sem o `install.sh` nem o `command.md`.
- **emilkowalski**, as outras skills (`emil-design-eng`, `animate`, `choreograph`…): não lidas nem copiadas; só o `STANDARDS.md` era necessário.

### Como atualizar
Ler de novo cada arquivo no commit novo, repetir a varredura, trocar o SHA e o SHA-256 desta página e registrar a revisão no PR. Nunca rodar instaladores nem copiar scripts.
