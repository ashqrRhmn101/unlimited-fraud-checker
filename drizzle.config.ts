import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle config — PostgreSQL (Supabase compatible).
 * The URL is read from .env (DATABASE_URL), e.g. a Supabase pooler URL:
 *   postgresql://postgres.<ref>:<password>@aws-0-….pooler.supabase.com:6543/postgres?sslmode=require
 *
 * Usage:  npx drizzle-kit push     (the app also creates tables on first start)
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
