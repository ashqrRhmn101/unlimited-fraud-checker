import type { Metadata } from "next";
import Link from "next/link";

import DangerZone from "@/components/DangerZone";
import { IconDatabase, IconKey } from "@/components/icons";
import QuotaMeter from "@/components/QuotaMeter";
import SearchBox from "@/components/SearchBox";
import { requirePageSession } from "@/lib/auth";
import { LEVEL_META, levelFor } from "@/lib/courier";
import { formatBytes, formatDateTime, sourceMeta, timeAgo } from "@/lib/format";
import { getFraudbdConfig, isFraudbdConfigured, maskKey } from "@/lib/fraudbd";
import { formatPhone } from "@/lib/phone";
import { getCustomerCounts, getDatabaseOverview, getUsage, listRecentChecks, listUploads } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ড্যাশবোর্ড | FraudBD Merchant Panel",
};

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-white/5 py-2 text-sm first:border-t-0">
      <dt className="bn shrink-0 text-slate-400">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-slate-100 ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  await requirePageSession("/dashboard");
  const config = getFraudbdConfig();
  const configured = isFraudbdConfigured(config);
  const [counts, usage, checks, uploads, database] = await Promise.all([
    getCustomerCounts(),
    getUsage(),
    listRecentChecks(10),
    listUploads(5),
    getDatabaseOverview(),
  ]);
  const isSupabase = database.provider === "supabase";

  const stats = [
    { label: "মোট কাস্টমার", value: counts.all, tone: "text-white" },
    { label: "চেক হয়েছে", value: counts.checked, tone: "text-emerald-300" },
    { label: "চেক বাকি", value: counts.unchecked, tone: "text-sky-300" },
    { label: "ভালো রেকর্ড", value: counts.good, tone: "text-emerald-300" },
    { label: "ঝুঁকিপূর্ণ (<70%)", value: counts.risky, tone: "text-rose-300" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">Merchant dashboard</p>
          <h1 className="bn mt-1 text-3xl font-extrabold text-white sm:text-4xl">ড্যাশবোর্ড</h1>
        </div>
        <div className="w-full max-w-md">
          <SearchBox size="md" hint={false} />
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((item) => (
          <div key={item.label} className="glass rounded-2xl p-4">
            <p className={`font-mono text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
            <p className="bn mt-1 text-xs font-semibold text-slate-400">{item.label}</p>
          </div>
        ))}
      </section>

      <div className="mt-4">
        <QuotaMeter usage={usage} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="bn flex items-center gap-2 text-base font-extrabold text-white">
              <IconKey className="h-4 w-4 text-emerald-300" /> fraud.bd API সংযোগ
            </h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
                configured ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-rose-500/10 text-rose-300 ring-rose-500/30"
              }`}
            >
              {configured ? "● CONNECTED (.env)" : "● KEY MISSING"}
            </span>
          </div>
          <dl className="mt-3">
            <Row label="প্ল্যান" value={`${config.plan} · দৈনিক ${config.dailyLimit}টি কল`} />
            <Row label="Endpoint" value={`POST ${config.apiUrl}`} mono />
            <Row label="RKR-API-KEY" value={maskKey(config.apiKey)} mono />
            <Row label="RKR-SECRET-KEY" value={maskKey(config.secretKey)} mono />
            <Row label="Authorized Domain" value={config.domain || "— সেট করা নেই"} mono />
            <Row label="ক্যাশ" value={`${config.cacheHours} ঘণ্টা (একই নম্বরে বারবার API কল হয় না)`} />
          </dl>
          <p className="bn mt-3 rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-slate-400 ring-1 ring-white/5">
            নতুন অ্যাকাউন্ট/নতুন ফ্রি প্ল্যান? শুধু <code className="text-emerald-300">.env</code> ফাইলে
            <code className="text-emerald-300"> FRAUDBD_API_KEY</code>,<code className="text-emerald-300"> FRAUDBD_SECRET_KEY</code> ও
            <code className="text-emerald-300"> FRAUDBD_AUTHORIZED_DOMAIN</code> বদলে অ্যাপ রিস্টার্ট করুন — কোড পরিবর্তন লাগবে না।
          </p>
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="bn flex items-center gap-2 text-base font-extrabold text-white">
              <IconDatabase className="h-4 w-4 text-sky-300" /> ডাটাবেজ
            </h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
                isSupabase ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-violet-500/10 text-violet-300 ring-violet-500/30"
              }`}
            >
              {isSupabase ? "Supabase (PostgreSQL)" : "PostgreSQL"}
            </span>
          </div>
          <dl className="mt-3">
            <Row label="Engine" value={`PostgreSQL ${database.version || ""} ${isSupabase ? "· Supabase" : ""}`.trim()} mono />
            <Row label="Host" value={database.host} mono />
            <Row label="Database" value={database.database} mono />
            <Row label="customers" value={`${database.tables.customers} rows`} mono />
            <Row label="courier_checks" value={`${database.tables.courier_checks} rows`} mono />
            <Row label="uploads" value={`${database.tables.uploads} rows`} mono />
          </dl>
          <p className="bn mt-3 rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-slate-400 ring-1 ring-white/5">
                        {isSupabase
              ? "সব ডেটা আপনার Supabase (PostgreSQL) ডাটাবেজে থাকে। পাসওয়ার্ড শুধু .env ফাইলে থাকে, ব্রাউজারে যায় না।"
              : "এই প্রিভিউতে লোকাল PostgreSQL চলছে। প্রোডাকশনে .env ফাইলে Supabase-এর connection string দিলেই Supabase-এ চলবে।"}
          </p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-2xl p-5">
          <h2 className="bn text-base font-extrabold text-white">সাম্প্রতিক চেক</h2>
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Recent fraud.bd lookups</p>
          {checks.length === 0 ? (
            <p className="bn mt-4 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
              এখনো কোনো চেক করা হয়নি। <Link href="/customers" className="text-emerald-300 underline">কাস্টমার লিস্ট</Link> থেকে 🔍 চাপুন।
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Result</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((check) => {
                    const meta = LEVEL_META[levelFor(check.total, check.successRate)];
                    return (
                      <tr key={check.id} className="border-t border-white/5">
                        <td className="py-2.5">
                          <Link href={`/check/${check.phone}`} prefetch={false} className="font-mono text-xs font-bold text-emerald-300 hover:underline">
                            {formatPhone(check.phone)}
                          </Link>
                          <p className="bn text-[11px] text-slate-400">{check.customerName ?? "—"}</p>
                        </td>
                        <td className="py-2.5">
                          {check.ok ? (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${meta.chip}`}>
                              {check.total ?? 0} · {check.successRate ?? 0}%
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-300" title={check.error ?? ""}>
                              ব্যর্থ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-[11px] text-slate-400">
                          {check.origin === "demo" ? "demo" : `API${check.durationMs ? ` · ${check.durationMs}ms` : ""}`}
                        </td>
                        <td className="py-2.5 text-[11px] text-slate-400" title={formatDateTime(check.createdAt)}>
                          {timeAgo(check.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="bn text-base font-extrabold text-white">সাম্প্রতিক আপলোড</h2>
              <Link href="/upload" className="bn text-xs font-bold text-emerald-300 hover:text-emerald-200">
                + আপলোড
              </Link>
            </div>
            {uploads.length === 0 ? (
              <p className="bn mt-3 text-sm text-slate-400">কোনো আপলোড নেই।</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {uploads.map((upload) => {
                  const meta = sourceMeta(upload.fileType);
                  return (
                    <li key={upload.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">{upload.fileName}</span>
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="bn mt-0.5 text-[11px] text-slate-400">
                        {upload.found} জন · নতুন {upload.inserted} · আপডেট {upload.updated} · {formatBytes(upload.fileSize)} · {timeAgo(upload.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <DangerZone demoCount={counts.demo} totalCount={counts.all} />
        </div>
      </div>
    </main>
  );
}
