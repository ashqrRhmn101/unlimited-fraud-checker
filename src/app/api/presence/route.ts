import { apiGuard } from "@/lib/auth";
import { checkPresence, isPresenceProvider, presenceConfigured } from "@/lib/presence";

export const dynamic = "force-dynamic";

/** GET /api/presence?phone=01711124851&provider=whatsapp */
export async function GET(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const phone = params.get("phone") ?? "";
  const provider = params.get("provider") ?? "";

  if (!isPresenceProvider(provider)) {
    return Response.json(
      { ok: false, reason: "unavailable", configured: presenceConfigured(), message: "provider must be whatsapp or telegram" },
      { status: 400 },
    );
  }

  const result = await checkPresence(phone, provider);
  return Response.json({ ...result, configured: presenceConfigured() }, { status: result.ok ? 200 : 200 });
}
