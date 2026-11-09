import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-3xl place-items-center px-4 py-24 text-center">
      <div>
        <div className="text-5xl">🔍</div>
        <h1 className="mt-4 text-2xl font-extrabold text-white">পেজটি পাওয়া যায়নি</h1>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">404 — Page not found</p>
        <p className="bn mx-auto mt-3 max-w-md text-sm text-slate-400">
          আপনি খুঁজছেন এমন পেজটি নেই। হোম পেজ থেকে যেকোনো নম্বর যাচাই করুন।
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#04060d] transition hover:bg-emerald-300"
        >
          হোম পেজে যান
        </Link>
      </div>
    </main>
  );
}
