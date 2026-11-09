import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Minimal, dependency-free admin session: an HMAC-signed, HTTP-only cookie.
 * Credentials live in `.env` (ADMIN_USERNAME / ADMIN_PASSWORD).
 */

export const SESSION_COOKIE = "fbd_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    `${process.env.FRAUDBD_SECRET_KEY ?? ""}:${process.env.ADMIN_PASSWORD ?? ""}:fraudbd-panel`
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "fraudbd-compare").update(a).digest();
  const hb = createHmac("sha256", "fraudbd-compare").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | null | undefined): { username: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: string;
      exp?: number;
    };
    if (!data.u || !data.exp || data.exp < Date.now()) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ username: string } | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Use at the top of protected pages. */
export async function requirePageSession(nextPath: string): Promise<{ username: string }> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return session;
}

/** Use at the top of protected API routes: `const denied = await apiGuard(); if (denied) return denied;` */
export async function apiGuard(): Promise<Response | null> {
  const session = await getSession();
  if (session) return null;
  return Response.json(
    { ok: false, error: "unauthorized", message: "অনুগ্রহ করে লগইন করুন / Please log in" },
    { status: 401 },
  );
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = (process.env.ADMIN_USERNAME ?? "admin").trim() || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedPass) return false;
  const userOk = safeEqual(username.trim(), expectedUser);
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}

export function isDefaultPassword(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "") === "fraudbd@123";
}

export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = forwarded ? forwarded.split(",")[0].trim() : new URL(request.url).protocol.replace(":", "");
  return proto === "https";
}
