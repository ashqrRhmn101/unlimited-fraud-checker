import { apiGuard } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import {
  deleteCustomersByScope,
  getCustomerCounts,
  getUsage,
  listCustomers,
  saveManualCustomer,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

/** GET /api/customers?offset=0&limit=10&q=&filter=all&sort=new — paginated list ("See More") */
export async function GET(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  try {
    const [page, counts, usage] = await Promise.all([
      listCustomers({
        offset: params.get("offset"),
        limit: params.get("limit"),
        q: params.get("q"),
        filter: params.get("filter"),
        sort: params.get("sort"),
      }),
      getCustomerCounts(),
      getUsage(),
    ]);
    return Response.json({ ok: true, ...page, counts, usage });
  } catch (error) {
    console.error("[customers] list failed", error);
    return Response.json({ ok: false, message: "কাস্টমার লোড করা যায়নি" }, { status: 500 });
  }
}

/** POST /api/customers — add (or update) a single customer manually */
export async function POST(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : null);
  const phone = normalizePhone(text("phone"));
  if (!phone) {
    return Response.json(
      { ok: false, message: "সঠিক বাংলাদেশী মোবাইল নম্বর দিন (১১ ডিজিট)" },
      { status: 400 },
    );
  }

  try {
    const result = await saveManualCustomer({
      phone,
      name: text("name"),
      address: text("address"),
      city: text("city"),
      area: text("area"),
      note: text("note"),
      source: text("source") === "search" ? "search" : "manual",
    });
    return Response.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error("[customers] save failed", error);
    return Response.json({ ok: false, message: "সেভ করা যায়নি" }, { status: 500 });
  }
}

/** DELETE /api/customers?scope=demo|all */
export async function DELETE(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  const scope = new URL(request.url).searchParams.get("scope");
  if (scope !== "demo" && scope !== "all") {
    return Response.json({ ok: false, message: "scope must be demo or all" }, { status: 400 });
  }
  const deleted = await deleteCustomersByScope(scope);
  return Response.json({ ok: true, deleted });
}
