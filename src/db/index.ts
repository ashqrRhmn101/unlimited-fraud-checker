import { sql, type SQL } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * FraudBD data layer — PostgreSQL (Supabase compatible)
 * ------------------------------------------------------
 * The app talks to a standard PostgreSQL database through Drizzle ORM + `pg`.
 * For production use a **Supabase** project: copy the connection string from
 * Supabase → Project Settings → Database (use the Session pooler, port 6543,
 * with `?sslmode=require`) into `.env` as DATABASE_URL, e.g.
 *
 *   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-xxx.pooler.supabase.com:6543/postgres?sslmode=require
 *
 * The same code also runs against any local PostgreSQL for development.
 *
 * All queries are written with Drizzle's `sql` template and always send values
 * as bound parameters ($1, $2, …) — never string interpolation of user input.
 */

function buildPool(connectionString: string): Pool {
  let ssl: boolean | { rejectUnauthorized: false } = false;
  try {
    const url = new URL(connectionString);
    const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
    // Supabase and most managed Postgres hosts require TLS.
    if (sslmode && sslmode !== "disable" && sslmode !== "allow" && sslmode !== "prefer") {
      ssl = { rejectUnauthorized: false };
    } else if (process.env.PGSSL === "true" || process.env.PGSSL === "1") {
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    // not a URL — pass through untouched
  }

  return new Pool({
    connectionString,
    ssl,
    max: Math.max(1, Number(process.env.DB_POOL_SIZE ?? 10) || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

const globalForDb = globalThis as typeof globalThis & {
  __fraudbdDb?: { pool: Pool; db: NodePgDatabase<Record<string, never>> };
};

export function getDb(): { pool: Pool; db: NodePgDatabase<Record<string, never>> } {
  if (globalForDb.__fraudbdDb) return globalForDb.__fraudbdDb;

  const connectionString = (process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Put your Supabase PostgreSQL connection string in the .env file.",
    );
  }

  const pool = buildPool(connectionString);
  const db = drizzle(pool);
  globalForDb.__fraudbdDb = { pool, db };
  return globalForDb.__fraudbdDb;
}

/** Run a SELECT and get plain row objects back. */
export async function queryRows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const { db } = getDb();
  const result = await db.execute(query);
  return result.rows as T[];
}

/** Run INSERT / UPDATE / DELETE / DDL. */
export async function execute(
  query: SQL,
): Promise<{ affectedRows: number; insertId: number | null }> {
  const { db } = getDb();
  const result = await db.execute(query);
  return { affectedRows: Number(result.rowCount ?? 0), insertId: null };
}

/** INSERT a single row and return its serial id via RETURNING. */
export async function insertReturningId(query: SQL): Promise<number> {
  const rows = await queryRows<{ id: number | string }>(sql`${query} RETURNING id`);
  return Number(rows[0]?.id ?? 0);
}

export async function ping(): Promise<boolean> {
  await queryRows(sql`SELECT 1 AS ok`);
  return true;
}

/** Describe the configured database without leaking the password. */
export function describeDatabaseUrl(): {
  provider: "supabase" | "postgres";
  host: string;
  database: string;
} {
  const url = (process.env.DATABASE_URL ?? "").trim();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return {
      provider: host.includes("supabase.co") ? "supabase" : "postgres",
      host: `${host}${parsed.port ? `:${parsed.port}` : ""}`,
      database: parsed.pathname.replace(/^\//, "") || "—",
    };
  } catch {
    return { provider: "postgres", host: "—", database: "—" };
  }
}
