"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

const GOALS = [
  { value: "General Health", label: "🌿 General Health" },
  { value: "Weight Loss", label: "⚖️ Weight Loss" },
  { value: "Blood Sugar Control", label: "🩸 Blood Sugar Control" },
  { value: "Sports Performance", label: "💪 Sports Performance" },
];

function getStrength(pw: string) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("General Health");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getStrength(password);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][strength];
  const strengthColor = ["", "#c1440e", "#e9a825", "#e9a825", "#2d6a4f", "#2d6a4f"][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.length < 2) { setError("Name must be at least 2 characters."); return; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message || "Registration failed. Please try again.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 1000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1a1a14] mb-1">Create account</h1>
      <p className="text-sm text-[#4a4a3a] mb-6">Start your personalised GI diet journey today</p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 size={16} />
          <AlertDescription>Account created! Redirecting to dashboard…</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" type="text" placeholder="Jane Smith" autoFocus autoComplete="name"
            value={name} onChange={e => setName(e.target.value)} disabled={loading} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@example.com" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal">Health goal</Label>
          <Select value={goal} onValueChange={setGoal} disabled={loading}>
            <SelectTrigger id="goal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOALS.map(g => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">
            Password <span className="text-xs text-[#9a9a8a] font-normal">(min. 6 characters)</span>
          </Label>
          <div className="relative">
            <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
              autoComplete="new-password" value={password}
              onChange={e => setPassword(e.target.value)} disabled={loading} className="pr-10" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9a8a] hover:text-[#4a4a3a]" tabIndex={-1}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <div className="space-y-1">
              <div className="h-1 rounded-full bg-[rgba(26,26,20,0.1)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(strength / 5) * 100}%`, background: strengthColor }} />
              </div>
              <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" placeholder="••••••••" autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} />
          {confirm && password !== confirm && (
            <p className="text-xs text-[#c1440e]">Passwords don't match</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : "Create account →"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#4a4a3a]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#e05b2b] font-medium hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
