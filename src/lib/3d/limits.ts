// Limites do 3D Studio. Uma fonte só para a rota, o prompt, a validação e a interface.
/** Texto do pedido da pessoa (e do pedido de ajuste). */
export const PEDIDO_MAX = 800;
/** Código OpenSCAD que entra (refino) e que sai da IA. */
export const SCAD_MAX = 20_000;
/** Mensagem de erro do OpenSCAD enviada de volta para a IA corrigir. */
export const ERRO_MAX = 1_500;
/** Saída máxima da IA (tokens) e entrada máxima estimada (caracteres), para a reserva de orçamento. */
export const SAIDA_MAX_TOKENS = 6_000;
export const PROMPT_REGRAS_CHARS = 3_500;
/** Volume de impressão da Bambu Lab A1 (mm). */
export const A1_VOLUME_MM = 256;
/** Parede mínima (3 linhas de 0,4 mm). */
export const PAREDE_MIN_MM = 1.2;
/** Tempo máximo de uma renderização no worker (ms) e tamanho máximo da malha aceita (triângulos). */
export const RENDER_TIMEOUT_MS = 30_000;
export const TRIANGULOS_MAX = 400_000;
