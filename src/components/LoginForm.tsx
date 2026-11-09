"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconKey, IconSpinner, IconUser } from "@/components/icons";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "লগইন ব্যর্থ হয়েছে");
        setPending(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
      setPending(false);
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="bn mb-1.5 block text-xs font-bold text-slate-300">ইউজারনেম</span>
        <span className="relative block">
          <IconUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className={field} required />
        </span>
      </label>
      <label className="block">
        <span className="bn mb-1.5 block text-xs font-bold text-slate-300">পাসওয়ার্ড</span>
        <span className="relative block">
          <IconKey className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            className={field}
            required
          />
        </span>
      </label>
      {error ? (
        <p className="bn rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/25">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 py-3 text-sm font-bold text-[#04060d] shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-70"
      >
        {pending ? <IconSpinner className="h-4 w-4" /> : null}
        {pending ? "লগইন হচ্ছে…" : "লগইন করুন"}
      </button>
    </form>
  );
}
