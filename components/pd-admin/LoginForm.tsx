"use client";

import { useEffect, useState } from "react";

const genericError = "Не удалось выполнить вход. Проверьте данные или повторите позже";

export function LoginForm() {
  const [preAuthToken, setPreAuthToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/internal/personal-data/auth/login", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: { preAuthToken?: string }) => { if (active && body.preAuthToken) setPreAuthToken(body.preAuthToken); })
      .catch(() => { if (active) setError(genericError); });
    return () => { active = false; };
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!preAuthToken) return;
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/internal/personal-data/auth/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: String(form.get("username") || ""),
              password: String(form.get("password") || ""),
              preAuthToken,
            }),
          });
          const body = await response.json() as { ok?: boolean; next?: string };
          if (!response.ok || !body.ok || !body.next) throw new Error();
          window.location.assign(body.next);
        } catch {
          setError(genericError);
          setPending(false);
        }
      }}
    >
      <div>
        <label htmlFor="pd-username" className="block text-xs font-semibold">Имя пользователя</label>
        <input id="pd-username" name="username" type="text" autoComplete="username" required maxLength={64} className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3 outline-none focus:border-[#ea5b0c]" />
      </div>
      <div>
        <label htmlFor="pd-password" className="block text-xs font-semibold">Пароль</label>
        <input id="pd-password" name="password" type="password" autoComplete="current-password" required maxLength={256} className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3 outline-none focus:border-[#ea5b0c]" />
      </div>
      {error ? <p role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p> : null}
      <button disabled={pending || !preAuthToken} className="w-full bg-steel-orange-deep px-4 py-3 text-xs font-bold uppercase disabled:opacity-50">
        {pending ? "Проверка…" : "Войти"}
      </button>
    </form>
  );
}
