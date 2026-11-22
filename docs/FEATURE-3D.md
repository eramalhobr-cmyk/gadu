# GaDu 3D Studio: especificação (3D-0)

Estado em 22/11/2026: **3D-1 desenvolvido e testado localmente (Beta, desligado por padrão)**, ainda **não publicado**. O que foi feito está em "3D-1: o que foi feito" logo abaixo; o resto do documento segue como especificação das próximas fases.

Legenda: **[Fato]** verificado em fonte citada · **[Proposta]** decisão a aprovar · **[A confirmar]** validar antes de implementar.

## Objetivo
Criar peças imprimíveis **conversando** (voz ou texto) com o GaDu e sair com um arquivo que o Bambu Studio abre **já configurado para a Bambu Lab A1** (PLA, bico 0.4). O Eduardo fatia e imprime pelo Bambu Studio.

Sem serviço pago por geração: **nada de Meshy, Tripo ou parecidos**. O custo é só a conversa com a IA (AI Gateway), dentro da cota e do teto mensal que já existem.

## Decisões do Eduardo (22/11/2026)
- Usar as IAs que já temos (modelos do AI Gateway: Claude, GPT, Gemini, Grok), sem pagar por geração.
- Começar pelo GaDu **gerando o arquivo** para fatiar no Bambu Studio. Envio direto para a impressora fica para depois (3D-3).
- Ir evoluindo até chegar na figura a partir de foto (3D-2).
- Casa Inteligente fica para depois; o 3D vem antes.

## Restrições (valem para todas as fases)
1. **Sem custo por geração:** nenhum serviço pago de imagem→3D. Modelos abertos só em infraestrutura gratuita (fase 3D-2).
2. **Código gerado pela IA só roda isolado:** o `.scad` roda **apenas** dentro do OpenSCAD WASM num Web Worker no navegador, sem rede, sem DOM, sem acesso a arquivos do sistema e com tempo-limite. O servidor nunca executa código gerado.
3. **Licenças:** o OpenSCAD (GPL) entra como componente separado (ver "Licenças"). O [CADAM](https://github.com/Adam-CAD/CADAM) (GPL-3.0) é **só inspiração**: não copiar código dele.
4. **Isolamento por pessoa:** tabelas novas com RLS `(select auth.uid())`, só `authenticated`, nada para `anon`, como no Financeiro e nas Metas.
5. **Custo sob controle:** cada chamada de IA passa por `reserve/settle/release_ai_budget` e pela cota diária; interruptor `STUDIO3D_ENABLED=0` desliga tudo.
6. **Voz e texto** em todo o fluxo (decisão oficial para módulos novos).

## 3D-1: o que foi feito (22/11/2026, branch `feat/3d-1-openscad`)
Escopo entregue: pedido em texto → código OpenSCAD paramétrico pela IA → render no navegador → visualizador e controles → verificações da A1 → STL e 3MF. **Sem banco** (nenhuma migração): nada é salvo no servidor nesta fase.

**Como ligar:** variável `MODELING_3D_ENABLED=1` (qualquer outro valor, ou ausente, deixa desligado). Desligado: sem entrada "3D" no Mais, `/app/3d` e `/api/3d/*` respondem 404 (com sessão) ou 401 (sem sessão). Ligado: entrada **3D (Beta)** no Mais, abre `/app/3d`. Diferente de `FINANCE_ENABLED` e `GOALS_ENABLED` (ligados por padrão), este começa **desligado**. (A spec 3D-0 previa `STUDIO3D_ENABLED`; o nome oficial passou a ser `MODELING_3D_ENABLED`.)

| Peça | Onde |
|---|---|
| Rota de geração | `src/app/api/3d/generate/route.ts` (`_guard.ts`: sessão 401 → interruptor 404) |
| Parâmetros (Customizer) | `src/lib/3d/params.ts` |
| Prompt, extração e validação do código | `src/lib/3d/scad.ts`; corpo zod em `schemas.ts`; limites em `limits.ts` |
| Verificações da A1 | `src/lib/3d/checks.ts` |
| Malha, STL, 3MF, zip | `mesh.ts`, `stl.ts`, `threemf.ts`, `zip.ts` |
| Worker e cliente | `public/vendor/openscad/render-worker.js`, `render-core.js`; `src/lib/3d/worker-client.ts` |
| Tela e visualizador | `src/components/studio3d/` (`Studio3D.tsx`, `Viewer3D.tsx`, `studio3d.css`), `src/app/app/3d/page.tsx` |

**Rota e custo.** `POST /api/3d/generate` com `{ modo: "novo" | "refinar" | "corrigir", pedido, scad?, erro? }` (zod estrito: `user_id` ou custo no corpo são recusados). Pedido até 800 caracteres, código até 20 000, erro até 1 500, saída da IA até 6 000 tokens. Mesmo pipeline do chat, fail closed: sessão e acesso → interruptor → zod → privacidade (dado sensível e termos bloqueados não vão à IA) → limites por motor de Ajustes → **reserva** de orçamento só pelo servidor com o id da sessão → cota diária → IA → **liquidação pelo custo real** (também quando o código volta inválido; se a liquidação falhar, o consumo é gravado direto). Se a IA falhar, a reserva é liberada. Usa `complete()` com o modelo barato já configurado (`CHEAP_MODEL` / `GATEWAY_CHEAP_MODEL`, hoje Haiku 5.5), registrado como `kind = chat` (não exige migração). O servidor nunca executa o código: só devolve o texto, depois de conferir tamanho, ausência de `include`/`use`/`import`/`surface` e `$fn` até 360. Os controles deslizantes e o re-render **não chamam a IA**.

**Worker e isolamento.** O OpenSCAD roda só num Web Worker (módulo): sem DOM, cookies nem rede. O app e o worker só trocam mensagens. Uma instância nova do OpenSCAD por render, motor Manifold, tempo-limite de 30 s: passou disso, o worker é encerrado e recriado. Pedidos novos enquanto um render roda são coalescidos (só o mais recente vale). A memória do WASM não tem teto próprio: o limite prático é o tempo e o tamanho da malha (recusa acima de 400 000 triângulos).

**CSP.** As páginas **não mudaram** (`worker-src 'self'` já bastava; sem `wasm-unsafe-eval`, sem `blob:`). O caminho `/vendor/openscad/*` ganhou CSP própria e mais estrita, em `next.config.ts` (valor em `src/lib/3d/csp.ts`): `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. O `src/proxy.ts` deixou de rodar nesse caminho (matcher exclui `vendor/`), para a CSP com nonce das páginas não se somar a esta. Esses arquivos são públicos (sem login), como qualquer arquivo de `public/`.

**Licenças.**
- **OpenSCAD WASM:** pacote npm [`openscad-wasm-prebuilt`](https://www.npmjs.com/package/openscad-wasm-prebuilt) 1.2.0, **GPL-2.0-or-later**. O `openscad.js` (WASM embutido) está **sem modificações** em `public/vendor/openscad/`, com `LICENSE.txt` (GPL v2) e `README.md` com os links do código-fonte (https://github.com/openscad/openscad e o repositório do pacote). Ele **não entra no bundle do app**: é um arquivo separado, carregado pelo worker; o código do GaDu (`render-core.js`, `render-worker.js`, `worker-client.ts`) só troca mensagens. A tela mostra o link para a licença. Não é parecer jurídico: é a leitura "componente separado, comunicação por mensagens" da spec; vale uma revisão se o GaDu for distribuído a terceiros. Para uso pessoal, nada a fazer.
- **three.js** 0.187.0, MIT (dependência npm, carregada só na tela 3D por import dinâmico). `@types/three` (MIT) só em desenvolvimento.
- CADAM (GPL-3.0): só inspiração; nenhum código copiado.

**Verificações da A1 (`checks.ts`).** Tamanho (≤ 256 mm por eixo, exato); malha fechada (cada aresta em exatamente 2 faces, com vértices soldados a 0,0001 mm; detecta aberta, não-manifold e face invertida); base plana (área em z mínimo com normal para baixo ≥ min(100 mm², 10% da pegada X×Y)); parede mínima 1,2 mm (**estimativa**: até 400 raios amostrados contra a normal, mais os parâmetros declarados com nome de parede/espessura abaixo de 1,2; não vê parede fina entre as amostras e o texto diz que é estimativa); balanço (aviso: fração da superfície a mais de 45°). Mensagens em pt-BR com "O que fazer". A peça é posta no centro da mesa (128, 128) com a base em z = 0 antes de visualizar e exportar.

**Exportação.** STL binário e 3MF comum (zip com `[Content_Types].xml`, `_rels/.rels` e `3D/3dmodel.model`, unidade mm, vértices soldados), ambos testados em unidade. O **3MF "A1 PLA 0.4"** tem a função pronta (`injectIntoTemplate` em `threemf.ts`: troca só `<resources>` e `<build>` do `3D/3dmodel.model` e copia o resto do projeto byte a byte), testada com um modelo **fictício**, mas o botão está **desativado** ("Aguardando o modelo de projeto do Eduardo") e `A1_TEMPLATE_AVAILABLE = false`.

**Como o Eduardo envia o modelo de projeto:** no Bambu Studio, abra um projeto novo, escolha a impressora **Bambu Lab A1**, bico **0.4** e filamento **PLA** (perfis padrão da Bambu), sem nenhum objeto, e salve como `a1-pla-04.3mf` (Arquivo › Salvar projeto). Entregue o arquivo à IA que continuar o 3D (por exemplo colocando-o em `docs/` ou na pasta combinada na conversa). A IA então: (1) lista o conteúdo do zip e valida que `3D/3dmodel.model`, `Metadata/project_settings.config` e `Metadata/model_settings.config` existem; (2) ajusta `injectIntoTemplate` para o que o arquivo real exigir (a spec marca isso como **[A confirmar]**: objetos novos no Bambu Studio costumam precisar de uma entrada em `model_settings.config`); (3) abre o resultado num Bambu Studio atual para conferir que a A1/PLA/0.4 continuam selecionados; (4) decide onde guardar o modelo (bucket privado por pessoa, como na spec, ou arquivo no repositório se for só do Eduardo) e liga o botão.

**Limitações do 3D-1:** sem imagem do render para a IA ver no refinamento; sem voz própria na tela (o teclado do celular já dita); nada é salvo (recarregar a página perde a peça; "Voltar uma versão" vale só enquanto a tela está aberta); o `.scad` da IA pode falhar (o botão "Pedir correção à IA" reenvia o erro); qualidade do código depende do modelo barato (os 10 testes de peças de referência dos critérios de pronto ainda **não** foram feitos: exigem a IA real e custo); o cabeçalho da tela mostra "Ajuda" porque a tela reaproveita o invólucro das páginas de conteúdo (como o Guia).

## Fases
| Fase | Entrega | Status |
|---|---|---|
| 3D-0 | Esta especificação | feita (documento) |
| 3D-1 (MVP) | Peça por conversa → OpenSCAD → STL e 3MF (comum e "A1 PLA 0.4") | **desenvolvido e testado localmente** (Beta, interruptor desligado); 3MF A1 e salvar versões ficam pendentes |
| 3D-2 | Figura a partir de foto com modelos abertos gratuitos + reparo de malha | planejado, P2 |
| 3D-3 | Envio direto para a A1 pela rede local (ponte local) | planejado, P3 (depois) |

## 3D-1 (MVP): conversa → OpenSCAD

### Fluxo
1. A pessoa pede: "faz um suporte de celular com 15 graus de inclinação e furo para o cabo" (voz ou texto), na tela 3D Studio ou no assistente.
2. Um modelo do AI Gateway escreve código **OpenSCAD paramétrico**: parâmetros no topo, no formato do Customizer (`largura = 80; // [40:200]`), com comentários em português e `assert()` para limites (ex.: parede mínima).
3. O navegador renderiza o `.scad` com o **OpenSCAD WASM num Web Worker** e mostra a peça num **visualizador three.js** (girar, aproximar, medidas da caixa em mm).
4. Os parâmetros viram **controles deslizantes**: mexer neles re-renderiza localmente, **sem chamar a IA** (custo zero).
5. A pessoa refina pela conversa ("2 mm mais alto", "arredonda as bordas"). A IA recebe o código atual, os parâmetros e **uma imagem do render** (capturada do three.js, 1 a 3 ângulos) para "ver" o resultado, e devolve o código novo.
6. **Verificações de impressão** rodam a cada render (abaixo). Problema vira aviso em linguagem simples, e o GaDu pode propor a correção.
7. **Exportar:** STL, 3MF comum e **3MF "A1 PLA 0.4"** (abaixo).
8. O `.scad`, os parâmetros e o histórico de versões ficam salvos no Supabase; dá para voltar a uma versão anterior.

### Verificações de impressão (A1)
| Verificação | Regra | Como |
|---|---|---|
| Tamanho | Nenhum eixo acima de **256 mm** (volume da A1: 256 × 256 × 256 mm) [Fato: ficha técnica da Bambu Lab A1] | caixa delimitadora da malha |
| Malha fechada (manifold) | Toda aresta compartilhada por exatamente 2 triângulos; sem faces invertidas | contagem de arestas no worker; o OpenSCAD com o motor Manifold já ajuda |
| Base plana | Existe uma face de apoio no Z mínimo com área mínima (proposta: ≥ 1 cm² ou 10% da área projetada) | faces com normal para baixo no Z mínimo |
| Parede mínima | **≥ 1,2 mm** (3 linhas de 0,4 mm) | `assert()` no código gerado + amostragem por raios na malha (aviso, não bloqueio) |
| Balanço (opcional) | Avisar ângulos acima de 45° que vão pedir suporte | normais das faces |

### Exportação
- **STL** binário, em mm.
- **3MF comum** (especificação 3MF Core): abre em qualquer fatiador.
- **3MF "A1 PLA 0.4"** [Proposta]: o Eduardo salva **uma vez** no Bambu Studio um projeto vazio com a A1, bico 0.4 e PLA e envia esse arquivo ao GaDu (fica num bucket privado do Supabase Storage, por pessoa). Ao exportar, o GaDu copia o modelo, **troca só a geometria** pela peça nova e mantém as configurações de impressora, filamento e processo. Assim o arquivo abre no Bambu Studio já configurado.
  - [A confirmar] A estrutura interna exata do projeto do Bambu Studio (arquivos em `Metadata/`, como `project_settings.config` e `model_settings.config`, e onde fica o objeto). Validar com o arquivo real do Eduardo e uma versão atual do Bambu Studio antes de programar; ter teste automatizado que abre o 3MF gerado e confere a estrutura.
  - Sem o modelo salvo, o botão mostra como criar o modelo em 3 passos e oferece o 3MF comum.

### Arquitetura
| Peça | Onde | Observação |
|---|---|---|
| Geração e refinamento do `.scad` | rota `/api/studio3d/gerar` (servidor) | sessão obrigatória, zod, `user_id` da sessão; reserva de orçamento antes, liquidação depois; prompt com regras da A1 e formato dos parâmetros |
| Modelo | AI Gateway (roteador atual com contingência) | modelo com visão para refinamento com imagem; testar 2 ou 3 modelos com um conjunto fixo de peças e escolher pelo resultado e pelo custo |
| Render | OpenSCAD WASM em Web Worker | sem rede no worker; `include`/`import` de arquivos externos bloqueados; tempo-limite (proposta: 30 s) e reinício do worker; limite de memória |
| Visualizador | three.js (MIT) | carregado só na tela 3D Studio |
| Verificações | Web Worker (JS) | puras e testáveis em unidade |
| Exportação 3MF | navegador (zip) | modelo A1 lido do Storage com URL assinada |
| Dados | Supabase | tabelas abaixo |

### Modelo de dados [Proposta, sem SQL ainda]
| Tabela | Campos principais |
|---|---|
| `studio3d_modelos` | `id`, `user_id`, `titulo`, `versao_atual`, `criado_em`, `atualizado_em`, `arquivado` |
| `studio3d_versoes` | `id`, `modelo_id`, `user_id`, `scad` (texto, limite de tamanho), `parametros` (jsonb), `pedido` (texto da pessoa), `verificacoes` (jsonb), `custo_usd`, `criado_em` |
| Storage `studio3d-modelos-bambu` (privado) | `{user_id}/a1-pla-04.3mf` |

STL e 3MF não são guardados: são gerados de novo a partir do `.scad`. Chaves compostas `(id, user_id)`, CHECKs e rollback no topo da migração, como nas fases anteriores. Migração é alto risco: aprovação explícita do Eduardo.

### Licenças
- **OpenSCAD** é GPL (versão 2 ou posterior) [A confirmar a versão exata do pacote WASM escolhido]. Proposta: servir o WASM como **arquivo separado** (`/vendor/openscad/`), com a licença e o link para o código-fonte ao lado, chamado só por mensagens do worker. O código do GaDu não importa nem modifica o OpenSCAD.
- **three.js**: MIT.
- **CADAM**: GPL-3.0, só como referência de ideias (fluxo conversa → OpenSCAD, controles deslizantes). Nenhum código copiado.

### Voz
- "GaDu, faz uma caixa de 10 por 6 com tampa" funciona de qualquer tela e abre o 3D Studio com o resultado.
- Ajustes por voz ("mais alto", "mais fino") e resposta falada curta: "Pronto, a caixa tem 100 por 60 por 40 milímetros e cabe na A1."

### Critérios de pronto (3D-1)
- 10 peças de referência (suporte de celular, caixa com tampa, gancho, organizador, chaveiro com nome, placa, espaçador, suporte de parede, porta-lápis, peça com furos) geram, passam nas verificações e abrem no Bambu Studio com a A1 configurada.
- Custo médio por ajuste medido e registrado (estimativa inicial: poucos centavos de dólar).
- Testes: unitários (verificações, parâmetros, 3MF), integração (rota com 401, orçamento, interruptor), isolamento A×B nas tabelas, e2e público (rotas 401).

## 3D-2: figura a partir de foto (modelos abertos e gratuitos)
- **Modelos:** [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) (Microsoft) ou [Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) (Tencent), rodando em **Hugging Face Spaces com ZeroGPU**, usando o **token do Hugging Face do Eduardo** (variável sensível só no servidor, nunca no navegador).
- **Limites:** o ZeroGPU tem cota diária de uso por conta [A confirmar os números atuais]; poucas gerações por dia. A tela mostra "você ainda tem X gerações hoje" quando der para saber, e falha de cota vira mensagem clara.
- **Licenças:** uso pessoal. [Fato, GitHub em 22/11/2026] o repositório do TRELLIS.2 declara MIT; o do Hunyuan3D-2.1 usa licença própria da Tencent (não é uma licença padrão). [A confirmar] a licença dos pesos e das dependências de cada um antes de ligar; a do Hunyuan3D tem restrições próprias (inclusive de território). O resultado não deve ser usado comercialmente sem rever a licença.
- **Fluxo:** foto → (opcional) remover fundo → gerar malha → **reparo de malha** (fechar buracos, deixar manifold, reduzir triângulos, escalar para o tamanho pedido em mm, cortar base plana) → mesmas verificações e exportações do 3D-1.
- **Reparo:** [manifold](https://github.com/elalish/manifold) (versão WASM no navegador) ou trimesh/manifold3d em Python se houver um serviço gratuito para isso [Proposta: preferir WASM para não ter servidor novo].
- **Execução:** chamada assíncrona (a geração leva minutos): o servidor dispara, guarda o estado e o app consulta; respeitar o tempo máximo das funções da Vercel.

## 3D-3: envio direto para a A1 (depois)
- Opcional. Exige uma **ponte local** na rede de casa (mini PC ou Raspberry Pi, o mesmo que poderia rodar o Home Assistant no futuro).
- [A confirmar] O modo LAN da A1 (código de acesso, MQTT e envio de arquivo) e as regras atuais de autorização do firmware da Bambu Lab para programas de terceiros.
- O GaDu nunca começa uma impressão sem confirmação explícita.

## Fora do escopo agora
- Biblioteca de modelos gratuitos de terceiros (Printables, MakerWorld): pode entrar depois, respeitando licenças.
- Fatiar dentro do GaDu: o fatiamento continua no Bambu Studio.
