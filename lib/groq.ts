type GroqMessage = { role: "user" | "assistant"; content: string };

export class GroqAPIError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "GroqAPIError";
  }
}

export async function requestGroq({
  system,
  messages,
  maxTokens = 450,
  temperature = 0.2,
}: {
  system: string;
  messages: GroqMessage[];
  maxTokens?: number;
  temperature?: number;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqAPIError("Groq API is not configured", 503);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = typeof data?.error?.message === "string"
      ? data.error.message
      : "Groq request failed";
    console.error("Groq API request failed:", response.status, providerMessage);
    throw new GroqAPIError(providerMessage, response.status);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new GroqAPIError("Groq returned an empty response", 502);
  }
  return text.trim();
}
