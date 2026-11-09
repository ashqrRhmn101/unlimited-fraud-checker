"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { IconSearch } from "@/components/icons";
import { looksLikePhoneQuery, normalizePhone } from "@/lib/phone";

export default function SearchBox({
  initialValue = "",
  autoFocus = false,
  size = "lg",
  hint = true,
}: {
  initialValue?: string;
  autoFocus?: boolean;
  size?: "lg" | "md";
  hint?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = value.trim();
    if (!raw) {
      setError("মোবাইল নম্বর বা নাম লিখুন / Enter a mobile number or name");
      return;
    }
    setError(null);

    if (looksLikePhoneQuery(raw)) {
      const phone = normalizePhone(raw);
      if (!phone) {
        setError("সঠিক বাংলাদেশী মোবাইল নম্বর দিন (১১ ডিজিট, যেমন 01711-124851)");
        return;
      }
      setPending(true);
      router.push(`/check/${phone}`);
      return;
    }

    setPending(true);
    router.push(`/customers?q=${encodeURIComponent(raw)}`);
  }

  return (
    <div className="w-full">
      <form onSubmit={submit}>
        <div className="glass-strong flex flex-col gap-2 rounded-2xl p-2 shadow-2xl shadow-black/40 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3 px-3">
            <IconSearch className="h-5 w-5 shrink-0 text-emerald-400" />
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus={autoFocus}
              autoComplete="off"
              placeholder="01711-124851 অথবা কাস্টমারের নাম"
              aria-label="Mobile number or customer name"
              className={`w-full bg-transparent font-semibold text-white placeholder:font-normal placeholder:text-slate-500 focus:outline-none ${
                size === "lg" ? "py-3.5 text-lg" : "py-2.5 text-base"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className={`shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 font-bold text-[#04060d] shadow-lg shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-70 ${
              size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm"
            }`}
          >
            {pending ? "খোঁজা হচ্ছে…" : "যাচাই করুন"}
          </button>
        </div>
      </form>
      {error ? (
        <p className="bn mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/25">{error}</p>
      ) : null}
      {hint && !error ? (
        <p className="bn mt-2 text-xs text-slate-500">
          নম্বর দিলে সরাসরি কুরিয়ার রিপোর্ট, নাম দিলে আপনার কাস্টমার লিস্টে খোঁজা হবে।
        </p>
      ) : null}
    </div>
  );
}
