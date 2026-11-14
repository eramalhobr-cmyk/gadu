# Integrações de saúde: Metas & Conquistas + Samsung Health

Estado em 14/11/2026: **Planejado**. Nenhuma integração, app nativo ou tabela existe. Fontes consultadas em 14/11/2026.

Legenda: **[Fato]** = verificado em fonte citada. **[Proposta]** = decisão a aprovar. **[A confirmar]** = fonte parcial, de comunidade ou conflitante.

Nota de pesquisa: as páginas do Android Developers foram abertas e lidas. As páginas da Samsung foram verificadas pelo conteúdo indexado em busca (o domínio não abriu neste ambiente); confirmar direto antes de implementar.

## Resumo
- **Não existe API web/REST oficial** para ler Samsung Health ou Health Connect a partir de um site ou PWA. Os dois funcionam **no aparelho Android**.
- O caminho realista é um **app Android companion mínimo** que lê o Health Connect (onde o Samsung Health pode sincronizar) e envia ao servidor do GaDu.
- O **Samsung Health Data SDK** dá acesso mais direto, mas exige app Android e **parceria aprovada** para distribuir.
- Antes de qualquer app: **importação manual** (exportação do Samsung Health, CSV, entrada manual).

## Caminhos oficiais

### Samsung Health Data SDK
- **[Fato]** O antigo Samsung Health SDK for Android foi descontinuado em 31/07/2025, segue disponível por mais dois anos e encerra em 2028. O sucessor é o Samsung Health Data SDK. ([anúncio Samsung, out/2025](https://developer.samsung.com/sdp/news/en/2025/10/30/dev-insight-oct-2025-move-to-samsung-health-data-sdk-as-samsung-health-sdk-for-android-deprecates-and-other-latest-news), [guia de migração](https://developer.samsung.com/health/data/migration-guide/overview.html))
- **[Fato]** É uma biblioteca Android; exige o app Samsung Health instalado (versão 6.30.2 ou superior). ([visão geral](https://developer.samsung.com/health/data/overview.html), [FAQ](https://developer.samsung.com/health/data/faq.html))
- **[Fato]** Permissão do usuário por tipo de dado. ([pedido de permissão](https://developer.samsung.com/health/data/guide/hello-sdk/permission-request.html), [tipos de dados](https://developer.samsung.com/health/data/guide/features/data-types.html))
- **[Fato]** Sem parceria, o app só funciona com o "modo desenvolvedor" do Samsung Health ligado, que é só para teste. Para distribuir, é preciso pedir parceria; escrever dados exige código de acesso após aprovação. ([modo desenvolvedor](https://developer.samsung.com/health/data/guide/developer-mode.html), [processo](https://developer.samsung.com/health/data/process.html), [release notes](https://developer.samsung.com/health/data/release-note.html))
- **[A confirmar]** Fóruns da Samsung relatam que a entrada de novos parceiros esteve fechada em alguns períodos. ([fórum](https://forum.developer.samsung.com/t/sdk-says-i-need-a-partnership/21304))
- **[A confirmar]** Passos aparecem como dado agregado (sem amostra a amostra).

### Health Connect (Android)
- **[Fato]** Armazenamento central de saúde **no aparelho**. A partir do Android 14 faz parte do sistema; no Android 13 e anteriores há regras próprias de leitura. ([ler dados](https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data))
- **[Fato]** Permissão por tipo de dado, declarada no manifesto (ex.: `READ_STEPS`, `READ_SLEEP`, `READ_HEART_RATE`, `READ_WEIGHT`, `READ_EXERCISE`). ([tipos de dados](https://developer.android.com/health-and-fitness/guides/health-connect/plan/data-types))
- **[Fato]** Leitura em segundo plano exige a permissão extra `READ_HEALTH_DATA_IN_BACKGROUND`.
- **[Fato]** Por padrão, o app lê até **30 dias antes** da primeira permissão concedida. Para mais, `READ_HEALTH_DATA_HISTORY`.
- **[Fato]** Se o app for desinstalado, todas as permissões (inclusive histórico) são revogadas; ao reinstalar, volta a regra dos 30 dias.
- **[Fato]** Para publicar na Google Play, é preciso declarar o uso dos tipos de dados do Health Connect no Play Console.
- **[A confirmar]** O Samsung Health sincroniza com o Health Connect quando a pessoa ativa isso no app; os tipos sincronizados variam por versão.

## 1. Permissões necessárias [Proposta, mínimo]
| Dado | Permissão Health Connect |
|---|---|
| Passos | `android.permission.health.READ_STEPS` |
| Exercícios | `READ_EXERCISE` (rota: `READ_EXERCISE_ROUTE`, **não pedir**) |
| Distância e calorias | `READ_DISTANCE`, `READ_ACTIVE_CALORIES_BURNED` |
| Sono | `READ_SLEEP` |
| Peso | `READ_WEIGHT` |
| Frequência cardíaca | `READ_HEART_RATE`, `READ_RESTING_HEART_RATE` |
| Segundo plano | `READ_HEALTH_DATA_IN_BACKGROUND` |
| Histórico > 30 dias | `READ_HEALTH_DATA_HISTORY` (só se a pessoa pedir) |

Pedir só o que a meta da pessoa usa. Nunca pedir escrita.

## 2. Dados realmente acessíveis
| Dado | Health Connect | Samsung Health Data SDK |
|---|---|---|
| Passos | Sim (`StepsRecord`, agregação `COUNT_TOTAL`) | Sim (agregado) |
| Exercícios/atividades | Sim (`ExerciseSessionRecord`, dezenas de tipos) | Sim |
| Sono | Sim (`SleepSessionRecord`, com estágios) | Sim |
| Peso e composição | Sim (`WeightRecord`, gordura, massa magra) | Sim |
| Frequência cardíaca | Sim (série, repouso, variabilidade) | Sim |
| Outros | Pressão, glicose, SpO2, temperatura, hidratação, nutrição, VO2 max, mindfulness, ciclo menstrual | Ver tabela de tipos da Samsung |

Fonte: tabelas oficiais citadas acima. Disponibilidade real depende do que o relógio/celular registra e do que a pessoa sincroniza.

## 3. Dependências Android
- App nativo (Kotlin) com Jetpack Health Connect (`androidx.health.connect:connect-client`) e WorkManager para leitura periódica.
- Android 14+ recomendado; Android 13 e anteriores precisam do app Health Connect da Play Store.
- Conta de desenvolvedor Google Play, política de privacidade publicada e declaração de dados de saúde.
- Para o Samsung Health Data SDK: Samsung Health instalado e parceria aprovada.

## 4. Limitações de uma aplicação web/PWA
- **[Fato]** O Health Connect é uma API do Android acessada por apps instalados; não há API de navegador nem endpoint na nuvem.
- O PWA do GaDu **não consegue** ler Health Connect nem Samsung Health, nem com permissão.
- Web Bluetooth ou sensores do navegador não substituem: não leem o histórico consolidado.
- A decisão oficial nº 7 (sem desenvolvimento nativo nesta fase) vale para o Studio; um companion de saúde exigiria **aprovação específica do Eduardo**.

## 5. Sincronização por conector [Proposta]
**Opção A, companion Android mínimo (preferida a médio prazo)**
```
Health Connect (aparelho) ← Samsung Health sincroniza
  → app GaDu Saúde (só leitura, tipos escolhidos)
  → resumo diário agregado (ex.: passos/dia, horas de sono, peso)
  → POST /api/health/sync (token de dispositivo, zod, limite de taxa)
  → servidor grava em goal_progress com origem "health_connect"
```
- Envia agregados diários, não amostras brutas.
- Token de dispositivo próprio, revogável, sem a sessão completa do app web.
- Conector desacoplado: o núcleo só conhece "indicador recebeu valor X com origem Y".

**Opção B, agregadores terceiros** (ex.: serviços pagos de dados de wearables). Também exigem um SDK no celular; adicionam outro operador de dados sensíveis. Só com contrato, DPA e avaliação de custo.

**Opção C, Samsung Health Data SDK direto.** Só se a parceria for aprovada e houver ganho real sobre o Health Connect.

## 6. Revogação de acesso
- No aparelho: Configurações do Health Connect → apps → remover permissões; ou desinstalar o companion. **[Fato]**
- No GaDu: botão "Desconectar saúde" invalida o token do dispositivo e para a sincronização.
- Escolha da pessoa: manter o histórico já importado ou apagá-lo na hora.
- Após revogar, indicadores mostram "sem atualização desde X".

## 7. Privacidade e retenção
- **[Fato]** Dado de saúde é dado pessoal sensível (LGPD, art. 5º, II). O tratamento com base em consentimento exige consentimento **específico e destacado, para finalidades específicas** (art. 11, I). O consentimento pode ser revogado a qualquer momento (art. 8º, §5º) e o titular pode pedir eliminação (art. 18). ([Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm))
- **[Proposta]**
  - Tela de consentimento própria, separada dos termos gerais, por tipo de dado e finalidade ("usar passos na meta X").
  - Registro do consentimento (o quê, quando, versão do texto) e da revogação.
  - Minimização: agregados diários; sem localização, rota ou dados de ciclo, salvo pedido explícito.
  - Retenção: enquanto a meta estiver ativa + 90 dias; depois, apagar ou manter só o resumo, por escolha da pessoa.
  - Exclusão completa ao apagar a conta ou revogar com "apagar dados".
  - Dados de saúde fora do contexto do modelo por padrão; entram só o necessário para a pergunta, com origem.
  - Nunca compartilhar com familiares sem autorização específica (ver [METAS_CONQUISTAS.md](METAS_CONQUISTAS.md)).
  - Logs sem valores de saúde.

## 8. Importação manual (primeiro passo, sem app nativo)
| Caminho | Como | Observação |
|---|---|---|
| Exportação do Samsung Health | No app: Configurações → Baixar dados pessoais. Os arquivos ficam em Meus Arquivos → Downloads → Samsung Health. ([Samsung](https://www.samsung.com/ca/support/apps-services/download-or-delete-your-samsung-health-data/)) | **[A confirmar]** Formato CSV por categoria (relatos de terceiros); alguns tipos podem faltar |
| CSV genérico | Modelo do GaDu: data, indicador, valor, unidade | Validação zod; pré-visualização antes de gravar |
| Entrada manual | "Hoje caminhei 9 mil passos", "pesei 80 kg" | Origem "manual"; o GaDu confirma antes de gravar |

Importação acontece no servidor, descarta colunas não usadas e mostra o que vai ser salvo antes.

## Arquitetura desacoplada [Proposta]
- `src/lib/connectors/health/*`: um adaptador por fonte (manual, csv-samsung, health-connect-companion).
- Saída única: `{ user_id, indicador, valor, unidade, periodo, origem }`.
- Metas & Conquistas não sabe de onde veio o dado, só da origem para exibir.
- Consentimento e tokens em tabelas próprias, com RLS por `user_id`.

## Fases
| Fase | Entrega | Risco |
|---|---|---|
| 0 | Este documento | — |
| 1 | Entrada manual de indicadores de saúde nas metas | Alto (banco) |
| 2 | Importação do export do Samsung Health / CSV | Alto (dado sensível) |
| 3 | Consentimento específico + endpoint de sincronização | Alto |
| 4 | Companion Android de leitura do Health Connect | Alto; exige aprovação de app nativo |
| 5 | Avaliar Samsung Health Data SDK ou agregador | Alto; parceria e contrato |

## Fora desta sprint
App nativo, conexão a contas reais, chamadas a APIs de dispositivos, tabelas e dados simulados.
