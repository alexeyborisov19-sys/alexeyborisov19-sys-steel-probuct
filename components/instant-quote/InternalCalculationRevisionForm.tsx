"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type InternalRevisionFormPart = {
  partId: string;
  label: string;
  bendCount?: number;
  weldLengthM?: number;
  powderAreaM2?: number;
  powderSides?: 1 | 2;
};

type RowState = {
  bendCount: string;
  weldLengthM: string;
  powderAreaM2: string;
  powderSides: string;
};

function rowFromPart(part: InternalRevisionFormPart): RowState {
  return {
    bendCount: part.bendCount == null ? "" : String(part.bendCount),
    weldLengthM: part.weldLengthM == null ? "" : String(part.weldLengthM),
    powderAreaM2: part.powderAreaM2 == null ? "" : String(part.powderAreaM2),
    powderSides: part.powderSides == null ? "" : String(part.powderSides),
  };
}

function parsedValue(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export function InternalCalculationRevisionForm({
  fileName,
  csrfToken,
  parts,
}: {
  fileName: string;
  csrfToken: string;
  parts: InternalRevisionFormPart[];
}) {
  const router = useRouter();
  const initial = useMemo<Record<string, RowState>>(
    () => Object.fromEntries(parts.map((part) => [part.partId, rowFromPart(part)])),
    [parts],
  );
  const [rows, setRows] = useState<Record<string, RowState>>(initial);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partId: string, field: keyof RowState, value: string) => {
    setRows((current) => ({
      ...current,
      [partId]: { ...current[partId], [field]: value },
    }));
  };

  const submit = async () => {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Укажите причину ревизии минимум из 3 символов.");
      return;
    }

    const bodyParts: Record<string, Record<string, number | null>> = {};
    for (const part of parts) {
      const current = rows[part.partId];
      const original = initial[part.partId];
      const patch: Record<string, number | null> = {};
      if (current.bendCount !== original.bendCount) patch.bendCount = parsedValue(current.bendCount);
      if (current.weldLengthM !== original.weldLengthM) patch.weldLengthM = parsedValue(current.weldLengthM);
      if (current.powderAreaM2 !== original.powderAreaM2) patch.powderAreaM2 = parsedValue(current.powderAreaM2);
      if (current.powderSides !== original.powderSides) patch.powderSides = parsedValue(current.powderSides);
      if (Object.keys(patch).length > 0) bodyParts[part.partId] = patch;
    }

    if (Object.keys(bodyParts).length === 0) {
      setError("Измените хотя бы один технологический параметр.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/internal/online-order/production-calculations/${encodeURIComponent(fileName)}/recalculate`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-steelprodukt-csrf": csrfToken,
        },
        body: JSON.stringify({
          reason: reason.trim(),
          internalNote: internalNote.trim() || undefined,
          parts: bodyParts,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        data?: { fileName?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.ok || !payload.data?.fileName) {
        throw new Error(payload?.error?.message || "Не удалось создать ревизию расчёта.");
      }
      router.push(`/internal/production-calculations/${encodeURIComponent(payload.data.fileName)}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать ревизию расчёта.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-5">
    <div className="border border-amber-400/20 bg-amber-400/[.04] p-4 text-sm leading-relaxed text-white/60">
      Изменяются только физические технологические параметры. Ставки, закупочные цены и суммы вводить вручную нельзя: новая ревизия полностью пересчитывается по текущей закрытой расчётной базе.
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.12em] text-white/35">
          <tr><th className="p-2">Позиция</th><th className="p-2">Гибов / шт.</th><th className="p-2">Сварной шов, м / шт.</th><th className="p-2">Площадь окраски, м² / шт.</th><th className="p-2">Сторон окраски</th></tr>
        </thead>
        <tbody>{parts.map((part) => {
          const row = rows[part.partId];
          return <tr key={part.partId} className="border-b border-white/[.06]">
            <td className="p-2"><div className="font-semibold">{part.label}</div><div className="mt-1 text-xs text-white/35">{part.partId}</div></td>
            <td className="p-2"><input type="number" min={0} step={1} value={row.bendCount} onChange={(event) => update(part.partId, "bendCount", event.target.value)} className="w-full border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
            <td className="p-2"><input type="number" min={0} step="0.001" value={row.weldLengthM} onChange={(event) => update(part.partId, "weldLengthM", event.target.value)} className="w-full border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
            <td className="p-2"><input type="number" min={0} step="0.001" value={row.powderAreaM2} onChange={(event) => update(part.partId, "powderAreaM2", event.target.value)} className="w-full border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
            <td className="p-2"><select value={row.powderSides} onChange={(event) => update(part.partId, "powderSides", event.target.value)} className="w-full border border-white/10 bg-[#111416] px-3 py-2 outline-none focus:border-steel-orange/60"><option value="">—</option><option value="1">1</option><option value="2">2</option></select></td>
          </tr>;
        })}</tbody>
      </table>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.12em] text-white/40">Причина ревизии *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full border border-white/10 bg-black/20 p-3 outline-none focus:border-steel-orange/60" placeholder="Например: уточнена длина сварного шва технологом по КД" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.12em] text-white/40">Внутреннее примечание</span><textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full border border-white/10 bg-black/20 p-3 outline-none focus:border-steel-orange/60" placeholder="Необязательно" /></label>
    </div>

    {error && <div className="border border-red-400/25 bg-red-400/[.05] p-3 text-sm text-red-200">{error}</div>}
    <button type="button" disabled={busy} onClick={() => void submit()} className="border border-steel-orange bg-steel-orange px-5 py-3 text-sm font-bold text-black disabled:cursor-wait disabled:opacity-50">{busy ? "Пересчитываем…" : "Создать новую ревизию и пересчитать"}</button>
  </div>;
}
