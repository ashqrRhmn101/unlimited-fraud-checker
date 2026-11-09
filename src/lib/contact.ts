/**
 * Contact deep-links for a Bangladeshi mobile number.
 *
 * Pure helpers (safe to import in client components). Every entry produces a
 * URL that opens the native app / site directly — no API key needed:
 *   - WhatsApp : https://wa.me/<intl>            (opens chat; shows "invite" if not on WhatsApp)
 *   - Telegram : https://t.me/+<intl>            (resolves if the number is registered)
 *   - Call     : tel:+<intl>
 *   - SMS      : sms:+<intl>
 *
 * Add any other site by appending to CONTACT_SITES — the UI renders it
 * automatically with its icon + label.
 */

export interface ContactSite {
  key: string;
  label: string;
  /** true → link opens in a new tab; false → same-tab navigation (tel:/sms:) */
  external: boolean;
  build: (phone: string) => string;
}

export const CONTACT_SITES: ContactSite[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    external: true,
    build: (phone) =>
      `https://wa.me/${phone}?text=${encodeURIComponent(
        "আসসালামু আলাইকুম — আপনার অর্ডারটি কনফার্ম করতে একবার কথা বলব?",
      )}`,
  },
  {
    key: "telegram",
    label: "Telegram",
    external: true,
    build: (phone) => `https://t.me/+${phone}`,
  },
  {
    key: "call",
    label: "Call",
    external: false,
    build: (phone) => `tel:+${phone}`,
  },
  {
    key: "sms",
    label: "SMS",
    external: false,
    build: (phone) => `sms:+${phone}`,
  },
];

export function siteByKey(key: string): ContactSite | undefined {
  return CONTACT_SITES.find((site) => site.key === key);
}

export function contactUrl(siteKey: string, phone: string): string | null {
  const site = siteByKey(siteKey);
  return site ? site.build(phone) : null;
}
