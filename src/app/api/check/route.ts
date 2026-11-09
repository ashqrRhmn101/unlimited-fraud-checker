import { apiGuard } from "@/lib/auth";
import { runCourierCheck } from "@/lib/checker";

export const dynamic = "force-dynamic";

/**
 * POST /api/check  { "phone": "01711124851", "force": false }
 * Server-side proxy to fraud.bd — the API keys never reach the browser.
 */
export async function POST(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  let body: { phone?: unknown; force?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await runCourierCheck(String(body.phone ?? ""), { force: body.force === true });
    return Response.json(result, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error("[check] failed", error);
    return Response.json(
      {
        ok: false,
        status: 500,
        code: "server_error",
        message: "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন",
        phone: null,
        usage: null,
        report: null,
        checkedAt: null,
      },
      { status: 500 },
    );
  }
}
