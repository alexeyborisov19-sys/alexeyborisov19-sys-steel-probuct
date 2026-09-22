"use client";

import { useState } from "react";
import type { ProductionOrderStorageSnapshot } from "@/lib/server/production-order/storage-settings";

type SafePayload<T> = {
  ok?: boolean;
  data?: T;
  code?: string;
};

function sourceLabel(source: ProductionOrderStorageSnapshot["source"]) {
  if (source === "saved") return "сохранён в настройках";
  if (source === "environment") return "взят из переменной окружения";
  return "не задан";
}

function errorMessage(code: string | undefined, action: "browse" | "save") {
  if (code === "BLOCKED" && action === "browse") {
    return "Обзор папок доступен только на компьютере, где запущен калькулятор. Путь можно ввести вручную.";
  }
  if (code === "VALIDATION_ERROR" && action === "save") {
    return "Папка должна существовать, быть указана абсолютным путём и быть доступна для записи.";
  }
  if (code === "CSRF_REJECTED") return "Сессия устарела. Обновите страницу и повторите действие.";
  if (code === "PERMISSION_DENIED") return "Недостаточно прав для изменения пути.";
  return action === "browse" ? "Не удалось открыть обзор папок." : "Не удалось сохранить путь.";
}

export function ProductionOrderStorageSettings({
  csrfToken,
  initialSettings,
  nativePickerSupported,
}: {
  csrfToken: string;
  initialSettings: ProductionOrderStorageSnapshot;
  nativePickerSupported: boolean;
}) {
  const [pathValue, setPathValue] = useState(initialSettings.ordersRoot ?? "");
  const [settings, setSettings] = useState(initialSettings);
  const [browsing, setBrowsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const browse = async () => {
    setError(null);
    setMessage(null);
    setBrowsing(true);
    try {
      const response = await fetch("/api/internal/production-order/storage-settings/browse", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-steelprodukt-csrf": csrfToken,
        },
        body: "{}",
      });
      const payload = await response.json().catch(() => null) as SafePayload<{ status: "selected" | "cancelled"; path?: string }> | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(errorMessage(payload?.code, "browse"));
      }
      if (payload.data.status === "selected" && payload.data.path) {
        setPathValue(payload.data.path);
        setMessage("Папка выбрана. Нажмите «Сохранить путь», чтобы использовать её для новых заказов.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessage(undefined, "browse"));
    } finally {
      setBrowsing(false);
    }
  };

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!pathValue.trim()) {
      setError("Укажите папку для хранения заказов.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/internal/production-order/storage-settings", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-steelprodukt-csrf": csrfToken,
        },
        body: JSON.stringify({ ordersRoot: pathValue.trim() }),
      });
      const payload = await response.json().catch(() => null) as SafePayload<{ settings: ProductionOrderStorageSnapshot }> | null;
      if (!response.ok || !payload?.ok || !payload.data?.settings) {
        throw new Error(errorMessage(payload?.code, "save"));
      }
      setSettings(payload.data.settings);
      setPathValue(payload.data.settings.ordersRoot ?? "");
      setMessage("Путь сохранён. Новые папки КП будут создаваться внутри этой папки.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessage(undefined, "save"));
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-5">
    <div className="border border-white/10 bg-white/[.02] p-4 text-sm leading-relaxed text-white/60">
      В этой папке система будет создавать каталоги вида <b className="text-white/85">«№ КП + название КП»</b>, сохранять КП, производственную заявку, CAD-файлы, чертежи и вложения. Путь хранится в закрытом серверном файле настроек и сохраняется после перезапуска приложения.
    </div>

    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[.12em] text-white/40">Папка для заказов</span>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row">
        <input
          type="text"
          value={pathValue}
          onChange={(event) => setPathValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={process.platform === "win32" ? "D:\\Производство\\Заказы" : "/Volumes/Production/Orders"}
          className="min-h-12 grow border border-white/15 bg-black/20 px-4 py-3 font-mono text-sm outline-none focus:border-steel-orange/60"
        />
        <button
          type="button"
          onClick={() => void browse()}
          disabled={browsing || saving || !nativePickerSupported}
          className="min-h-12 border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {browsing ? "Открываем…" : "Обзор"}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || browsing}
          className="min-h-12 border border-steel-orange bg-steel-orange px-5 py-3 text-sm font-bold text-black disabled:cursor-wait disabled:opacity-50"
        >
          {saving ? "Проверяем и сохраняем…" : "Сохранить путь"}
        </button>
      </div>
    </label>

    <div className="grid gap-3 text-sm md:grid-cols-3">
      <div className="border border-white/10 p-3"><div className="text-xs uppercase tracking-[.1em] text-white/35">Состояние</div><div className="mt-1 font-semibold">{settings.ordersRoot ? "Настроено" : "Не настроено"}</div></div>
      <div className="border border-white/10 p-3"><div className="text-xs uppercase tracking-[.1em] text-white/35">Источник</div><div className="mt-1">{sourceLabel(settings.source)}</div></div>
      <div className="border border-white/10 p-3"><div className="text-xs uppercase tracking-[.1em] text-white/35">Последнее изменение</div><div className="mt-1">{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString("ru-RU") : "—"}</div>{settings.updatedByDisplayName && <div className="mt-1 text-xs text-white/40">{settings.updatedByDisplayName}</div>}</div>
    </div>

    {!nativePickerSupported && <div className="border border-amber-400/20 bg-amber-400/[.04] p-3 text-sm text-amber-100/80">На этой системе кнопка «Обзор» недоступна. Абсолютный путь можно ввести вручную.</div>}
    {message && <div className="border border-emerald-400/20 bg-emerald-400/[.04] p-3 text-sm text-emerald-100/85">{message}</div>}
    {error && <div className="border border-red-400/25 bg-red-400/[.05] p-3 text-sm text-red-200">{error}</div>}
  </div>;
}
