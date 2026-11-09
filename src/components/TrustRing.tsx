import { LEVEL_META, type RecordLevel } from "@/lib/courier";

export default function TrustRing({
  value,
  level,
  size = 84,
  label = "Trust Score",
  framed = true,
}: {
  value: number;
  level: RecordLevel;
  size?: number;
  label?: string;
  framed?: boolean;
}) {
  const meta = LEVEL_META[level];
  const stroke = Math.max(6, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = level === "new" ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const dash = (pct / 100) * circumference;

  const ring = (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={meta.stroke}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ filter: `drop-shadow(0 0 6px ${meta.stroke}88)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {level === "new" ? (
          <span className="text-sm font-extrabold text-slate-300">N/A</span>
        ) : (
          <span className="font-extrabold leading-none text-white" style={{ fontSize: size * 0.26 }}>
            {pct}
            <span style={{ fontSize: size * 0.13 }}>%</span>
          </span>
        )}
      </div>
    </div>
  );

  if (!framed) return ring;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1628]/90 px-4 pb-3 pt-4 shadow-inner shadow-black/30">
      {ring}
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
    </div>
  );
}
