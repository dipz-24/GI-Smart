"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, Apple, Calendar, Target, TrendingUp, ChevronRight } from "lucide-react";

const MEAL_ICONS = { Breakfast: "Morning", Lunch: "Midday", Dinner: "Evening", Snacks: "Snack" } as Record<string, string>;

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [todayMeals, setTodayMeals] = useState(null as any);
  const [latestDay, setLatestDay] = useState(null as any);
  const [historyCount, setHistoryCount] = useState(0);
  const [calorieTarget, setCalorieTarget] = useState(2000);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null as string | null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    async function loadDashboardData() {
      setDataLoading(true);
      setDataError(null);
      try {
        const [planRes, trackRes] = await Promise.all([
          fetch("/api/meal-plan"),
          fetch("/api/tracking"),
        ]);
        const planData = await planRes.json();
        const trackData = await trackRes.json();

        if (planData.days && planData.days.length > 0) {
          setTodayMeals(planData.days[0]);
          if (planData.dailyCalorieTarget) setCalorieTarget(planData.dailyCalorieTarget);
        }
        if (trackData.days && trackData.days.length > 0) {
          setLatestDay(trackData.days[0]);
          setHistoryCount(trackData.days.length);
        }
      } catch (err) {
        setDataError("Couldn't load your data from Neo4j.");
      } finally {
        setDataLoading(false);
      }
    }
    loadDashboardData();
  }, [session]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
        <Loader2 size={32} className="animate-spin text-[#e05b2b]" />
      </div>
    );
  }
  if (!session) return null;

  const firstName = session.user.name?.split(" ")[0] || "User";

  const quickStats = [
    {
      label: "Latest GI",
      value: latestDay?.gi == null ? "-" : String(latestDay.gi),
      sub: "Target: 55 or below",
      icon: Activity,
      color: "#2d6a4f",
      bg: "#d8f3dc",
    },
    {
      label: "Calories",
      value: latestDay?.kcal == null ? "-" : latestDay.kcal.toLocaleString(),
      sub: `Goal: ${calorieTarget.toLocaleString()} kcal`,
      icon: TrendingUp,
      color: "#e05b2b",
      bg: "#ffe4d6",
    },
    {
      label: "Adherence",
      value: latestDay ? Math.round(latestDay.adherence * 100) + "%" : "-",
      sub: "On your meal plan",
      icon: Target,
      color: "#7a5800",
      bg: "#fef3c7",
    },
    {
      label: "Days Logged",
      value: String(historyCount),
      sub: historyCount > 0 ? "In your history" : "Start logging today",
      icon: Calendar,
      color: "#185fa5",
      bg: "#e6f1fb",
    },
  ];

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-[rgba(26,26,20,0.08)] shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-[#1a1a14]">Welcome back, {firstName}</h1>
            <p className="text-sm text-[#4a4a3a] mt-1">
              Goal: <strong>{(session.user as any).goal || "General Health"}</strong> - {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/user/profile">Edit Profile</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/tracking">Log Today</Link>
            </Button>
          </div>
        </div>

        {dataError && (
          <div className="bg-white rounded-2xl p-6 border border-[rgba(193,68,14,0.2)] text-center">
            <p className="text-sm text-[#c1440e] font-medium">{dataError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,20,0.08)] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon size={15} style={{ color: s.color }} />
                </div>
                <span className="text-xs text-[#4a4a3a] font-medium">{s.label}</span>
              </div>
              <div className="text-2xl font-black text-[#1a1a14]">{dataLoading ? "..." : s.value}</div>
              <div className="text-xs text-[#9a9a8a] mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1a1a14]">Today's Meal Plan</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/meal-plan" className="flex items-center gap-1">View full plan <ChevronRight size={14} /></Link>
              </Button>
            </div>

            {dataLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#e05b2b]" />
              </div>
            )}

            {!dataLoading && !todayMeals && (
              <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,20,0.08)] text-center">
                <p className="text-sm text-[#4a4a3a]">No meal plan found yet.</p>
              </div>
            )}

            {!dataLoading && todayMeals && (
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(todayMeals.meals).map(([meal, info]: [string, any]) => (
                  <Card key={meal} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{MEAL_ICONS[meal] || "Meal"}: {meal}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 mb-3">
                        {info.foods.map((f: string, i: number) => (
                          <li key={f + i} className="text-sm text-[#4a4a3a] flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-[#e05b2b] shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#d8f3dc] text-[#2d6a4f] font-medium">GI {info.gi}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#ede8df] text-[#4a4a3a] font-medium">{info.kcal} kcal</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#1a1a14]">Quick Actions</h2>
            {[
              { href: "/foods", icon: Apple, label: "Browse Food Database", sub: "Search real foods from Neo4j" },
              { href: "/meal-plan", icon: Calendar, label: "Weekly Meal Plan", sub: "7-day personalised plan" },
              { href: "/tracking", icon: Activity, label: "Daily Tracking", sub: "Log meals & water" },
              { href: "/user/profile", icon: Target, label: "Health Profile", sub: "Update goals & stats" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-[rgba(26,26,20,0.08)] hover:shadow-md hover:border-[rgba(224,91,43,0.3)] transition-all group">
                <div className="w-9 h-9 rounded-xl bg-[rgba(224,91,43,0.08)] flex items-center justify-center group-hover:bg-[rgba(224,91,43,0.15)] transition-colors">
                  <a.icon size={16} className="text-[#e05b2b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1a1a14] truncate">{a.label}</div>
                  <div className="text-xs text-[#4a4a3a]">{a.sub}</div>
                </div>
                <ChevronRight size={14} className="text-[#9a9a8a] group-hover:text-[#e05b2b] transition-colors shrink-0" />
              </Link>
            ))}

            <div className="bg-[#1a1a14] text-white rounded-2xl p-5">
              <div className="text-xs font-mono uppercase tracking-wider text-[#e05b2b] mb-2">GI Guide</div>
              <div className="space-y-2">
                {[
                  { label: "Low GI", range: "55 or below", color: "#2d6a4f", bg: "#d8f3dc" },
                  { label: "Medium GI", range: "56-69", color: "#7a5800", bg: "#fef3c7" },
                  { label: "High GI", range: "70 or above", color: "#c1440e", bg: "#ffe4d6" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                    <span className="text-xs text-[#9a9a8a]">{t.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
