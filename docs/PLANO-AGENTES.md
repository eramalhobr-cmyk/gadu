# GaDu · Plano de agentes: Pessoal e Trabalho

Proposta para discussão (10/11/2026). Nada disto foi implementado ainda.

## 1. Visão

O GaDu vira um **chefe de gabinete** com duas casas:

- **Pessoal**: a vida da pessoa (saúde, finanças, família, estudos), com agentes que cuidam de cada área.
- **Trabalho**: uma **empresa virtual** para o negócio próprio da pessoa (ex.: Imagem Consultoria). Um **agente CEO** orquestra **diretorias** (Comercial, Projetos, Financeiro, Marketing, Tecnologia, RH…), do CRM de prospecção até a execução do dia a dia.

Regra que continua valendo: **nada do empregador de ninguém**. O espaço Trabalho é para negócio próprio ou projetos próprios.

## 2. Princípios

1. **Humano no comando**: agentes propõem; ações que saem do GaDu (e-mail, agenda, cliente) passam por aprovação.
2. **Começar pequeno e útil**: poucos agentes que resolvem problemas reais, antes de uma empresa inteira.
3. **Um agente = papel + instruções + ferramentas + memória + orçamento + resultado esperado.**
4. **Transparência**: todo trabalho de agente fica registrado (o que fez, quanto custou, o que falta aprovar).
5. **Privacidade por espaço**: dados de Trabalho e Pessoal separados; cada pessoa só vê os seus.
6. **Custo previsível**: teto por agente e modelos baratos para tarefas simples.

## 3. Estrutura proposta

### 3.1 Espaços

| Espaço | Para quê | Exemplos |
|---|---|---|
| Pessoal (sempre existe) | Vida e rotina | treino, contas da casa, viagem, estudos |
| Trabalho (um ou mais) | Negócio próprio | Imagem Consultoria: clientes, propostas, projetos |

Memórias, tarefas, projetos, conversas e agentes passam a pertencer a um espaço. O "Hoje" junta os dois, com filtro.

### 3.2 Pessoal: agentes

| Agente | Faz | Ferramentas |
|---|---|---|
| **GaDu (orquestrador pessoal)** | Começar o dia, prioridades, revisão da noite | agenda, e-mail, tarefas, lembretes |
| Saúde e bem-estar | treino, sono, alimentação, consultas | lembretes, agenda, metas |
| Finanças pessoais | orçamento, metas, contas a pagar | tarefas, lembretes (nunca dados bancários) |
| Família e casa | rotina, compras, manutenção, datas | tarefas, agenda |
| Estudos e carreira | plano de estudos, leituras, cursos | tarefas, busca na memória |
| Viagens e lazer | roteiros, reservas a fazer, checklists | agenda, tarefas |

### 3.3 Trabalho: a empresa virtual

```
                 CEO (orquestrador)
                        │
 ┌──────────┬───────────┼───────────┬────────────┬───────────┐
Comercial  Projetos   Financeiro  Marketing   Tecnologia    RH e
 e CRM     e Entrega              e Conteúdo  e Digital     Parceiros
```

| Agente | Responsável por | Exemplos de pedidos |
|---|---|---|
| **CEO** | Recebe objetivos, quebra em entregas, delega às áreas, consolida e reporta. Reunião semanal com você. | "Quero fechar 3 clientes novos este trimestre." |
| **Comercial e CRM** | Prospecção, funil, propostas, acompanhamento dos contatos | "Quem eu preciso acompanhar esta semana?" |
| **Projetos e Entrega** | Execução das consultorias: cronograma, entregas, riscos, status para o cliente | "Monta o plano do projeto do cliente X." |
| **Financeiro** | Fluxo de caixa, cobranças, preço das propostas, resultado do mês | "Quanto entra este mês? Quem está atrasado?" |
| **Marketing e Conteúdo** | LinkedIn, cases, calendário editorial, materiais | "Escreve um post sobre o case do cliente Y." |
| **Tecnologia e Digital** | Site, automações, ferramentas, dados | "Que ferramenta usar para a proposta digital?" |
| **RH e Parceiros** | Rede de consultores parceiros, contratos e rituais | "Preciso de um especialista em varejo para maio." |
| **Estratégia e Mercado** (depois) | Concorrentes, tendências, metas do ano (OKRs) | "Como está o mercado de consultoria de imagem?" |

**Para a Imagem Consultoria, começaria com 5:** CEO, Comercial e CRM, Projetos e Entrega, Financeiro, Marketing.

## 4. Experiência (produto)

- **Agentes** com dois lados: **Pessoal | Trabalho**.
  - Trabalho mostra o **organograma** (CEO no topo, áreas embaixo), com cartões que indicam: ativo, tarefas abertas e aprovações pendentes.
  - "**Fale com o CEO**" é a porta de entrada do Trabalho.
- **Caixa de aprovações** no Hoje: "O Comercial preparou 3 acompanhamentos: aprovar?"
- **Clientes (CRM leve)**: lista e funil em colunas (Prospecção › Conversa › Proposta › Fechado), ficha do cliente com contatos, histórico, projetos e próximos passos.
- **Antes da reunião**: 30 min antes de um evento com cliente, chega um resumo (histórico, pendências, sugestão de pauta).
- **Depois da reunião**: cola a transcrição e o GaDu gera resumo, decisões e tarefas no cliente certo.
- **Relatório semanal do CEO** (segunda, 8h): resultados, riscos, próximas prioridades.
- **Briefing da manhã** com duas partes: Pessoal e Trabalho.

## 5. Arquitetura (tech)

### 5.1 Dados novos (todos com `user_id` e RLS)

| Tabela | Conteúdo |
|---|---|
| `workspaces` | espaço (pessoal ou trabalho), nome, cor |
| colunas `workspace_id` | em agents, projects, tasks, memories, conversations |
| `agents` (ampliar) | papel, agente pai (hierarquia), ferramentas permitidas, nível de autonomia, modelo, teto mensal |
| `agent_runs` | cada execução: pedido, plano, passos, custo, status |
| `approvals` | fila de aprovação: tipo de ação, conteúdo proposto, status |
| `companies`, `contacts` | clientes e prospects, pessoas de contato |
| `deals` | oportunidades no funil, valor, etapa, próximo passo |
| `activities` | interações (reunião, e-mail, ligação) por cliente |
| `documents` | propostas, contratos, materiais (com busca por significado) |

### 5.2 Como os agentes trabalham

- **Orquestração por ferramentas**: o CEO usa *tool use* do Claude. Cada diretoria é uma ferramenta ("pedir ao Comercial…"); cada diretoria tem suas próprias ferramentas (CRM, tarefas, agenda, e-mail).
- **Níveis de autonomia**: 0 conversa · 1 propõe · 2 executa com aprovação · 3 executa rotinas aprovadas.
- **Execuções longas** em segundo plano com retomada (Vercel Workflow ou fila), e o resultado aparece na caixa de aprovações.
- **Rotinas** pelo agendador que já existe: relatório semanal, acompanhamentos do dia, caixa da semana.
- **Custo**: CEO com o modelo principal; diretorias com o modelo barato quando a tarefa é simples; teto por agente.

### 5.3 O que já temos e serve de base

| Já existe | Uso no plano |
|---|---|
| Agentes com instruções, área, ícone e cor | vira a base dos agentes Pessoal e Trabalho |
| Conversa com agente ou projeto | "Fale com o CEO", "Fale com o Comercial" |
| Memória por área do agente | vira memória por espaço e área |
| Projetos e tarefas | projetos de cliente e entregas |
| Agenda (ler e propor evento), Gmail (ler) | antes e depois da reunião, acompanhamentos |
| Insights, briefing, revisão da noite, agendador | relatório do CEO e rotinas das áreas |
| Busca por significado | histórico de clientes e documentos |
| Convites, admin e negócio próprio no convite | entrada do Luiz Cláudio com a empresa pronta |

**Falta:** espaços, hierarquia e ferramentas por agente, caixa de aprovações, registro de execuções, CRM, documentos, orçamento por agente.

## 6. Plano em fases

| Fase | Entrega | Resultado para você |
|---|---|---|
| **6.1 Fundamentos** | Espaços Pessoal e Trabalho; agentes com categoria, papel, hierarquia, autonomia e teto; organograma na aba Agentes; modelos prontos das duas categorias | A empresa virtual aparece e cada agente sabe o seu papel |
| **6.2 CRM leve** | Clientes, contatos, funil, atividades; agente Comercial com ferramentas de CRM; "antes da reunião" | Prospecção e acompanhamentos organizados |
| **6.3 Orquestração** | CEO delega às áreas (*tool use*); caixa de aprovações; registro de execuções; relatório semanal | Você pede um objetivo e a empresa trabalha |
| **6.4 Execução** | Rotinas por agente; rascunhos de e-mail com aprovação; notas de reunião viram tarefas; documentos por empresa | O dia a dia anda sozinho, com você aprovando |
| **6.5 Métricas** | Painel por área (só dados reais), metas do trimestre | Visão de resultado |
| **Convite do Luiz Cláudio** | Depois da 6.2 (ou 6.3) | Ele já entra com algo útil |

## 7. Riscos e cuidados

- **Custo**: orquestração gasta mais tokens. Por isso: teto por agente, modelo barato nas áreas, rotinas só quando ligadas.
- **Confiança**: nada sai do GaDu sem aprovação, até você liberar rotinas específicas.
- **Complexidade**: começar com 5 agentes de Trabalho, não 10.
- **Privacidade**: espaço Trabalho é do negócio próprio; termos bloqueados continuam valendo.
- **Qualidade**: cada agente com exemplos de bons resultados e revisão periódica das instruções.

## 8. Para decidirmos juntos

1. Uma empresa por pessoa ou várias (ex.: você com projetos próprios e o Luiz com a Imagem)?
2. No futuro, o espaço Trabalho poderá ser **compartilhado** (você e o Luiz na mesma empresa)? Isso muda o modelo de dados desde já.
3. Etapas do funil da Imagem Consultoria (ex.: Indicação › Conversa › Diagnóstico › Proposta › Fechado).
4. Nível de autonomia inicial: tudo com aprovação?
5. Busca na web (pesquisa de mercado e prospects) entra agora, com custo próprio, ou depois?
6. Quais 5 agentes de Trabalho e quais de Pessoal entram primeiro?
