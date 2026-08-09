"use client";

import { useState } from "react";

export function LogoutButton({ csrfToken }: { csrfToken: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/internal/personal-data/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Steelprodukt-CSRF": csrfToken },
          body: "{}",
        }).catch(() => undefined);
        window.location.assign("/internal/personal-data/login");
      }}
      className="border border-white/15 px-3 py-2 text-[10px] font-bold uppercase hover:border-[#ea5b0c] disabled:opacity-50"
    >
      {pending ? "Выход…" : "Выйти"}
    </button>
  );
}
