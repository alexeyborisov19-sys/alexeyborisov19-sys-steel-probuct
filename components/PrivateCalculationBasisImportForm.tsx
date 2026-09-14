"use client";

import { useState } from "react";

type ImportResponse = {
  ok?: boolean;
  code?: string;
  supplierSourceDate?: string;
  supplierRows?: number;
  warnings?: string[];
};

export function PrivateCalculationBasisImportForm() {
  const [token, setToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const submit = async () => {
    if (!token.trim() || !file || busy) return;
    setBusy(true);
    setMessage("Импортируем закрытые ставки и обновляем официальный прайс…");
    setWarnings([]);
    try {
      const form = new FormData();
      form.set("calculator", file, file.name);
      const response = await fetch("/api/internal/online-order/import-private-calculator", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const payload = await response.json().catch(() => null) as ImportResponse | null;
      if (!response.ok || !payload?.ok) {
        const text = payload?.code === "ALREADY_IMPORTED"
          ? "Импорт уже был выполнен. Повторное использование токена заблокировано."
          : payload?.code === "UNAUTHORIZED"
            ? "Неверный одноразовый токен."
            : "Импорт не завершён. Закрытая база не активирована полностью.";
        throw new Error(text);
      }
      setMessage(`Готово. Закрытая база установлена; официальный прайс обновлён${payload.supplierSourceDate ? ` (${payload.supplierSourceDate})` : ""}${payload.supplierRows ? `, строк: ${payload.supplierRows}` : ""}.`);
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
      setToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Импорт не завершён.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl border border-white/10 bg-[#101416] p-6 text-white">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Одноразовая настройка</p>
      <h1 className="mt-3 text-2xl font-semibold">Закрытая расчётная база</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/50">
        Загрузите внутренний файл калькулятора. Заводские ставки сохраняются только в закрытом серверном хранилище; в клиентский код и публичный API они не попадают.
      </p>

      <label className="mt-6 block text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Одноразовый токен</label>
      <input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        type="password"
        autoComplete="off"
        className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none"
      />

      <label className="mt-5 block text-[10px] font-bold uppercase tracking-[.13em] text-white/35">калькулятор.html</label>
      <input
        type="file"
        accept=".html,.htm,text/html"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-2 block w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm text-white/70"
      />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!token.trim() || !file || busy}
        className="mt-6 w-full border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/25"
      >
        {busy ? "Импорт…" : "Установить расчётную базу"}
      </button>

      {message && <p className="mt-4 text-sm leading-relaxed text-white/65">{message}</p>}
      {warnings.length > 0 && <div className="mt-4 space-y-2 border border-steel-orange/20 bg-steel-orange/[.04] p-4 text-xs leading-relaxed text-white/50">{warnings.map((item) => <p key={item}>{item}</p>)}</div>}
    </div>
  );
}
