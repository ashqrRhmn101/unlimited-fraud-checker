import { callFraudbd, getFraudbdConfig } from "@/lib/fraudbd";
import { normalizePhone, toLocalPhone } from "@/lib/phone";
import { getLatestCheck, getUsage, saveCheck } from "@/lib/repo";
import type { CheckApiResult } from "@/lib/types";

/**
 * One courier check, quota-aware:
 *  1. a saved result younger than FRAUDBD_CACHE_HOURS is reused (0 API calls)
 *  2. otherwise, if today's quota allows, fraud.bd is called live (1 API call)
 *  3. if the quota is exhausted, the last saved result is shown with a warning
 */
export async function runCourierCheck(
  input: string,
  options: { force?: boolean } = {},
): Promise<CheckApiResult> {
  const phone = normalizePhone(input);
  if (!phone) {
    return {
      ok: false,
      status: 400,
      code: "invalid_phone",
      message: "সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন 01711-124851)",
      phone: null,
      usage: null,
      report: null,
      checkedAt: null,
    };
  }

  const config = getFraudbdConfig();
  const latest = await getLatestCheck(phone);
  const ageHours = latest ? (Date.now() - new Date(latest.createdAt).getTime()) / 3_600_000 : Infinity;

  if (!options.force && latest && ageHours < config.cacheHours) {
    return {
      ok: true,
      source: "cache",
      phone,
      report: latest.report,
      checkedAt: latest.createdAt,
      usage: await getUsage(),
      warning: null,
      durationMs: null,
    };
  }

  const usage = await getUsage();
  if (usage.remaining <= 0) {
    if (latest) {
      return {
        ok: true,
        source: "cache",
        phone,
        report: latest.report,
        checkedAt: latest.createdAt,
        usage,
        warning: `আজকের API লিমিট (${usage.limit}টি) শেষ — সর্বশেষ সংরক্ষিত রিপোর্ট দেখানো হচ্ছে।`,
        durationMs: null,
      };
    }
    return {
      ok: false,
      status: 429,
      code: "limit",
      message: `আজকের API লিমিট (${usage.limit}টি) শেষ। রাত ১২টার পর আবার চেষ্টা করুন অথবা .env-এ নতুন অ্যাকাউন্টের key দিন।`,
      phone,
      usage,
      report: null,
      checkedAt: null,
    };
  }

  const outcome = await callFraudbd(toLocalPhone(phone));

  if (outcome.ok) {
    const checkedAt = new Date();
    await saveCheck({
      phone,
      ok: true,
      httpStatus: outcome.httpStatus,
      report: outcome.report,
      raw: outcome.raw,
      error: null,
      durationMs: outcome.durationMs,
      origin: "api",
      createdAt: checkedAt,
    });
    return {
      ok: true,
      source: "live",
      phone,
      report: outcome.report,
      checkedAt: checkedAt.toISOString(),
      usage: { ...usage, used: usage.used + 1, remaining: Math.max(0, usage.remaining - 1) },
      warning: null,
      durationMs: outcome.durationMs,
    };
  }

  if (outcome.code !== "config") {
    await saveCheck({
      phone,
      ok: false,
      httpStatus: outcome.httpStatus,
      report: null,
      raw: outcome.raw,
      error: `${outcome.code}: ${outcome.apiMessage ?? outcome.message}`,
      durationMs: outcome.durationMs,
      origin: "api",
    });
  }

  const status =
    outcome.code === "limit" || outcome.code === "throttle" ? 429 : outcome.code === "config" ? 503 : 502;

  return {
    ok: false,
    status,
    code: outcome.code,
    message: outcome.message,
    phone,
    usage,
    report: latest?.report ?? null,
    checkedAt: latest?.createdAt ?? null,
  };
}
