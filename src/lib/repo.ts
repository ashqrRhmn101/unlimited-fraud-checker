import { sql, type SQL } from "drizzle-orm";

import { describeDatabaseUrl, execute, insertReturningId, queryRows } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";
import { levelFor, parseStoredReport, type CourierReport } from "@/lib/courier";
import { getFraudbdConfig } from "@/lib/fraudbd";
import type { ImportedCustomer } from "@/lib/importers";
import { toAsciiDigits } from "@/lib/phone";
import type { CustomerCounts, CustomerDTO, CustomerFilter, CustomerSort, UsageDTO } from "@/lib/types";

type Row = Record<string, unknown>;

/* ───────────────────────── value helpers ───────────────────────── */

export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  // pg returns timestamptz as Date; plain timestamp strings are read as UTC.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const toIso = (value: unknown) => toDate(value)?.toISOString() ?? null;
const toStr = (value: unknown) => (value === null || value === undefined ? null : String(value));
const toInt = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : Number(value);
const toBool = (value: unknown) => value === true || value === 1 || value === "1" || value === "t";

function clip(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Start of the current day in Bangladesh time (UTC+6) — quota resets here. */
export function dhakaDayStart(now: Date = new Date()): Date {
  const offset = 6 * 3600_000;
  const local = new Date(now.getTime() + offset);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset);
}

/* ───────────────────────── customers ───────────────────────── */

const CUSTOMER_COLUMNS = sql.raw(
  "id, phone, name, address, city, area, alt_phones, note, source, upload_id, created_at, updated_at, last_checked_at, check_total, check_delivered, check_cancelled, check_rate, check_level, check_tier",
);

function mapCustomer(row: Row): CustomerDTO {
  return {
    id: Number(row.id),
    phone: String(row.phone),
    name: toStr(row.name),
    address: toStr(row.address),
    city: toStr(row.city),
    area: toStr(row.area),
    altPhones: toStr(row.alt_phones),
    note: toStr(row.note),
    source: String(row.source ?? "manual"),
    uploadId: toInt(row.upload_id),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastCheckedAt: toIso(row.last_checked_at),
    checkTotal: toInt(row.check_total),
    checkDelivered: toInt(row.check_delivered),
    checkCancelled: toInt(row.check_cancelled),
    checkRate: toInt(row.check_rate),
    checkLevel: toStr(row.check_level),
    checkTier: toStr(row.check_tier),
  };
}

function filterSql(filter: CustomerFilter): SQL | null {
  switch (filter) {
    case "unchecked":
      return sql`last_checked_at IS NULL`;
    case "checked":
      return sql`last_checked_at IS NOT NULL`;
    case "good":
      return sql`(check_total > 0 AND check_rate >= 85)`;
    case "risky":
      return sql`(check_total > 0 AND check_rate < 70)`;
    case "new":
      return sql`(last_checked_at IS NOT NULL AND check_total = 0)`;
    default:
      return null;
  }
}

function searchSql(query: string): SQL | null {
  const term = query.trim().replace(/[%_\\]/g, "").slice(0, 80);
  if (!term) return null;
  const like = `%${term.toLowerCase()}%`;
  const parts: SQL[] = [
    sql`LOWER(name) LIKE ${like}`,
    sql`LOWER(address) LIKE ${like}`,
    sql`LOWER(city) LIKE ${like}`,
    sql`LOWER(area) LIKE ${like}`,
  ];
  const digits = toAsciiDigits(term).replace(/\D/g, "");
  if (digits.length >= 3) {
    const local = digits.replace(/^880/, "").replace(/^0/, "");
    parts.push(sql`phone LIKE ${`%${local}%`}`);
  }
  return sql`(${sql.join(parts, sql` OR `)})`;
}

function whereSql(conditions: (SQL | null)[]): SQL {
  const list = conditions.filter((item): item is SQL => item !== null);
  return list.length > 0 ? sql`WHERE ${sql.join(list, sql` AND `)}` : sql``;
}

function orderSql(sort: CustomerSort): SQL {
  switch (sort) {
    case "old":
      return sql.raw("ORDER BY created_at ASC, id ASC");
    case "name":
      return sql.raw("ORDER BY (name IS NULL) ASC, name ASC, id ASC");
    case "risk":
      return sql.raw("ORDER BY (check_rate IS NULL) ASC, check_rate ASC, check_total DESC, id ASC");
    default:
      return sql.raw("ORDER BY created_at DESC, id ASC");
  }
}

export const CUSTOMER_FILTERS: CustomerFilter[] = ["all", "unchecked", "checked", "good", "risky", "new"];
export const CUSTOMER_SORTS: CustomerSort[] = ["new", "old", "name", "risk"];

export async function listCustomers(options: {
  offset?: unknown;
  limit?: unknown;
  q?: string | null;
  filter?: string | null;
  sort?: string | null;
}) {
  await ensureDatabase();
  const limit = clampInt(options.limit, 1, 100, 10);
  const offset = clampInt(options.offset, 0, 10_000_000, 0);
  const filter = CUSTOMER_FILTERS.includes(options.filter as CustomerFilter)
    ? (options.filter as CustomerFilter)
    : "all";
  const sort = CUSTOMER_SORTS.includes(options.sort as CustomerSort) ? (options.sort as CustomerSort) : "new";
  const where = whereSql([filterSql(filter), searchSql(options.q ?? "")]);

  const rows = await queryRows<Row>(
    sql`SELECT ${CUSTOMER_COLUMNS} FROM customers ${where} ${orderSql(sort)} LIMIT ${sql.raw(String(limit))} OFFSET ${sql.raw(String(offset))}`,
  );
  const [countRow] = await queryRows<Row>(sql`SELECT COUNT(*) AS c FROM customers ${where}`);
  const total = Number(countRow?.c ?? 0);

  return {
    items: rows.map(mapCustomer),
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
  };
}

export async function getCustomerCounts(): Promise<CustomerCounts> {
  await ensureDatabase();
  const [row] = await queryRows<Row>(sql`
    SELECT COUNT(*) AS all_count,
      SUM(CASE WHEN last_checked_at IS NULL THEN 1 ELSE 0 END) AS unchecked,
      SUM(CASE WHEN last_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS checked,
      SUM(CASE WHEN check_total > 0 AND check_rate >= 85 THEN 1 ELSE 0 END) AS good,
      SUM(CASE WHEN check_total > 0 AND check_rate < 70 THEN 1 ELSE 0 END) AS risky,
      SUM(CASE WHEN last_checked_at IS NOT NULL AND check_total = 0 THEN 1 ELSE 0 END) AS no_record,
      SUM(CASE WHEN source = 'demo' THEN 1 ELSE 0 END) AS demo
    FROM customers`);
  return {
    all: Number(row?.all_count ?? 0),
    unchecked: Number(row?.unchecked ?? 0),
    checked: Number(row?.checked ?? 0),
    good: Number(row?.good ?? 0),
    risky: Number(row?.risky ?? 0),
    noRecord: Number(row?.no_record ?? 0),
    demo: Number(row?.demo ?? 0),
  };
}

export async function getCustomerByPhone(phone: string): Promise<CustomerDTO | null> {
  await ensureDatabase();
  const rows = await queryRows<Row>(sql`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE phone = ${phone} LIMIT 1`);
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function getCustomerById(id: number): Promise<CustomerDTO | null> {
  await ensureDatabase();
  const rows = await queryRows<Row>(sql`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ${id} LIMIT 1`);
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function saveManualCustomer(input: {
  phone: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  note?: string | null;
  source?: string;
}): Promise<{ customer: CustomerDTO; created: boolean }> {
  await ensureDatabase();
  const now = new Date();
  const values = {
    name: clip(input.name, 191),
    address: clip(input.address, 2000),
    city: clip(input.city, 100),
    area: clip(input.area, 120),
    note: clip(input.note, 2000),
  };
  const existing = await getCustomerByPhone(input.phone);
  if (existing) {
    const patch: SQL[] = [];
    if (values.name) patch.push(sql`name = ${values.name}`);
    if (values.address) patch.push(sql`address = ${values.address}`);
    if (values.city) patch.push(sql`city = ${values.city}`);
    if (values.area) patch.push(sql`area = ${values.area}`);
    if (values.note) patch.push(sql`note = ${values.note}`);
    if (existing.source === "demo") patch.push(sql`source = ${input.source ?? "manual"}`);
    if (patch.length > 0) {
      await execute(sql`UPDATE customers SET ${sql.join(patch, sql`, `)}, updated_at = ${now} WHERE id = ${existing.id}`);
    }
    return { customer: (await getCustomerById(existing.id)) ?? existing, created: false };
  }

  const id = await insertReturningId(
    sql`INSERT INTO customers (phone, name, address, city, area, note, source, created_at, updated_at)
        VALUES (${input.phone}, ${values.name}, ${values.address}, ${values.city}, ${values.area}, ${values.note}, ${input.source ?? "manual"}, ${now}, ${now})`,
  );
  const customer = id ? await getCustomerById(id) : await getCustomerByPhone(input.phone);
  if (!customer) throw new Error("Customer could not be saved");
  return { customer, created: true };
}

export async function importCustomers(
  list: ImportedCustomer[],
  meta: { fileName: string; fileType: string; fileSize: number; rowsScanned: number; skipped: number },
): Promise<{ uploadId: number; inserted: number; updated: number; unchanged: number }> {
  await ensureDatabase();
  const now = new Date();
  const source = ["excel", "csv", "pdf", "text"].includes(meta.fileType) ? meta.fileType : "manual";

  const uploadId = await insertReturningId(
    sql`INSERT INTO uploads (file_name, file_type, file_size, rows_scanned, found, inserted, updated, skipped, created_at)
        VALUES (${clip(meta.fileName, 255) ?? "upload"}, ${source}, ${Math.round(meta.fileSize)}, ${meta.rowsScanned}, ${list.length}, ${0}, ${0}, ${meta.skipped}, ${now})`,
  );

  const existing = new Map<string, Row>();
  for (const phones of chunk(list.map((item) => item.phone), 500)) {
    const rows = await queryRows<Row>(
      sql`SELECT id, phone, name, address, city, area, alt_phones, note, source FROM customers WHERE phone IN (${sql.join(
        phones.map((phone) => sql`${phone}`),
        sql`, `,
      )})`,
    );
    for (const row of rows) existing.set(String(row.phone), row);
  }

  const fresh = list.filter((item) => !existing.has(item.phone));
  let inserted = 0;
  for (const batch of chunk(fresh, 200)) {
    const values = sql.join(
      batch.map(
        (item) =>
          sql`(${item.phone}, ${clip(item.name, 191)}, ${clip(item.address, 2000)}, ${clip(item.city, 100)}, ${clip(item.area, 120)}, ${clip(item.altPhones, 255)}, ${clip(item.note, 2000)}, ${source}, ${uploadId || null}, ${now}, ${now})`,
      ),
      sql`, `,
    );
    const columns = sql.raw(
      "(phone, name, address, city, area, alt_phones, note, source, upload_id, created_at, updated_at)",
    );
    const result = await execute(
      sql`INSERT INTO customers ${columns} VALUES ${values} ON CONFLICT (phone) DO NOTHING`,
    );
    inserted += result.affectedRows;
  }

  let updated = 0;
  let unchanged = 0;
  for (const item of list) {
    const row = existing.get(item.phone);
    if (!row) continue;
    const candidates: [string, string | null][] = [
      ["name", clip(item.name, 191)],
      ["address", clip(item.address, 2000)],
      ["city", clip(item.city, 100)],
      ["area", clip(item.area, 120)],
      ["alt_phones", clip(item.altPhones, 255)],
      ["note", clip(item.note, 2000)],
    ];
    const patch = candidates
      .filter(([column, value]) => value && value !== toStr(row[column]))
      .map(([column, value]) => sql`${sql.raw(column)} = ${value}`);
    if (String(row.source) === "demo") patch.push(sql`source = ${source}`);
    if (patch.length === 0) {
      unchanged += 1;
      continue;
    }
    await execute(sql`UPDATE customers SET ${sql.join(patch, sql`, `)}, updated_at = ${now} WHERE id = ${Number(row.id)}`);
    updated += 1;
  }

  if (uploadId) {
    await execute(sql`UPDATE uploads SET inserted = ${inserted}, updated = ${updated} WHERE id = ${uploadId}`);
  }
  return { uploadId, inserted, updated, unchanged };
}

export async function deleteCustomerById(id: number): Promise<number> {
  await ensureDatabase();
  const result = await execute(sql`DELETE FROM customers WHERE id = ${id}`);
  return result.affectedRows;
}

export async function deleteCustomersByScope(scope: "demo" | "all"): Promise<number> {
  await ensureDatabase();
  const result =
    scope === "demo"
      ? await execute(sql`DELETE FROM customers WHERE source = ${"demo"}`)
      : await execute(sql`DELETE FROM customers`);
  return result.affectedRows;
}

export async function listCustomersForExport(): Promise<CustomerDTO[]> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT ${CUSTOMER_COLUMNS} FROM customers ORDER BY created_at DESC, id ASC LIMIT 50000`,
  );
  return rows.map(mapCustomer);
}

/* ───────────────────────── courier checks ───────────────────────── */

export interface StoredCheck {
  id: number;
  phone: string;
  report: CourierReport;
  raw: string | null;
  origin: string;
  createdAt: string;
}

export async function getLatestCheck(phone: string): Promise<StoredCheck | null> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT id, phone, report_json, raw_json, origin, created_at FROM courier_checks
        WHERE phone = ${phone} AND ok = ${true} ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  const report = parseStoredReport(toStr(row.report_json));
  const createdAt = toIso(row.created_at);
  if (!report || !createdAt) return null;
  return {
    id: Number(row.id),
    phone: String(row.phone),
    report,
    raw: toStr(row.raw_json),
    origin: String(row.origin ?? "api"),
    createdAt,
  };
}

export async function saveCheck(input: {
  phone: string;
  ok: boolean;
  httpStatus: number | null;
  report: CourierReport | null;
  raw: unknown;
  error: string | null;
  durationMs: number;
  origin: "api" | "demo";
  createdAt?: Date;
}): Promise<void> {
  await ensureDatabase();
  const createdAt = input.createdAt ?? new Date();
  const report = input.report;
  const level = report ? levelFor(report.total, report.successRate) : null;
  let raw: string | null = null;
  if (input.raw !== null && input.raw !== undefined) {
    raw = (typeof input.raw === "string" ? input.raw : JSON.stringify(input.raw)).slice(0, 60000);
  }

  await execute(
    sql`INSERT INTO courier_checks (phone, ok, http_status, total_orders, delivered, cancelled, success_rate, risk_level, trust_tier, report_json, raw_json, error_message, origin, duration_ms, created_at)
        VALUES (${input.phone}, ${input.ok}, ${input.httpStatus}, ${report?.total ?? null}, ${report?.delivered ?? null}, ${report?.cancelled ?? null},
                ${report?.successRate ?? null}, ${level}, ${clip(report?.trustTier ?? null, 40)}, ${report ? JSON.stringify(report) : null}, ${raw},
                ${clip(input.error, 2000)}, ${input.origin}, ${Math.round(input.durationMs)}, ${createdAt})`,
  );

  if (input.ok && report) {
    await execute(
      sql`UPDATE customers SET last_checked_at = ${createdAt}, check_total = ${report.total}, check_delivered = ${report.delivered},
          check_cancelled = ${report.cancelled}, check_rate = ${report.successRate}, check_level = ${level},
          check_tier = ${clip(report.trustTier, 40)} WHERE phone = ${input.phone}`,
    );
  }
}

export async function getUsage(): Promise<UsageDTO> {
  await ensureDatabase();
  const config = getFraudbdConfig();
  const start = dhakaDayStart();
  const [row] = await queryRows<Row>(
    sql`SELECT COUNT(*) AS c FROM courier_checks WHERE origin = ${"api"} AND ok = ${true} AND created_at >= ${start}`,
  );
  const used = Number(row?.c ?? 0);
  return {
    used,
    limit: config.dailyLimit,
    remaining: Math.max(0, config.dailyLimit - used),
    resetsAt: new Date(start.getTime() + 86_400_000).toISOString(),
    plan: config.plan,
  };
}

export interface CheckLogRow {
  id: number;
  phone: string;
  ok: boolean;
  total: number | null;
  successRate: number | null;
  level: string | null;
  tier: string | null;
  error: string | null;
  origin: string;
  durationMs: number | null;
  createdAt: string | null;
  customerId: number | null;
  customerName: string | null;
}

function mapCheckLog(row: Row): CheckLogRow {
  return {
    id: Number(row.id),
    phone: String(row.phone),
    ok: toBool(row.ok),
    total: toInt(row.total_orders),
    successRate: toInt(row.success_rate),
    level: toStr(row.risk_level),
    tier: toStr(row.trust_tier),
    error: toStr(row.error_message),
    origin: String(row.origin ?? "api"),
    durationMs: toInt(row.duration_ms),
    createdAt: toIso(row.created_at),
    customerId: toInt(row.customer_id),
    customerName: toStr(row.customer_name),
  };
}

export async function listRecentChecks(limit = 10): Promise<CheckLogRow[]> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT cc.id, cc.phone, cc.ok, cc.total_orders, cc.success_rate, cc.risk_level, cc.trust_tier, cc.error_message,
               cc.origin, cc.duration_ms, cc.created_at, cu.id AS customer_id, cu.name AS customer_name
        FROM courier_checks cc LEFT JOIN customers cu ON cu.phone = cc.phone
        ORDER BY cc.created_at DESC, cc.id DESC LIMIT ${sql.raw(String(clampInt(limit, 1, 100, 10)))}`,
  );
  return rows.map(mapCheckLog);
}

export async function getCheckHistory(phone: string, limit = 10): Promise<CheckLogRow[]> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT id, phone, ok, total_orders, success_rate, risk_level, trust_tier, error_message, origin, duration_ms, created_at
        FROM courier_checks WHERE phone = ${phone}
        ORDER BY created_at DESC, id DESC LIMIT ${sql.raw(String(clampInt(limit, 1, 100, 10)))}`,
  );
  return rows.map(mapCheckLog);
}

/* ───────────────────────── uploads & overview ───────────────────────── */

export interface UploadLogRow {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  rowsScanned: number;
  found: number;
  inserted: number;
  updated: number;
  skipped: number;
  createdAt: string | null;
}

export async function listUploads(limit = 8): Promise<UploadLogRow[]> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT id, file_name, file_type, file_size, rows_scanned, found, inserted, updated, skipped, created_at
        FROM uploads ORDER BY created_at DESC, id DESC LIMIT ${sql.raw(String(clampInt(limit, 1, 100, 8)))}`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    fileName: String(row.file_name),
    fileType: String(row.file_type),
    fileSize: Number(row.file_size ?? 0),
    rowsScanned: Number(row.rows_scanned ?? 0),
    found: Number(row.found ?? 0),
    inserted: Number(row.inserted ?? 0),
    updated: Number(row.updated ?? 0),
    skipped: Number(row.skipped ?? 0),
    createdAt: toIso(row.created_at),
  }));
}

export async function getDatabaseOverview() {
  await ensureDatabase();
  const info = describeDatabaseUrl();
  const [presenceRow] = await queryRows<Row>(sql`SELECT COUNT(*) AS c FROM presence_checks`);
  const [versionRow] = await queryRows<Row>(sql`SELECT VERSION() AS v`);
  const [customers] = await queryRows<Row>(sql`SELECT COUNT(*) AS c FROM customers`);
  const [checks] = await queryRows<Row>(sql`SELECT COUNT(*) AS c FROM courier_checks`);
  const [uploadCount] = await queryRows<Row>(sql`SELECT COUNT(*) AS c FROM uploads`);
  const version = String(versionRow?.v ?? "").split(" on ")[0].slice(0, 60);
  return {
    ...info,
    version,
    tables: {
      customers: Number(customers?.c ?? 0),
      courier_checks: Number(checks?.c ?? 0),
      uploads: Number(uploadCount?.c ?? 0),
      presence_checks: Number(presenceRow?.c ?? 0),
    },
  };
}

/* ───────────────────────── presence checks (WhatsApp / Telegram) ───────────────────────── */

export interface PresenceRow {
  phone: string;
  provider: string;
  present: boolean | null;
  checkedAt: string | null;
  raw: string | null;
}

export async function getPresence(phone: string, provider: string): Promise<PresenceRow | null> {
  await ensureDatabase();
  const rows = await queryRows<Row>(
    sql`SELECT phone, provider, present, checked_at, raw FROM presence_checks
        WHERE phone = ${phone} AND provider = ${provider} LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    phone: String(row.phone),
    provider: String(row.provider),
    present: row.present === null || row.present === undefined ? null : row.present === true || row.present === 1,
    checkedAt: toIso(row.checked_at),
    raw: toStr(row.raw),
  };
}

export async function savePresence(input: {
  phone: string;
  provider: string;
  present: boolean | null;
  raw: string | null;
}): Promise<void> {
  await ensureDatabase();
  const now = new Date();
  await execute(
    sql`INSERT INTO presence_checks (phone, provider, present, raw, checked_at)
        VALUES (${input.phone}, ${input.provider}, ${input.present}, ${input.raw}, ${now})
        ON CONFLICT (phone, provider) DO UPDATE SET present = EXCLUDED.present, raw = EXCLUDED.raw, checked_at = EXCLUDED.checked_at`,
  );
}
