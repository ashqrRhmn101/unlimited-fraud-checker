"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import ContactLinks from "@/components/ContactLinks";
import CourierReportCard from "@/components/CourierReportCard";
import {
  IconBolt,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconSpinner,
  IconTrash,
  IconUpload,
  IconX,
} from "@/components/icons";
import QuotaMeter from "@/components/QuotaMeter";
import { LEVEL_META, levelFor, type CourierReport } from "@/lib/courier";
import { initials, sourceMeta, timeAgo } from "@/lib/format";
import { formatPhone, toLocalPhone } from "@/lib/phone";
import type {
  CheckApiResult,
  CustomerCounts,
  CustomerDTO,
  CustomerFilter,
  CustomerListResponse,
  CustomerSort,
  UsageDTO,
} from "@/lib/types";

const PAGE_SIZE = 10;

const FILTERS: { key: CustomerFilter; label: string; count: (counts: CustomerCounts) => number }[] = [
  { key: "all", label: "সব", count: (c) => c.all },
  { key: "unchecked", label: "চেক হয়নি", count: (c) => c.unchecked },
  { key: "checked", label: "চেক হয়েছে", count: (c) => c.checked },
  { key: "good", label: "ভালো রেকর্ড", count: (c) => c.good },
  { key: "risky", label: "ঝুঁকিপূর্ণ", count: (c) => c.risky },
  { key: "new", label: "রেকর্ড নেই", count: (c) => c.noRecord },
];

const SORTS: { key: CustomerSort; label: string }[] = [
  { key: "new", label: "নতুন আগে" },
  { key: "old", label: "পুরোনো আগে" },
  { key: "name", label: "নাম (A–Z)" },
  { key: "risk", label: "ঝুঁকি বেশি আগে" },
];

interface PanelState {
  open: boolean;
  status: "loading" | "done" | "error";
  report: CourierReport | null;
  source: "live" | "cache" | null;
  checkedAt: string | null;
  message: string | null;
  warning: string | null;
}

const EMPTY_PANEL: PanelState = {
  open: false,
  status: "done",
  report: null,
  source: null,
  checkedAt: null,
  message: null,
  warning: null,
};

export default function CustomerList({
  initial,
  initialQuery,
  cacheHours,
}: {
  initial: CustomerListResponse;
  initialQuery: string;
  cacheHours: number;
}) {
  const [items, setItems] = useState<CustomerDTO[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [counts, setCounts] = useState<CustomerCounts>(initial.counts);
  const [usage, setUsage] = useState<UsageDTO>(initial.usage);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [sort, setSort] = useState<CustomerSort>("new");
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panels, setPanels] = useState<Record<string, PanelState>>({});
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const stopBulk = useRef(false);
  const requestSeq = useRef(0);
  const skipFirst = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(
    async (offset: number): Promise<CustomerListResponse> => {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
        filter,
        sort,
        q: debouncedQuery,
      });
      const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login?next=/customers";
        throw new Error("unauthorized");
      }
      const data = (await response.json()) as CustomerListResponse | { ok: false; message?: string };
      if (!data.ok) throw new Error(data.message || "কাস্টমার লোড করা যায়নি");
      return data;
    },
    [filter, sort, debouncedQuery],
  );

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    fetchPage(0)
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setItems(data.items);
        setTotal(data.total);
        setCounts(data.counts);
        setUsage(data.usage);
      })
      .catch((err: unknown) => {
        if (seq === requestSeq.current) setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [fetchPage]);

  async function reloadFirstPage() {
    const data = await fetchPage(0);
    setItems(data.items);
    setTotal(data.total);
    setCounts(data.counts);
    setUsage(data.usage);
  }

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(items.length);
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...data.items.filter((item) => !seen.has(item.id))];
      });
      setTotal(data.total);
      setCounts(data.counts);
      setUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function runCheck(
    customer: CustomerDTO,
    options: { force?: boolean; open?: boolean } = {},
  ): Promise<"ok" | "limit" | "error"> {
    const key = customer.phone;
    const open = options.open ?? true;
    setPanels((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] ?? EMPTY_PANEL),
        open: open || Boolean(previous[key]?.open),
        status: "loading",
        message: null,
        warning: null,
      },
    }));

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone, force: Boolean(options.force) }),
      });
      if (response.status === 401) {
        window.location.href = "/login?next=/customers";
        return "error";
      }
      const data = (await response.json()) as CheckApiResult;
      if (data.usage) setUsage(data.usage);

      if (data.ok) {
        setPanels((previous) => ({
          ...previous,
          [key]: {
            open: previous[key]?.open ?? open,
            status: "done",
            report: data.report,
            source: data.source,
            checkedAt: data.checkedAt,
            message: null,
            warning: data.warning,
          },
        }));
        setItems((previous) =>
          previous.map((item) =>
            item.phone === key
              ? {
                  ...item,
                  lastCheckedAt: data.checkedAt,
                  checkTotal: data.report.total,
                  checkDelivered: data.report.delivered,
                  checkCancelled: data.report.cancelled,
                  checkRate: data.report.successRate,
                  checkLevel: levelFor(data.report.total, data.report.successRate),
                  checkTier: data.report.trustTier,
                }
              : item,
          ),
        );
        if (!customer.lastCheckedAt) {
          setCounts((previous) => ({
            ...previous,
            unchecked: Math.max(0, previous.unchecked - 1),
            checked: previous.checked + 1,
          }));
        }
        return "ok";
      }

      setPanels((previous) => ({
        ...previous,
        [key]: {
          open: true,
          status: "error",
          report: data.report ?? previous[key]?.report ?? null,
          source: data.report ? "cache" : (previous[key]?.source ?? null),
          checkedAt: data.checkedAt ?? previous[key]?.checkedAt ?? null,
          message: data.message,
          warning: null,
        },
      }));
      return data.code === "limit" ? "limit" : "error";
    } catch {
      setPanels((previous) => ({
        ...previous,
        [key]: {
          ...(previous[key] ?? EMPTY_PANEL),
          open: true,
          status: "error",
          message: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন",
        },
      }));
      return "error";
    }
  }

  function onSearchClick(customer: CustomerDTO) {
    const panel = panels[customer.phone];
    if (panel?.status === "loading") return;
    if (panel?.open && panel.status === "done") {
      setPanels((previous) => ({ ...previous, [customer.phone]: { ...panel, open: false } }));
      return;
    }
    if (panel?.report && panel.status === "done") {
      setPanels((previous) => ({ ...previous, [customer.phone]: { ...panel, open: true } }));
      return;
    }
    void runCheck(customer, { open: true });
  }

  async function checkVisible() {
    const targets = items.filter((item) => !item.lastCheckedAt && panels[item.phone]?.status !== "loading");
    if (targets.length === 0) {
      window.alert("এই তালিকার সবাইকে আগেই চেক করা হয়েছে।");
      return;
    }
    const allowed = Math.min(targets.length, usage.remaining);
    if (allowed <= 0) {
      window.alert(`আজকের API লিমিট শেষ (${usage.used}/${usage.limit})। আগামীকাল আবার চেষ্টা করুন।`);
      return;
    }
    const ok = window.confirm(
      `${allowed} জন কাস্টমার চেক করা হবে।\nসর্বোচ্চ ${allowed}টি API কল খরচ হবে (আজ বাকি ${usage.remaining}টি)।\nচালিয়ে যাবেন?`,
    );
    if (!ok) return;

    stopBulk.current = false;
    setBulk({ running: true, done: 0, total: allowed });
    for (let index = 0; index < allowed; index += 1) {
      if (stopBulk.current) break;
      const outcome = await runCheck(targets[index], { open: false });
      setBulk({ running: true, done: index + 1, total: allowed });
      if (outcome === "limit") break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    setBulk((previous) => (previous ? { ...previous, running: false } : null));
  }

  async function removeCustomer(customer: CustomerDTO) {
    const label = customer.name ?? formatPhone(customer.phone);
    if (!window.confirm(`"${label}" কাস্টমারটি ডাটাবেজ থেকে মুছে ফেলবেন?`)) return;
    const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    if (response.ok) {
      setItems((previous) => previous.filter((item) => item.id !== customer.id));
      setTotal((value) => Math.max(0, value - 1));
      setCounts((previous) => ({
        ...previous,
        all: Math.max(0, previous.all - 1),
        demo: customer.source === "demo" ? Math.max(0, previous.demo - 1) : previous.demo,
      }));
    }
  }

  async function removeDemo() {
    if (!window.confirm("সব ডেমো কাস্টমার মুছে ফেলবেন? (আপনার আপলোড করা ডেটা থাকবে)")) return;
    const response = await fetch("/api/customers?scope=demo", { method: "DELETE" });
    if (response.ok) {
      setPanels({});
      await reloadFirstPage();
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(toLocalPhone(phone));
      setCopied(phone);
      setTimeout(() => setCopied((current) => (current === phone ? null : current)), 1500);
    } catch {
      // clipboard not available
    }
  }

  const uncheckedVisible = items.filter((item) => !item.lastCheckedAt).length;

  return (
    <div className="space-y-4">
      {counts.demo > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/25 sm:flex-row sm:items-center sm:justify-between">
          <p className="bn text-sm leading-relaxed text-amber-100">
            <b>ডেমো ডেটা দেখানো হচ্ছে ({counts.demo} জন)।</b> নিজের কাস্টমার লিস্টের Excel/PDF আপলোড করুন, তারপর
            ডেমো মুছে ফেলুন।
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href="/upload" className="bn rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-[#04060d] hover:bg-amber-300">
              ফাইল আপলোড
            </Link>
            <button
              type="button"
              onClick={removeDemo}
              className="bn rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-amber-100 ring-1 ring-amber-400/30 hover:bg-white/15"
            >
              ডেমো মুছুন
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-xl bg-black/30 px-3 ring-1 ring-white/10 focus-within:ring-emerald-400/50">
            <IconSearch className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="নাম, নম্বর বা ঠিকানা দিয়ে খুঁজুন…"
              className="bn w-full bg-transparent py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="text-slate-500 hover:text-white" aria-label="Clear">
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CustomerSort)}
            className="bn rounded-xl bg-[#0b1120] px-3 py-2.5 text-sm text-slate-200 ring-1 ring-white/10 focus:outline-none"
            aria-label="Sort"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <QuotaMeter usage={usage} compact />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const active = filter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`bn flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-emerald-400 text-[#04060d] shadow-lg shadow-emerald-500/20"
                    : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {option.label}
                <span className={`rounded-full px-1.5 font-mono text-[10px] ${active ? "bg-black/15" : "bg-white/10"}`}>
                  {option.count(counts)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={checkVisible}
            disabled={Boolean(bulk?.running) || uncheckedVisible === 0}
            className="bn flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3.5 py-2 text-xs font-bold text-sky-200 ring-1 ring-sky-500/30 transition hover:bg-sky-500/25 disabled:opacity-50"
          >
            <IconBolt className="h-4 w-4" />
            এই তালিকার সবাইকে চেক করুন ({uncheckedVisible})
          </button>
          {bulk?.running ? (
            <button
              type="button"
              onClick={() => {
                stopBulk.current = true;
              }}
              className="bn rounded-xl bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-500/30"
            >
              থামান
            </button>
          ) : null}
          <a
            href="/api/customers/export"
            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
          >
            <IconDownload className="h-4 w-4" />
            CSV
          </a>
          <Link
            href="/upload"
            className="bn flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-[#04060d] hover:bg-emerald-300"
          >
            <IconUpload className="h-4 w-4" />
            আপলোড
          </Link>
        </div>
      </div>

      {bulk ? (
        <div className="glass rounded-2xl p-3">
          <div className="bn flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-2">
              {bulk.running ? <IconSpinner className="h-3.5 w-3.5 text-sky-300" /> : "✓"}
              {bulk.running ? "চেক চলছে…" : "চেক সম্পন্ন"} {bulk.done}/{bulk.total}
            </span>
            {!bulk.running ? (
              <button type="button" onClick={() => setBulk(null)} className="text-slate-500 hover:text-white">
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${bulk.total ? (bulk.done / bulk.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="bn rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/25">{error}</p>
      ) : null}

      {counts.all === 0 ? (
        <div className="glass rounded-3xl p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25">
            <IconUpload className="h-8 w-8" />
          </div>
          <h3 className="bn mt-4 text-lg font-bold text-white">এখনো কোনো কাস্টমার নেই</h3>
          <p className="bn mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            আপনার কাস্টমার লিস্টের Excel, CSV বা PDF ফাইল আপলোড করুন — নাম, নম্বর ও ঠিকানা স্বয়ংক্রিয়ভাবে আপনার
            ডাটাবেজে সেভ হয়ে এখানে দেখাবে।
          </p>
          <Link
            href="/upload"
            className="bn mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#04060d] hover:bg-emerald-300"
          >
            <IconUpload className="h-4 w-4" /> ফাইল আপলোড করুন
          </Link>
        </div>
      ) : items.length === 0 && !loading ? (
        <div className="glass bn rounded-2xl p-8 text-center text-sm text-slate-400">
          এই ফিল্টার/সার্চে কোনো কাস্টমার পাওয়া যায়নি।
        </div>
      ) : (
        <ol className={`space-y-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {items.map((customer, index) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              index={index}
              panel={panels[customer.phone]}
              copied={copied === customer.phone}
              cacheHours={cacheHours}
              onSearch={onSearchClick}
              onRefresh={(item) => void runCheck(item, { force: true, open: true })}
              onCopy={copyPhone}
              onDelete={removeCustomer}
            />
          ))}
        </ol>
      )}

      {counts.all > 0 ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="bn text-xs text-slate-400">
            দেখানো হচ্ছে <b className="text-slate-200">{items.length}</b> / {total} জন
          </p>
          {items.length < total ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="bn flex items-center gap-2 rounded-2xl bg-white/5 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10 disabled:opacity-60"
            >
              {loadingMore ? (
                <>
                  <IconSpinner className="h-4 w-4" /> লোড হচ্ছে…
                </>
              ) : (
                <>
                  আরও {Math.min(PAGE_SIZE, total - items.length)} জন দেখুন (See More)
                  <IconChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          ) : items.length > 0 ? (
            <p className="bn text-xs text-slate-500">✓ সব কাস্টমার দেখানো হয়েছে</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CustomerRow({
  customer,
  index,
  panel,
  copied,
  cacheHours,
  onSearch,
  onRefresh,
  onCopy,
  onDelete,
}: {
  customer: CustomerDTO;
  index: number;
  panel: PanelState | undefined;
  copied: boolean;
  cacheHours: number;
  onSearch: (customer: CustomerDTO) => void;
  onRefresh: (customer: CustomerDTO) => void;
  onCopy: (phone: string) => void;
  onDelete: (customer: CustomerDTO) => void;
}) {
  const level = customer.lastCheckedAt ? levelFor(customer.checkTotal, customer.checkRate) : null;
  const meta = level ? LEVEL_META[level] : null;
  const source = sourceMeta(customer.source);
  const loading = panel?.status === "loading";
  const open = Boolean(panel?.open);
  const location = [customer.area, customer.city].filter(Boolean).join(", ");
  const addressLine = [customer.address, location].filter(Boolean).join(" · ");

  return (
    <li className={`glass overflow-hidden rounded-2xl transition ${open ? "ring-1 ring-emerald-400/30" : ""}`}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-3.5 w-6 shrink-0 text-right font-mono text-[11px] text-slate-500">{index + 1}</span>
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-extrabold ring-2 ${
              meta ? meta.avatar : "bg-white/5 text-slate-300 ring-white/10"
            }`}
          >
            {initials(customer.name, customer.phone)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bn truncate text-[15px] font-bold text-white">{customer.name ?? "নাম নেই"}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${source.className}`}>{source.label}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <Link
                href={`/check/${customer.phone}`}
                prefetch={false}
                className="font-mono text-base font-bold tracking-wide text-emerald-300 hover:underline"
              >
                {formatPhone(customer.phone)}
              </Link>
              <button
                type="button"
                onClick={() => onCopy(customer.phone)}
                title="নম্বর কপি করুন"
                className="text-slate-500 transition hover:text-white"
              >
                <IconCopy className="h-3.5 w-3.5" />
              </button>
              {copied ? <span className="bn text-[10px] font-semibold text-emerald-300">কপি হয়েছে</span> : null}
              <span className="ml-1 hidden sm:block">
                <ContactLinks phone={customer.phone} variant="icons" />
              </span>
            </div>
            {addressLine ? (
              <p className="bn mt-1 flex items-start gap-1 text-xs text-slate-400">
                <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="line-clamp-2">{addressLine}</span>
              </p>
            ) : null}
            {customer.altPhones ? (
              <p className="bn mt-0.5 text-[11px] text-slate-500">
                অন্য নম্বর: {customer.altPhones.split(",").map((phone) => formatPhone(phone.trim())).join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pl-9 sm:justify-end sm:pl-0">
          {meta && customer.lastCheckedAt ? (
            <div className={`rounded-xl px-3 py-1.5 text-right ring-1 ${meta.chip}`}>
              <p className="font-mono text-sm font-extrabold">
                {customer.checkTotal ? `${customer.checkRate ?? 0}%` : "N/A"}
                <span className="bn ml-1 text-[11px] font-semibold opacity-80">· {customer.checkTotal ?? 0} পার্সেল</span>
              </p>
              <p className="bn text-[10px] opacity-80">
                {meta.bn} · {timeAgo(customer.lastCheckedAt)}
              </p>
            </div>
          ) : (
            <span className="bn rounded-xl bg-white/5 px-3 py-2 text-[11px] text-slate-400 ring-1 ring-white/10">
              এখনো চেক করা হয়নি
            </span>
          )}
          <button
            type="button"
            onClick={() => onSearch(customer)}
            disabled={loading}
            title="fraud.bd API দিয়ে কুরিয়ার রেকর্ড দেখুন"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-4 py-2.5 text-sm font-bold text-[#04060d] shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-70"
          >
            {loading ? <IconSpinner className="h-4 w-4" /> : <IconSearch className="h-4 w-4" />}
            <span className="bn">
              {loading ? "চেক হচ্ছে" : open ? "বন্ধ করুন" : customer.lastCheckedAt ? "রিপোর্ট" : "চেক করুন"}
            </span>
          </button>
        </div>
      </div>

      {open && panel ? (
        <div className="border-t border-white/10 bg-black/25 p-3 sm:p-4">
          {panel.status === "loading" && !panel.report ? (
            <div className="animate-pulse space-y-3">
              <div className="h-16 rounded-2xl bg-white/5" />
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-24 rounded-2xl bg-white/5" />
                ))}
              </div>
              <p className="bn text-center text-xs text-slate-500">fraud.bd থেকে তথ্য আনা হচ্ছে…</p>
            </div>
          ) : null}
          {panel.message ? (
            <p className="bn mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm leading-relaxed text-rose-200 ring-1 ring-rose-500/25">
              {panel.message}
            </p>
          ) : null}
          {panel.warning ? (
            <p className="bn mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-500/25">
              {panel.warning}
            </p>
          ) : null}
          {panel.report ? (
            <>
              <CourierReportCard
                report={panel.report}
                variant="compact"
                checkedAt={panel.checkedAt}
                source={panel.source}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/check/${customer.phone}`}
                  prefetch={false}
                  className="bn rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-[#04060d] hover:bg-emerald-300"
                >
                  সম্পূর্ণ রিপোর্ট →
                </Link>
                <button
                  type="button"
                  onClick={() => onRefresh(customer)}
                  disabled={loading}
                  className="bn flex items-center gap-1.5 rounded-xl bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                >
                  {loading ? <IconSpinner className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />}
                  লাইভ রিফ্রেশ (১টি API কল)
                </button>
                {panel.source === "cache" ? (
                  <span className="bn text-[11px] text-slate-500">
                    সংরক্ষিত ফলাফল {cacheHours} ঘণ্টা পর্যন্ত ব্যবহার হয় — API কোটা বাঁচে
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(customer)}
                  className="bn ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <IconTrash className="h-3.5 w-3.5" /> মুছুন
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
