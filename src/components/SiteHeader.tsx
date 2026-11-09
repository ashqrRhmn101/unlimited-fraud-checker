import Link from "next/link";

import LogoutButton from "@/components/LogoutButton";
import { getSession } from "@/lib/auth";
import { getUsage } from "@/lib/repo";
import type { UsageDTO } from "@/lib/types";

const PRIVATE_NAV = [
  { href: "/customers", label: "সকল কাস্টমার" },
  { href: "/upload", label: "আপলোড" },
  { href: "/dashboard", label: "ড্যাশবোর্ড" },
];

const PUBLIC_NAV = [
  { href: "/", label: "হোম" },
  { href: "/#how", label: "কীভাবে কাজ করে" },
  { href: "/#sample", label: "নমুনা রিপোর্ট" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-emerald-500/25">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#04060d]" fill="currentColor" aria-hidden>
          <path d="M12 2 4 5v6.5c0 4.6 3.2 8.9 8 10.5 4.8-1.6 8-5.9 8-10.5V5l-8-3Zm-1.2 13.6-3-3 1.4-1.4 1.6 1.6 4-4 1.4 1.4-5.4 5.4Z" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-tight text-white">
          Fraud<span className="text-emerald-400">BD</span>
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
          Merchant Panel
        </span>
      </span>
    </Link>
  );
}

export default async function SiteHeader() {
  const session = await getSession();
  let usage: UsageDTO | null = null;
  if (session) {
    try {
      usage = await getUsage();
    } catch {
      usage = null;
    }
  }
  const nav = session ? PRIVATE_NAV : PUBLIC_NAV;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#04060d]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bn rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              {usage ? (
                <Link
                  href="/dashboard"
                  title="আজকের fraud.bd API ব্যবহার"
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-ring" />
                  API {usage.used}/{usage.limit}
                </Link>
              ) : null}
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-[#04060d] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
            >
              লগইন
            </Link>
          )}
        </div>
      </div>

      {session ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bn shrink-0 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
