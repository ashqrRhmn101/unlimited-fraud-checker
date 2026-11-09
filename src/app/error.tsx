"use client";

import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[60vh] w-full max-w-xl place-items-center px-4 py-16 text-center">
      <div className="glass rounded-3xl p-8">
        <div className="text-4xl">⚠️</div>
        <h1 className="bn mt-3 text-xl font-extrabold text-white">কিছু একটা সমস্যা হয়েছে</h1>
        <p className="bn mt-2 text-sm leading-relaxed text-slate-400">
          পেজটি লোড করা যায়নি। ডাটাবেজ সংযোগ (.env-এর DATABASE_URL) ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।
        </p>
        {error.digest ? <p className="mt-2 font-mono text-[11px] text-slate-500">ref: {error.digest}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="bn rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#04060d] hover:bg-emerald-300"
          >
            আবার চেষ্টা করুন
          </button>
          <Link href="/" className="bn rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15">
            হোম
          </Link>
        </div>
      </div>
    </main>
  );
}
