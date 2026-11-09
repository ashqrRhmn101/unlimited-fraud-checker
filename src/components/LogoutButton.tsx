"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconLogout } from "@/components/icons";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      title="লগআউট"
      className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      <IconLogout className="h-4 w-4" />
      <span className="hidden sm:inline">লগআউট</span>
    </button>
  );
}
