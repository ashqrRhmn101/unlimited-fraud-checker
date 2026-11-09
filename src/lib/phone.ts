/**
 * Bangladeshi mobile number helpers.
 * Everything is stored normalised as 8801XXXXXXXXX; fraud.bd expects 01XXXXXXXXX.
 * Handles Bangla digits (০১৭…), +880 / 880 / 0 prefixes, spaces and dashes,
 * and Excel cells where the leading 0 was dropped (1712345678).
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => String(BN_DIGITS.indexOf(digit)));
}

export function normalizePhone(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const digits = toAsciiDigits(String(input)).replace(/\D/g, "");
  if (!digits) return null;

  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  else if (local.startsWith("88") && local.length === 13) local = local.slice(2);
  if (local.startsWith("0")) local = local.slice(1);

  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `880${local}`;
}

/** 8801711124851 -> 01711124851 (format used by the fraud.bd API) */
export function toLocalPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized ? `0${normalized.slice(3)}` : phone;
}

/** 8801711124851 -> 01711-124851 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** 8801711124851 -> 01711-XXX851 (for public pages) */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 5)}-XXX${local.slice(8)}`;
}

/** true when the user typed something that should be treated as a phone number */
export function looksLikePhoneQuery(input: string): boolean {
  const ascii = toAsciiDigits(input);
  const digits = ascii.replace(/\D/g, "");
  const letters = ascii.replace(/[^a-zA-Z\u0980-\u09FF]/g, "").replace(/[০-৯]/g, "");
  return digits.length >= 6 && letters.length === 0;
}

export interface PhoneMatch {
  phone: string;
  start: number;
  end: number;
}

const STRICT_PHONE = /(?<!\d)(?:\+?\s?88[\s-]?)?0[\s-]?1[3-9](?:[\s-]?\d){8}(?!\d)/g;
const BARE_PHONE = /(?<!\d)1[3-9]\d{8}(?!\d)/g;

/**
 * Find every BD mobile number inside free text. Prefers properly written numbers
 * (01… / +880…) and only falls back to 10-digit numbers without the leading 0
 * (typical for Excel number cells) when nothing else is found.
 */
export function findPhones(text: string | null | undefined): PhoneMatch[] {
  if (!text) return [];
  const source = toAsciiDigits(String(text));
  const out: PhoneMatch[] = [];
  const seen = new Set<string>();

  const collect = (pattern: RegExp) => {
    for (const match of source.matchAll(pattern)) {
      const phone = normalizePhone(match[0]);
      const start = match.index ?? 0;
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        out.push({ phone, start, end: start + match[0].length });
      }
    }
  };

  collect(STRICT_PHONE);
  if (out.length === 0) collect(BARE_PHONE);
  return out;
}

/** Remove every phone number from a piece of text (used to clean name/address cells). */
export function stripPhones(text: string): string {
  const matches = findPhones(text);
  if (matches.length === 0) return text;
  let result = "";
  let cursor = 0;
  for (const match of matches.sort((a, b) => a.start - b.start)) {
    result += text.slice(cursor, match.start) + " ";
    cursor = match.end;
  }
  result += text.slice(cursor);
  return result.replace(/\s{2,}/g, " ").trim();
}
