import { NextRequest, NextResponse } from "next/server";
import { GroqAPIError, requestGroq } from "@/lib/groq";

const SYSTEM = `You are GI Smart Assistant, a helpful nutrition chatbot specializing in Glycemic Index (GI) diet advice.
You help users understand:
- Glycemic Index and Glycemic Load values
- Which foods are low, medium, or high GI
- Meal planning for blood sugar control, weight loss, and general health
- Hydration and nutrition tips
Keep answers concise, friendly, and practical. Always relate advice back to GI values where relevant.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((message: { role?: unknown; content?: unknown }) =>
          ["user", "assistant"].includes(String(message?.role)) && typeof message?.content === "string"
        )
        .slice(-10)
        .map((message: { role: "user" | "assistant"; content: string }) => ({
          role: message.role,
          content: message.content.slice(0, 1500),
        }))
    : [];
  if (messages.length === 0) {
    return NextResponse.json({ reply: "Please enter a message." }, { status: 400 });
  }

  try {
    const reply = await requestGroq({
      system: SYSTEM,
      messages,
      maxTokens: 400,
      temperature: 0.3,
    });
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof GroqAPIError && error.status === 503) {
      return NextResponse.json({ reply: error.message }, { status: 503 });
    }
    return NextResponse.json({ reply: "Sorry, something went wrong. Please try again." }, { status: 500 });
  }
}
