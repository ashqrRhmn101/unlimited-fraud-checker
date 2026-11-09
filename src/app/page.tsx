import Link from "next/link";

import CourierReportCard from "@/components/CourierReportCard";
import { IconBolt, IconDatabase, IconFile, IconKey, IconSearch, IconShield, IconUpload, IconUsers } from "@/components/icons";
import SearchBox from "@/components/SearchBox";
import { getSession } from "@/lib/auth";
import { normalizeFraudbdResponse, SUPPORTED_COURIERS } from "@/lib/courier";
import { SAMPLE_API_RESPONSE } from "@/lib/sample-report";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: IconUpload,
    title: "Excel / PDF আপলোড",
    desc: "কাস্টমার লিস্টের ফাইল দিন — নাম, নম্বর, ঠিকানা স্বয়ংক্রিয়ভাবে আলাদা হয়ে আপনার Supabase (PostgreSQL) ডাটাবেজে সেভ হবে।",
  },
  {
    icon: IconUsers,
    title: "সকল কাস্টমার তালিকা",
    desc: "প্রতিবার ১০ জন করে সুন্দরভাবে দেখাবে, “See More” চাপলে আরও ১০ জন। নাম/নম্বর/ঠিকানা দিয়ে সার্চ ও ফিল্টার।",
  },
  {
    icon: IconSearch,
    title: "নম্বরের পাশে 🔍 ক্লিক",
    desc: "কিছু টাইপ করতে হবে না — আপনার fraud.bd API key স্বয়ংক্রিয়ভাবে ব্যবহার হয়ে রিপোর্ট চলে আসবে।",
  },
  {
    icon: IconShield,
    title: "কুরিয়ার রিপোর্ট",
    desc: "কোন কুরিয়ারে কতটি অর্ডার, কতটি ডেলিভারি ও রিটার্ন, সাকসেস রেট ও ট্রাস্ট স্কোর — এক নজরে।",
  },
];

const FEATURES = [
  { icon: IconFile, title: "Excel, CSV, PDF ও টেক্সট", desc: "বাংলা/ইংরেজি হেডার, বাংলা সংখ্যা (০১৭…), +880 — সব ফরম্যাট চেনে। WhatsApp অর্ডার মেসেজও পেস্ট করা যায়।" },
  { icon: IconBolt, title: "দৈনিক লিমিট বাঁচানো ক্যাশ", desc: "একই নম্বর ২৪ ঘণ্টার মধ্যে আবার দেখলে সংরক্ষিত রিপোর্ট দেখায় — আপনার ১১০টি দৈনিক কল নষ্ট হয় না।" },
  { icon: IconUsers, title: "এক ক্লিকে পুরো পেজ চেক", desc: "তালিকার সব আন-চেকড কাস্টমার একসাথে চেক করুন — লিমিট অনুযায়ী নিজে থেকেই থামবে।" },
  { icon: IconDatabase, title: "Supabase PostgreSQL ডাটাবেজ", desc: "অন্য কোনো ডাটাবেজ সার্ভার লাগবে না। Supabase-এর ফ্রি plan-এ সব ডেটা থাকে, টেবিল নিজে তৈরি হয়।" },
  { icon: IconKey, title: "Key থাকে .env-এ", desc: "API key ও Secret key শুধু সার্ভারের .env ফাইলে — ব্রাউজারে কখনো যায় না। নতুন অ্যাকাউন্ট হলে শুধু key বদলান।" },
  { icon: IconShield, title: "পাসওয়ার্ড-সুরক্ষিত প্যানেল", desc: "কাস্টমারের তথ্য ও API কোটা লগইন দিয়ে সুরক্ষিত — বাইরের কেউ আপনার ডেটা দেখতে বা কোটা খরচ করতে পারবে না।" },
];

const FAQ = [
  {
    q: "দৈনিক ১১০টি লিমিট শেষ হলে কী হবে?",
    a: "প্যানেল নিজে থেকেই লাইভ কল বন্ধ করে দেয় এবং আগের সংরক্ষিত রিপোর্ট দেখায়। রাত ১২টার পর আবার শুরু হয়। চাইলে নতুন অ্যাকাউন্টের key .env-এ বসিয়ে সাথে সাথে আবার চালু করতে পারেন।",
  },
  {
    q: "নতুন fraud.bd অ্যাকাউন্টের key কোথায় বসাব?",
    a: "প্রজেক্টের .env ফাইলে FRAUDBD_API_KEY, FRAUDBD_SECRET_KEY ও FRAUDBD_AUTHORIZED_DOMAIN বদলে অ্যাপ রিস্টার্ট করুন। কোডে কিছু পরিবর্তন করতে হবে না।",
  },
  {
    q: "ডেটা কোথায় থাকে? অন্য কেউ নিতে পারবে?",
    a: "সব কাস্টмор ও চেকের রেকর্ড আপনার Supabase (PostgreSQL) ডাটাবেজে থাকে। প্যানেল পাসওয়ার্ড দিয়ে সুরক্ষিত এবং API key কখনো ব্রাউজারে পাঠানো হয় না।",
  },
  {
    q: "PDF থেকে কি নাম-ঠিকানা আসবে?",
    a: "কম্পিউটারে তৈরি (টেক্সট) PDF থেকে নম্বর, নাম ও ঠিকানা আলাদা করা হয়। স্ক্যান করা ছবি-PDF-এ টেক্সট থাকে না — সেক্ষেত্রে Excel/CSV সবচেয়ে নির্ভুল।",
  },
];

export default async function HomePage() {
  const session = await getSession();
  const sample = normalizeFraudbdResponse(SAMPLE_API_RESPONSE, "01711124851");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section id="top" className="relative pb-12 pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] grid-overlay" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="bn inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-emerald-300 ring-1 ring-emerald-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-ring" />
            fraud.bd API ইন্টিগ্রেটেড · Supabase PostgreSQL · Excel/PDF ইমপোর্ট
          </div>
          <h1 className="bn mt-6 text-balance text-4xl font-extrabold leading-[1.2] tracking-tight text-white sm:text-5xl">
            কাস্টমার লিস্ট আপলোড করুন,
            <span className="mt-1 block text-gradient">এক ক্লিকে কুরিয়ার রেকর্ড দেখুন</span>
          </h1>
          <p className="bn mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            আর নম্বর টাইপ করে “যাচাই করুন” চাপতে হবে না। Excel বা PDF থেকে সব কাস্টমার একবারে ইমপোর্ট করুন — প্রতিটি
            নম্বরের পাশে 🔍 বাটনে ক্লিক করলেই আপনার fraud.bd API দিয়ে দেখাবে কোন কুরিয়ারে কতটি অর্ডার সম্পন্ন হয়েছে।
          </p>

          <div className="mx-auto mt-8 max-w-2xl text-left">
            <SearchBox />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={session ? "/customers" : "/login?next=/customers"}
              className="bn rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#04060d] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
            >
              {session ? "সকল কাস্টমার দেখুন →" : "মার্চেন্ট প্যানেলে লগইন →"}
            </Link>
            <Link
              href="#sample"
              className="bn rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              নমুনা রিপোর্ট দেখুন
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-24">
        <h2 className="bn text-2xl font-extrabold text-white sm:text-3xl">
          কীভাবে কাজ করে <span className="text-sm font-medium text-slate-400">/ How it works</span>
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="glass relative overflow-hidden rounded-2xl p-5">
              <span className="absolute -right-1 -top-4 text-6xl font-black text-white/5">0{index + 1}</span>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="bn mt-4 text-base font-bold text-white">{step.title}</h3>
              <p className="bn mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="sample" className="mt-16 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="bn text-2xl font-extrabold text-white sm:text-3xl">নমুনা রিপোর্ট</h2>
            <p className="bn mt-1 text-sm text-slate-400">
              🔍 চাপলে প্রতিটি কাস্টমারের জন্য ঠিক এই রিপোর্টটি দেখাবে (fraud.bd-এর আসল রেসপন্স থেকে তৈরি)।
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-400 ring-1 ring-white/10">
            phone masked for privacy
          </span>
        </div>
        <div className="mt-6">
          {sample ? <CourierReportCard report={sample} variant="full" source="sample" mask /> : null}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="bn text-2xl font-extrabold text-white sm:text-3xl">
          যা যা পাচ্ছেন <span className="text-sm font-medium text-slate-400">/ Features</span>
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass rounded-2xl p-5 transition hover:border-emerald-400/30">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="bn mt-4 text-base font-bold text-white">{feature.title}</h3>
              <p className="bn mt-2 text-sm leading-relaxed text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h2 className="bn text-xl font-extrabold text-white">কুরিয়ার কভারেজ</h2>
          <p className="bn mt-1 text-sm text-slate-400">fraud.bd-এর মাধ্যমে বাংলাদেশের প্রধান কুরিয়ারগুলোর সমন্বিত রেকর্ড।</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUPPORTED_COURIERS.map((courier) => (
              <span key={courier} className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
                {courier}
              </span>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-2xl p-6">
          <h2 className="bn text-xl font-extrabold text-white">সব সেটিং একটি .env ফাইলে</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black/50 p-4 text-[12px] leading-relaxed text-slate-300 ring-1 ring-white/10">
{`DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-xxx.pooler.supabase.com:6543/postgres?sslmode=require
FRAUDBD_API_KEY=RKR_PUB_••••••••••••
FRAUDBD_SECRET_KEY=RKR_SEC_••••••••••••
FRAUDBD_AUTHORIZED_DOMAIN=your-domain
FRAUDBD_DAILY_LIMIT=110
ADMIN_PASSWORD=••••••••`}
          </pre>
          <p className="bn mt-3 text-xs leading-relaxed text-slate-400">
            ৩০ দিনের ফ্রি প্ল্যান শেষ? নতুন অ্যাকাউন্ট খুলে শুধু key দুটি বদলে দিন — বাকি সব আগের মতোই চলবে।
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="bn text-2xl font-extrabold text-white sm:text-3xl">
          প্রশ্নোত্তর <span className="text-sm font-medium text-slate-400">/ FAQ</span>
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="glass group rounded-2xl p-5">
              <summary className="bn cursor-pointer list-none text-base font-bold text-white">
                <span className="mr-2 text-emerald-400 group-open:hidden">+</span>
                <span className="mr-2 hidden text-emerald-400 group-open:inline">−</span>
                {item.q}
              </summary>
              <p className="bn mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-sky-500/10 to-transparent p-8 ring-1 ring-emerald-400/25">
          <div className="relative z-10 max-w-2xl">
            <h2 className="bn text-2xl font-extrabold text-white sm:text-3xl">আজই কাস্টমার লিস্ট আপলোড করুন</h2>
            <p className="bn mt-3 text-sm leading-relaxed text-slate-200">
              ফাইল দিন → তালিকা দেখুন → 🔍 চাপুন। ফেক অর্ডার ও পার্সেল রিটার্নের ক্ষতি কমান।
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={session ? "/upload" : "/login?next=/upload"}
                className="bn rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#04060d] transition hover:bg-emerald-300"
              >
                ফাইল আপলোড করুন
              </Link>
              <Link
                href={session ? "/customers" : "/login?next=/customers"}
                className="bn rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                সকল কাস্টমার
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>
      </section>
    </main>
  );
}
