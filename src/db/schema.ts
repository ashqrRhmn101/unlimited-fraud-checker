import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * The single, canonical schema — PostgreSQL (Supabase compatible).
 * The app auto-creates these tables on first start (src/db/bootstrap.ts);
 * alternatively run `npx drizzle-kit push`.
 */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    name: varchar("name", { length: 191 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    area: varchar("area", { length: 120 }),
    altPhones: varchar("alt_phones", { length: 255 }),
    note: text("note"),
    source: varchar("source", { length: 20 }).notNull().default("manual"),
    uploadId: integer("upload_id"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    checkTotal: integer("check_total"),
    checkDelivered: integer("check_delivered"),
    checkCancelled: integer("check_cancelled"),
    checkRate: integer("check_rate"),
    checkLevel: varchar("check_level", { length: 20 }),
    checkTier: varchar("check_tier", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_phone_unique").on(table.phone),
    index("customers_created_idx").on(table.createdAt),
    index("customers_checked_idx").on(table.lastCheckedAt),
  ],
);

export const courierChecks = pgTable(
  "courier_checks",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    ok: boolean("ok").notNull().default(false),
    httpStatus: integer("http_status"),
    totalOrders: integer("total_orders"),
    delivered: integer("delivered"),
    cancelled: integer("cancelled"),
    successRate: integer("success_rate"),
    riskLevel: varchar("risk_level", { length: 20 }),
    trustTier: varchar("trust_tier", { length: 40 }),
    reportJson: text("report_json"),
    rawJson: text("raw_json"),
    errorMessage: text("error_message"),
    origin: varchar("origin", { length: 10 }).notNull().default("api"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("courier_checks_phone_idx").on(table.phone, table.createdAt),
    index("courier_checks_created_idx").on(table.createdAt),
  ],
);

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  fileSize: integer("file_size").notNull().default(0),
  rowsScanned: integer("rows_scanned").notNull().default(0),
  found: integer("found").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  settingKey: varchar("setting_key", { length: 100 }).primaryKey(),
  settingValue: text("setting_value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cached result of "is this number on WhatsApp / Telegram?" lookups.
 * Populated only when PRESENCE_API_URL is configured (see src/lib/presence.ts);
 * without an API the UI simply offers deep-link buttons into the apps.
 */
export const presenceChecks = pgTable(
  "presence_checks",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 20 }).notNull(),
    present: boolean("present"),
    raw: text("raw"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("presence_checks_phone_provider_unique").on(table.phone, table.provider)],
);
