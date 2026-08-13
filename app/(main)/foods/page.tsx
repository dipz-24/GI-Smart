"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Search, Filter, ArrowRightLeft, Loader2, ChevronUp, ChevronDown } from "lucide-react";

const TIERS = ["all", "low", "medium", "high"];
const TIER_STYLE = {
  low: { bg: "#d8f3dc", text: "#2d6a4f", label: "Low GI" },
  medium: { bg: "#fef3c7", text: "#7a5800", label: "Medium GI" },
  high: { bg: "#ffe4d6", text: "#c1440e", label: "High GI" },
  unknown: { bg: "#ede8df", text: "#4a4a3a", label: "GI N/A" },
} as Record<string, { bg: string; text: string; label: string }>;

const CATEGORY_GROUPS = [
  {
    label: "🌿 Plant Based",
    options: [
      { label: "Fruits", match: ["Fruit", "Fruits"] },
      { label: "Vegetables", match: ["Vegetable", "Vegetables"] },
      { label: "Grains & Cereals", match: ["Grains", "Breakfasts", "USDA-Foundation"] },
      { label: "Legumes & Beans", match: ["Legume", "Beans", "Plant-based foods and beverages"] },
      { label: "Nuts & Seeds", match: ["Nuts"] },
    ],
  },
  {
    label: "🥩 Animal Products",
    options: [
      { label: "Meat & Poultry", match: ["Meats and their products", "Fish and meat and eggs", "Meals"] },
      { label: "Seafood", match: ["Seafood"] },
      { label: "Dairy & Eggs", match: ["Dairy", "Dairies", "Eggs and their products"] },
      { label: "Meat Alternatives", match: ["Meat alternatives"] },
    ],
  },
  {
    label: "🥫 Packaged Foods",
    options: [
      { label: "Snacks", match: ["Snacks", "Crackers", "Sandwiches"] },
      { label: "Desserts & Sweets", match: ["Desserts", "Sweet pies", "Bonbon-pastille"] },
      { label: "Beverages", match: ["Beverages", "Beverages and beverages preparations"] },
      { label: "Condiments & Spreads", match: ["Condiments", "Spreads", "Sweeteners"] },
      { label: "Canned Foods", match: ["Canned foods"] },
    ],
  },
  {
    label: "💪 Health & Diet",
    options: [
      { label: "Protein Foods", match: ["Protein", "Protien-powder", "Powder"] },
      { label: "Dietary Supplements", match: ["Dietary supplements"] },
      { label: "Baby Foods", match: ["Baby foods"] },
    ],
  },
];

export default function FoodsPage() {
  const [foods, setFoods] = useState([] as any[]);
  const [foodsLoading, setFoodsLoading] = useState(true);
  const [foodsError, setFoodsError] = useState(null as string | null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [selectedCat, setSelectedCat] = useState<string[] | null>(null);
  const [selectedCatLabel, setSelectedCatLabel] = useState("All Categories");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openFood, setOpenFood] = useState(null as string | null);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState(null as string | null);
  const [altCache, setAltCache] = useState({} as Record<string, any>);

  useEffect(() => {
    async function loadFoods() {
      setFoodsLoading(true);
      setFoodsError(null);
      try {
        const res = await fetch("/api/foods");
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        setFoods(data.foods || []);
      } catch {
        setFoodsError("Couldn't load foods from Neo4j. Check your connection and .env.local credentials.");
      } finally {
        setFoodsLoading(false);
      }
    }
    loadFoods();
  }, []);

  async function toggleAlternatives(foodName: string) {
    if (openFood === foodName) { setOpenFood(null); return; }
    setOpenFood(foodName);
    if (altCache[foodName]) return;
    setAltLoading(true);
    setAltError(null);
    try {
      const res = await fetch("/api/foods/alternatives?name=" + encodeURIComponent(foodName));
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setAltCache(prev => ({ ...prev, [foodName]: data }));
    } catch {
      setAltError("Couldn't load alternatives.");
    } finally {
      setAltLoading(false);
    }
  }

  function selectCategory(label: string, match: string[] | null) {
    setSelectedCatLabel(label);
    setSelectedCat(match);
    setDropdownOpen(false);
  }

  const filtered = foods.filter(f => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.category || "").toLowerCase().includes(search.toLowerCase());
    const matchTier = tier === "all" || f.tier === tier;
    const matchCat = !selectedCat || selectedCat.some(m =>
      (f.category || "").toLowerCase() === m.toLowerCase()
    );
    return matchSearch && matchTier && matchCat;
  });

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a1a14] mb-1">Food Database</h1>
          <p className="text-[#4a4a3a]">
            {foodsLoading ? "Loading foods from Neo4j..." : `${filtered.length} of ${foods.length} foods`}
          </p>
        </div>

        {foodsError && (
          <div className="bg-white rounded-2xl p-6 border border-[rgba(193,68,14,0.2)] text-center mb-6">
            <p className="text-sm text-[#c1440e] font-medium">{foodsError}</p>
          </div>
        )}

        {!foodsError && (
          <>
            <div className="bg-white rounded-2xl p-4 border border-[rgba(26,26,20,0.08)] shadow-sm mb-6 space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a9a8a]" />
                <Input placeholder="Search foods..." value={search}
                  onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Filter size={13} className="text-[#4a4a3a]" />
                    <span className="text-xs font-medium text-[#4a4a3a]">GI:</span>
                  </div>
                  {TIERS.map(t => (
                    <button key={t} onClick={() => setTier(t)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                      style={tier === t
                        ? { background: "#e05b2b", color: "white" }
                        : { background: "#ede8df", color: "#4a4a3a" }}>
                      {t === "all" ? "All" : t}
                    </button>
                  ))}
                </div>

                <div className="relative sm:ml-auto">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border-2 transition-all min-w-[160px] justify-between"
                    style={selectedCat
                      ? { borderColor: "#e05b2b", color: "#e05b2b", background: "rgba(224,91,43,0.06)" }
                      : { borderColor: "rgba(26,26,20,0.15)", color: "#4a4a3a", background: "white" }}>
                    <span>{selectedCatLabel}</span>
                    <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-[rgba(26,26,20,0.1)] shadow-xl z-50 overflow-hidden">
                      <div className="p-1">
                        <button onClick={() => selectCategory("All Categories", null)}
                          className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-[rgba(224,91,43,0.06)] transition-colors font-medium text-[#1a1a14]">
                          All Categories
                        </button>
                      </div>
                      {CATEGORY_GROUPS.map(group => (
                        <div key={group.label} className="border-t border-[rgba(26,26,20,0.06)]">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-[#9a9a8a] uppercase tracking-wider">
                            {group.label}
                          </div>
                          {group.options.map(opt => (
                            <button key={opt.label} onClick={() => selectCategory(opt.label, opt.match)}
                              className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-[rgba(224,91,43,0.06)] transition-colors mx-1 text-[#4a4a3a] hover:text-[#1a1a14]"
                              style={selectedCatLabel === opt.label
                                ? { background: "rgba(224,91,43,0.08)", color: "#e05b2b", fontWeight: 600 }
                                : {}}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(selectedCat || tier !== "all") && (
                <div className="flex items-center gap-2 pt-1 border-t border-[rgba(26,26,20,0.06)]">
                  <span className="text-xs text-[#4a4a3a]">Filters:</span>
                  {tier !== "all" && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[rgba(224,91,43,0.1)] text-[#e05b2b] font-medium capitalize flex items-center gap-1">
                      {tier} GI
                      <button onClick={() => setTier("all")} className="font-bold">x</button>
                    </span>
                  )}
                  {selectedCat && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[rgba(224,91,43,0.1)] text-[#e05b2b] font-medium flex items-center gap-1">
                      {selectedCatLabel}
                      <button onClick={() => selectCategory("All Categories", null)} className="font-bold">x</button>
                    </span>
                  )}
                  <button onClick={() => { setTier("all"); selectCategory("All Categories", null); setSearch(""); }}
                    className="text-xs text-[#c1440e] hover:underline ml-auto">
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {foodsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-[#e05b2b]" />
              </div>
            ) : (
              <>
                <p className="text-sm text-[#4a4a3a] mb-4">
                  {filtered.length} food{filtered.length !== 1 ? "s" : ""} found
                </p>
                {filtered.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-[rgba(26,26,20,0.08)]">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-[#4a4a3a] font-medium">No foods match your filters.</p>
                    <button onClick={() => { setSearch(""); setTier("all"); selectCategory("All Categories", null); }}
                      className="text-sm text-[#e05b2b] mt-2 hover:underline">Clear filters</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(food => {
                      const t = TIER_STYLE[food.tier] ?? TIER_STYLE.unknown;
                      return (
                        <div key={food.foodId} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,20,0.08)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                              style={{ background: t.bg, color: t.text }}>{t.label}</span>
                            <span className="text-xs text-[#9a9a8a] font-mono">{food.kcal} kcal</span>
                          </div>
                          <div className="font-bold text-[#1a1a14] mb-0.5">{food.name}</div>
                          <div className="text-xs text-[#4a4a3a] mb-3">{food.category}</div>
                          <div className="space-y-1.5 mb-3">
                            <div className="flex justify-between text-xs text-[#4a4a3a]">
                              <span>GI Score</span>
                              <strong className="text-[#1a1a14]">{food.gi}</strong>
                            </div>
                            <div className="h-1.5 rounded-full bg-[rgba(26,26,20,0.08)] overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: Math.min(100, food.gi || 5) + "%", background: t.text }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            {[["Carbs", food.carbs + "g"], ["Protein", food.protein + "g"], ["Fat", food.fat + "g"]].map(([l, v]) => (
                              <div key={l} className="bg-[#f5f0e8] rounded-lg py-1.5">
                                <div className="text-xs font-bold text-[#1a1a14]">{v}</div>
                                <div className="text-[10px] text-[#9a9a8a]">{l}</div>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => toggleAlternatives(food.name)}
                            className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#e05b2b] hover:text-[#c1440e] py-1.5 border-t border-[rgba(26,26,20,0.08)] transition-colors">
                            {openFood === food.name
                              ? <><ChevronUp size={13} /> Hide alternatives</>
                              : <><ArrowRightLeft size={13} /> Find Alternatives</>}
                          </button>
                          {openFood === food.name && (
                            <div className="mt-2 pt-2 border-t border-dashed border-[rgba(26,26,20,0.1)]">
                              {altLoading && !altCache[food.name] && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 size={16} className="animate-spin text-[#e05b2b]" />
                                </div>
                              )}
                              {altError && <p className="text-xs text-[#c1440e] text-center py-2">{altError}</p>}
                              {altCache[food.name] && (
                                altCache[food.name].alternatives.length === 0
                                  ? <p className="text-xs text-[#4a4a3a] text-center py-2">No lower-GI alternatives found yet.</p>
                                  : <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-[#9a9a8a] uppercase tracking-wide mb-1">Lower-GI swaps</p>
                                    {altCache[food.name].alternatives.map((alt: any) => (
                                      <div key={alt.name} className="flex items-center justify-between bg-[#d8f3dc] rounded-lg px-2.5 py-1.5">
                                        <span className="text-xs font-semibold text-[#1a1a14]">{alt.name}</span>
                                        <span className="text-[10px] font-mono text-[#2d6a4f]">GI {alt.giValue}</span>
                                      </div>
                                    ))}
                                  </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}