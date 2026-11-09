import { describeDatabaseUrl, ping } from "@/db";
import { ensureDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabase();
    await ping();
    return Response.json({ ok: true, database: "postgresql", provider: describeDatabaseUrl().provider });
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
