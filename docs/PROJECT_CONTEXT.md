# GaDu — contexto mestre e decisões de produto
Atualizado: 2026-11-12. **Documento de intenção e governança; não é certificado de implementação.**

## Objetivo
GaDu é um assistente pessoal de IA multiusuário, com voz, memória, organização, integrações e módulos especializados. O desenvolvimento deve ser independente de ChatGPT, Codex e Claude Code, com GitHub como fonte única versionada.

## Marco Zero — prioridades
1. Auditoria do código existente, dependências, autenticação, APIs, RLS, custos, integrações, testes e infraestrutura.
2. Arquitetura alvo e plano de refatoração incremental, sem interromper produção.
3. Governança agnóstica: `AGENTS.md`, `CLAUDE.md`, documentação central, ADRs e handoff entre ferramentas.
4. Design System GaDu integrado ao PWA atual, com revisão de UX, usabilidade, navegabilidade, acessibilidade e responsividade.
5. Identificar divergências entre roadmap e implementação e classificar: implementado, parcial, planejado ou a validar.

## Produto — visão priorizada
- **GaDu Personal:** voz natural e, futuramente, conversa contínua; memória contextual e controlada pelo usuário; tarefas, recorrências, lembretes, agenda, e-mail, notificações e ações com confirmação.
- **GaDu Finance:** contas, cartões, receitas, despesas, parcelamentos, orçamentos, importação CSV/OFX, categorização e conciliação, dashboards e projeções; Open Finance como evolução condicionada a segurança e consentimento. Dashboard detalhado será incorporado quando fornecido.
- **Administração e consumo:** administrador acompanha usuários, créditos concedidos, consumidos e saldo, tokens, custos reais por provedor/modelo, cotas e alertas. Cada usuário acessa somente seus próprios dados; administração de custos não concede acesso automático a conversas ou dados financeiros.
- **Pesquisa inteligente** e integrações autorizadas.
- **GaDu 3D Studio:** no final do GaDu Personal, antes do Agent Office. Busca de modelos gratuitos (respeitando licenças) em MakerWorld, Printables, Thingiverse; biblioteca; geração de modelos 3D realmente imprimíveis (não apenas imagens), exportação para fatiadores como Bambu Studio; evoluir para análise de suportes/tolerâncias e integrações.
- **Agent Office:** posterior ao GaDu Personal e ao GaDu 3D Studio.

## Princípios
Segurança e privacidade por padrão; arquitetura modular; independência de provedor de IA; nenhuma operação sensível sem aprovação; documentação e testes acompanham código; interfaces em pt-BR; experiência antes de ornamentação.

## Fonte de verdade
O código e testes demonstram o estado implementado; roadmap indica intenção e histórico; ADRs registram decisões. Divergências devem ser explicitadas, não ocultadas.
