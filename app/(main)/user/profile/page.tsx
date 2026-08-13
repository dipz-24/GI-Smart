"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, User, Target } from "lucide-react";
import { calculateDailyCalories, calculateDailyWater } from "@/lib/calories";

const GOALS = ["General Health", "Weight Loss", "Blood Sugar Control", "Sports Performance"];
const ACTIVITIES = [
  { value: "sedentary", label: "Sedentary (little/no exercise)" },
  { value: "light", label: "Light (1–3 days/week)" },
  { value: "moderate", label: "Moderate (3–5 days/week)" },
  { value: "active", label: "Active (6–7 days/week)" },
  { value: "very_active", label: "Very Active (intense daily)" },
];

function calcBMI(w: number, h: number) {
  const hm = h / 100;
  return +(w / (hm * hm)).toFixed(1);
}
function bmiCat(bmi: number) {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [age, setAge] = useState("25");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("170");
  const [activity, setActivity] = useState("moderate");
  const [goal, setGoal] = useState("General Health");
  const [targetWeight, setTargetWeight] = useState("");
  const [weeks, setWeeks] = useState("12");
  const [dietPreference, setDietPreference] = useState("omnivore");
  const [glutenFree, setGlutenFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/profile")
      .then((res) => res.ok ? res.json() : null)
      .then((profile) => {
        if (!profile) return;
        if (profile.age) setAge(String(profile.age));
        if (profile.weight) setWeight(String(profile.weight));
        if (profile.height) setHeight(String(profile.height));
        if (profile.activity) setActivity(profile.activity);
        if (profile.goal) setGoal(profile.goal);
        if (profile.targetWeight) setTargetWeight(String(profile.targetWeight));
        if (profile.weeks) setWeeks(String(profile.weeks));
        if (profile.dietPreference) setDietPreference(profile.dietPreference);
        setGlutenFree(Boolean(profile.glutenFree));
      });
  }, [session]);

  if (isPending) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <Loader2 size={32} className="animate-spin text-[#e05b2b]" />
    </div>
  );
  if (!session) return null;

  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age);
  const bmi = w && h ? calcBMI(w, h) : null;
  const cat = bmi ? bmiCat(bmi) : null;
  const tdee = w && h && a ? calculateDailyCalories({
    weight: w,
    height: h,
    age: a,
    activity,
    goal,
    targetWeight: targetWeight ? parseFloat(targetWeight) : null,
    weeks: weeks ? parseInt(weeks) : null,
  }) : null;
  const waterTarget = w ? calculateDailyWater(w, activity) : null;
  const catColor: Record<string, string> = {
    Underweight: "#185fa5", Normal: "#2d6a4f", Overweight: "#e9a825", Obese: "#c1440e",
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age, weight, height, activity, goal, targetWeight, weeks,
          dietPreference, glutenFree,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a14] mb-1">Health Profile</h1>
          <p className="text-sm text-[#4a4a3a]">Update your measurements to personalise your meal plan</p>
        </div>

        {saved && (
          <Alert variant="success" className="bg-[#d8f3dc] border-[#2d6a4f] text-[#2d6a4f]">
            <CheckCircle2 size={16} />
            <AlertDescription>Profile saved! Your meal plan has been updated.</AlertDescription>
          </Alert>
        )}

        {/* BMI + Calories live preview */}
        {bmi && (
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-[#4a4a3a] font-medium uppercase tracking-wider mb-1">Your BMI</div>
                <div className="text-3xl font-black" style={{ color: catColor[cat!] }}>{bmi}</div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: catColor[cat!] }}>{cat}</div>
              </CardContent>
            </Card>
            {tdee && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-xs text-[#4a4a3a] font-medium uppercase tracking-wider mb-1">Daily Calories</div>
                  <div className="text-3xl font-black text-[#e05b2b]">{tdee}</div>
                  <div className="text-sm text-[#4a4a3a] mt-0.5">kcal/day target</div>
                </CardContent>
              </Card>
            )}
            {waterTarget && (
              <Card>
                <CardContent className="pt-5">
                  <div className="text-xs text-[#4a4a3a] font-medium uppercase tracking-wider mb-1">Daily Water</div>
                  <div className="text-3xl font-black text-[#185fa5]">{waterTarget.toFixed(1)} L</div>
                  <div className="text-sm text-[#4a4a3a] mt-0.5">personal target</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Personal info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User size={15} className="text-[#e05b2b]" /> Personal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={session.user.name || ""} readOnly className="bg-[#f5f0e8] cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={session.user.email || ""} readOnly className="bg-[#f5f0e8] cursor-not-allowed" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal">Health Goal</Label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger id="goal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOALS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dietPreference">Diet preference</Label>
                  <Select value={dietPreference} onValueChange={setDietPreference}>
                    <SelectTrigger id="dietPreference"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="omnivore">Omnivore</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Additional preference</Label>
                  <label className="h-10 rounded-xl border border-[rgba(26,26,20,0.15)] bg-white px-3 flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={glutenFree}
                      onChange={(event) => setGlutenFree(event.target.checked)}
                      className="accent-[#e05b2b]"
                    />
                    Gluten-free
                  </label>
                </div>
              </div>
              <p className="text-xs text-[#9a9a8a]">
                Preferences filter meal suggestions, but ingredient data may be incomplete. Always verify labels for allergies or medical restrictions.
              </p>

              {/* Weight Loss extra fields */}
              {goal === "Weight Loss" && (
                <div className="rounded-xl border-2 border-[#e05b2b] border-dashed bg-[#fff8f5] p-4 space-y-4">
                  <p className="text-sm font-semibold text-[#e05b2b] flex items-center gap-1.5">
                    <Target size={14} /> Weight Loss Settings
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="targetWeight">Goal Weight (kg)</Label>
                      <Input
                        id="targetWeight"
                        type="number"
                        min="30"
                        max="300"
                        step="0.1"
                        placeholder={weight ? `Current: ${weight}kg` : "e.g. 65"}
                        value={targetWeight}
                        onChange={e => setTargetWeight(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="weeks">Timeline (weeks)</Label>
                      <Input
                        id="weeks"
                        type="number"
                        min="1"
                        max="104"
                        placeholder="e.g. 12"
                        value={weeks}
                        onChange={e => setWeeks(e.target.value)}
                      />
                    </div>
                  </div>
                  {targetWeight && weight && parseFloat(targetWeight) < parseFloat(weight) && (
                    <div className="text-xs text-[#4a4a3a] bg-white rounded-lg p-3 border border-[rgba(26,26,20,0.1)]">
                      <strong>To lose:</strong> {(parseFloat(weight) - parseFloat(targetWeight)).toFixed(1)}kg over {weeks} weeks
                      {tdee && <span> · Target: <strong>{tdee} kcal/day</strong></span>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Body stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Body Measurements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" min="10" max="120" value={age}
                    onChange={e => setAge(e.target.value)} placeholder="25" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" min="20" max="300" step="0.1" value={weight}
                    onChange={e => setWeight(e.target.value)} placeholder="70" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" min="50" max="250" value={height}
                    onChange={e => setHeight(e.target.value)} placeholder="170" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activity">Activity Level</Label>
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger id="activity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITIES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save profile →"}
          </Button>
        </form>
      </main>
    </>
  );
}
