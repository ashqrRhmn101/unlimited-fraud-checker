"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconPlus, IconRefresh, IconSpinner } from "@/components/icons";
import type { CheckApiResult } from "@/lib/types";

/** Force a live fraud.bd lookup (1 API call) and re-render the server page. */
export function RefreshCheckButton({ phone, remaining }: { phone: string; remaining: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (remaining <= 0) {
      setError("আজকের API লিমিট শেষ।");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, force: true }),
      });
      const data = (await response.json()) as CheckApiResult;
      if (!data.ok) setError(data.message);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="bn flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:opacity-60"
      >
        {pending ? <IconSpinner className="h-4 w-4" /> : <IconRefresh className="h-4 w-4" />}
        {pending ? "fraud.bd থেকে আনা হচ্ছে…" : "লাইভ রিফ্রেশ (১টি API কল)"}
      </button>
      {error ? (
        <p className="bn rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/25">{error}</p>
      ) : null}
    </div>
  );
}

/** Save a searched number into the customer list. */
export function AddCustomerForm({ phone }: { phone: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, address, source: "search" }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "সেভ করা যায়নি");
        return;
      }
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা");
    } finally {
      setPending(false);
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none";

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="কাস্টমারের নাম" className={field} />
      <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ঠিকানা" className={field} />
      <button
        type="submit"
        disabled={pending}
        className="bn flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-[#04060d] hover:bg-emerald-300 disabled:opacity-60"
      >
        {pending ? <IconSpinner className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
        কাস্টমার লিস্টে যোগ করুন
      </button>
      {error ? <p className="bn text-xs text-rose-300">{error}</p> : null}
    </form>
  );
}
