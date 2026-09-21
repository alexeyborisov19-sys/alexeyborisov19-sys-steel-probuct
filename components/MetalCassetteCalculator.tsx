"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CALCULATION_DISCLAIMER } from "@/lib/instant-quote/client-labels";

type Mode = "area" | "wall";
type CassetteType = "open" | "closed";
type Thickness = "0.65" | "0.7" | "1.0" | "1.2";
type Estimate = {
  netAreaM2: number;
  quantity: number;
  defaultRateRubM2: number;
  approximateRateRubM2: number;
  approximateTotalRub: number;
};
type ReviewedEstimate = Omit<Estimate, "approximateTotalRub" | "approximateRateRubM2"> & {
  approximateTotalRub: number | null;
  approximateRateRubM2: number | null;
  reviewStatus: "passed" | "unavailable" | "needs-review";
  message: string;
};
const thicknesses: Array<{ value: Thickness; label: string }> = [
  { value: "0.65", label: "0,65" }, { value: "0.7", label: "0,7" },
  { value: "1.0", label: "1,0" }, { value: "1.2", label: "1,2" },
];
const defaultRates: Record<CassetteType, Record<Thickness, number>> = {
  open: { "0.65": 1730, "0.7": 1764, "1.0": 2074, "1.2": 2300 },
  closed: { "0.65": 1984, "0.7": 2023, "1.0": 2378, "1.2": 2637 },
};
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
function numeric(value: string) { return Number(value.trim().replace(/\s+/g, "").replace(",", ".")); }
function defaultRate(type: CassetteType, thickness: Thickness) { return defaultRates[type][thickness]; }

export function MetalCassetteCalculator() {
  const [mode, setMode] = useState<Mode>("area");
  const [type, setType] = useState<CassetteType>("open");
  const [thickness, setThickness] = useState<Thickness>("0.7");
  const [area, setArea] = useState("100");
  const [wallWidth, setWallWidth] = useState("12000");
  const [wallHeight, setWallHeight] = useState("6000");
  const [openings, setOpenings] = useState("0");
  const [pricePerM2, setPricePerM2] = useState(String(defaultRate("open", "0.7")));
  const [responseState, setResponseState] = useState<{ key: string; value: Estimate } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reviewState, setReviewState] = useState<{ key: string; result?: ReviewedEstimate; pending: boolean; failed?: boolean } | null>(null);
  const reviewController = useRef<AbortController | null>(null);
  function selectType(nextType: CassetteType) {
    setType(nextType); setPricePerM2(String(defaultRate(nextType, thickness)));
  }
  function selectThickness(nextThickness: Thickness) {
    setThickness(nextThickness); setPricePerM2(String(defaultRate(type, nextThickness)));
  }
  function resetPrice() { setPricePerM2(String(defaultRate(type, thickness))); }
  const payload = useMemo(() => ({
    mode, type, thickness, areaM2: numeric(area), wallWidthMm: numeric(wallWidth),
    wallHeightMm: numeric(wallHeight), openingsM2: numeric(openings), pricePerM2: numeric(pricePerM2),
  }), [mode, type, thickness, area, wallWidth, wallHeight, openings, pricePerM2]);
  const requestKey = JSON.stringify(payload);
  const result = responseState?.key === requestKey ? responseState.value : null;
  const activeReview = reviewState?.key === requestKey ? reviewState : null;
  const amount = activeReview ? (activeReview.pending || activeReview.failed ? null : activeReview.result?.approximateTotalRub) : result?.approximateTotalRub;
  const rate = activeReview ? (activeReview.pending || activeReview.failed ? null : activeReview.result?.approximateRateRubM2) : result?.approximateRateRubM2;
  async function reviewEstimate() {
    reviewController.current?.abort();
    const controller = new AbortController();
    reviewController.current = controller;
    setReviewState({ key: requestKey, pending: true });
    try {
      const response = await fetch("/api/calc-metallokassety", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, review: true }), signal: controller.signal });
      if (!response.ok) throw new Error("Review unavailable");
      const data = await response.json() as ReviewedEstimate;
      if (!["passed", "unavailable", "needs-review"].includes(data.reviewStatus) || typeof data.message !== "string"
        || (data.reviewStatus !== "needs-review" && !(typeof data.approximateTotalRub === "number" && Number.isFinite(data.approximateTotalRub) && data.approximateTotalRub > 0))) throw new Error("Invalid review");
      if (!controller.signal.aborted) setReviewState({ key: requestKey, result: data, pending: false });
    } catch { if (!controller.signal.aborted) setReviewState({ key: requestKey, failed: true, pending: false }); }
  }
  useEffect(() => () => reviewController.current?.abort(), [requestKey]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch("/api/calc-metallokassety", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: controller.signal,
        });
        if (!response.ok) throw new Error("estimate failed");
        const data = (await response.json()) as Estimate;
        if (controller.signal.aborted) return;
        if (![data.netAreaM2, data.quantity, data.defaultRateRubM2, data.approximateRateRubM2, data.approximateTotalRub]
          .every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) throw new Error("invalid estimate");
        setResponseState({ key: requestKey, value: data }); setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        setResponseState(null); setStatus("error");
      }
    }, 140);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [payload, requestKey]);
  const specialistHref = result && result.netAreaM2 > 0
    ? {
        pathname: "/contacts",
        query: { source: "calculator-metallokassety", mode, type, thickness,
          area: String(result.netAreaM2), quantity: String(result.quantity) },
        hash: "contact-form",
      }
    : "/contacts#contact-form";
  const typeName = type === "open" ? "Открытая" : "Закрытая";
  const baseRate = defaultRate(type, thickness);
  const isCustomPrice = numeric(pricePerM2) !== baseRate;

  return (
    <section id="calculator-metallokasset" className="mt-12 scroll-mt-24 overflow-hidden border border-steel-orange/35 bg-[#101417] sm:mt-16">
      <div className="border-b border-white/10 px-5 py-5 sm:px-8">
        <p className="eyebrow">Предварительный расчёт</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h2 className="text-2xl font-semibold uppercase leading-tight sm:text-3xl">Калькулятор металлокассет</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              Выберите быстрый расчёт по площади или более точную оценку по габаритам стены. Базовые цены подставляются автоматически и при необходимости редактируются вручную.
            </p>
          </div>
          <div className="grid grid-cols-2 border border-white/12 bg-[#0c1013] p-1">
            <button type="button" onClick={() => setMode("area")} aria-pressed={mode === "area"} className={`min-h-11 px-3 text-xs font-bold uppercase transition ${mode === "area" ? "bg-steel-orange text-black" : "text-white/60 hover:text-white"}`}>По площади</button>
            <button type="button" onClick={() => setMode("wall")} aria-pressed={mode === "wall"} className={`min-h-11 px-3 text-xs font-bold uppercase transition ${mode === "wall" ? "bg-steel-orange text-black" : "text-white/60 hover:text-white"}`}>По стене</button>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.05fr_.95fr]">
        <div className="min-w-0 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Тип кассеты</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["open", "closed"] as const).map((value) => {
                const selected = type === value;
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => selectType(value)} className={`min-h-16 border px-4 py-3 text-left transition ${selected ? "border-steel-orange bg-steel-orange/12" : "border-white/12 bg-[#0c1013] hover:border-steel-orange/60"}`}>
                    <span className="block text-sm font-semibold">{value === "open" ? "Открытая" : "Закрытая"}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">{value === "open" ? "видимый крепёж · открытый шов" : "скрытый крепёж · замковый стык"}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {mode === "area" ? (
            <div className="mt-6">
              <label htmlFor="facade-area" className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Площадь фасада</label>
              <div className="mt-3 flex">
                <input id="facade-area" inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-xl font-semibold outline-none focus:border-steel-orange" aria-describedby="area-help" />
                <span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 bg-white/[.035] text-sm font-bold text-steel-orange">м²</span>
              </div>
              <p id="area-help" className="mt-2 text-xs leading-5 text-white/40">Быстрая оценка для первого бюджета. Точная раскладка зависит от геометрии стен и проёмов.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wall-width" className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Ширина стены</label>
                <div className="mt-3 flex"><input id="wall-width" inputMode="numeric" value={wallWidth} onChange={(event) => setWallWidth(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/50">мм</span></div>
              </div>
              <div>
                <label htmlFor="wall-height" className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Высота стены</label>
                <div className="mt-3 flex"><input id="wall-height" inputMode="numeric" value={wallHeight} onChange={(event) => setWallHeight(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/50">мм</span></div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="wall-openings" className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Площадь окон и дверей <span className="font-normal normal-case tracking-normal text-white/35">необязательно</span></label>
                <div className="mt-3 flex"><input id="wall-openings" inputMode="decimal" value={openings} onChange={(event) => setOpenings(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/50">м²</span></div>
                <p className="mt-2 text-xs leading-5 text-white/40">Положение проёмов влияет на реальную подрезку, поэтому по одной их площади результат остаётся предварительным.</p>
              </div>
            </div>
          )}
          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Толщина металла</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thicknesses.map((item) => {
                const selected = thickness === item.value;
                return <button key={item.value} type="button" aria-pressed={selected} onClick={() => selectThickness(item.value)} className={`min-h-12 border px-3 text-sm font-semibold transition ${selected ? "border-steel-orange bg-steel-orange text-black" : "border-white/12 bg-[#0c1013] text-white/68 hover:border-steel-orange/60"}`}>{item.label} мм</button>;
              })}
            </div>
          </fieldset>
          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="price-per-m2" className="text-xs font-bold uppercase tracking-[.12em] text-white/55">Цена за 1 м²</label>
              {isCustomPrice ? <button type="button" onClick={resetPrice} className="text-[11px] font-bold uppercase text-steel-orange hover:text-white">Сбросить к базовой</button> : <span className="text-[11px] text-white/35">базовая цена</span>}
            </div>
            <div className="mt-3 flex">
              <input id="price-per-m2" inputMode="decimal" value={pricePerM2} onChange={(event) => setPricePerM2(event.target.value)} className="min-w-0 flex-1 border border-steel-orange/45 bg-[#0c1013] px-4 py-4 text-xl font-semibold outline-none focus:border-steel-orange" aria-describedby="cassette-rate-help" />
              <span className="flex min-w-24 items-center justify-center border-y border-r border-steel-orange/45 bg-steel-orange/10 text-sm font-bold text-steel-orange">₽ / м²</span>
            </div>
            <p id="cassette-rate-help" className="mt-2 text-xs leading-5 text-white/40">По умолчанию подставляется базовая ставка для выбранного типа и толщины. Поле можно изменить для конкретного расчёта; итоговая ставка не может быть ниже базовой. Это расчётный ориентир, а не подтверждённая среднерыночная цена.</p>
          </div>
          <div className="mt-6 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/40">Типовой формат</p><p className="mt-2 text-sm font-semibold">1170 × 545 мм</p></div>
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/40">Конструкция</p><p className="mt-2 text-sm font-semibold">{type === "open" ? "открытый шов" : "замковый стык"}</p></div>
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/40">Статус</p><p className="mt-2 text-sm font-semibold">предварительный расчёт</p></div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col bg-[radial-gradient(circle_at_100%_0%,rgba(224,86,36,.14),transparent_45%)] p-5 sm:p-8">
          <div className="border-b border-white/12 pb-5">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Результат</p>
            <p className="mt-1 text-xs text-white/45">{typeName} кассета · {thickness.replace(".", ",")} мм</p>
          </div>
          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-white/45">Ориентировочная стоимость</p>
            <p aria-live="polite" className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {status === "loading" || activeReview?.pending ? "…" : typeof amount === "number" && amount > 0 ? `≈ ${money.format(amount)} ₽` : "—"}
            </p>
            <p className="mt-3 text-xs leading-5 text-white/45">Финальная цена подтверждается после проверки раскладки, чертежей и состава заказа.</p>
            <p className="mt-3 text-xs leading-5 text-white/60">{CALCULATION_DISCLAIMER}</p>
            <button type="button" disabled={!result || activeReview?.pending} onClick={reviewEstimate}
              className="mt-5 min-h-12 w-full border border-steel-orange px-4 py-3 text-sm font-semibold disabled:opacity-50">
              {activeReview?.pending ? "Проверяем расчёт и рынок…" : "Проверить расчёт и рынок"}
            </button>
            <p role="status" className="mt-3 text-xs leading-5 text-white/60">
              {activeReview?.failed ? "Проверка недоступна. Передайте параметры инженеру." : activeReview?.result?.message
                ?? "Оценка по формулам. Для дополнительной проверки нажмите кнопку; ИИ и рынок не считаются проверенными заранее."}
            </p>
          </div>
          <dl className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/40">Площадь облицовки</dt><dd className="mt-2 text-xl font-semibold text-steel-orange">{result ? `${decimal.format(result.netAreaM2)} м²` : "—"}</dd></div>
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/40">Количество кассет</dt><dd className="mt-2 text-xl font-semibold">{result && result.quantity > 0 ? `≈ ${money.format(result.quantity)} шт.` : "—"}</dd></div>
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/40">Принятая цена</dt><dd className="mt-2 text-lg font-semibold">{typeof rate === "number" && rate > 0 ? `≈ ${money.format(rate)} ₽/м²` : "—"}</dd></div>
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/40">Толщина</dt><dd className="mt-2 text-lg font-semibold">{thickness.replace(".", ",")} мм</dd></div>
          </dl>
          {status === "error" ? <p className="mt-4 text-sm text-red-300">Не удалось обновить расчёт. Проверьте введённые значения.</p> : null}
          <div className="mt-auto pt-7">
            <Link href={specialistHref} className="clip-corner flex min-h-12 items-center justify-center bg-steel-orange-deep px-6 py-4 text-center text-sm font-bold uppercase transition hover:bg-orange-600">Получить точный расчёт&nbsp; →</Link>
            <p className="mt-3 text-center text-xs leading-5 text-white/42">На следующем шаге можно приложить PDF, DXF, DWG, STEP, Excel, изображения или архив проекта.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
