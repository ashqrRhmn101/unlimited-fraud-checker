import { cookies } from "next/headers";

import { clientKey, hit } from "@/lib/rateLimit";
import {
  checkCredentials,
  createSessionToken,
  isSecureRequest,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Brute-force protection: max 10 login attempts per 5 minutes per IP.
  if (!hit(clientKey(request), 10, 5 * 60_000)) {
    return Response.json(
      { ok: false, message: "খুব দ্রুত অনেক চেষ্টা Pinchas — ৫ মিনিট পর আবার চেষ্টা করুন / Too many attempts, retry in 5 minutes" },
      { status: 429, headers: { "Retry-After": "300" } },
    );
  }

  let body: { username?: unknown; password?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return Response.json(
      { ok: false, message: "ইউজারনেম বা পাসওয়ার্ড সঠিক নয় / Wrong username or password" },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(username.trim()), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return Response.json({ ok: true });
}
