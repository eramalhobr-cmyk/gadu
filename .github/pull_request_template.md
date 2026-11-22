## O que muda
<!-- Em português, para o Eduardo entender: o que a pessoa vai ver ou ganhar. -->

## Feito por (IA):
<!-- Claude Code · Codex · Cursor (Grok Bot) · outra. Se mais de uma, diga quem fez o quê. -->

## Revisar:
<!-- O que outra IA ou o Eduardo deve conferir com atenção (riscos, partes incompletas, decisões). Vai também para "A revisar por outra IA" em docs/HANDOFF.md. -->

## Risco
- [ ] Baixo (interface, textos, docs, reversível)
- [ ] Alto (banco, autenticação, permissões, credenciais, segurança, custo): plano de rollback abaixo e aprovação do Eduardo

## Como foi testado
- [ ] `npm run typecheck`
- [ ] `npm run test:unit` e `npm run test:integration`
- [ ] `npm run build`
- [ ] `bash scripts/test-db.sh`
- [ ] e2e público e mobile (se mexeu na interface)
- [ ] Conferido a 412 × 915 (celular)

## Documentação atualizada
- [ ] ROADMAP.md · CHANGELOG.md · PROJECT_STATUS.md · docs/FEATURE_MATRIX.md · docs/HANDOFF.md

## Rollback
<!-- Como desfazer: reverter o PR, interruptor de emergência, promover deploy anterior na Vercel. -->
