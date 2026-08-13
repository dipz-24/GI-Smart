"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Menu, X, Activity, LogOut, User, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 bg-[rgba(245,240,232,0.92)] backdrop-blur-md border-b border-[rgba(26,26,20,0.07)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4">
        {/* Brand */}
        <Link href="/" className="font-bold text-xl text-[#1a1a14] tracking-tight shrink-0" style={{ fontFamily: "'Playfair Display', serif" }}>
          GI<span className="text-[#e05b2b]">Smart</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          <Link href="/foods" className="text-sm font-medium text-[#4a4a3a] hover:text-[#1a1a14] transition-colors">Foods</Link>
          {session && (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-[#4a4a3a] hover:text-[#1a1a14] transition-colors">Dashboard</Link>
              <Link href="/meal-plan" className="text-sm font-medium text-[#4a4a3a] hover:text-[#1a1a14] transition-colors">Meal Plan</Link>
              <Link href="/tracking" className="text-sm font-medium text-[#4a4a3a] hover:text-[#1a1a14] transition-colors">Tracking</Link>
              <Link href="/graph" className="text-sm font-medium text-[#4a4a3a] hover:text-[#1a1a14] transition-colors">Graph</Link>
            </>
          )}
        </div>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-2">
          {isPending ? (
            <div className="h-8 w-20 rounded-full bg-[rgba(26,26,20,0.08)] animate-pulse" />
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[rgba(26,26,20,0.06)] transition-colors text-sm font-medium text-[#1a1a14]"
              >
                <div className="w-7 h-7 rounded-full bg-[#e05b2b] text-white flex items-center justify-center text-xs font-bold">
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate">{session.user.name}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-[rgba(26,26,20,0.1)] shadow-lg overflow-hidden z-50">
                  <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#4a4a3a] hover:bg-[rgba(224,91,43,0.06)] hover:text-[#1a1a14] transition-colors" onClick={() => setUserMenuOpen(false)}>
                    <LayoutDashboard size={14} /> Dashboard
                  </Link>
                  <Link href="/user/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#4a4a3a] hover:bg-[rgba(224,91,43,0.06)] hover:text-[#1a1a14] transition-colors" onClick={() => setUserMenuOpen(false)}>
                    <User size={14} /> Profile
                  </Link>
                  <div className="border-t border-[rgba(26,26,20,0.08)]" />
                  <button onClick={handleSignOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#c1440e] hover:bg-[rgba(193,68,14,0.06)] transition-colors">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-[#4a4a3a]" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[rgba(26,26,20,0.07)] bg-[#f5f0e8] px-4 py-4 flex flex-col gap-3">
          <Link href="/foods" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Foods</Link>
          {session ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link href="/meal-plan" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Meal Plan</Link>
              <Link href="/tracking" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Tracking</Link>
              <Link href="/graph" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Graph</Link>
              <Link href="/user/profile" className="text-sm font-medium text-[#4a4a3a]" onClick={() => setMenuOpen(false)}>Profile</Link>
              <button onClick={handleSignOut} className="text-left text-sm font-medium text-[#c1440e]">Sign out</button>
            </>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="flex-1">
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}