"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";

const MEAL_ICONS = { Breakfast: "🌅", Lunch: "☀️", Dinner: "🌙", Snacks: "🍎" } as Record<string, string>;

export default function MealPlanPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [plan, setPlan] = useState(null as any);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState(null as string | null);
  const [shuffling, setShuffling] = useState<string | null>(null);
  const [shuffleError, setShuffleError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    async function loadPlan() {
      setPlanLoading(true);
      setPlanError(null);
      try {
        const res = await fetch("/api/meal-plan");
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        setPlan(data);
      } catch (err) {
        setPlanError("Couldn't load meal plan from Neo4j.");
      } finally {
        setPlanLoading(false);
      }
    }
    loadPlan();
  }, [session]);

  if (isPending) return <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]"><Loader2 size={32} className="animate-spin text-[#e05b2b]" /></div>;
  if (!session) return null;

  async function shuffleMeal(dayIndex: number, mealSlot: string, currentItems: any[], dayFoods: string[]) {
    const key = `${dayIndex}-${mealSlot}`;
    setShuffling(key);
    setShuffleError(null);
    try {
      const res = await fetch("/api/meal-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayNumber: dayIndex + 1,
          mealSlot,
          currentItems,
          dayFoods,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shuffle failed");
      setPlan((current: any) => ({
        ...current,
        days: current.days.map((day: any, index: number) =>
          index === dayIndex
            ? { ...day, meals: { ...day.meals, [mealSlot]: data.meal } }
            : day
        ),
      }));
    } catch (err) {
      setShuffleError(err instanceof Error ? err.message : "Could not shuffle this meal.");
    } finally {
      setShuffling(null);
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[#1a1a14] mb-1">Weekly Meal Plan</h1>
          <p className="text-[#4a4a3a] text-sm">
            {planLoading ? "Loading your plan from Neo4j..." : plan?.summary}
          </p>
          {plan && plan.source === "sample" && (
          <p className="text-xs text-[#9a9a8a] mt-1">
          (Showing a sample plan — no account matched.)
          </p>
        )}
        </div>

        {planError && (
          <div className="bg-white rounded-2xl p-6 border border-[rgba(193,68,14,0.2)] text-center">
            <p className="text-sm text-[#c1440e] font-medium">{planError}</p>
          </div>
        )}
        {shuffleError && <p className="text-sm text-[#c1440e] mb-4">{shuffleError}</p>}

        {planLoading && !planError && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#e05b2b]" />
          </div>
        )}

        {!planLoading && !planError && plan && (
          <div className="space-y-6">
            {plan.days.map((d: any, dayIndex: number) => (
              <div key={d.day}>
                <h2 className="text-base font-bold text-[#1a1a14] mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#e05b2b] text-white text-xs flex items-center justify-center font-bold">{d.day[0]}</span>
                  {d.day}
                  <span className="ml-auto text-xs font-mono font-normal text-[#4a4a3a]">
                    {Object.values(d.meals).reduce((sum: number, meal: any) => sum + meal.kcal, 0).toLocaleString()} / {(plan.dailyCalorieTarget || 2000).toLocaleString()} kcal
                  </span>
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(d.meals).map(([meal, info]: [string, any]) => (
                    <Card key={meal} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between gap-2">
                          <span>{MEAL_ICONS[meal] || "🍽️"} {meal}</span>
                          <button
                            type="button"
                            aria-label={`Shuffle ${d.day} ${meal}`}
                            title="Shuffle meal"
                            disabled={shuffling !== null || plan.source === "sample"}
                            onClick={() => shuffleMeal(
                              dayIndex,
                              meal,
                              info.items || info.foods.map((name: string) => ({ name })),
                              Object.values(d.meals).flatMap((dayMeal: any) => dayMeal.foods)
                            )}
                            className="text-[#e05b2b] disabled:opacity-40"
                          >
                            <RefreshCw size={14} className={shuffling === `${dayIndex}-${meal}` ? "animate-spin" : ""} />
                          </button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 mb-3">
                          {(info.items || info.foods.map((name: string) => ({ name }))).map((item: any, i: number) => (
                            <li key={item.name + i} className="text-xs text-[#4a4a3a] flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-[#e05b2b] shrink-0" />{item.name}
                              </span>
                              {item.portionG && <span className="text-[10px] text-[#9a9a8a]">{item.portionG}g</span>}
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-between text-[10px] text-[#9a9a8a] font-mono">
                          <span>GI {info.gi}</span>
                          <span>{info.kcal} kcal</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
