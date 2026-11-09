import { getFraudbdConfig } from "@/lib/fraudbd";
import { normalizePhone } from "@/lib/phone";
import { getPresence, savePresence } from "@/lib/repo";

/**
 * Optional "is this number on WhatsApp / Telegram?" detection.
 *
 * Deep-link buttons always work without any API. For a real presence indicator,
 * set PRESENCE_API_URL (+ optional PRESENCE_API_KEY) to a provider that accepts:
 *     GET <PRESENCE_API_URL>?phone=8801XXXXXXXXX&provider=whatsapp|telegram
 * and returns JSON: {"present": true|false}  (also accepts {"exists": …}).
 * Results are cached in the presence_checks table for PRESENCE_CACHE_HOURS.
 */

export type PresenceResult =
  | { ok: true; phone: string; provider: string; present: boolean; source: "api" | "cache"; checkedAt: string }
  | { ok: false; phone: string | null; provider: string; reason: "unavailable" | "invalid_phone" | "error"; message: string };

const PROVIDERS = ["whatsapp", "telegram"] as const;
export type PresenceProvider = (typeof PROVIDERS)[number];

export function isPresenceProvider(value: string): value is PresenceProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function presenceApiUrl(): string | null {
  const url = (process.env.PRESENCE_API_URL ?? "").trim();
  return url || null;
}

export function presenceConfigured(): boolean {
  return Boolean(presenceApiUrl());
}

function cacheHours(): number {
  const parsed = Number(process.env.PRESENCE_CACHE_HOURS ?? 24);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

async function callPresenceApi(phone: string, provider: PresenceProvider): Promise<boolean | null> {
  const base = presenceApiUrl();
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("phone", phone);
  url.searchParams.set("provider", provider);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const key = (process.env.PRESENCE_API_KEY ?? "").trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const json = (await response.json()) as Record<string, unknown>;
    const value = json.present ?? json.exists ?? json.registered ?? json.on_whatsapp ?? json.on_telegram;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true" || value === "1" || value.toLowerCase() === "yes";
    if (typeof value === "number") return value === 1;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPresence(rawPhone: string, provider: string): Promise<PresenceResult> {
  if (!isPresenceProvider(provider)) {
    return { ok: false, phone: null, provider, reason: "unavailable", message: "Unknown provider" };
  }
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { ok: false, phone: null, provider, reason: "invalid_phone", message: "Invalid phone" };
  }
  if (!presenceApiUrl()) {
    return {
      ok: false,
      phone,
      provider,
      reason: "unavailable",
      message: "PRESENCE_API_URL set kora hoy nai — button diye app theke check korun.",
    };
  }

  try {
    const cached = await getPresence(phone, provider);
    if (cached && cached.checkedAt) {
      const ageHours = (Date.now() - new Date(cached.checkedAt).getTime()) / 3_600_000;
      if (cached.present !== null && ageHours < cacheHours()) {
        return { ok: true, phone, provider, present: cached.present, source: "cache", checkedAt: cached.checkedAt };
      }
    }

    const present = await callPresenceApi(phone, provider);
    const checkedAt = new Date().toISOString();
    await savePresence({ phone, provider, present, raw: present === null ? "no answer" : JSON.stringify({ present }) });
    if (present === null) {
      return { ok: false, phone, provider, reason: "error", message: "Provider theke answer asheni" };
    }
    return { ok: true, phone, provider, present, source: "api", checkedAt };
  } catch (error) {
    console.error("[presence] failed", error);
    return { ok: false, phone, provider, reason: "error", message: "Presence check failed" };
  }
}

// keep config import used (cacheHours shares fraud.bd config file pattern)
void getFraudbdConfig;
