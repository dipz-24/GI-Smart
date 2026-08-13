"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Droplets, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type MealEntries = Record<"Breakfast" | "Lunch" | "Dinner" | "Snacks", {
  status: "pending" | "followed" | "different" | "skipped";
  foods: { name: string; portionG: number }[];
}>;

type CoachResult = {
  day: string;
  remainingSlots: string[];
  targets: { kcal: number; protein: number; fibre: number; water: number };
  consumed: { kcal: number; protein: number; fibre: number };
  remaining: { kcal: number; protein: number; fibre: number; water: number };
  projected: { kcal: number; protein: number; fibre: number };
  insights: string[];
  adjustedPortions: boolean;
  adapted: boolean;
  isDayComplete: boolean;
  review: Array<{
    key: string;
    label: string;
    status: "met" | "warning";
    message: string;
  }>;
  disclaimer: string;
  recommendations: Array<{
    slot: string;
    gi: number;
    kcal: number;
    protein: number;
    fibre: number;
    foods: string[];
    items: Array<{ name: string; portionG: number }>;
    reasons: string[];
  }>;
};

type AIFocus = "summary" | "tomorrow" | "balance" | "low-gi";
type AIInsight = { headline: string; summary: string; priority: string; suggestion: string };

export default function AdaptiveGICoach({ mealEntries, water }: { mealEntries: MealEntries; water: string }) {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [resultKey, setResultKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [aiInsight, setAIInsight] = useState<AIInsight | null>(null);
  const [aiResultKey, setAIResultKey] = useState("");
  const [aiLoading, setAILoading] = useState<AIFocus | null>(null);
  const [aiError, setAIError] = useState<{ key: string; message: string } | null>(null);

  const selectedKey = JSON.stringify(mealEntries);
  const inputKey = `${selectedKey}|${water}`;
  const visibleResult = resultKey === inputKey ? result : null;
  const visibleError = error?.key === inputKey ? error.message : null;
  const visibleAIInsight = aiResultKey === inputKey ? aiInsight : null;
  const visibleAIError = aiError?.key === inputKey ? aiError.message : null;

  async function analyzeDay() {
    setLoading(true);
    setError(null);
    try {
      const localDate = new Date();
      const dayNumber = ((localDate.getDay() + 6) % 7) + 1;
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayNumber,
          completedSlots: Object.entries(mealEntries)
            .filter(([, entry]) => entry.status === "followed")
            .map(([slot]) => slot),
          mealEntries,
          water: Number.parseFloat(water || "0"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The coach could not analyze your day.");
      setResult(data);
      setResultKey(inputKey);
      setAIInsight(null);
      setAIResultKey("");
    } catch (caught) {
      setError({
        key: inputKey,
        message: caught instanceof Error ? caught.message : "The coach could not analyze your day.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function getAIInsight(focus: AIFocus) {
    setAILoading(focus);
    setAIError(null);
    try {
      const localDate = new Date();
      const dayNumber = ((localDate.getDay() + 6) % 7) + 1;
      const response = await fetch("/api/coach/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber, mealEntries, water: Number.parseFloat(water || "0"), focus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI Coach is temporarily unavailable.");
      setAIInsight(data.insight);
      setAIResultKey(inputKey);
    } catch (caught) {
      setAIError({
        key: inputKey,
        message: caught instanceof Error ? caught.message : "AI Coach is temporarily unavailable.",
      });
    } finally {
      setAILoading(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#26362d] bg-[#17231d] text-white shadow-xl">
      <div className="relative p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#e05b2b]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-20 h-48 w-48 rounded-full bg-[#5fb878]/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#8fd19e]/25 bg-[#8fd19e]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#aee7bb]">
              <Sparkles size={13} /> Adaptive GI Coach
            </div>
            <h2 className="text-2xl font-black tracking-tight">Optimize the rest of your day</h2>
            <p className="mt-2 text-sm leading-6 text-[#c9d2cc]">
              Record whether you followed, changed, or skipped each meal. The coach preserves your plan
              unless a real deviation changes what remains for the day.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={analyzeDay}
            disabled={loading}
            className="relative shrink-0 bg-[#e05b2b] shadow-lg shadow-black/20"
          >
            {loading
              ? <><Loader2 size={17} className="animate-spin" /> Analyzing…</>
              : <><Sparkles size={17} /> Analyze my day</>}
          </Button>
        </div>

        {visibleError && (
          <div className="relative mt-5 rounded-xl border border-[#ff9e7c]/30 bg-[#c1440e]/20 px-4 py-3 text-sm text-[#ffd2c2]">
            {visibleError}
          </div>
        )}

        {visibleResult && (
          <div className="relative mt-7 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Calories"
                before={`${visibleResult.consumed.kcal.toLocaleString()} kcal`}
                after={`${visibleResult.projected.kcal.toLocaleString()} / ${visibleResult.targets.kcal.toLocaleString()}`}
              />
              <Metric
                label="Protein"
                before={`${visibleResult.consumed.protein.toFixed(1)} g`}
                after={`${visibleResult.projected.protein.toFixed(1)} g · min ${visibleResult.targets.protein.toFixed(1)}`}
              />
              <Metric
                label="Fibre"
                before={`${visibleResult.consumed.fibre.toFixed(1)} g`}
                after={`${visibleResult.projected.fibre.toFixed(1)} g · min ${visibleResult.targets.fibre.toFixed(1)}`}
              />
              <Metric
                label="Water remaining"
                before={`${visibleResult.remaining.water.toFixed(1)} L`}
                after={visibleResult.remaining.water === 0 ? "Target met" : `${visibleResult.targets.water.toFixed(1)} L target`}
                icon={<Droplets size={14} />}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#f4f7f5]">
                  {visibleResult.isDayComplete ? "Today’s nutrition review" : "Projected nutrition check"}
                </h3>
                <span className="text-[10px] text-[#9eaaa2]">References, not a medical diagnosis</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {visibleResult.review.map((check) => (
                  <div
                    key={check.key}
                    className="rounded-xl border p-3"
                    style={check.status === "met"
                      ? { borderColor: "rgba(143,209,158,0.25)", background: "rgba(143,209,158,0.09)" }
                      : { borderColor: "rgba(246,190,90,0.35)", background: "rgba(246,190,90,0.1)" }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      {check.status === "met"
                        ? <CheckCircle2 size={14} className="text-[#8fd19e]" />
                        : <AlertTriangle size={14} className="text-[#f6be5a]" />}
                      {check.label}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-[#c9d2cc]">{check.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e05b2b]/30 bg-gradient-to-br from-[#2b211c] to-[#1f1916]">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles size={15} className="text-[#ff8a5f]" /> AI Coach Insight
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#c9bdb6]">
                    Groq explains the verified results above; it cannot change the calculated nutrition values.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => getAIInsight("summary")}
                  disabled={aiLoading !== null}
                  className="shrink-0 bg-white text-[#2b211c] hover:bg-[#fff5ef]"
                >
                  {aiLoading === "summary"
                    ? <><Loader2 size={15} className="animate-spin" /> Thinking…</>
                    : <><Sparkles size={15} /> Explain my day</>}
                </Button>
              </div>

              {visibleAIError && (
                <div className="border-t border-[#e05b2b]/20 px-5 py-4 text-sm text-[#ffb49a]">{visibleAIError}</div>
              )}

              {visibleAIInsight && (
                <div className="border-t border-[#e05b2b]/20 bg-black/10 p-5">
                  <div className="text-lg font-black text-white">{visibleAIInsight.headline}</div>
                  <p className="mt-2 text-sm leading-6 text-[#e2d9d4]">{visibleAIInsight.summary}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff8a5f]">Main observation</div>
                      <p className="mt-1.5 text-xs leading-5 text-[#ddd2cc]">{visibleAIInsight.priority}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fd19e]">Practical next step</div>
                      <p className="mt-1.5 text-xs leading-5 text-[#ddd2cc]">{visibleAIInsight.suggestion}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {([
                      ["tomorrow", "How should I improve tomorrow?"],
                      ["balance", "Was today balanced?"],
                      ["low-gi", "Explain the GI impact"],
                    ] as const).map(([focus, label]) => (
                      <button
                        key={focus}
                        type="button"
                        disabled={aiLoading !== null}
                        onClick={() => getAIInsight(focus)}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-[#e2d9d4] transition-colors hover:border-[#ff8a5f]/50 hover:text-white disabled:opacity-50"
                      >
                        {aiLoading === focus ? "Thinking…" : label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-white/[0.06] px-5 py-2.5 text-[9px] leading-4 text-[#8f8179]">
                Nutrition totals and meal-status facts are sent to the configured AI provider; names and email addresses are not included.
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-5">
                <h3 className="text-sm font-bold text-[#f4f7f5]">What the coach found</h3>
                <ul className="mt-4 space-y-3">
                  {visibleResult.insights.map((insight) => (
                    <li key={insight} className="flex gap-2.5 text-xs leading-5 text-[#c9d2cc]">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#8fd19e]" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#f4f7f5]">
                      {visibleResult.adapted ? "Coach-adjusted remaining meals" : "Your remaining planned meals"}
                    </h3>
                    <p className="mt-1 text-xs text-[#9eaaa2]">
                      {visibleResult.adjustedPortions
                        ? "Portions were adjusted toward your remaining calorie target."
                        : "Your planned portions already fit the remaining target."}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#8fd19e]">{visibleResult.day}</span>
                </div>

                {visibleResult.recommendations.length === 0 ? (
                  <div className="rounded-2xl border border-[#8fd19e]/20 bg-[#8fd19e]/10 p-5 text-sm leading-6 text-[#ccefd4]">
                    Every meal slot is already recorded. The coach will not rewrite food you already ate; use the nutrition review above to understand today&apos;s gaps.
                  </div>
                ) : (
                  visibleResult.recommendations.map((meal) => (
                    <article key={meal.slot} className="rounded-2xl bg-white p-5 text-[#1a1a14] shadow-lg">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-bold">{meal.slot}</h4>
                        <div className="flex gap-2 text-[10px] font-mono">
                          <span className="rounded-full bg-[#d8f3dc] px-2 py-1 text-[#2d6a4f]">GI {meal.gi}</span>
                          <span className="rounded-full bg-[#ede8df] px-2 py-1 text-[#4a4a3a]">{meal.kcal} kcal</span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {(meal.items.length ? meal.items : meal.foods.map((name) => ({ name, portionG: 0 }))).map((item) => (
                          <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-[#f7f4ee] px-3 py-2 text-xs">
                            <span className="font-medium">{item.name}</span>
                            {item.portionG > 0 && <span className="shrink-0 text-[#77776a]">{item.portionG} g</span>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#68685c]">
                        <span>{meal.protein.toFixed(1)} g protein</span>
                        <span>{meal.fibre.toFixed(1)} g fibre</span>
                        <span className="inline-flex items-center gap-1 text-[#2d6a4f]"><ArrowRight size={11} /> {meal.reasons[0]}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <p className="text-[10px] leading-4 text-[#87928b]">{visibleResult.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  before,
  after,
  icon,
}: {
  label: string;
  before: string;
  after: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9eaaa2]">
        {icon}{label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-[#aeb8b2]">{before}</span>
        <ArrowRight size={13} className="text-[#e05b2b]" />
        <span className="text-sm font-bold text-white">{after}</span>
      </div>
    </div>
  );
}
