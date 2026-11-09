import { apiGuard } from "@/lib/auth";
import { deleteCustomerById, getCustomerById } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard();
  if (denied) return denied;
  const { id } = await params;
  const customer = await getCustomerById(Number(id));
  if (!customer) return Response.json({ ok: false, message: "Not found" }, { status: 404 });
  return Response.json({ ok: true, customer });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await apiGuard();
  if (denied) return denied;
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ ok: false, message: "Invalid id" }, { status: 400 });
  }
  const deleted = await deleteCustomerById(numericId);
  return Response.json({ ok: deleted > 0, deleted }, { status: deleted > 0 ? 200 : 404 });
}
