"use client";

import { useState } from "react";

export type Stage4Field = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "date" | "datetime-local" | "number" | "select" | "lines" | "checkbox" | "checkboxes";
  required?: boolean;
  defaultValue?: string | number;
  options?: Array<{ value: string; label: string }>;
  help?: string;
  min?: number;
  max?: number;
};

function fieldValue(data: FormData, field: Stage4Field) {
  if (field.kind === "checkboxes") return data.getAll(field.name).map(String);
  if (field.kind === "checkbox") return data.get(field.name) === "true";
  if (field.kind === "lines") return String(data.get(field.name) || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  if (field.kind === "number") return Number(data.get(field.name));
  return String(data.get(field.name) || "").trim();
}

export function SecureMutationForm({
  csrfToken,
  endpoint,
  method = "POST",
  fields,
  baseBody = {},
  submitLabel,
  successHref,
  confirmText,
  endpointIdField,
}: {
  csrfToken: string;
  endpoint: string;
  method?: "POST" | "PATCH";
  fields: Stage4Field[];
  baseBody?: Record<string, unknown>;
  submitLabel: string;
  successHref?: string;
  confirmText?: string;
  endpointIdField?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="grid gap-4 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true); setMessage("");
    const data = new FormData(event.currentTarget); const body: Record<string, unknown> = { ...baseBody };
    for (const field of fields) body[field.name] = fieldValue(data, field);
    try {
      const requestEndpoint = endpointIdField
        ? endpoint.replace("{id}", encodeURIComponent(String(body[endpointIdField] || "")))
        : endpoint;
      const response = await fetch(requestEndpoint, {
        method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Steelprodukt-CSRF": csrfToken }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => null) as { data?: { id?: string }; code?: string } | null;
      if (!response.ok) {
        setMessage(result?.code === "STEP_UP_REQUIRED" ? "Требуется повторное подтверждение пароля (step-up)." : `Операция отклонена: ${result?.code || "ошибка"}.`);
        return;
      }
      if (successHref) {
        const href = result?.data?.id ? successHref.replace("{id}", encodeURIComponent(result.data.id)) : successHref;
        window.location.assign(href);
      } else window.location.reload();
    } finally { setPending(false); }
  }}>
    {fields.map((field) => <label key={field.name} className={`text-xs ${field.kind === "textarea" || field.kind === "lines" || field.kind === "checkboxes" ? "md:col-span-2" : ""}`}>
      <span className="font-semibold">{field.label}</span>
      {field.kind === "textarea" || field.kind === "lines" ? <textarea name={field.name} required={field.required} defaultValue={field.defaultValue} rows={field.kind === "lines" ? 4 : 5} className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3" />
        : field.kind === "select" ? <select name={field.name} required={field.required} defaultValue={field.defaultValue} className="mt-2 w-full border border-white/15 bg-[#0b0e10] px-4 py-3">{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          : field.kind === "checkboxes" ? <span className="mt-2 grid gap-2 sm:grid-cols-2">{field.options?.map((option) => <span key={option.value} className="flex items-center gap-2 border border-white/10 p-3"><input type="checkbox" name={field.name} value={option.value} />{option.label}</span>)}</span>
            : field.kind === "checkbox" ? <span className="mt-2 flex items-center gap-3 border border-white/10 p-3"><input type="checkbox" name={field.name} value="true" />Да</span>
            : <input name={field.name} type={field.kind || "text"} required={field.required} defaultValue={field.defaultValue} min={field.min} max={field.max} autoComplete="off" className="mt-2 w-full border border-white/15 bg-black/25 px-4 py-3" />}
      {field.help ? <span className="mt-1 block text-[10px] leading-relaxed text-white/40">{field.help}</span> : null}
    </label>)}
    {message ? <p role="alert" className="text-xs text-red-200 md:col-span-2">{message}</p> : null}
    <button disabled={pending} className="bg-[#ea5b0c] px-5 py-3 text-xs font-bold uppercase disabled:opacity-50 md:col-span-2">{pending ? "Выполняется…" : submitLabel}</button>
  </form>;
}
