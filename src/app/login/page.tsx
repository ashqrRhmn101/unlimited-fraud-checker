import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { IconShield } from "@/components/icons";
import LoginForm from "@/components/LoginForm";
import { getSession, isDefaultPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "লগইন | FraudBD Merchant Panel",
};

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/customers";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getSession()) redirect(target);

  return (
    <main className="mx-auto grid min-h-[72vh] w-full max-w-md place-items-center px-4 py-12">
      <div className="w-full">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25">
            <IconShield className="h-7 w-7" />
          </span>
          <h1 className="bn mt-4 text-2xl font-extrabold text-white">মার্চেন্ট প্যানেলে লগইন</h1>
          <p className="bn mt-1 text-sm text-slate-400">
            কাস্টমার ডেটা ও API কোটা সুরক্ষিত রাখতে প্যানেলটি পাসওয়ার্ড দিয়ে সুরক্ষিত।
          </p>
        </div>
        <div className="glass-strong mt-6 rounded-3xl p-6">
          <LoginForm next={target} />
        </div>
        <p className="bn mt-4 text-center text-xs leading-relaxed text-slate-500">
          ইউজারনেম ও পাসওয়ার্ড সার্ভারের <code className="rounded bg-white/5 px-1 text-emerald-300">.env</code> ফাইলে
          (ADMIN_USERNAME / ADMIN_PASSWORD) সেট করা আছে।
          {isDefaultPassword() ? (
            <span className="mt-2 block rounded-lg bg-amber-500/10 px-3 py-2 text-amber-200 ring-1 ring-amber-500/25">
              ⚠️ ডিফল্ট পাসওয়ার্ড ব্যবহার হচ্ছে — লাইভ করার আগে .env-এ পরিবর্তন করুন।
            </span>
          ) : null}
        </p>
      </div>
    </main>
  );
}
