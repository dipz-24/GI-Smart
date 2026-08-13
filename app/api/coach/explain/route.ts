import { NextResponse } from "next/server";
import { POST as analyzeCoachDay } from "@/app/api/coach/route";
import { getAuthenticatedEmail } from "@/lib/server-session";
import { GroqAPIError, requestGroq } from "@/lib/groq";

const ALLOWED_FOCUS = ["summary", "tomorrow", "balance", "low-gi"] as const;
type Focus = (typeof ALLOWED_FOCUS)[number];

const SYSTEM_PROMPT = `You are the explanation layer for GI Smart's nutrition coach.
The application has already calculated every nutrition value. Never recalculate, contradict, or invent numbers.
Treat energyStatus and coachingConstraint as binding facts. Never reverse below/within/above target.
If a meal was skipped, do not recommend compensating, restricting, offsetting, or changing tomorrow's intake to repay today's result.
For a completed day, discuss tomorrow only; never tell the user to eat an additional meal today.
Use only the supplied analysis. Do not diagnose deficiencies, diseases, or eating disorders.
Describe targets as estimates or references, not medical requirements.
Do not encourage eating merely to make a number exact. A single day does not establish a health pattern.
Be supportive, specific, concise, and practical. Mention accomplishments before gaps.
Return only valid JSON with these string fields: headline, summary, priority, suggestion.`;

export async function POST(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const focus: Focus = ALLOWED_FOCUS.includes(body?.focus) ? body.focus : "summary";
  const analysisRequest = new Request(new URL("/api/coach", request.url), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      dayNumber: body?.dayNumber,
      mealEntries: body?.mealEntries,
      water: body?.water,
    }),
  });
  const analysisResponse = await analyzeCoachDay(analysisRequest);
  const analysis = await analysisResponse.json();
  if (!analysisResponse.ok) return NextResponse.json(analysis, { status: analysisResponse.status });

  const focusInstruction: Record<Focus, string> = {
    summary: "Summarize today's result and identify at most one useful priority.",
    tomorrow: "Give one realistic way to use today's result when planning tomorrow.",
    balance: "Explain whether the tracked day appears balanced according to the supplied references only.",
    "low-gi": "Explain the low-GI implications using only the supplied GI facts. If GI evidence is absent, say so.",
  };

  const energyStatus = getEnergyStatus(analysis.review);
  const coachingConstraint = analysis.skippedSlots?.length
    ? "A skipped meal is recorded. Do not compensate for it today or tomorrow; recommend returning to the normal plan and noticing patterns only if this happens repeatedly."
    : energyStatus === "below"
      ? "Calories are below the estimated range. Never describe them as high or recommend a lighter/reduced intake."
      : energyStatus === "above"
        ? "Calories are above the estimated range. Do not recommend punishment or compensatory restriction."
        : "Calories are within the estimated range. Do not describe them as too high or too low.";

  const safeFacts = {
    isDayComplete: analysis.isDayComplete,
    completedSlots: analysis.completedSlots,
    differentSlots: analysis.differentSlots,
    skippedSlots: analysis.skippedSlots,
    targets: analysis.targets,
    consumed: analysis.consumed,
    projected: analysis.projected,
    remaining: analysis.remaining,
    review: analysis.review,
    insights: analysis.insights,
    energyStatus,
    coachingConstraint,
    pendingMeals: analysis.recommendations?.map((meal: { slot: string; gi: number; kcal: number; protein: number; fibre: number }) => ({
      slot: meal.slot,
      gi: meal.gi,
      kcal: meal.kcal,
      protein: meal.protein,
      fibre: meal.fibre,
    })),
  };

  try {
    const rawText = await requestGroq({
      system: SYSTEM_PROMPT,
      maxTokens: 450,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: `${focusInstruction[focus]}\n\nVerified analysis:\n${JSON.stringify(safeFacts)}`,
      }],
    });
    const parsed = parseInsight(rawText);
    if (!parsed) {
      return NextResponse.json({ error: "AI Coach returned an invalid response" }, { status: 502 });
    }
    const insight = enforceCoachingConstraints(parsed, {
      energyStatus,
      skippedSlots: analysis.skippedSlots || [],
      calorieTarget: Number(analysis.targets?.kcal || 0),
      caloriesConsumed: Number(analysis.consumed?.kcal || 0),
    });
    return NextResponse.json({ insight, focus });
  } catch (error) {
    console.error("AI Coach explanation failed:", error);
    if (error instanceof GroqAPIError && error.status === 503) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: "AI Coach is temporarily unavailable" }, { status: 502 });
  }
}

function getEnergyStatus(review: unknown): "below" | "within" | "above" {
  if (!Array.isArray(review)) return "within";
  const calories = review.find((item) => item?.key === "calories");
  const message = typeof calories?.message === "string" ? calories.message.toLowerCase() : "";
  if (message.includes("below")) return "below";
  if (message.includes("above")) return "above";
  return "within";
}

function enforceCoachingConstraints(
  insight: { headline: string; summary: string; priority: string; suggestion: string },
  facts: { energyStatus: "below" | "within" | "above"; skippedSlots: string[]; calorieTarget: number; caloriesConsumed: number }
) {
  if (facts.skippedSlots.length === 0) return insight;

  const skipped = facts.skippedSlots.join(" and ");
  const difference = Math.max(0, Math.round(facts.calorieTarget - facts.caloriesConsumed));
  return {
    ...insight,
    headline: "A skipped meal made today different from the plan",
    summary: facts.energyStatus === "below"
      ? `You recorded ${skipped} as skipped, leaving today's intake about ${difference.toLocaleString()} kcal below your estimate. One day does not need to be offset or repaid.`
      : `You recorded ${skipped} as skipped. Treat this as today's record rather than something that must be offset tomorrow.`,
    priority: "Consistency over time matters more than correcting one day's calorie total.",
    suggestion: "Tomorrow, return to your usual meal plan. Do not eat less or more simply to compensate for today; review the plan only if skipped meals become a pattern.",
  };
}

function parseInsight(text: string) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const fields = ["headline", "summary", "priority", "suggestion"] as const;
    if (!fields.every((field) => typeof value[field] === "string")) return null;
    return {
      headline: String(value.headline).slice(0, 700),
      summary: String(value.summary).slice(0, 700),
      priority: String(value.priority).slice(0, 700),
      suggestion: String(value.suggestion).slice(0, 700),
    };
  } catch {
    return null;
  }
}
