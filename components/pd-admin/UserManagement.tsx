"use client";

import { useState } from "react";

async function mutate(url: string, csrfToken: string, method: "POST" | "PATCH", body: unknown) {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Steelprodukt-CSRF": csrfToken },
    body: JSON.stringify(body),
  });
}

export function CreateUserForm({ csrfToken }: { csrfToken: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="grid gap-3 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await mutate("/api/internal/personal-data/users", csrfToken, "POST", {
      username: String(data.get("username") || ""), displayName: String(data.get("displayName") || ""),
      role: String(data.get("role") || ""), temporaryPassword: String(data.get("temporaryPassword") || ""),
    });
    if (response.ok) window.location.reload();
    else { setMessage(response.status === 403 ? "Требуется повторное подтверждение пароля (step-up)." : "Пользователь не создан."); setPending(false); }
  }}>
    <label className="text-xs">Логин<input name="username" required pattern="[a-z][a-z0-9._-]{2,63}" autoComplete="off" className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3" /></label>
    <label className="text-xs">Отображаемое имя<input name="displayName" required minLength={2} maxLength={120} autoComplete="off" className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3" /></label>
    <label className="text-xs">Роль<select name="role" className="mt-2 w-full border border-white/15 bg-[#0b0e10] px-4 py-3"><option>MANAGER</option><option>AUDITOR</option><option>PERSONAL_DATA_OFFICER</option><option>ADMIN</option></select></label>
    <label className="text-xs">Временный пароль<input name="temporaryPassword" type="password" required autoComplete="new-password" maxLength={256} className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3" /></label>
    {message ? <p role="alert" className="text-xs text-red-200 md:col-span-2">{message}</p> : null}
    <button disabled={pending} className="bg-steel-orange-deep px-5 py-3 text-xs font-bold uppercase disabled:opacity-50 md:col-span-2">{pending ? "Создание…" : "Создать пользователя"}</button>
  </form>;
}

export function UserActions({ csrfToken, userId, currentRole, isActive }: { csrfToken: string; userId: string; currentRole: string; isActive: boolean }) {
  const [message, setMessage] = useState("");
  const action = async (body: Record<string, unknown>) => {
    setMessage("");
    const response = await mutate(`/api/internal/personal-data/users/${encodeURIComponent(userId)}`, csrfToken, "PATCH", body);
    if (response.ok) window.location.reload();
    else setMessage(response.status === 403 ? "Требуется step-up." : "Действие отклонено правилами безопасности.");
  };
  return <div className="space-y-4">
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "change-role", role: String(data.get("role")) }); }}>
      <select name="role" defaultValue={currentRole} className="flex-1 border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm"><option>ADMIN</option><option>PERSONAL_DATA_OFFICER</option><option>MANAGER</option><option>AUDITOR</option></select>
      <button className="border border-white/20 px-4 py-3 text-xs font-bold uppercase">Изменить роль</button>
    </form>
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "reset-password", temporaryPassword: String(data.get("temporaryPassword") || "") }); }}>
      <input name="temporaryPassword" type="password" required autoComplete="new-password" placeholder="Новый временный пароль" className="flex-1 border border-white/15 bg-black/25 px-4 py-3 text-sm" />
      <button className="border border-white/20 px-4 py-3 text-xs font-bold uppercase">Сбросить пароль</button>
    </form>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => void action({ action: isActive ? "deactivate" : "activate" })} className="border border-white/20 px-3 py-2 text-xs">{isActive ? "Деактивировать" : "Активировать"}</button>
      <button onClick={() => void action({ action: "unlock" })} className="border border-white/20 px-3 py-2 text-xs">Разблокировать</button>
      <button onClick={() => void action({ action: "revoke-sessions" })} className="border border-red-500/30 px-3 py-2 text-xs text-red-200">Отозвать все сессии</button>
    </div>
    {message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}
  </div>;
}
