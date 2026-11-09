"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconSpinner, IconTrash } from "@/components/icons";

export default function DangerZone({ demoCount, totalCount }: { demoCount: number; totalCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<"demo" | "all" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function remove(scope: "demo" | "all") {
    if (scope === "all") {
      const answer = window.prompt(`সব ${totalCount} জন কাস্টমার মুছে যাবে (চেক ইতিহাস ও API ব্যবহারের হিসাব থাকবে)।\nনিশ্চিত হলে DELETE লিখুন:`);
      if (answer !== "DELETE") return;
    } else if (!window.confirm(`${demoCount} জন ডেমো কাস্টমার মুছে ফেলবেন?`)) {
      return;
    }
    setPending(scope);
    setMessage(null);
    try {
      const response = await fetch(`/api/customers?scope=${scope}`, { method: "DELETE" });
      const data = (await response.json()) as { ok: boolean; deleted?: number };
      setMessage(data.ok ? `${data.deleted ?? 0} জন কাস্টমার মুছে ফেলা হয়েছে।` : "মুছে ফেলা যায়নি।");
      router.refresh();
    } catch {
      setMessage("নেটওয়ার্ক সমস্যা");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl bg-rose-500/[0.06] p-5 ring-1 ring-rose-500/20">
      <h2 className="bn text-base font-extrabold text-white">ডেটা ব্যবস্থাপনা</h2>
      <p className="bn mt-1 text-xs text-slate-400">ডেমো ডেটা সরিয়ে নিজের কাস্টমার দিয়ে শুরু করুন।</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => remove("demo")}
          disabled={demoCount === 0 || pending !== null}
          className="bn flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-40"
        >
          {pending === "demo" ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash className="h-3.5 w-3.5" />}
          ডেমো ডেটা মুছুন ({demoCount})
        </button>
        <button
          type="button"
          onClick={() => remove("all")}
          disabled={totalCount === 0 || pending !== null}
          className="bn flex items-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25 disabled:opacity-40"
        >
          {pending === "all" ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash className="h-3.5 w-3.5" />}
          সব কাস্টমার মুছুন ({totalCount})
        </button>
      </div>
      {message ? <p className="bn mt-3 text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}
