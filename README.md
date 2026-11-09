# FraudBD Merchant Panel

কাস্টমর লিস্ট (Excel / CSV / PDF) আপলোড করুন। “সব কাস্টমর” পেজে 10 জন করে দেখা যায়। প্রতিবার number-এর পাশে 🔍 বাটনে ক্লিক করলে fraud.bd API দিয়ে oi number-এর সব courier রেকর্ড দেখা যায়। সব ডেটা থাকে **Supabase (PostgreSQL)** ডাটাবেজে। MySQL / XAMPP / অন্য কোনো সার্ভার লাগে না।

---

## ফিচার তালিকা

| | |
|---|---|
| 📥 Import | Excel (.xlsx/.xls/.ods), CSV, PDF, WhatsApp অর্ডার মেসেজ পেস্ট |
| 🧠 Smart কলাম | Name/নাম, Mobile/মোবাইল, Address/ঠিকানা, District/জেলা — অটো চিনে নেয় |
| ☎️ নম্বর-ফরম্যাট | `01711-124851`, `+8801711124851`, `০১১...` — সব ফরম্যাট নর্মালাইজ হয় |
| 👥 কাস্টমর লিস্ট | 10 জন করে + "See More", সার্চ, ফিল্টার, CSV export |
| 🔍 এক ক্লিকে চেক | প্রতিবার number-এর পাশে button — fraud.bd API key অটো use হয় |
| 💬 কন্ট্যাক্ট বাটন | WhatsApp / Telegram / Call / SMS আইকন বাটন, ক্লিক করলে অ্যাপে যায় |
| 🟢 Presence dot | optional API set korle green/red dot-e dekha jay number-ti app-e ache kina |
| 💾 কোটা বাঁ্যানো | একই নম্বর 24h cache — দৈনিক 110 call বাঁ্চে |
| 🔐 নিরাপত্তা | পাসওয়ার্ড প্যানেল, rate-limited login, API key শুধু .env-তে |
| 🗄️ ডাটাবেজ | Supabase PostgreSQL, টেবিল অটো তেরি হয় |
| 📱 mobile-first | সব device-ন responsive |

---

## 1. Supabase সেট্যাপ

## 2. `.env` সেট করুন

## 3. চালু করুন

```bash
npm install
npm run build
npm start        # http://localhost:3000
```

## 4. Vercel-ত হোস্ট (optional)

Vercel → Import repo → Environment Variables-ত .env-এর value দিন → Deploy। Supabase + Vercel = কোনো সার্ভার maintain korte hobe na।

---

##  API কিভাবে kaj করে

```
Headers: RKR-API-KEY, RKR-SECRET-KEY, Origin: https://<authorized-domain>
Body:    {"phone": "01711124851"}
```

- Origin header authorized domain-এর সাথে MUST মিলতে হতে, না hole fraud.bd block করে।
- Call সার্ভার থেকে হয় (`/api/check`), key kokhono browser-ত যায় না।
- Response: `{ success, data: { phone, overall_stats, advice, courier_breakdown, trust_tier } }`

### কোটা বাঁ্যানো

- একই number-এর result **24h cache** — abar dekhele 0 API call।
- Daily limit sesh hole live call off hoy, last saved report dekha jay. Midnight (BD time)-e reset hoy।
- "sob check korun" button diye page-er sob customer eksathe check hoy, limit onujayi nijei thame।

---

## WhatsApp / Telegram / Call / SMS বাটন (নতুন ফিচার)

নম্বর-এর নিচে আইকন বাটন:

| বাটন | Link | Behavior |
|---|---|---|
| 🟢 WhatsApp | `https://wa.me/8801XXXXXXXXX?text=...` | WhatsApp অ্যাপে চ্যাট খোলে; na thakle "invite" dekhai |
| 🔵 Telegram | `https://t.me/+8801XXXXXXXXX` | registered hole Telegram-ত jay |
| 📞 Call | `tel:+8801XXXXXXXXX` | dialer খোলে |
| ✉️ SMS | `sms:+8801XXXXXXXXX` | SMS অ্যাপ খোলে |

- **কোনো API key লাগে না** — deep links অটো kaj kore।
- **Presence detection** (নম্বরটি অ্যাপে আছে কিনা) optional: `.env`-ত set করুন:


Result `presence_checks` table-ত cache hoy. Set na thakle shudhu buttons thake; button-e click korle app-ei bujha jabe. Note: WhatsApp officially kono public "number exists" API dey na — paid third-party provider lagbe.

- **অন্য কোনো সাইটের বাটন** add korte `src/lib/contact.ts` er `CONTACT_SITES` array-তে entry jog korlei UI-তে automatically ashe।

---


## নিরাপত্তা

- Sob private page/API login chara 401/redirect dey.
- Session cookie: HMAC signed, httpOnly, sameSite=lax, https-e secure; 30 din.
- Login: 10 attempt / 5 min / IP rate limit.
- Sob SQL Drizzle bound parameters ($1...) diye — user input diye SQL toiri hoy na.
- Upload: extension whitelist, 15 MB cap, 20k row cap.
- Headers: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy. robots noindex. compress on.
- Keys shudhu .env-e; dashboard-e masked dekha jay.

## পার্ফর্ম্যান্স

- Compression on; heavy parsers dynamic import.
- Pagination (max 100/request), prefetch off on check links, DB indexes.
- Check + presence results 24h DB cache.

## মোবাইল-ফার্স্ট রেসপনসিভ

Header nav mobile-ত scroll hoy; table horizontal scroll; card stack kore; report card mobile-ত column; touch target 40px+.

---


## লেকাল ডেভেলপমেন্ট

```bash
cp .env.example .env     # value edit korun
npm install
npm run dev
```
👨‍💻 Developer
Md. Lavib Uddin Ashik
GitHub: @ashqrRhmn101
Live Project:

Made with lots of love for clean APIs and happy pets

#fraubd #NodeJS #Express #MongoDB #Backend #FullStack #MERN
