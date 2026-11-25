export const MAX_TEXTO_FALA = 2400;
export const falaNaturalEnabled = (env: Record<string, string | undefined> = process.env) => env.SPEECH_ENABLED === "1";
