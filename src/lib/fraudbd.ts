import { normalizeFraudbdResponse, type CourierReport } from "@/lib/courier";

/**
 * Server-only fraud.bd client. Keys are read from `.env` at runtime, so you can
 * switch to a new account by editing `.env` and restarting — no code changes.
 *
 * Request:  POST https://fraud.bd/api/v1/search   body: {"phone":"01XXXXXXXXX"}
 * Headers:  RKR-API-KEY, RKR-SECRET-KEY, Origin: https://<authorized-domain>
 */

export interface FraudbdConfig {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  domain: string;
  origin: string | null;
  plan: string;
  dailyLimit: number;
  cacheHours: number;
  timeoutMs: number;
}

function intEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getFraudbdConfig(): FraudbdConfig {
  const domain = (process.env.FRAUDBD_AUTHORIZED_DOMAIN ?? "").trim();
  const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return {
    apiUrl: (process.env.FRAUDBD_API_URL ?? "").trim() || "https://fraud.bd/api/v1/search",
    apiKey: (process.env.FRAUDBD_API_KEY ?? "").trim(),
    secretKey: (process.env.FRAUDBD_SECRET_KEY ?? "").trim(),
    domain: cleanDomain,
    origin: cleanDomain ? `https://${cleanDomain}` : null,
    plan: (process.env.FRAUDBD_PLAN_NAME ?? "").trim() || "fraud.bd",
    dailyLimit: intEnv(process.env.FRAUDBD_DAILY_LIMIT, 110),
    cacheHours: intEnv(process.env.FRAUDBD_CACHE_HOURS, 24),
    timeoutMs: intEnv(process.env.FRAUDBD_TIMEOUT_MS, 20000),
  };
}

export function isFraudbdConfigured(config: FraudbdConfig = getFraudbdConfig()): boolean {
  return Boolean(config.apiKey && config.secretKey);
}

export function maskKey(key: string): string {
  if (!key) return "— (not set)";
  if (key.length <= 14) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 10)}••••••••${key.slice(-4)}`;
}

export type FraudbdErrorCode =
  | "config"
  | "domain"
  | "auth"
  | "limit"
  | "throttle"
  | "rejected"
  | "invalid_response"
  | "http"
  | "timeout"
  | "network";

export type FraudbdOutcome =
  | { ok: true; report: CourierReport; raw: unknown; httpStatus: number; durationMs: number }
  | {
      ok: false;
      code: FraudbdErrorCode;
      message: string;
      apiMessage: string | null;
      httpStatus: number | null;
      durationMs: number;
      raw: unknown;
    };

const FRIENDLY: Record<FraudbdErrorCode, string> = {
  config: "fraud.bd API key সেট করা নেই। .env ফাইলে FRAUDBD_API_KEY ও FRAUDBD_SECRET_KEY দিন, তারপর অ্যাপ রিস্টার্ট করুন।",
  domain:
    "fraud.bd ডোমেইন মিলছে না (RKR_DOMAIN_MISMATCH)। .env-এর FRAUDBD_AUTHORIZED_DOMAIN-এ আপনার fraud.bd ড্যাশবোর্ডের Authorized Domain হুবহু দিন।",
  auth: "API Key / Secret Key সঠিক নয় বা প্ল্যানের মেয়াদ শেষ। নতুন key .env-এ বসিয়ে অ্যাপ রিস্টার্ট করুন।",
  limit: "আজকের fraud.bd API লিমিট শেষ। আগামীকাল আবার চেষ্টা করুন অথবা .env-এ নতুন অ্যাকাউন্টের key দিন।",
  throttle: "খুব দ্রুত অনেক রিকোয়েস্ট পাঠানো হয়েছে (প্রতি মিনিটে সর্বোচ্চ ৬০টি)। কয়েক সেকেন্ড পরে আবার চেষ্টা করুন।",
  rejected: "fraud.bd রিকোয়েস্টটি গ্রহণ করেনি।",
  invalid_response: "fraud.bd থেকে অপ্রত্যাশিত রেসপন্স এসেছে।",
  http: "fraud.bd সার্ভারে সমস্যা হয়েছে।",
  timeout: "fraud.bd সার্ভার সময়মতো উত্তর দেয়নি। একটু পরে আবার চেষ্টা করুন।",
  network: "fraud.bd সার্ভারের সাথে সংযোগ করা যায়নি। ইন্টারনেট/সার্ভার সংযোগ দেখুন।",
};

export async function callFraudbd(localPhone: string): Promise<FraudbdOutcome> {
  const config = getFraudbdConfig();
  const started = Date.now();

  if (!isFraudbdConfigured(config)) {
    return {
      ok: false,
      code: "config",
      message: FRIENDLY.config,
      apiMessage: null,
      httpStatus: null,
      durationMs: 0,
      raw: null,
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "RKR-API-KEY": config.apiKey,
    "RKR-SECRET-KEY": config.secretKey,
    "User-Agent": "FraudBD-Merchant-Panel/2.0",
  };
  if (config.origin) {
    headers.Origin = config.origin;
    headers.Referer = `${config.origin}/`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: localPhone }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    const durationMs = Date.now() - started;
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
    const apiMessage = typeof body.message === "string" ? body.message : null;

    if (response.ok && body.success === true) {
      const report = normalizeFraudbdResponse(json, localPhone);
      if (report) return { ok: true, report, raw: json, httpStatus: response.status, durationMs };
      return {
        ok: false,
        code: "invalid_response",
        message: FRIENDLY.invalid_response,
        apiMessage,
        httpStatus: response.status,
        durationMs,
        raw: json,
      };
    }

    const lower = (apiMessage ?? "").toLowerCase();
    let code: FraudbdErrorCode = response.ok ? "rejected" : "http";
    if (lower.includes("domain_mismatch") || lower.includes("domain")) code = "domain";
    else if (response.status === 429 && lower.includes("too many")) code = "throttle";
    else if (response.status === 429 || /limit|quota|exceed|exhaust/.test(lower)) code = "limit";
    else if (response.status === 401 || /api key|secret|unauthori|invalid key|expired/.test(lower)) code = "auth";

    const message =
      code === "rejected" || code === "http"
        ? `${FRIENDLY[code]}${apiMessage ? ` (${apiMessage})` : ` (HTTP ${response.status})`}`
        : FRIENDLY[code];

    return {
      ok: false,
      code,
      message,
      apiMessage,
      httpStatus: response.status,
      durationMs,
      raw: json ?? text.slice(0, 500),
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "timeout" : "network",
      message: aborted ? FRIENDLY.timeout : FRIENDLY.network,
      apiMessage: error instanceof Error ? error.message : null,
      httpStatus: null,
      durationMs: Date.now() - started,
      raw: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
