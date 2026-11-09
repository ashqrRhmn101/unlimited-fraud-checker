const NUMBER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Dhaka",
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(value: number | null | undefined): string {
  return NUMBER.format(Number(value ?? 0));
}

export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? DATE.format(date) : "—";
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? DATE_TIME.format(date) : "—";
}

/** Relative time in Bangla, e.g. "৫ মিনিট আগে" style with western digits. */
export function timeAgo(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "এইমাত্র";
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} দিন আগে`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} মাস আগে`;
  return `${Math.round(months / 12)} বছর আগে`;
}

export function initials(name: string | null | undefined, phone?: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => Array.from(part)[0]?.toUpperCase() ?? "").join("");
  }
  return (phone ?? "?").slice(-2);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SOURCE_LABEL: Record<string, { label: string; className: string }> = {
  excel: { label: "Excel", className: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25" },
  csv: { label: "CSV", className: "bg-teal-500/10 text-teal-300 ring-teal-500/25" },
  pdf: { label: "PDF", className: "bg-rose-500/10 text-rose-300 ring-rose-500/25" },
  text: { label: "Text", className: "bg-violet-500/10 text-violet-300 ring-violet-500/25" },
  manual: { label: "Manual", className: "bg-sky-500/10 text-sky-300 ring-sky-500/25" },
  search: { label: "Search", className: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/25" },
  demo: { label: "Demo", className: "bg-amber-500/10 text-amber-300 ring-amber-500/25" },
};

export function sourceMeta(source: string) {
  return SOURCE_LABEL[source] ?? { label: source, className: "bg-slate-500/10 text-slate-300 ring-slate-500/25" };
}
