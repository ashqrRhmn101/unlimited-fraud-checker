import { sql } from "drizzle-orm";

import { execute, queryRows } from "@/db";
import { levelFor, normalizeFraudbdResponse } from "@/lib/courier";
import { normalizePhone } from "@/lib/phone";
import { SAMPLE_API_RESPONSE, SAMPLE_PHONE } from "@/lib/sample-report";

/**
 * Self-installing database: on the first request the app creates every table it
 * needs in PostgreSQL (Supabase or local). No manual migration step required —
 * alternatively run `npx drizzle-kit push` with the same schema.
 */

const DDL = [
  `CREATE TABLE IF NOT EXISTS customers (
    id serial PRIMARY KEY NOT NULL,
    phone varchar(20) NOT NULL,
    name varchar(191),
    address text,
    city varchar(100),
    area varchar(120),
    alt_phones varchar(255),
    note text,
    source varchar(20) DEFAULT 'manual' NOT NULL,
    upload_id integer,
    last_checked_at timestamp with time zone,
    check_total integer,
    check_delivered integer,
    check_cancelled integer,
    check_rate integer,
    check_level varchar(20),
    check_tier varchar(40),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers USING btree (phone)`,
  `CREATE INDEX IF NOT EXISTS customers_created_idx ON customers USING btree (created_at)`,
  `CREATE INDEX IF NOT EXISTS customers_checked_idx ON customers USING btree (last_checked_at)`,
  `CREATE INDEX IF NOT EXISTS customers_name_idx ON customers USING btree (lower(name))`,
  `CREATE TABLE IF NOT EXISTS courier_checks (
    id serial PRIMARY KEY NOT NULL,
    phone varchar(20) NOT NULL,
    ok boolean DEFAULT false NOT NULL,
    http_status integer,
    total_orders integer,
    delivered integer,
    cancelled integer,
    success_rate integer,
    risk_level varchar(20),
    trust_tier varchar(40),
    report_json text,
    raw_json text,
    error_message text,
    origin varchar(10) DEFAULT 'api' NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS courier_checks_phone_idx ON courier_checks USING btree (phone, created_at)`,
  `CREATE INDEX IF NOT EXISTS courier_checks_created_idx ON courier_checks USING btree (created_at)`,
  `CREATE TABLE IF NOT EXISTS uploads (
    id serial PRIMARY KEY NOT NULL,
    file_name varchar(255) NOT NULL,
    file_type varchar(20) NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    rows_scanned integer DEFAULT 0 NOT NULL,
    found integer DEFAULT 0 NOT NULL,
    inserted integer DEFAULT 0 NOT NULL,
    updated integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    setting_key varchar(100) PRIMARY KEY NOT NULL,
    setting_value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS presence_checks (
    id serial PRIMARY KEY NOT NULL,
    phone varchar(20) NOT NULL,
    provider varchar(20) NOT NULL,
    present boolean,
    raw text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS presence_checks_phone_provider_unique ON presence_checks USING btree (phone, provider)`,
];

const DEMO_CUSTOMERS: [name: string, phone: string, address: string, city: string, area: string][] = [
  ["Rakibul Hasan", "01711124851", "House 42, Road 5, Mirpur 10", "Dhaka", "Mirpur"],
  ["Sumaiya Akter", "01898765432", "Flat 3B, Agrabad C/A", "Chattogram", "Agrabad"],
  ["Tanvir Ahmed", "01612345678", "27 Zindabazar Main Road", "Sylhet", "Zindabazar"],
  ["Nusrat Jahan", "01911223344", "Road 12, Sector 7, Uttara", "Dhaka", "Uttara"],
  ["Mehedi Hasan", "01556677889", "Sonadanga R/A, Block B, House 9", "Khulna", "Sonadanga"],
  ["Farzana Akter", "01787654321", "Shaheb Bazar, Ghoramara", "Rajshahi", "Boalia"],
  ["Sabbir Rahman", "01334455667", "Nathullabad Bus Stand Road", "Barishal", "Sadar"],
  ["Tasnim Islam", "01445566778", "Station Road, Rangpur Sadar", "Rangpur", "Sadar"],
  ["Imran Hossain", "01822334455", "Kandirpar, Jhawtola Lane 3", "Cumilla", "Sadar"],
  ["Jannatul Ferdous", "01977889900", "Chashara, BB Road", "Narayanganj", "Sadar"],
  ["Rifat Chowdhury", "01688990011", "Board Bazar, Gazipur City", "Gazipur", "Tongi"],
  ["Mim Rahman", "01399887766", "Charmatha, Bogura Sadar", "Bogura", "Sadar"],
  ["Shakib Khan", "01711998877", "Dhanmondi 27, Road 16, House 4", "Dhaka", "Dhanmondi"],
  ["Oishi Barua", "01866554433", "Panchlaish R/A, Road 3", "Chattogram", "Panchlaish"],
  ["Arif Billah", "01922446688", "Kewatkhali, Mymensingh Sadar", "Mymensingh", "Sadar"],
];

let readyPromise: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!readyPromise) {
    readyPromise = initialise().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

async function initialise(): Promise<void> {
  for (const statement of DDL) await execute(sql.raw(statement));
  await seedDemoData();
}

export async function readSetting(key: string): Promise<string | null> {
  const rows = await queryRows<{ setting_value: string | null }>(
    sql`SELECT setting_value FROM app_settings WHERE setting_key = ${key}`,
  );
  return rows[0]?.setting_value ?? null;
}

export async function writeSetting(key: string, value: string): Promise<void> {
  const now = new Date();
  await execute(
    sql`INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (${key}, ${value}, ${now})
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at`,
  );
}

async function seedDemoData(): Promise<void> {
  if (await readSetting("demo_seeded")) return;

  const [countRow] = await queryRows<{ c: number | string }>(sql`SELECT COUNT(*) AS c FROM customers`);
  const hasCustomers = Number(countRow?.c ?? 0) > 0;
  const enabled = (process.env.SEED_DEMO_DATA ?? "false").trim().toLowerCase() === "true";

  if (enabled && !hasCustomers) {
    const now = Date.now();
    const values = DEMO_CUSTOMERS.map(([name, phone, address, city, area], index) => {
      const createdAt = new Date(now - index * 60_000);
      return sql`(${normalizePhone(phone)}, ${name}, ${address}, ${city}, ${area}, ${"demo"}, ${createdAt}, ${createdAt})`;
    });
    await execute(
      sql`INSERT INTO customers (phone, name, address, city, area, source, created_at, updated_at) VALUES ${sql.join(values, sql`, `)}`,
    );

    // One real fraud.bd result (captured during development) so the demo shows a
    // finished report without spending API quota. origin='demo' → not counted.
    const report = normalizeFraudbdResponse(SAMPLE_API_RESPONSE, "01711124851");
    if (report) {
      const checkedAt = new Date(now - 2 * 3600_000);
      const level = levelFor(report.total, report.successRate);
      await execute(
        sql`INSERT INTO courier_checks (phone, ok, http_status, total_orders, delivered, cancelled, success_rate, risk_level, trust_tier, report_json, raw_json, error_message, origin, duration_ms, created_at)
            VALUES (${SAMPLE_PHONE}, ${true}, ${200}, ${report.total}, ${report.delivered}, ${report.cancelled}, ${report.successRate}, ${level}, ${report.trustTier}, ${JSON.stringify(report)}, ${JSON.stringify(SAMPLE_API_RESPONSE)}, ${null}, ${"demo"}, ${0}, ${checkedAt})`,
      );
      await execute(
        sql`UPDATE customers SET last_checked_at = ${checkedAt}, check_total = ${report.total}, check_delivered = ${report.delivered},
            check_cancelled = ${report.cancelled}, check_rate = ${report.successRate}, check_level = ${level}, check_tier = ${report.trustTier}
            WHERE phone = ${SAMPLE_PHONE}`,
      );
    }
  }

  await writeSetting("demo_seeded", new Date().toISOString());
}
