"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

import { IconCheckCircle, IconFile, IconPlus, IconSpinner, IconUpload, IconX } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";
import type { ImportPreviewRow, UploadSummary } from "@/lib/types";

type Tab = "file" | "text" | "manual";

const ACCEPT = ".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.pdf,.txt";

const TEXT_EXAMPLE = `Rakib Hasan 01711-124851 House 42, Road 5, Mirpur 10, Dhaka
নুসরাত জাহান, ০১৯১১২২৩৩৪৪, উত্তরা সেক্টর 7, ঢাকা

Name: Tanvir Ahmed
Phone: 01612345678
Address: Zindabazar, Sylhet`;

const FIELD =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20";

export default function UploadPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: UploadSummary; preview: ImportPreviewRow[] } | null>(null);
  const [manual, setManual] = useState({ name: "", phone: "", address: "", city: "" });
  const [manualDone, setManualDone] = useState<string | null>(null);

  function pickFile(selected: File | null | undefined) {
    if (!selected) return;
    setFile(selected);
    setError(null);
    setResult(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  async function send(body: FormData) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      if (response.status === 401) {
        window.location.href = "/login?next=/upload";
        return;
      }
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        summary?: UploadSummary;
        preview?: ImportPreviewRow[];
      };
      if (!response.ok || !data.ok || !data.summary) {
        setError(data.message ?? "আপলোড ব্যর্থ হয়েছে");
        return;
      }
      setResult({ summary: data.summary, preview: data.preview ?? [] });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setPending(false);
    }
  }

  function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("আগে একটি ফাইল বেছে নিন");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    void send(body);
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setError("কাস্টমারের তথ্য পেস্ট করুন");
      return;
    }
    const body = new FormData();
    body.append("text", text);
    void send(body);
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setManualDone(null);
    const phone = normalizePhone(manual.phone);
    if (!phone) {
      setError("সঠিক বাংলাদেশী মোবাইল নম্বর দিন (১১ ডিজিট)");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manual, phone }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string; created?: boolean };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "সেভ করা যায়নি");
        return;
      }
      setManualDone(`${formatPhone(phone)} — ${data.created ? "নতুন কাস্টমার যোগ হয়েছে" : "তথ্য আপডেট হয়েছে"} ✓`);
      setManual({ name: "", phone: "", address: "", city: "" });
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setPending(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "file", label: "Excel / PDF ফাইল" },
    { key: "text", label: "টেক্সট পেস্ট" },
    { key: "manual", label: "একজন যোগ করুন" },
  ];

  return (
    <div className="glass-strong rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setError(null);
            }}
            className={`bn rounded-xl px-4 py-2 text-sm font-bold transition ${
              tab === item.key ? "bg-emerald-400 text-[#04060d]" : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <form onSubmit={submitFile} className="mt-5 space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "border-emerald-400 bg-emerald-500/10" : "border-white/15 bg-black/20 hover:border-emerald-400/60 hover:bg-white/[0.03]"
            }`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25">
              <IconUpload className="h-7 w-7" />
            </span>
            <p className="bn mt-4 text-base font-bold text-white">ফাইল এখানে টেনে আনুন অথবা ক্লিক করে বেছে নিন</p>
            <p className="mt-1 text-xs text-slate-400">Excel (.xlsx, .xls) · CSV · PDF · TXT — সর্বোচ্চ 15 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </div>

          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <span className="flex min-w-0 items-center gap-3">
                <IconFile className="h-5 w-5 shrink-0 text-emerald-300" />
                <span className="truncate text-sm font-semibold text-white">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(file.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="text-slate-400 hover:text-white"
                aria-label="Remove file"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending || !file}
            className="bn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 py-3 text-sm font-bold text-[#04060d] shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? <IconSpinner className="h-4 w-4" /> : <IconUpload className="h-4 w-4" />}
            {pending ? "ফাইল প্রসেস ও সেভ হচ্ছে…" : "আপলোড করে ডাটাবেজে সেভ করুন"}
          </button>
        </form>
      ) : null}

      {tab === "text" ? (
        <form onSubmit={submitText} className="mt-5 space-y-3">
          <p className="bn text-xs leading-relaxed text-slate-400">
            Excel থেকে কপি করা সারি, WhatsApp/Messenger-এর অর্ডার মেসেজ বা যেকোনো লেখা পেস্ট করুন — মোবাইল নম্বর,
            নাম ও ঠিকানা স্বয়ংক্রিয়ভাবে আলাদা করা হবে।
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            placeholder={TEXT_EXAMPLE}
            className={`${FIELD} font-mono text-[13px] leading-relaxed`}
          />
          <button
            type="submit"
            disabled={pending}
            className="bn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 py-3 text-sm font-bold text-[#04060d] transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? <IconSpinner className="h-4 w-4" /> : null}
            {pending ? "প্রসেস হচ্ছে…" : "ইমপোর্ট করুন"}
          </button>
        </form>
      ) : null}

      {tab === "manual" ? (
        <form onSubmit={submitManual} className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="bn mb-1 block text-xs font-bold text-slate-300">মোবাইল নম্বর *</span>
            <input
              value={manual.phone}
              onChange={(event) => setManual({ ...manual, phone: event.target.value })}
              placeholder="01711-124851"
              inputMode="tel"
              className={`${FIELD} font-mono`}
              required
            />
          </label>
          <label className="block">
            <span className="bn mb-1 block text-xs font-bold text-slate-300">নাম</span>
            <input value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} placeholder="Rakibul Hasan" className={FIELD} />
          </label>
          <label className="block sm:col-span-2">
            <span className="bn mb-1 block text-xs font-bold text-slate-300">ঠিকানা</span>
            <input value={manual.address} onChange={(event) => setManual({ ...manual, address: event.target.value })} placeholder="House 42, Road 5, Mirpur 10" className={FIELD} />
          </label>
          <label className="block">
            <span className="bn mb-1 block text-xs font-bold text-slate-300">জেলা / শহর</span>
            <input value={manual.city} onChange={(event) => setManual({ ...manual, city: event.target.value })} placeholder="Dhaka" className={FIELD} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pending}
              className="bn flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-[#04060d] hover:bg-emerald-300 disabled:opacity-50"
            >
              {pending ? <IconSpinner className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
              সেভ করুন
            </button>
          </div>
          {manualDone ? (
            <p className="bn rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/25 sm:col-span-2">
              {manualDone}{" "}
              <Link href="/customers" className="font-bold underline">
                লিস্টে দেখুন
              </Link>
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <p className="bn mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm leading-relaxed text-rose-300 ring-1 ring-rose-500/25">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4 rounded-2xl bg-emerald-500/[0.06] p-4 ring-1 ring-emerald-500/25">
          <p className="bn flex items-center gap-2 text-sm font-bold text-emerald-200">
            <IconCheckCircle className="h-5 w-5" />
            {result.summary.fileName} — {result.summary.found} জন কাস্টমার পাওয়া গেছে ও ডাটাবেজে সেভ হয়েছে
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: "পাওয়া গেছে", value: result.summary.found, tone: "text-white" },
              { label: "নতুন যোগ", value: result.summary.inserted, tone: "text-emerald-300" },
              { label: "আপডেট", value: result.summary.updated, tone: "text-sky-300" },
              { label: "অপরিবর্তিত", value: result.summary.unchanged, tone: "text-slate-300" },
              { label: "ডুপ্লিকেট", value: result.summary.duplicates, tone: "text-amber-300" },
              { label: "নম্বর নেই", value: result.summary.invalid, tone: "text-rose-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-black/25 px-2 py-2.5 text-center ring-1 ring-white/10">
                <p className={`font-mono text-lg font-extrabold ${item.tone}`}>{item.value}</p>
                <p className="bn text-[10px] text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
          {result.summary.mapping ? (
            <div className="bn flex flex-wrap gap-2 text-[11px]">
              {Object.entries(result.summary.mapping)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <span key={key} className="rounded-full bg-black/25 px-2.5 py-1 text-slate-300 ring-1 ring-white/10">
                    <b className="text-emerald-300">{key}</b> ← {value}
                  </span>
                ))}
            </div>
          ) : null}
          {result.summary.warnings.map((warning) => (
            <p key={warning} className="bn rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/25">
              {warning}
            </p>
          ))}
          {result.preview.length > 0 ? (
            <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-black/30 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, index) => (
                    <tr key={row.phone} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="bn px-3 py-2 font-semibold text-white">{row.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-emerald-300">{formatPhone(row.phone)}</td>
                      <td className="bn px-3 py-2 text-slate-300">{[row.address, row.city].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <Link
            href="/customers"
            className="bn inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#04060d] hover:bg-emerald-300"
          >
            সকল কাস্টমার দেখুন ও চেক করুন →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
