/**
 * Pure helpers for fraud.bd courier reports (safe to import in client components).
 *
 * fraud.bd  POST /api/v1/search  →
 * { success: true, data: { phone, overall_stats: { total_orders, total_delivered,
 *   total_cancelled, success_rate }, advice: { type, title, message, color },
 *   courier_breakdown: [{ courier, orders, delivered, returned, cancelled,
 *   unreached, performance }], trust_tier } }
 */

export interface CourierRow {
  key: string;
  name: string;
  orders: number;
  delivered: number;
  returned: number;
  cancelled: number;
  unreached: number;
  performance: number;
}

export interface CourierAdvice {
  type: string | null;
  title: string | null;
  message: string | null;
}

export interface CourierReport {
  phone: string;
  total: number;
  delivered: number;
  /** returned + cancelled parcels (fraud.bd "total_cancelled") */
  cancelled: number;
  successRate: number;
  couriers: CourierRow[];
  trustTier: string | null;
  advice: CourierAdvice | null;
}

export type RecordLevel = "good" | "fair" | "risky" | "bad" | "new";

export function levelFor(total: number | null | undefined, rate: number | null | undefined): RecordLevel {
  if (!total || total <= 0) return "new";
  const value = Number(rate ?? 0);
  if (value >= 85) return "good";
  if (value >= 70) return "fair";
  if (value >= 50) return "risky";
  return "bad";
}

export interface LevelMeta {
  bn: string;
  en: string;
  desc: string;
  text: string;
  chip: string;
  banner: string;
  iconWrap: string;
  bar: string;
  stroke: string;
  avatar: string;
}

export const LEVEL_META: Record<RecordLevel, LevelMeta> = {
  good: {
    bn: "ভালো রেকর্ড",
    en: "Good Record",
    desc: "কাস্টমারের ডেলিভারি সাকসেস রেট ভালো। আপনি নিশ্চিন্তে অর্ডারটি সম্পন্ন করতে পারেন, তবে প্রয়োজনে নিজের মতো যাচাই করে নিতে পারেন।",
    text: "text-emerald-300",
    chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    banner: "bg-emerald-500/[0.07]",
    iconWrap: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    bar: "bg-emerald-500",
    stroke: "#22c55e",
    avatar: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  },
  fair: {
    bn: "মাঝারি রেকর্ড",
    en: "Average Record",
    desc: "কিছু পার্সেল ফেরত বা বাতিল হয়েছে। পাঠানোর আগে ফোনে কথা বলে অর্ডারটি কনফার্ম করে নিন।",
    text: "text-amber-300",
    chip: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    banner: "bg-amber-500/[0.07]",
    iconWrap: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    bar: "bg-amber-400",
    stroke: "#f59e0b",
    avatar: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  },
  risky: {
    bn: "ঝুঁকিপূর্ণ রেকর্ড",
    en: "Risky Record",
    desc: "ফেরত/বাতিলের হার বেশি। ডেলিভারি চার্জ বা আংশিক অগ্রিম নিয়ে তারপর পার্সেল পাঠান।",
    text: "text-orange-300",
    chip: "bg-orange-500/10 text-orange-300 ring-orange-500/30",
    banner: "bg-orange-500/[0.07]",
    iconWrap: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
    bar: "bg-orange-400",
    stroke: "#f97316",
    avatar: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
  },
  bad: {
    bn: "খারাপ রেকর্ড",
    en: "Bad Record",
    desc: "এই নম্বরের বেশিরভাগ পার্সেল ফেরত বা বাতিল হয়েছে। ক্যাশ অন ডেলিভারিতে না পাঠিয়ে পূর্ণ অগ্রিম নিন।",
    text: "text-rose-300",
    chip: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
    banner: "bg-rose-500/[0.07]",
    iconWrap: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    bar: "bg-rose-500",
    stroke: "#f43f5e",
    avatar: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  },
  new: {
    bn: "নতুন কাস্টমার",
    en: "No Record",
    desc: "এই নম্বরে কোনো কুরিয়ার রেকর্ড পাওয়া যায়নি। কাস্টমারের সাথে কথা বলে কনফার্ম হয়ে পার্সেল পাঠান।",
    text: "text-sky-300",
    chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    banner: "bg-sky-500/[0.06]",
    iconWrap: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    bar: "bg-sky-400",
    stroke: "#38bdf8",
    avatar: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  },
};

const COURIER_NAMES: Record<string, string> = {
  steadfast: "Steadfast",
  pathao: "Pathao",
  redx: "RedX",
  paperfly: "Paperfly",
  parceldex: "ParcelDex",
  carrybee: "CarryBee",
  ecourier: "eCourier",
  karatoa: "Karatoa Courier",
  karatoacourier: "Karatoa Courier",
  sundorban: "Sundarban Courier",
  sundarban: "Sundarban Courier",
  sundorbancourier: "Sundarban Courier",
  sundarbancourier: "Sundarban Courier",
  saparibahan: "S A Paribahan",
};

export const SUPPORTED_COURIERS = [
  "Steadfast",
  "Pathao",
  "RedX",
  "Paperfly",
  "ParcelDex",
  "CarryBee",
  "Karatoa Courier",
  "Sundarban Courier",
  "S A Paribahan",
  "eCourier",
];

function courierKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "") || "unknown";
}

export function courierDisplayName(raw: string): string {
  const key = courierKey(raw);
  return COURIER_NAMES[key] ?? (raw.trim() || "Unknown");
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Turn the raw fraud.bd JSON into a stable shape. Duplicate courier rows that
 * only differ in casing (e.g. "Steadfast" and "SteadFast") are merged.
 */
export function normalizeFraudbdResponse(json: unknown, fallbackPhone: string): CourierReport | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const statsRaw = data.overall_stats ?? data.overallStats ?? data.summary ?? null;
  const stats = (statsRaw && typeof statsRaw === "object" ? statsRaw : {}) as Record<string, unknown>;
  const listRaw = data.courier_breakdown ?? data.couriers ?? data.courierBreakdown ?? [];
  const list = Array.isArray(listRaw) ? listRaw : [];

  if (!statsRaw && list.length === 0 && !("trust_tier" in data)) return null;

  const merged = new Map<string, CourierRow>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const rawName = String(row.courier ?? row.name ?? row.courier_name ?? "Unknown");
    const key = courierKey(rawName);
    const current = merged.get(key) ?? {
      key,
      name: courierDisplayName(rawName),
      orders: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
      unreached: 0,
      performance: 0,
    };
    current.orders += num(row.orders ?? row.total ?? row.total_parcels ?? row.total_orders);
    current.delivered += num(row.delivered ?? row.success ?? row.success_parcel ?? row.total_delivered);
    current.returned += num(row.returned ?? row.return ?? row.returns);
    current.cancelled += num(row.cancelled ?? row.cancel ?? row.total_cancelled);
    current.unreached += num(row.unreached);
    merged.set(key, current);
  }

  const couriers = [...merged.values()]
    .map((row) => ({
      ...row,
      performance: row.orders > 0 ? Math.round((row.delivered / row.orders) * 100) : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const sumOrders = couriers.reduce((acc, row) => acc + row.orders, 0);
  const sumDelivered = couriers.reduce((acc, row) => acc + row.delivered, 0);
  const sumFailed = couriers.reduce((acc, row) => acc + row.returned + row.cancelled, 0);

  const total = stats.total_orders !== undefined ? num(stats.total_orders) : sumOrders;
  const delivered = stats.total_delivered !== undefined ? num(stats.total_delivered) : sumDelivered;
  const cancelled = stats.total_cancelled !== undefined ? num(stats.total_cancelled) : sumFailed;
  const successRate =
    stats.success_rate !== undefined
      ? Math.round(num(stats.success_rate))
      : total > 0
        ? Math.round((delivered / total) * 100)
        : 0;

  const adviceRaw = data.advice && typeof data.advice === "object" ? (data.advice as Record<string, unknown>) : null;

  return {
    phone: textOrNull(data.phone) ?? fallbackPhone,
    total,
    delivered,
    cancelled,
    successRate: Math.max(0, Math.min(100, successRate)),
    couriers,
    trustTier: textOrNull(data.trust_tier ?? data.trustTier),
    advice: adviceRaw
      ? {
          type: textOrNull(adviceRaw.type),
          title: textOrNull(adviceRaw.title),
          message: textOrNull(adviceRaw.message),
        }
      : null,
  };
}

export function parseStoredReport(json: string | null | undefined): CourierReport | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as CourierReport;
    if (typeof parsed?.total !== "number" || !Array.isArray(parsed.couriers)) return null;
    return parsed;
  } catch {
    return null;
  }
}
