"use client";

import { useState } from "react";

export function PasswordChangeForm({ csrfToken }: { csrfToken: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true); setMessage("");
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/internal/personal-data/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Steelprodukt-CSRF": csrfToken },
        body: JSON.stringify({
          currentPassword: String(data.get("currentPassword") || ""),
          newPassword: String(data.get("newPassword") || ""),
          confirmPassword: String(data.get("confirmPassword") || ""),
        }),
      });
      if (response.ok) window.location.assign("/internal/personal-data");
      else { setMessage("Пароль не изменён. Проверьте текущий пароль и требования к новому."); setPending(false); }
    }}>
      {[
        ["currentPassword", "Текущий пароль", "current-password"],
        ["newPassword", "Новый пароль", "new-password"],
        ["confirmPassword", "Повтор нового пароля", "new-password"],
      ].map(([name, label, autoComplete]) => <div key={name}>
        <label htmlFor={name} className="block text-xs font-semibold">{label}</label>
        <input id={name} name={name} type="password" autoComplete={autoComplete} required maxLength={256} className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3 outline-none focus:border-[#ea5b0c]" />
      </div>)}
      <p className="text-xs leading-relaxed text-white/45">Не менее 14 символов: строчные и заглавные буквы, цифра и специальный символ.</p>
      {message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}
      <button disabled={pending} className="bg-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase disabled:opacity-50">{pending ? "Сохранение…" : "Изменить пароль"}</button>
    </form>
  );
}
