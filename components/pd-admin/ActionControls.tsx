"use client";

import { useState } from "react";

async function jsonRequest(url: string, csrfToken: string, options: { method?: string; body?: unknown } = {}) {
  return fetch(url, {
    method: options.method ?? "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Steelprodukt-CSRF": csrfToken },
    body: JSON.stringify(options.body ?? {}),
  });
}

export function StepUpForm({ csrfToken }: { csrfToken: string }) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault(); setPending(true); setStatus("");
      const form = new FormData(event.currentTarget);
      const response = await jsonRequest("/api/internal/personal-data/auth/step-up", csrfToken, { body: { password: String(form.get("password") || "") } });
      if (response.ok) window.location.reload();
      else { setStatus("Подтверждение не выполнено."); setPending(false); }
    }}>
      <label htmlFor="step-up-password" className="block text-xs font-semibold">Повторное подтверждение текущего пароля</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="step-up-password" name="password" type="password" autoComplete="current-password" required className="min-w-0 flex-1 border border-white/15 bg-black/25 px-4 py-3 outline-none focus:border-[#ea5b0c]" />
        <button disabled={pending} className="bg-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase disabled:opacity-50">{pending ? "Проверка…" : "Подтвердить"}</button>
      </div>
      {status ? <p role="alert" className="text-xs text-red-200">{status}</p> : null}
    </form>
  );
}

type SearchItem = { requestId: string; source: string; createdAt: string; internalStatus: string };

export function LeadSearchPanel({ csrfToken, contactEnabled, textEnabled }: { csrfToken: string; contactEnabled: boolean; textEnabled: boolean }) {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-4">
      <form className="grid gap-3 md:grid-cols-[150px_1fr_1fr_auto]" onSubmit={async (event) => {
        event.preventDefault(); setPending(true); setStatus(""); setItems([]);
        const form = new FormData(event.currentTarget);
        const mode = String(form.get("mode"));
        const isContact = mode === "phone" || mode === "email";
        const response = await jsonRequest(isContact ? "/api/internal/personal-data/search/contact" : "/api/internal/personal-data/search/text", csrfToken, {
          body: isContact
            ? { kind: mode, value: String(form.get("value") || ""), legalBasis: String(form.get("legalBasis") || "") }
            : { field: mode, value: String(form.get("value") || ""), legalBasis: String(form.get("legalBasis") || "") },
        });
        const body = await response.json().catch(() => ({})) as { items?: SearchItem[] };
        if (response.ok) { setItems(body.items ?? []); setStatus(body.items?.length ? "" : "Совпадений не найдено."); }
        else setStatus("Поиск не выполнен. Проверьте основание и формат запроса.");
        setPending(false);
      }}>
        <select name="mode" aria-label="Тип поиска" className="border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm">
          {contactEnabled ? <><option value="phone">Телефон точно</option><option value="email">E-mail точно</option></> : null}
          {textEnabled ? <><option value="name">Имя ограниченно</option><option value="company">Организация</option></> : null}
        </select>
        <input name="value" required maxLength={160} placeholder="Значение для поиска" className="border border-white/15 bg-black/25 px-4 py-3 text-sm outline-none focus:border-[#ea5b0c]" />
        <input name="legalBasis" required minLength={8} maxLength={240} placeholder="Основание доступа (не менее 8 символов)" className="border border-white/15 bg-black/25 px-4 py-3 text-sm outline-none focus:border-[#ea5b0c]" />
        <button disabled={pending || (!contactEnabled && !textEnabled)} className="bg-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase disabled:opacity-50">{pending ? "Поиск…" : "Найти"}</button>
      </form>
      {status ? <p className="text-xs text-white/55">{status}</p> : null}
      {items.length ? <div className="grid gap-2">{items.map((item) => (
        <a key={item.requestId} href={`/internal/personal-data/leads/${encodeURIComponent(item.requestId)}`} className="grid gap-1 border border-white/10 p-3 text-xs hover:border-[#ea5b0c] sm:grid-cols-4">
          <b>{item.requestId}</b><span>{item.source}</span><span>{new Date(item.createdAt).toLocaleString("ru-RU")}</span><span>{item.internalStatus}</span>
        </a>
      ))}</div> : null}
    </div>
  );
}

export function LeadRevealPanel({ csrfToken, requestId }: { csrfToken: string; requestId: string }) {
  const [lead, setLead] = useState<Record<string, string | null> | null>(null);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      {!lead ? <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (event) => {
        event.preventDefault(); setMessage("");
        const data = new FormData(event.currentTarget);
        const response = await jsonRequest(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/reveal`, csrfToken, { body: { legalBasis: String(data.get("legalBasis") || "") } });
        const body = await response.json().catch(() => ({})) as { lead?: Record<string, string | null> };
        if (response.ok && body.lead) setLead(body.lead); else setMessage("Раскрытие не разрешено или не указано основание.");
      }}>
        <input name="legalBasis" required minLength={8} maxLength={240} placeholder="Основание раскрытия" className="min-w-0 flex-1 border border-white/15 bg-black/25 px-4 py-3 text-sm" />
        <button className="border border-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase text-[#ea5b0c]">Раскрыть</button>
      </form> : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {Object.entries(lead).filter(([key]) => key !== "requestId").map(([key, value]) => <div key={key} className="border border-white/10 p-3"><dt className="text-[10px] uppercase text-white/40">{key}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value || "Не указано"}</dd></div>)}
        </dl>
      )}
      {message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}
    </div>
  );
}

export function LeadWorkflowPanel({ csrfToken, requestId, currentStatus, managers, canAssign, canComment, canRetention, retentionOverrideUntil }: {
  csrfToken: string; requestId: string; currentStatus: string; managers: Array<{ id: string; display_name: string }>;
  canAssign: boolean; canComment: boolean; canRetention: boolean; retentionOverrideUntil: string | null;
}) {
  const [message, setMessage] = useState("");
  const act = async (url: string, body: unknown) => {
    setMessage(""); const response = await jsonRequest(url, csrfToken, { body });
    if (response.ok) window.location.reload(); else setMessage("Изменение не выполнено.");
  };
  return <div className="space-y-4">
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/workflow`, { status: String(data.get("status")) }); }}>
      <select name="status" defaultValue={currentStatus} className="flex-1 border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm">
        {["NEW", "IN_PROGRESS", "NEEDS_CLARIFICATION", "PROPOSAL_SENT", "CONTRACT", "CLOSED"].map((status) => <option key={status}>{status}</option>)}
      </select><button className="bg-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase">Изменить статус</button>
    </form>
    {canAssign ? <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/assign`, { userId: String(data.get("userId") || "") || null }); }}>
      <select name="userId" className="flex-1 border border-white/15 bg-[#0b0e10] px-3 py-3 text-sm"><option value="">Не назначен</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.display_name}</option>)}</select>
      <button className="border border-white/20 px-5 py-3 text-xs font-bold uppercase">Назначить</button>
    </form> : null}
    {canComment ? <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void act(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/comments`, { body: String(data.get("body") || "") }).then(() => form.reset()); }}>
      <textarea name="body" required minLength={2} maxLength={4_000} rows={3} placeholder="Служебный комментарий" className="w-full border border-white/15 bg-black/25 px-4 py-3 text-sm" />
      <button className="border border-white/20 px-5 py-3 text-xs font-bold uppercase">Добавить комментарий</button>
    </form> : null}
    {canRetention ? <div className="border border-white/10 p-4"><p className="mb-3 text-xs font-semibold">Продление срока хранения · требуется активный step-up</p><form className="grid gap-2 md:grid-cols-[180px_1fr_auto]" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void act(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/retention`, { until: String(data.get("until") || "") || null, reason: String(data.get("reason") || "") }); }}>
      <input name="until" type="date" defaultValue={retentionOverrideUntil?.slice(0, 10) || ""} className="border border-white/15 bg-black/25 px-4 py-3 text-sm" />
      <input name="reason" required minLength={8} maxLength={240} placeholder="Основание продления или снятия" className="border border-white/15 bg-black/25 px-4 py-3 text-sm" />
      <div className="flex gap-2"><button className="border border-[#ea5b0c] px-4 py-3 text-xs font-bold uppercase text-[#ea5b0c]">Сохранить</button><button type="button" onClick={(event) => { const form = event.currentTarget.closest("form"); const data = form ? new FormData(form) : null; void act(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/retention`, { until: null, reason: String(data?.get("reason") || "") }); }} className="border border-white/15 px-4 py-3 text-xs">Снять</button></div>
    </form></div> : null}
    {message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}
  </div>;
}

export function EditableComment({
  csrfToken,
  requestId,
  commentId,
  author,
  createdAt,
  body,
}: {
  csrfToken: string;
  requestId: string;
  commentId: string;
  author: string;
  createdAt: string;
  body: string;
}) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  return <article className="border border-white/10 p-3"><div className="flex items-center justify-between gap-3 text-[10px] text-white/40"><span>{author} · {new Date(createdAt).toLocaleString("ru-RU")}</span><button type="button" onClick={() => setEditing((value) => !value)} className="text-[#ea5b0c]">{editing ? "Отмена" : "Редактировать"}</button></div>
    {editing ? <form className="mt-3 space-y-2" onSubmit={async (event) => {
      event.preventDefault(); setMessage("");
      const data = new FormData(event.currentTarget);
      const response = await jsonRequest(`/api/internal/personal-data/leads/${encodeURIComponent(requestId)}/comments`, csrfToken, {
        method: "PATCH",
        body: { commentId, body: String(data.get("body") || "") },
      });
      if (response.ok) window.location.reload(); else setMessage("Комментарий не изменён.");
    }}><textarea name="body" defaultValue={body} required minLength={2} maxLength={4_000} rows={4} className="w-full border border-white/15 bg-black/25 px-4 py-3 text-sm" /><button className="border border-[#ea5b0c] px-4 py-2 text-xs font-bold uppercase text-[#ea5b0c]">Сохранить</button>{message ? <p role="alert" className="text-xs text-red-200">{message}</p> : null}</form> : <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>}
  </article>;
}

export function VerificationButton({ csrfToken, kind }: { csrfToken: string; kind: "audit" | "integrity" }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <button disabled={pending} onClick={async () => {
    setPending(true); setMessage("");
    const response = await jsonRequest(kind === "audit" ? "/api/internal/personal-data/access-events/verify" : "/api/internal/personal-data/integrity", csrfToken);
    const body = await response.json().catch(() => ({})) as { verification?: { valid?: boolean; events?: number }; run?: { status?: string; findingsCount?: number } };
    if (response.ok) setMessage(kind === "audit" ? `Цепочка: ${body.verification?.valid ? "целостна" : "нарушена"}; событий: ${body.verification?.events ?? 0}` : `Проверка: ${body.run?.status}; находок: ${body.run?.findingsCount ?? 0}`);
    else setMessage("Проверка не выполнена.");
    setPending(false);
  }} className="border border-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase text-[#ea5b0c] disabled:opacity-50">{pending ? "Проверка…" : kind === "audit" ? "Проверить цепочку" : "Запустить проверку"}{message ? <span className="ml-3 normal-case text-white/60">{message}</span> : null}</button>;
}

export function SessionControls({ csrfToken, sessions }: { csrfToken: string; sessions: Array<{ id: string; createdAt: string; lastSeenAt: string; absoluteExpiresAt: string; revokedAt: string | null; current: boolean }> }) {
  const revoke = async (mode: string, sessionId?: string) => {
    const response = await jsonRequest("/api/internal/personal-data/profile/sessions", csrfToken, { method: "DELETE", body: { mode, sessionId } });
    if (response.ok) window.location.reload();
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><button onClick={() => void revoke("others")} className="border border-white/15 px-3 py-2 text-xs">Завершить другие</button><button onClick={() => void revoke("all")} className="border border-red-500/30 px-3 py-2 text-xs text-red-200">Завершить все</button></div>
    {sessions.map((session) => <div key={session.id} className="grid gap-2 border border-white/10 p-3 text-xs sm:grid-cols-[1fr_1fr_1fr_auto]">
      <span>{session.current ? "Текущая сессия" : "Другая сессия"}</span><span>Активность: {new Date(session.lastSeenAt).toLocaleString("ru-RU")}</span><span>До: {new Date(session.absoluteExpiresAt).toLocaleString("ru-RU")}</span>
      {!session.revokedAt ? <button onClick={() => void revoke("one", session.id)} className="text-[#ea5b0c]">Завершить</button> : <span className="text-white/35">Завершена</span>}
    </div>)}
  </div>;
}
