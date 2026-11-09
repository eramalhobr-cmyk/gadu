import { serverConfig } from "@/lib/config";
import type { ChatRequest, Provider } from "./types";

// Contingência: usado só se o motor principal falhar antes de responder.
export const geminiProvider: Provider = {
  id: "gemini",
  name: "Gemini",
  available: () => Boolean(serverConfig().geminiKey),
  async *stream(req: ChatRequest) {
    const cfg = serverConfig();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal: req.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${req.system}\n\n${req.context}` }] },
        contents: req.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("gemini vazio");
    yield text;
  },
};
