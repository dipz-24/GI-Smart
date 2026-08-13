import Link from "next/link";
import { Activity } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left: form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-12 bg-[#f5f0e8]">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-block mb-8 font-bold text-2xl text-[#1a1a14]" style={{ fontFamily: "'Playfair Display', serif" }}>
            GI<span className="text-[#e05b2b]">Smart</span>
          </Link>
          {children}
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden lg:flex flex-col justify-center px-16 bg-[#1a1a14] text-white relative overflow-hidden" style={{ width: "42%" }}>
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(ellipse 80% 80% at 50% -10%, #e05b2b, transparent)" }} />
        <div className="relative z-10">
          <div className="w-12 h-12 bg-[#e05b2b] rounded-2xl flex items-center justify-center mb-6">
            <Activity size={24} className="text-white" />
          </div>
          <h2 className="text-4xl font-black leading-tight mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your health,<br />
            <span className="text-[#e05b2b]">personalised.</span>
          </h2>
          <p className="text-[#9a9a8a] text-lg leading-relaxed mb-10">
            Log in to access your dashboard, personalised meal plan, and daily GI tracking.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { num: "500+", label: "Foods Indexed" },
              { num: "3", label: "GI Tiers" },
              { num: "7-Day", label: "Meal Plans" },
              { num: "AI", label: "Powered Plans" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-2xl font-black text-[#e05b2b]">{s.num}</div>
                <div className="text-sm text-[#9a9a8a] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
