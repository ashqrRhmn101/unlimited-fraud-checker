"use client";

import { useEffect, useState } from "react";

import { IconPhone, IconSms, IconTelegram, IconWhatsapp } from "@/components/icons";
import { CONTACT_SITES } from "@/lib/contact";

const ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
  whatsapp: IconWhatsapp,
  telegram: IconTelegram,
  call: IconPhone,
  sms: IconSms,
};

const STYLES: Record<string, string> = {
  whatsapp: "bg-[#25D366]/15 text-[#25D366] ring-[#25D366]/40 hover:bg-[#25D366]/30",
  telegram: "bg-[#229ED9]/15 text-[#229ED9] ring-[#229ED9]/40 hover:bg-[#229ED9]/30",
  call: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40 hover:bg-emerald-500/30",
  sms: "bg-sky-500/15 text-sky-300 ring-sky-500/40 hover:bg-sky-500/30",
};

type PresenceState = { status: "loading" | "done" | "off"; present?: boolean };

/**
 * Row of contact buttons under a phone number: WhatsApp, Telegram, Call, SMS.
 * WhatsApp/Telegram buttons open the app directly (wa.me / t.me). When a
 * PRESENCE_API_URL is configured, a green/grey dot also shows whether the
 * number is actually registered on that platform.
 */
export default function ContactLinks({
  phone,
  variant = "full",
}: {
  phone: string;
  variant?: "full" | "icons";
}) {
  const [presence, setPresence] = useState<Record<string, PresenceState>>({
    whatsapp: { status: "loading" },
    telegram: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;
    for (const provider of ["whatsapp", "telegram"] as const) {
      fetch(`/api/presence?phone=${encodeURIComponent(phone)}&provider=${provider}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          if (data.ok && typeof data.present === "boolean") {
            setPresence((previous) => ({
              ...previous,
              [provider]: { status: "done", present: data.present },
            }));
          } else {
            setPresence((previous) => ({ ...previous, [provider]: { status: "off" } }));
          }
        })
        .catch(() => {
          if (!cancelled) setPresence((previous) => ({ ...previous, [provider]: { status: "off" } }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [phone]);

  const icons = variant === "icons";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${icons ? "" : "gap-2"}`} aria-label="Contact links">
      {CONTACT_SITES.map((site) => {
        const Icon = ICONS[site.key];
        const url = site.build(phone);
        const state = presence[site.key];
        return (
          <a
            key={site.key}
            href={url}
            {...(site.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            title={`${site.label}-e khule jabe — ${site.label} ache kina dekhabe`}
            className={`relative inline-flex items-center rounded-xl ring-1 transition ${
              STYLES[site.key] ?? "bg-white/5 text-slate-300 ring-white/15"
            } ${icons ? "gap-1 px-2 py-1.5 text-[11px] font-bold" : "gap-2 px-3 py-2 text-xs font-bold"}`}
          >
            {Icon ? <Icon className={icons ? "h-4 w-4" : "h-5 w-5"} /> : null}
            {site.label}
            {state && (site.key === "whatsapp" || site.key === "telegram") ? (
              <span
                className={`ml-0.5 inline-block h-2 w-2 rounded-full ${
                  state.status === "loading"
                    ? "animate-pulse bg-slate-500"
                    : state.status === "off"
                      ? "bg-slate-600"
                      : state.present
                        ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                        : "bg-rose-400/80"
                }`}
                title={
                  state.status === "loading"
                    ? "check hocche…"
                    : state.status === "off"
                      ? `${site.label}-e ache kina — button diye app-e check korun`
                      : state.present
                        ? `${site.label}-e ei number ache`
                        : `${site.label}-e ei number nei`
                }
              />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
