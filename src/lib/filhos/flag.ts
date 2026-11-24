/** AGENDA_FILHOS_ENABLED=0 desliga a Agenda de filhos (tela, rotas, ações e bloco do chat). Ligada por padrão. */
export const agendaFilhosEnabled = () => process.env.AGENDA_FILHOS_ENABLED !== "0";
