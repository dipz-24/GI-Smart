"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Droplets, Activity, Pencil, Plus, Trash2, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import AdaptiveGICoach from "@/components/AdaptiveGICoach";

const metStyle = {
  yes: { bg: "#d8f3dc", text: "#2d6a4f", label: "✓ On track" },
  partial: { bg: "#fef3c7", text: "#7a5800", label: "~ Partial" },
  no: { bg: "#ffe4d6", text: "#c1440e", label: "✗ Off track" },
} as Record<string, { bg: string; text: string; label: string }>;

const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type MealSlot = (typeof MEAL_SLOTS)[number];
type MealStatus = "pending" | "followed" | "different" | "skipped";
type ActualFoodInput = { name: string; portionG: number };
type MealEntry = { status: MealStatus; foods: ActualFoodInput[] };

function emptyMealEntries(): Record<MealSlot, MealEntry> {
  return {
    Breakfast: { status: "pending", foods: [] },
    Lunch: { status: "pending", foods: [] },
    Dinner: { status: "pending", foods: [] },
    Snacks: { status: "pending", foods: [] },
  };
}

function entriesFromDay(day: {
  mealSlots?: string[];
  followedSlots?: string[];
  differentSlots?: string[];
  skippedSlots?: string[];
  actualFoods?: { slot: string; name: string; portionG: number }[];
}): Record<MealSlot, MealEntry> {
  const followed = new Set(day.followedSlots || day.mealSlots || []);
  const different = new Set(day.differentSlots || []);
  const skipped = new Set(day.skippedSlots || []);
  return Object.fromEntries(MEAL_SLOTS.map((slot) => {
    const status: MealStatus = different.has(slot) ? "different" : followed.has(slot) ? "followed" : skipped.has(slot) ? "skipped" : "pending";
    const foods = (day.actualFoods || [])
      .filter((food) => food.slot === slot)
      .map((food) => ({ name: food.name, portionG: Number(food.portionG || 100) }));
    return [slot, { status, foods: status === "different" && foods.length === 0 ? [{ name: "", portionG: 100 }] : foods }];
  })) as Record<MealSlot, MealEntry>;
}

function FoodAutocomplete({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase();
  const matches = query.length < 2
    ? []
    : options
        .filter((name) => name.toLocaleLowerCase().includes(query))
        .sort((a, b) => {
          const aStarts = a.toLocaleLowerCase().startsWith(query);
          const bStarts = b.toLocaleLowerCase().startsWith(query);
          return Number(bStarts) - Number(aStarts) || a.localeCompare(b);
        })
        .slice(0, 8);

  return (
    <div className="relative min-w-0">
      <Input
        placeholder="Search food name"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-suggestions`}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[rgba(26,26,20,0.14)] bg-white p-1 shadow-xl"
        >
          {matches.map((name, index) => (
            <button
              key={`${name}-${index}`}
              type="button"
              role="option"
              aria-selected={name === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#1a1a14] hover:bg-[#f5f0e8] focus:bg-[#f5f0e8] focus:outline-none"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [water, setWater] = useState("2.0");
  const [notes, setNotes] = useState("");
  const [mealEntries, setMealEntries] = useState<Record<MealSlot, MealEntry>>(emptyMealEntries);
  const [foodOptions, setFoodOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [history, setHistory] = useState([] as any[]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null as string | null);
  const [matchedByEmail, setMatchedByEmail] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [waterGoal, setWaterGoal] = useState(2.5);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  async function loadHistory() {
    if (!session) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/tracking");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setHistory(data.days || []);
      setMatchedByEmail(data.matchedByEmail);
      if (Number(data.waterGoal) > 0) setWaterGoal(Number(data.waterGoal));
      const localToday = new Date().toLocaleDateString("en-CA");
      const todayLog = data.days?.find((day: any) => day.date === localToday);
      if (todayLog) {
        setMealEntries(entriesFromDay(todayLog));
      }
    } catch (err) {
      setHistoryError("Couldn't load tracking history from Neo4j.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/foods")
      .then((response) => response.ok ? response.json() : { foods: [] })
      .then((data) => setFoodOptions(Array.from(new Set<string>(
        (data.foods || []).map((food: { name: string }) => food.name)
      ))))
      .catch(() => setFoodOptions([]));
  }, [session]);

  if (isPending) return <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]"><Loader2 size={32} className="animate-spin text-[#e05b2b]" /></div>;
  if (!session) return null;

  const localToday = new Date().toLocaleDateString("en-CA");

  function editToday(day: any) {
    setMealEntries(entriesFromDay(day));
    setWater(String(day.water ?? 0));
    setNotes(day.notes || "");
    setEditing(true);
    setSaveError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function deleteToday() {
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/tracking", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: localToday,
        }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setMealEntries(emptyMealEntries());
      setWater("2.0");
      setNotes("");
      setEditing(false);
      setDeleteDialogOpen(false);
      await loadHistory();
    } catch {
      setSaveError("Could not delete today’s log. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checks,
          mealEntries,
          water,
          notes,
          logDate: localToday,
        }),
      });

      if (!res.ok) {
        throw new Error("Save failed");
      }

      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
      await loadHistory();
    } catch (err) {
      console.error(err);
      setSaveError("Could not save today's log. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
  const checks = Object.fromEntries(MEAL_SLOTS.map((slot) => [slot, mealEntries[slot].status === "followed"]));

  function setMealStatus(slot: MealSlot, status: MealStatus) {
    setMealEntries((current) => ({
      ...current,
      [slot]: {
        status: current[slot].status === status ? "pending" : status,
        foods: current[slot].status !== status && status === "different"
          ? current[slot].foods.length ? current[slot].foods : [{ name: "", portionG: 100 }]
          : [],
      },
    }));
  }

  function updateActualFood(slot: MealSlot, index: number, update: Partial<ActualFoodInput>) {
    setMealEntries((current) => ({
      ...current,
      [slot]: {
        ...current[slot],
        foods: current[slot].foods.map((food, foodIndex) => foodIndex === index ? { ...food, ...update } : food),
      },
    }));
  }

  function addActualFood(slot: MealSlot) {
    setMealEntries((current) => ({
      ...current,
      [slot]: { ...current[slot], foods: [...current[slot].foods, { name: "", portionG: 100 }] },
    }));
  }

  function removeActualFood(slot: MealSlot, index: number) {
    setMealEntries((current) => ({
      ...current,
      [slot]: { ...current[slot], foods: current[slot].foods.filter((_, foodIndex) => foodIndex !== index) },
    }));
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a14] mb-1">Daily Tracking</h1>
          <p className="text-sm text-[#4a4a3a]">{today}</p>
        </div>

        {saved && (
          <Alert variant="success">
            <CheckCircle2 size={16} />
            <AlertDescription>Today's log saved successfully!</AlertDescription>
          </Alert>
        )}
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        {editing && (
          <Alert>
            <Pencil size={16} />
            <AlertDescription className="flex items-center justify-between gap-3">
              Editing today&apos;s log. Unchecked meals will be removed.
              <button type="button" onClick={cancelEdit} aria-label="Cancel editing">
                <X size={16} />
              </button>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Activity size={16} className="text-[#e05b2b]" /> Meal Adherence</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#4a4a3a] mb-4">What happened at each meal?</p>
              <div className="space-y-3">
                {MEAL_SLOTS.map((meal) => {
                  const entry = mealEntries[meal];
                  return (
                    <div key={meal} className="rounded-2xl border border-[rgba(26,26,20,0.1)] bg-[#faf8f4] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-semibold text-[#1a1a14]">
                          {meal === "Breakfast" ? "🌅" : meal === "Lunch" ? "☀️" : meal === "Dinner" ? "🌙" : "🍎"} {meal}
                          {entry.status === "pending" && <span className="ml-2 text-[10px] font-normal text-[#9a9a8a]">Not logged</span>}
                        </span>
                        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#ede8df] p-1">
                          {([
                            ["followed", "Followed plan"],
                            ["different", "Ate different"],
                            ["skipped", "Skipped"],
                          ] as const).map(([status, label]) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setMealStatus(meal, status)}
                              className="rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all"
                              style={entry.status === status
                                ? { background: status === "followed" ? "#2d6a4f" : status === "different" ? "#e05b2b" : "#4a4a3a", color: "white" }
                                : { color: "#68685c" }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {entry.status === "different" && (
                        <div className="mt-4 space-y-2 border-t border-dashed border-[rgba(26,26,20,0.12)] pt-4">
                          <p className="text-xs text-[#68685c]">Add what you actually ate. Nutrition is verified against Neo4j when you save.</p>
                          {entry.foods.map((food, index) => (
                            <div key={`${meal}-${index}`} className="grid grid-cols-[1fr_90px_32px] gap-2">
                              <FoodAutocomplete
                                id={`${meal.toLowerCase()}-food-${index}`}
                                value={food.name}
                                options={foodOptions}
                                onChange={(name) => updateActualFood(meal, index, { name })}
                              />
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="10"
                                  max="1000"
                                  step="5"
                                  aria-label={`${meal} food portion in grams`}
                                  value={food.portionG}
                                  onChange={(event) => updateActualFood(meal, index, { portionG: Number(event.target.value) })}
                                  className="pr-7"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9a9a8a]">g</span>
                              </div>
                              <button
                                type="button"
                                aria-label={`Remove ${meal} food`}
                                onClick={() => removeActualFood(meal, index)}
                                disabled={entry.foods.length === 1}
                                className="flex items-center justify-center rounded-lg text-[#c1440e] disabled:opacity-25"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addActualFood(meal)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#e05b2b]"
                          >
                            <Plus size={13} /> Add another food
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Droplets size={16} className="text-[#185fa5]" /> Water Intake</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Input type="number" min="0" max="10" step="0.1" value={water}
                  onChange={(e) => setWater(e.target.value)} className="w-28" />
                <span className="text-sm text-[#4a4a3a]">litres today</span>
              </div>
              <div className="h-3 rounded-full bg-[rgba(26,26,20,0.08)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: Math.min(100, (parseFloat(water) / waterGoal) * 100) + "%", background: "#185fa5" }} />
              </div>
              <p className="text-xs text-[#4a4a3a]">
                Goal: {waterGoal.toFixed(1)}L · {Math.max(0, waterGoal - parseFloat(water || "0")).toFixed(1)}L remaining
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300}
                placeholder="How did you feel today? Any deviations from the plan?"
                className="w-full rounded-xl border border-[rgba(26,26,20,0.15)] bg-white px-3 py-2 text-sm text-[#1a1a14] placeholder:text-[#9a9a8a] focus:outline-none focus:ring-2 focus:ring-[#e05b2b] resize-none h-24 transition-all" />
              <p className="text-xs text-[#9a9a8a] mt-1 text-right">{notes.length}/300</p>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : editing ? "Update today's log →" : "Save today's log →"}
          </Button>
        </form>

        <AdaptiveGICoach mealEntries={mealEntries} water={water} />

        <div>
          <h2 className="text-lg font-bold text-[#1a1a14] mb-4">Recent History</h2>
          {!matchedByEmail && !historyLoading && (
            <p className="text-xs text-[#9a9a8a] mb-3">
              (Showing sample history — no tracking data is linked to your account yet.)
            </p>
          )}
          {historyError && (
            <div className="bg-white rounded-2xl p-6 border border-[rgba(193,68,14,0.2)] text-center">
              <p className="text-sm text-[#c1440e] font-medium">{historyError}</p>
            </div>
          )}
          {historyLoading && !historyError && (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[#e05b2b]" />
            </div>
          )}
          {!historyLoading && !historyError && (
            <div className="space-y-2">
              {history.map((d) => {
                const m = metStyle[d.met];
                return (
                  <div key={d.trackId} className="bg-white rounded-xl px-4 py-3 border border-[rgba(26,26,20,0.08)] flex items-center justify-between gap-4">
                    <div className="text-sm font-medium text-[#1a1a14]">
                      {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#4a4a3a]">
                      <span>GI {d.gi ?? "—"}</span>
                      <span>{d.kcal == null ? "— kcal" : `${d.kcal} kcal`}</span>
                      {d.water !== undefined && <span>{Number(d.water).toFixed(1)} L water</span>}
                    </div>
                    {d.date === localToday && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => editToday(d)}
                          className="text-xs text-[#e05b2b] flex items-center gap-1"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDialogOpen(true)}
                          disabled={deleting}
                          className="text-xs text-[#c1440e] flex items-center gap-1 disabled:opacity-40"
                        >
                          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Delete
                        </button>
                      </div>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: m.bg, color: m.text }}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Dialog.Root open={deleteDialogOpen} onOpenChange={(open) => !deleting && setDeleteDialogOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe4d6] text-[#c1440e]">
              <Trash2 size={20} />
            </div>
            <Dialog.Title className="text-lg font-bold text-[#1a1a14]">
              Delete today&apos;s log?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-[#4a4a3a]">
              This permanently removes today&apos;s meals, water, notes, and calculated nutrition. This action cannot be undone.
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary" disabled={deleting}>Cancel</Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={deleteToday}
              >
                {deleting
                  ? <><Loader2 size={16} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={16} /> Delete log</>}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
