import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";

const features = [
  { icon: "📊", tag: "Profile", title: "BMI Analysis", desc: "Enter your measurements and instantly get your BMI category and daily calorie target." },
  { icon: "🥗", tag: "Plan", title: "Weekly Meal Plan", desc: "Your menu for the week—breakfast, lunch, dinner, and snacks tuned to your BMI and daily calories." },
  { icon: "🔍", tag: "Browse", title: "Food Database", desc: "Search 500+ foods by GI tier, category, and nutritional values from our curated database." },
  { icon: "📅", tag: "Log", title: "Daily Tracking", desc: "Log meals and water intake, view GI adherence scores and 30-day progress heatmaps." },
];

const foods = [
  { name: "Rolled Oats", category: "Grains", gi: 55, tier: "medium" },
  { name: "Lentils", category: "Legumes", gi: 32, tier: "low" },
  { name: "Brown Rice", category: "Grains", gi: 68, tier: "medium" },
  { name: "White Bread", category: "Grains", gi: 75, tier: "high" },
  { name: "Apple", category: "Fruits", gi: 39, tier: "low" },
  { name: "Watermelon", category: "Fruits", gi: 76, tier: "high" },
];

const tierColors: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "#d8f3dc", text: "#2d6a4f", label: "Low GI" },
  medium: { bg: "#fef3c7", text: "#7a5800", label: "Medium GI" },
  high: { bg: "#ffe4d6", text: "#c1440e", label: "High GI" },
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative text-center px-4 py-24 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(224,91,43,0.1) 0%, transparent 70%)" }} />
          <div className="relative max-w-3xl mx-auto">
            <span className="inline-block font-mono text-xs tracking-widest uppercase text-[#e05b2b] border border-[#e05b2b] rounded-full px-3 py-1 mb-5">
              Personalised GI Diet Tracker
            </span>
            <h1 className="text-5xl sm:text-6xl font-black leading-none tracking-tight mb-5 text-[#1a1a14]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Eat <em className="not-italic text-[#e05b2b]">Smarter.</em><br />Feel the Difference.
            </h1>
            <p className="text-lg text-[#4a4a3a] max-w-xl mx-auto mb-8 leading-relaxed">
              Track your GI diet, calculate your BMI, and get a personalised meal plan built from 500+ scientifically-rated foods.
            </p>

            <div className="flex flex-wrap gap-3 justify-center mb-14">
              <Button size="lg" asChild>
                <Link href="/register">Get started free →</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/foods">Browse foods</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto">
              {[
                { n: "500+", l: "Foods Indexed" },
                { n: "100+", l: "Low GI Foods" },
                { n: "7-Day", l: "Meal Plans" },
                { n: "AI", l: "Powered" },
              ].map((s) => (
                <div key={s.l} className="bg-white rounded-2xl px-4 py-5 border border-[rgba(26,26,20,0.08)] shadow-sm">
                  <div className="text-2xl font-black text-[#e05b2b]">{s.n}</div>
                  <div className="text-xs text-[#4a4a3a] mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-[rgba(26,26,20,0.08)] shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#e05b2b]">{f.tag}</span>
                <h3 className="text-base font-bold text-[#1a1a14] mt-1 mb-2">{f.title}</h3>
                <p className="text-sm text-[#4a4a3a] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Foods */}
        <section className="max-w-6xl mx-auto px-4 pb-24">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-[#1a1a14]">Featured Foods</h2>
              <p className="text-sm text-[#4a4a3a] mt-1">Tap a food to see full nutrition details</p>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/foods">View all →</Link>
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {foods.map((food) => {
              const t = tierColors[food.tier];
              return (
                <Link key={food.name} href="/foods" className="bg-white rounded-2xl p-5 border border-[rgba(26,26,20,0.08)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all block">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: t.bg, color: t.text }}>
                      {t.label}
                    </span>
                  </div>
                  <div className="font-bold text-[#1a1a14] mb-0.5">{food.name}</div>
                  <div className="text-xs text-[#4a4a3a] mb-3">{food.category}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#4a4a3a]">
                      <span>GI Score</span>
                      <strong className="text-[#1a1a14]">{food.gi}</strong>
                    </div>
                    <div className="h-1.5 rounded-full bg-[rgba(26,26,20,0.08)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, food.gi)}%`, background: t.text }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-6xl mx-auto px-4 pb-24">
          <div className="rounded-3xl bg-[#1a1a14] text-white px-8 py-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse 60% 80% at 50% -10%, #e05b2b, transparent)" }} />
            <div className="relative">
              <h2 className="text-3xl font-black mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Ready to eat smarter?</h2>
              <p className="text-[#9a9a8a] mb-6 max-w-md mx-auto">Join thousands tracking their GI diet and seeing real results. Free forever, no credit card needed.</p>
              <Button size="lg" asChild>
                <Link href="/register">Start for free →</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[rgba(26,26,20,0.08)] py-8 px-4 text-center text-sm text-[#4a4a3a]">
          <p className="font-bold text-[#1a1a14] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            GI<span className="text-[#e05b2b]">Smart</span>
          </p>
          <p>© 2025 GI Smart · Built with Next.js & shadcn/ui</p>
        </footer>
      </main>
    </>
  );
}
