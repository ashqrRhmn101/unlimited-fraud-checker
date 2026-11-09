import type { Metadata } from "next";

import CustomerList from "@/components/CustomerList";
import { requirePageSession } from "@/lib/auth";
import { getFraudbdConfig } from "@/lib/fraudbd";
import { getCustomerCounts, getUsage, listCustomers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সকল কাস্টমার · Customer Info | FraudBD",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 80);
  await requirePageSession(query ? `/customers?q=${encodeURIComponent(query)}` : "/customers");

  const [page, counts, usage] = await Promise.all([
    listCustomers({ offset: 0, limit: 10, q: query }),
    getCustomerCounts(),
    getUsage(),
  ]);
  const config = getFraudbdConfig();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
            Customer Info · Customer Data
          </p>
          <h1 className="bn mt-1 text-3xl font-extrabold text-white sm:text-4xl">সকল কাস্টমার</h1>
          <p className="bn mt-2 text-sm leading-relaxed text-slate-400">
            প্রতিটি নম্বরের পাশের <b className="text-emerald-300">🔍 চেক করুন</b> বাটনে ক্লিক করলেই আপনার fraud.bd API
            key দিয়ে স্বয়ংক্রিয়ভাবে কুরিয়ার রেকর্ড দেখাবে — কোন কুরিয়ারে কতটি অর্ডার, কতটি ডেলিভারি ও রিটার্ন।
            প্রতিবার ১০ জন করে দেখানো হয়।
          </p>
        </div>
        <div className="flex gap-2">
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <p className="font-mono text-xl font-extrabold text-white">{counts.all}</p>
            <p className="bn text-[11px] text-slate-400">মোট কাস্টমার</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <p className="font-mono text-xl font-extrabold text-emerald-300">{counts.checked}</p>
            <p className="bn text-[11px] text-slate-400">চেক হয়েছে</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3 text-center">
            <p className="font-mono text-xl font-extrabold text-rose-300">{counts.risky}</p>
            <p className="bn text-[11px] text-slate-400">ঝুঁকিপূর্ণ</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CustomerList
          initial={{ ok: true, ...page, counts, usage }}
          initialQuery={query}
          cacheHours={config.cacheHours}
        />
      </div>
    </main>
  );
}
