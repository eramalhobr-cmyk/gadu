# GaDu Casa: módulo Casa Inteligente

Estado em 14/11/2026: **Planejado**. Nada deste documento existe no app. Não há integração, tabela nem tela funcional. Fontes consultadas em 14/11/2026.

Legenda: **[Fato]** = verificado em fonte citada. **[Proposta]** = decisão a aprovar. **[A confirmar]** = fonte parcial ou de comunidade; validar antes de implementar.

## Objetivo
Controlar a casa pela conversa (voz ou texto), com segurança e histórico. O GaDu não substitui o app do fabricante: ele conversa com uma camada de integração e registra o que foi pedido e o que aconteceu.

## Funcionalidades futuras
| Área | O que faz |
|---|---|
| Residências | Cadastrar uma ou mais casas; dono pessoal ou grupo familiar |
| Ambientes | Sala, quarto, cozinha etc.; dispositivo pertence a um ambiente |
| Luzes e tomadas | Ligar, desligar, brilho, cor |
| Climatização | Ar-condicionado, ventilador, aquecedor: modo e temperatura |
| Dispositivos diversos | Sensores, cortinas, eletrodomésticos compatíveis |
| Cenas e rotinas | "Modo cinema", "boa noite": vários comandos de uma vez |
| Estados | Ver se está ligado, temperatura atual, última leitura |
| Histórico | Cada comando com origem, horário e resultado |
| Automação | Por horário ou condição (ex.: "se passar de 28 °C, ligue o ar") |
| Voz e texto | "GaDu, apague as luzes da sala" em qualquer módulo |

## Pesquisa de integrações

### Amazon Alexa
- **[Fato]** A Smart Home Skill API funciona no sentido **Alexa → nuvem do fabricante**: quem tem dispositivos cria uma skill; o cliente ativa a skill, vincula a conta e a Alexa descobre os dispositivos daquela nuvem. A descoberta é um pedido da Alexa para a skill, não o contrário. ([Understand the Smart Home Skill API](https://developer.amazon.com/docs/smarthome/understand-the-smart-home-skill-api.html), [About Alexa Discovery](https://developer.amazon.com/docs/smarthome/discovery.html), [Smart Home Skill APIs](https://developer.amazon.com/docs/device-apis/smart-home-general-apis.html))
- **[Fato]** Não há API pública oficial para um terceiro listar ou controlar **todos** os dispositivos e rotinas de uma conta Alexa. A documentação não traz endpoint de listagem; perguntas de desenvolvedores sobre isso ficaram sem solução oficial.
- **Limite real:** "conectar a conta Alexa" ao GaDu **não** dá controle genérico da casa. Bibliotecas que fazem isso usam login não oficial (cookies do app) e podem quebrar ou violar termos. **Não usar.**
- **Alternativas oficiais:**
  1. O GaDu (ou o Home Assistant) expõe os próprios dispositivos **para** a Alexa via skill. A Alexa vira mais uma porta de voz; o controle continua na camada de integração.
  2. O Home Assistant tem integração com Alexa (via Home Assistant Cloud ou skill própria), que publica entidades do HA na Alexa. ([Nabu Casa: recursos](https://support.nabucasa.com/hc/en-us/articles/26260474250269/))
  3. **[A confirmar]** Disparar rotinas da Alexa a partir de sensores virtuais expostos por uma skill.

### Tuya, Smart Life e Tuya Smart
- **[Fato]** Smart Life e Tuya Smart são apps de consumidor da mesma plataforma Tuya; dispositivos "compatíveis com Smart Life" falam com a nuvem Tuya.
- **[Fato]** A Tuya oferece o Cloud Development Platform com OpenAPI. ([Cloud Development](https://developer.tuya.com/en/cloud), [API overview](https://developer.tuya.com/en/docs/cloud/api-overview))
- **[Fato, guia da própria Tuya]** Vínculo de conta: no projeto de nuvem, *Devices → Link Tuya App Account → Add App Account*; aparece um QR code que a pessoa lê no app (aba "Eu"). O data center do projeto precisa ser o da região da conta. ([Tuya IoT Platform Configuration Guide](https://github.com/tuya/tuya-home-assistant/wiki/Tuya-IoT-Platform-Configuration-Guide))
- **[Fato]** Cotas de chamadas são mensais e não acumulam para o mês seguinte. ([Tuya Support](https://support.tuya.com/en/help/_detail/K927ttzta56wa))
- **[A confirmar]** Plano de teste (Trial): relatos de 1 mês com renovação por pedido, limite de ~50 dispositivos e erro "Your Quota of trial Edition is used up"; planos pagos relatados como caros. ([fórum HA: limite de 50](https://community.home-assistant.io/t/tuya-iot-trial-account-50-device-limit/578524), [renovação](https://community.home-assistant.io/t/tuya-dev-account-renewal-steps/685268))
- **Conclusão:** usar a OpenAPI da Tuya direto num produto multiusuário exige plano comercial e contrato. Para uso pessoal, o caminho mais estável é via Home Assistant.

### Home Assistant
- **[Fato]** REST API na mesma porta da interface (8123), em `/api/`, com cabeçalho `Authorization: Bearer <token>`. Ex.: `GET /api/states`, `POST /api/services/<domínio>/<serviço>`. ([REST API](https://developers.home-assistant.io/docs/api/rest/))
- **[Fato]** WebSocket API em `/api/websocket`; o token vai numa mensagem `auth`; permite `get_states`, chamar serviços e assinar eventos em tempo real. ([WebSocket API](https://developers.home-assistant.io/docs/api/websocket), [home-assistant-js-websocket](https://www.npmjs.com/package/home-assistant-js-websocket))
- **[Fato]** Token de longa duração (long-lived access token) é criado no perfil do usuário do HA, vale 10 anos e pode ser revogado ali. ([Auth API](https://developers.home-assistant.io/docs/auth_api))
- **[Fato]** A integração Tuya do HA, desde a versão 2024.2, não exige conta de desenvolvedor Tuya: usa o código de usuário e QR code do app Smart Life/Tuya Smart. ([Tuya no HA](https://www.home-assistant.io/integrations/tuya), [issue #80278](https://github.com/home-assistant/core/issues/80278))
- **[Fato]** Home Assistant Cloud (Nabu Casa) oferece acesso remoto seguro e integração com Alexa e Google Assistant. ([Nabu Casa](https://support.nabucasa.com/hc/en-us/articles/26260474250269/)) **[A confirmar]** Preço: fontes de terceiros citam cerca de US$ 6,50 a 7,50/mês.

## Avaliação: Home Assistant como camada de integração
| Prós | Contras |
|---|---|
| Milhares de integrações (Tuya, Zigbee, Matter, Alexa, Google) | Precisa de um servidor ligado na casa (mini PC, Raspberry Pi, VM) |
| API estável e documentada (REST + WebSocket) | A pessoa precisa instalar e manter o HA |
| Execução local: luzes funcionam mesmo se a nuvem cair | Token de longa duração dá acesso amplo a tudo que o usuário do HA vê |
| Gratuito e aberto; Tuya sem conta de desenvolvedor | Expor o HA na internet aumenta a superfície de ataque |
| Automação local já pronta | Suporte e configuração variam por casa |

**Hospedagem:** HA OS num aparelho dedicado é o padrão. O servidor do GaDu (Vercel) precisa alcançar o HA: Nabu Casa (mais simples), túnel (ex.: Cloudflare Tunnel) ou proxy reverso com TLS. Nunca abrir a porta 8123 direto no roteador.

**Segurança do token [Proposta]:**
- Criar no HA um **usuário dedicado ao GaDu**, sem admin, e gerar o token nele.
- Guardar o token só no servidor, cifrado (ex.: Supabase Vault ou cifra com chave fora do banco). Nunca no cliente, em log ou no contexto do modelo.
- Lista de entidades permitidas no GaDu (allowlist); o resto é ignorado mesmo que o token permita.
- Botão "Desconectar" apaga o token; orientar a revogação também no perfil do HA.

### Recomendação em fases
1. **Fase 1, Home Assistant primeiro.** Conector único do GaDu para o HA da pessoa. Tuya/Smart Life, Alexa e outros entram pelo HA. Menos código, menos credenciais de terceiros.
2. **Fase 2, Alexa como porta de voz.** Via integração Alexa do próprio HA (ou Nabu Casa). O GaDu não tenta controlar a conta Alexa.
3. **Fase 3, conector Tuya direto (opcional).** Só para quem não tem HA e só com plano comercial Tuya e revisão de custo.

## Arquitetura proposta [Proposta]
```
Voz/texto → /api/chat (sessão → user_id)
  → Core Contextual resolve escopo (pessoal ou grupo da residência) [RLS]
  → intenção "casa.comando" (dispositivo, ação, parâmetros)
  → classe de risco → confirmação (e 2º fator se crítico)
  → conector no servidor (credencial decifrada só na memória)
  → Home Assistant /api/services/...
  → grava comando + resultado (sem credencial) → responde
```
- Conector em `src/lib/connectors/home/*`: interface comum (`listDevices`, `getState`, `runAction`), um adaptador por provedor.
- Validação zod em toda rota; timeout curto; tentativa única para comandos (nunca repetir "abrir portão" sozinho).
- Estado lido do provedor na hora; cache curto só para exibição.

### Modelo de dados futuro (sem SQL, apenas proposta)
| Tabela | Campos principais |
|---|---|
| `home_residences` | id, owner_user_id, group_id (opcional), nome, fuso |
| `home_members` | residence_id, user_id, papel (dono, adulto, convidado) |
| `home_connections` | id, residence_id, provedor, url_base, credencial cifrada, status, criado_por |
| `home_rooms` | id, residence_id, nome |
| `home_devices` | id, residence_id, room_id, entidade externa, tipo, classe_risco, permitido |
| `home_scenes` | id, residence_id, nome, passos (json), exige_confirmacao |
| `home_automations` | id, residence_id, gatilho, condição, ações, aprovada_por, ativa |
| `home_commands` | id, residence_id, user_id, device_id/scene_id, ação, origem (voz/texto/automação), confirmado, resultado, erro, criado_em |

- RLS: acesso se `(select auth.uid()) = owner_user_id` ou se existe vínculo em `home_members`. Papel define o que pode comandar.
- `home_connections.credencial` nunca sai em `select` para o cliente: leitura só por função `security definer` no servidor.

### Classes de risco
| Classe | Exemplos | Controles |
|---|---|---|
| Baixo | Luz, tomada comum, cena de luz | Executa direto; desfazer rápido |
| Médio | Climatização, cortina, eletrodoméstico | Confirma se o pedido for ambíguo ou fora do padrão; limites (ex.: 16–30 °C) |
| Crítico | Fechadura, alarme, portão, câmera | Confirmação explícita sempre; segundo fator (PIN, passkey ou biometria do aparelho); nunca em automação sem aprovação prévia; só dono/adulto; aviso aos demais membros |

- Câmeras: nada de imagem no contexto do modelo sem pedido explícito.
- Automação nova só ativa após a pessoa aprovar o texto da regra.

### Auditoria
- Registrar: quem, residência, dispositivo, ação, origem, confirmação, resultado, duração.
- Nunca registrar token, URL com segredo ou resposta bruta do provedor.
- Retenção proposta: 90 dias para comandos de baixo risco; 1 ano para críticos.

### Ligação com o Core Contextual
- Escopo resolvido no servidor (`home_members`), nunca vindo do cliente.
- Pista de tela (`module: casa`) só prioriza; comandos funcionam em qualquer módulo.
- Ler estado é automático no escopo; agir segue a regra "aprovação para agir" do [CORE_CONTEXTUAL.md](CORE_CONTEXTUAL.md).

## Fases e dependências
| Fase | Entrega | Depende de |
|---|---|---|
| 0 | Este documento; módulo "Planejado" no catálogo | — |
| 1 | Conector HA só leitura (estados) para 1 residência pessoal | Cofre de credenciais; auditoria; aprovação de alto risco |
| 2 | Comandos de baixo risco por voz/texto + histórico | Fase 1; classes de risco |
| 3 | Cenas, médio risco, grupos familiares | Modelo de grupos/membros com RLS |
| 4 | Críticos com 2º fator; automações aprovadas | Passkey/PIN; revisão de segurança |
| 5 | Alexa como porta de voz; Tuya direto (opcional) | Fases anteriores; custo avaliado |

Tudo que envolve credencial, banco ou dispositivo crítico é **alto risco** no Fast Track.

## Fora desta sprint
Nenhuma integração real, nenhuma conta conectada, nenhuma tabela ou migração, nenhum dispositivo simulado na interface.
