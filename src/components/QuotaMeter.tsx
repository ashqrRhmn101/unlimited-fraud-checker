import { IconBolt } from "@/components/icons";
import type { UsageDTO } from "@/lib/types";

export default function QuotaMeter({ usage, compact = false }: { usage: UsageDTO; compact?: boolean }) {
  const ratio = usage.limit > 0 ? Math.min(1, usage.used / usage.limit) : 1;
  const bar = ratio >= 0.9 ? "bg-rose-500" : ratio >= 0.7 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className={`glass rounded-2xl ${compact ? "px-4 py-3" : "p-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
            <IconBolt className="h-4 w-4" />
          </span>
          <div>
            <p className="bn text-xs font-bold text-white">আজকের fraud.bd API ব্যবহার</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Plan: {usage.plan} · resets 12:00 AM (BD)
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-extrabold text-white">
            {usage.used}
            <span className="text-sm text-slate-500">/{usage.limit}</span>
          </p>
          <p className="bn text-[11px] text-slate-400">বাকি {usage.remaining}টি</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
    </div>
  );
}
