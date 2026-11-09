import type { Metadata } from "next";

import { IconDownload, IconFile } from "@/components/icons";
import UploadPanel from "@/components/UploadPanel";
import { requirePageSession } from "@/lib/auth";
import { formatBytes, formatDateTime, sourceMeta } from "@/lib/format";
import { listUploads } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "কাস্টমার আপলোড (Excel / PDF) | FraudBD",
};

const SAMPLES = [
  { href: "/samples/customers-sample.xlsx", label: "Excel নমুনা (.xlsx)" },
  { href: "/samples/customers-sample.csv", label: "CSV নমুনা (.csv)" },
  { href: "/samples/customers-sample.pdf", label: "PDF নমুনা (.pdf)" },
];

export default async function UploadPage() {
  await requirePageSession("/upload");
  const uploads = await listUploads(10);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">Import customers</p>
      <h1 className="bn mt-1 text-3xl font-extrabold text-white sm:text-4xl">কাস্টমার লিস্ট আপলোড</h1>
      <p className="bn mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
        Excel, CSV বা PDF ফাইল আপলোড করলেই ফাইলের প্রতিটি কাস্টমারের নাম, মোবাইল নম্বর ও ঠিকানা সরাসরি আপনার নিজের
        ডাটাবেজে (Supabase PostgreSQL) সেভ হবে এবং “সকল কাস্টমার” পেজে দেখাবে। একই নম্বর আগে থেকে থাকলে নতুন তথ্য দিয়ে আপডেট হবে।
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <UploadPanel />

        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="bn text-base font-extrabold text-white">যেসব কলাম নিজে থেকেই চিনে নেয়</h2>
            <ul className="bn mt-3 space-y-2 text-sm text-slate-300">
              <li><b className="text-emerald-300">নাম:</b> Name, Customer, Receiver, নাম, গ্রাহক</li>
              <li><b className="text-emerald-300">মোবাইল:</b> Phone, Mobile, Contact, মোবাইল, নম্বর</li>
              <li><b className="text-emerald-300">ঠিকানা:</b> Address, Delivery Address, ঠিকানা</li>
              <li><b className="text-emerald-300">জেলা/থানা:</b> City, District, Area, Thana, জেলা, থানা</li>
              <li><b className="text-emerald-300">নোট:</b> Note, Product, Remarks, নোট</li>
            </ul>
            <p className="bn mt-3 text-xs leading-relaxed text-slate-500">
              হেডার না থাকলেও কলামের লেখা দেখে নম্বর, নাম ও ঠিকানা আলাদা করা হয়। নম্বর যেকোনো ফরম্যাটে চলবে: 01711-124851,
              +8801711124851, ০১৭১১১২৪৮৫১ বা 1711124851।
            </p>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="bn text-base font-extrabold text-white">নমুনা ফাইল</h2>
            <p className="bn mt-1 text-xs text-slate-400">ফরম্যাট বুঝতে ডাউনলোড করে আপলোড করে দেখুন।</p>
            <div className="mt-3 space-y-2">
              {SAMPLES.map((sample) => (
                <a
                  key={sample.href}
                  href={sample.href}
                  download
                  className="bn flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <IconFile className="h-4 w-4 text-emerald-300" /> {sample.label}
                  </span>
                  <IconDownload className="h-4 w-4 text-slate-400" />
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-sky-500/10 p-5 ring-1 ring-sky-500/25">
            <h2 className="bn text-sm font-extrabold text-sky-100">PDF সম্পর্কে</h2>
            <p className="bn mt-1 text-xs leading-relaxed text-sky-100/80">
              টেক্সট-ভিত্তিক PDF (কম্পিউটারে তৈরি) সরাসরি পড়া যায়। স্ক্যান করা ছবি-PDF-এ টেক্সট থাকে না — সেক্ষেত্রে
              Excel/CSV ব্যবহার করুন। বাংলা ফন্টের PDF-এ নাম ভেঙে গেলে Excel সবচেয়ে নির্ভুল।
            </p>
          </div>
        </aside>
      </div>

      <section className="glass mt-6 rounded-2xl p-5">
        <h2 className="bn text-lg font-extrabold text-white">আপলোড ইতিহাস</h2>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Upload history</p>
        {uploads.length === 0 ? (
          <p className="bn mt-4 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
            এখনো কোনো ফাইল আপলোড করা হয়নি।
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="pb-2">File</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-center">Found</th>
                  <th className="pb-2 text-center">New</th>
                  <th className="pb-2 text-center">Updated</th>
                  <th className="pb-2 text-center">Skipped</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => {
                  const meta = sourceMeta(upload.fileType);
                  return (
                    <tr key={upload.id} className="border-t border-white/5">
                      <td className="py-2.5">
                        <p className="max-w-[260px] truncate font-semibold text-white">{upload.fileName}</p>
                        <p className="text-[11px] text-slate-500">{formatBytes(upload.fileSize)}</p>
                      </td>
                      <td className="py-2.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td className="py-2.5 text-center font-mono text-white">{upload.found}</td>
                      <td className="py-2.5 text-center font-mono text-emerald-300">{upload.inserted}</td>
                      <td className="py-2.5 text-center font-mono text-sky-300">{upload.updated}</td>
                      <td className="py-2.5 text-center font-mono text-rose-300">{upload.skipped}</td>
                      <td className="py-2.5 text-xs text-slate-400">{formatDateTime(upload.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
