import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#04060d]/70">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <span className="text-lg font-extrabold text-white">
            Fraud<span className="text-emerald-400">BD</span> <span className="text-sm font-semibold text-slate-400">Merchant Panel</span>
          </span>
          <p className="bn mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            কাস্টমার লিস্ট (Excel / PDF) আপলোড করুন, প্রতিটি নম্বরের পাশে এক ক্লিকে fraud.bd API দিয়ে কুরিয়ার
            রেকর্ড দেখুন। সব ডেটা আপনার Supabase (PostgreSQL) ডাটাবেজে থাকে।
          </p>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-500">
            Courier data is provided by the fraud.bd API using your own merchant keys (stored only in the server-side
            .env file).
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Panel</h4>
          <ul className="bn mt-4 space-y-2.5 text-sm text-slate-400">
            <li><Link className="transition hover:text-emerald-300" href="/customers">সকল কাস্টমার</Link></li>
            <li><Link className="transition hover:text-emerald-300" href="/upload">Excel / PDF আপলোড</Link></li>
            <li><Link className="transition hover:text-emerald-300" href="/dashboard">ড্যাশবোর্ড ও API ব্যবহার</Link></li>
            <li><Link className="transition hover:text-emerald-300" href="/#sample">নমুনা রিপোর্ট</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Stack</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
            <li>Supabase PostgreSQL</li>
            <li>fraud.bd REST API</li>
            <li>Keys in <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12px] text-emerald-300">.env</code></li>
            <li>Excel · CSV · PDF import</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} FraudBD Merchant Panel · Self-hosted · Your data stays on your server.
      </div>
    </footer>
  );
}
