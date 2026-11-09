import type { Metadata } from "next";
import Link from "next/link";

import { AddCustomerForm, RefreshCheckButton } from "@/components/CheckActions";
import ContactLinks from "@/components/ContactLinks";
import CourierReportCard from "@/components/CourierReportCard";
import { IconMapPin, IconUser } from "@/components/icons";
import QuotaMeter from "@/components/QuotaMeter";
import SearchBox from "@/components/SearchBox";
import { requirePageSession } from "@/lib/auth";
import { runCourierCheck } from "@/lib/checker";
import { formatDate, formatDateTime, sourceMeta, timeAgo } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { getCheckHistory, getCustomerByPhone, getLatestCheck, getUsage } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ phone: string }> }): Promise<Metadata> {
  const { phone } = await params;
  const normalized = normalizePhone(decodeURIComponent(phone));
  return {
    title: normalized ? `${formatPhone(normalized)} — Customer Profile | FraudBD` : "Customer Profile | FraudBD",
  };
}

export default async function CheckPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone: rawPhone } = await params;
  await requirePageSession(`/check/${rawPhone}`);
  const phone = normalizePhone(decodeURIComponent(rawPhone));

  if (!phone) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <div className="glass rounded-3xl p-8 text-center">
          <div className="text-3xl">⚠️</div>
          <h1 className="bn mt-3 text-xl font-extrabold text-white">সঠিক মোবাইল নম্বর দিন</h1>
          <p className="bn mt-2 text-sm text-slate-400">
            &ldquo;{decodeURIComponent(rawPhone)}&rdquo; একটি বৈধ বাংলাদেশী মোবাইল নম্বর নয়। ১১ ডিজিটের নম্বর দিন (যেমন
            01711-124851)।
          </p>
          <div className="mt-6 text-left">
            <SearchBox autoFocus size="md" />
          </div>
        </div>
      </main>
    );
  }

  // Auto check: saved result (0 API calls) when fresh, otherwise one live fraud.bd call.
  const result = await runCourierCheck(phone);
  const [customer, history, latest, usage] = await Promise.all([
    getCustomerByPhone(phone),
    getCheckHistory(phone, 8),
    getLatestCheck(phone),
    result.usage ? Promise.resolve(result.usage) : getUsage(),
  ]);

  const report = result.report;
  const source = result.ok ? result.source : report ? "cache" : null;
  const checkedAt = result.checkedAt;
  let rawJson: string | null = null;
  if (latest?.raw) {
    try {
      rawJson = JSON.stringify(JSON.parse(latest.raw), null, 2);
    } catch {
      rawJson = latest.raw;
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="bn flex items-center gap-2 text-xs text-slate-400">
          <Link href="/customers" className="hover:text-emerald-300">
            সকল কাস্টমার
          </Link>
          <span>/</span>
          <span className="font-mono text-slate-200">{formatPhone(phone)}</span>
        </nav>
        <div className="w-full max-w-md">
          <SearchBox size="md" hint={false} />
        </div>
      </div>

      {!result.ok ? (
        <div className="bn mt-5 rounded-2xl bg-rose-500/10 p-4 text-sm leading-relaxed text-rose-200 ring-1 ring-rose-500/25">
          <b>চেক করা যায়নি:</b> {result.message}
          {report ? <span className="mt-1 block text-rose-200/80">নিচে সর্বশেষ সংরক্ষিত রিপোর্ট দেখানো হচ্ছে।</span> : null}
        </div>
      ) : null}
      {result.ok && result.warning ? (
        <div className="bn mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-500/25">{result.warning}</div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {report ? (
            <CourierReportCard
              report={report}
              variant="full"
              checkedAt={checkedAt}
              source={source}
              customerName={customer?.name ?? null}
              contactSlot={<ContactLinks phone={phone} variant="full" />}
            />
          ) : (
            <div className="glass rounded-3xl p-10 text-center">
              <p className="bn text-base font-bold text-white">এই নম্বরের কোনো রিপোর্ট নেই</p>
              <p className="bn mt-2 text-sm text-slate-400">উপরের সমস্যাটি ঠিক করে আবার চেষ্টা করুন।</p>
            </div>
          )}

          {rawJson ? (
            <details className="glass rounded-2xl p-4">
              <summary className="bn cursor-pointer text-sm font-bold text-slate-300">fraud.bd API-এর আসল রেসপন্স (Raw JSON)</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed text-slate-300">{rawJson}</pre>
            </details>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="bn flex items-center gap-2 text-base font-extrabold text-white">
              <IconUser className="h-4 w-4 text-emerald-300" /> কাস্টমারের তথ্য
            </h2>
            {customer ? (
              <dl className="bn mt-3 space-y-2.5 text-sm">
                <div>
                  <dt className="text-[11px] text-slate-500">নাম</dt>
                  <dd className="font-semibold text-white">{customer.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">মোবাইল</dt>
                  <dd className="font-mono font-semibold text-emerald-300">{formatPhone(customer.phone)}</dd>
                  <div className="mt-2">
                    <ContactLinks phone={customer.phone} variant="icons" />
                  </div>
                </div>
                {customer.altPhones ? (
                  <div>
                    <dt className="text-[11px] text-slate-500">অন্য নম্বর</dt>
                    <dd className="font-mono text-slate-200">{customer.altPhones}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[11px] text-slate-500">ঠিকানা</dt>
                  <dd className="flex items-start gap-1 text-slate-200">
                    <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                    {[customer.address, customer.area, customer.city].filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
                {customer.note ? (
                  <div>
                    <dt className="text-[11px] text-slate-500">নোট</dt>
                    <dd className="text-slate-200">{customer.note}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs text-slate-400">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${sourceMeta(customer.source).className}`}>
                    {sourceMeta(customer.source).label}
                  </span>
                  <span>যোগ হয়েছে {formatDate(customer.createdAt)}</span>
                </div>
              </dl>
            ) : (
              <>
                <p className="bn mt-2 text-sm text-slate-400">এই নম্বরটি আপনার কাস্টমার লিস্টে নেই।</p>
                <AddCustomerForm phone={phone} />
              </>
            )}
          </div>

          <RefreshCheckButton phone={phone} remaining={usage.remaining} />
          <QuotaMeter usage={usage} />

          <div className="glass rounded-2xl p-5">
            <h2 className="bn text-base font-extrabold text-white">চেক ইতিহাস</h2>
            {history.length === 0 ? (
              <p className="bn mt-2 text-sm text-slate-400">কোনো ইতিহাস নেই।</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs ring-1 ring-white/5">
                    <span className="text-slate-400" title={formatDateTime(entry.createdAt)}>
                      {timeAgo(entry.createdAt)}
                      {entry.origin === "demo" ? " · demo" : ""}
                    </span>
                    {entry.ok ? (
                      <span className="font-mono font-bold text-emerald-300">
                        {entry.total ?? 0} পার্সেল · {entry.successRate ?? 0}%
                      </span>
                    ) : (
                      <span className="max-w-[170px] truncate font-semibold text-rose-300" title={entry.error ?? ""}>
                        ব্যর্থ: {entry.error ?? "error"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
