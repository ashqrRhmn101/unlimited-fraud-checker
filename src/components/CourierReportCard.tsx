import type { ReactNode } from "react";

import { IconArrowUp, IconBox, IconCheckCircle, IconPercent, IconReturn, IconShield, IconTruck, IconUser } from "@/components/icons";
import TrustRing from "@/components/TrustRing";
import { LEVEL_META, levelFor, type CourierReport } from "@/lib/courier";
import { formatDateTime, timeAgo } from "@/lib/format";
import { maskPhone, toLocalPhone } from "@/lib/phone";

const TONES = {
  sky: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
} as const;

function StatCard({
  icon,
  tone,
  value,
  label,
  bn,
  compact,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  value: string | number;
  label: string;
  bn: string;
  compact: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-white/10 bg-[#0c1426] text-center shadow-inner shadow-black/20 ${
        compact ? "gap-1.5 px-3 py-3" : "gap-2 px-4 py-5"
      }`}
    >
      <span className={`grid place-items-center rounded-xl ring-1 ${TONES[tone]} ${compact ? "h-8 w-8" : "h-10 w-10"}`}>
        {icon}
      </span>
      <span className={`font-extrabold leading-none text-white ${compact ? "text-2xl" : "text-[32px]"}`}>{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="bn -mt-1 text-[11px] text-slate-500">{bn}</span>
    </div>
  );
}

function barColor(performance: number): string {
  if (performance >= 85) return "bg-emerald-500";
  if (performance >= 70) return "bg-amber-400";
  if (performance >= 50) return "bg-orange-400";
  return "bg-rose-500";
}

export default function CourierReportCard({
  report,
  variant = "full",
  checkedAt,
  source,
  customerName,
  mask = false,
  contactSlot,
}: {
  report: CourierReport;
  variant?: "full" | "compact";
  checkedAt?: string | null;
  source?: "live" | "cache" | "sample" | null;
  customerName?: string | null;
  mask?: boolean;
  contactSlot?: ReactNode;
}) {
  const level = levelFor(report.total, report.successRate);
  const meta = LEVEL_META[level];
  const compact = variant === "compact";
  const phoneText = mask ? maskPhone(report.phone) : toLocalPhone(report.phone);
  const tier = (report.trustTier ?? (level === "new" ? "New" : meta.en)).toUpperCase();
  const pad = compact ? "px-4 sm:px-5" : "px-5 sm:px-7";

  return (
    <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1020] shadow-2xl shadow-black/40">
      {!compact ? (
        <div className="relative flex flex-col gap-5 bg-gradient-to-br from-[#14203a] via-[#0e172c] to-[#0a1020] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <div className={`grid h-16 w-16 place-items-center rounded-full ring-2 ${meta.avatar}`}>
                <IconUser className="h-8 w-8" />
              </div>
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-[#06101f] ring-4 ring-[#0e172c]">
                <IconArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Customer Profile</p>
              <h2 className="mt-1 truncate font-mono text-[26px] font-extrabold tracking-tight text-white sm:text-[32px]">
                {phoneText}
              </h2>
              {customerName ? <p className="truncate text-sm font-semibold text-slate-300">{customerName}</p> : null}
              <span
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${meta.chip}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {tier} Tier
              </span>
              {contactSlot ? <div className="mt-3">{contactSlot}</div> : null}
            </div>
          </div>
          <TrustRing value={report.successRate} level={level} />
        </div>
      ) : null}

      <div className={`flex items-start gap-3 border-y border-white/[0.06] py-4 ${pad} ${meta.banner} ${compact ? "border-t-0" : ""}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${meta.iconWrap}`}>
          <IconShield className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="bn text-[15px] font-bold text-white">
            {meta.bn} <span className="font-semibold text-slate-300">({meta.en})</span>
          </p>
          <p className="bn mt-0.5 text-[13px] leading-relaxed text-slate-300/90">{meta.desc}</p>
          {report.advice?.message ? (
            <p className="bn mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1.5 text-xs text-slate-200 ring-1 ring-white/10">
              <span className={`font-bold ${meta.text}`}>fraud.bd পরামর্শ:</span> {report.advice.message}
            </p>
          ) : null}
        </div>
        {compact ? <TrustRing value={report.successRate} level={level} size={58} framed={false} /> : null}
      </div>

      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${compact ? "p-4 sm:p-5" : "p-5 sm:p-7"}`}>
        <StatCard compact={compact} icon={<IconBox className="h-5 w-5" />} tone="sky" value={report.total} label="Total Parcels" bn="মোট পার্সেল" />
        <StatCard compact={compact} icon={<IconCheckCircle className="h-5 w-5" />} tone="emerald" value={report.delivered} label="Delivered" bn="সফল ডেলিভারি" />
        <StatCard compact={compact} icon={<IconReturn className="h-5 w-5" />} tone="rose" value={report.cancelled} label="Returned" bn="রিটার্ন / বাতিল" />
        <StatCard compact={compact} icon={<IconPercent className="h-5 w-5" />} tone="violet" value={`${report.successRate}%`} label="Success Rate" bn="সাকসেস রেট" />
      </div>

      <div className={`border-t border-white/[0.06] ${compact ? "p-4 sm:p-5" : "p-5 sm:p-7"}`}>
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
          <IconTruck className="h-4 w-4 text-sky-400" />
          Detailed Courier Breakdown
          <span className="bn font-semibold normal-case tracking-normal text-slate-500">· কোন কুরিয়ারে কতটি</span>
        </h3>
        {report.couriers.length === 0 ? (
          <p className="bn mt-4 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
            কোনো কুরিয়ারে এই নম্বরের পার্সেল রেকর্ড পাওয়া যায়নি।
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#0c1426]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.14em]">
                  <th className="px-4 py-3 text-slate-400">Logistics Partner</th>
                  <th className="px-3 py-3 text-center text-slate-400">Total</th>
                  <th className="px-3 py-3 text-center text-emerald-400">Success</th>
                  <th className="px-3 py-3 text-center text-rose-400">Return</th>
                  <th className="px-4 py-3 text-right text-slate-400">Performance</th>
                </tr>
              </thead>
              <tbody>
                {report.couriers.map((row) => (
                  <tr key={row.key} className="border-t border-white/[0.06] transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25">
                          <IconTruck className="h-4 w-4" />
                        </span>
                        <span className="font-bold text-white">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-white">{row.orders}</td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-emerald-400">{row.delivered}</td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-rose-400">
                      {row.returned + row.cancelled}
                      {row.unreached > 0 ? (
                        <span className="ml-1 text-[10px] font-semibold text-slate-500" title="Unreached">
                          +{row.unreached}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:w-36">
                          <div className={`h-full rounded-full ${barColor(row.performance)}`} style={{ width: `${row.performance}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-xs font-bold text-slate-200">{row.performance}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkedAt || source ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-black/20 py-3 text-[11px] text-slate-400 ${pad}`}>
          <span className="bn">
            উৎস: fraud.bd API
            {source === "cache" ? " · সংরক্ষিত ফলাফল (কোনো API কল খরচ হয়নি)" : null}
            {source === "live" ? " · লাইভ চেক" : null}
            {source === "sample" ? " · নমুনা রিপোর্ট" : null}
          </span>
          {checkedAt ? (
            <span className="bn">
              চেক: {formatDateTime(checkedAt)} · {timeAgo(checkedAt)}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
