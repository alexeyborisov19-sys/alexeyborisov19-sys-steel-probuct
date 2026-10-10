"use client";
import { AttributionLink } from "@/components/AttributionLink";
import { CalculatorLogo } from "@/components/CalculatorLogo";
import { CassetteProjectEditor } from "@/components/cassette-project/CassetteProjectEditor";

import { useEffect, useMemo, useState } from "react";
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
const thicknesses: Array<{ value: Thickness; label: string }> = [
  { value: "0.65", label: "0,65" }, { value: "0.7", label: "0,7" },
  { value: "1.0", label: "1,0" }, { value: "1.2", label: "1,2" },
];
const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
function numeric(value: string) { return Number(value.trim().replace(/\s+/g, "").replace(",", ".")); }

function MetalCassetteQuickEstimate() {
  const [mode, setMode] = useState<Mode>("area");
  const [type, setType] = useState<CassetteType>("open");
  const [thickness, setThickness] = useState<Thickness>("0.7");
  const [area, setArea] = useState("100");
  const [wallWidth, setWallWidth] = useState("12000");
  const [wallHeight, setWallHeight] = useState("6000");
  const [openings, setOpenings] = useState("0");
  const [responseState, setResponseState] = useState<{ key: string; value: Estimate } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  function selectType(nextType: CassetteType) {
    setType(nextType);
  }
  function selectThickness(nextThickness: Thickness) {
    setThickness(nextThickness);
  }
  const payload = useMemo(() => ({
    mode, type, thickness, areaM2: numeric(area), wallWidthMm: numeric(wallWidth),
    wallHeightMm: numeric(wallHeight), openingsM2: numeric(openings),
  }), [mode, type, thickness, area, wallWidth, wallHeight, openings]);
  const requestKey = JSON.stringify(payload);
  const result = responseState?.key === requestKey ? responseState.value : null;
  const amount = result?.approximateTotalRub;
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = window.setTimeout(async () => {
      setStatus("loading"); setErrorMessage(null);
      deadline = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch("/api/calc-metallokassety", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: controller.signal,
        });
        const data = await response.json() as Estimate & { error?: string };
        if (!response.ok) {
          if (!disposed) setErrorMessage(response.status === 400 && data.error ? data.error : "Сервис расчёта временно недоступен. Повторите попытку.");
          throw new Error("estimate failed");
        }
        if (disposed) return;
        if (![data.netAreaM2, data.quantity, data.defaultRateRubM2, data.approximateRateRubM2, data.approximateTotalRub]
          .every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) throw new Error("invalid estimate");
        setResponseState({ key: requestKey, value: data }); setStatus("ready");
      } catch {
        if (disposed) return;
        setResponseState(null); setStatus("error");
        setErrorMessage(current => current ?? "Не удалось связаться с сервером расчёта. Проверьте соединение и повторите попытку.");
      } finally { clearTimeout(deadline); }
    }, 140);
    return () => { disposed = true; window.clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [payload, requestKey, retry]);
  const specialistHref = {
    pathname: "/contacts",
    query: {
      source: "calculator-metallokassety", mode, type, thickness,
      ...(mode === "wall"
        ? { wallWidth: String(payload.wallWidthMm), wallHeight: String(payload.wallHeightMm), openings: String(payload.openingsM2) }
        : { inputArea: String(payload.areaM2) }),
      ...(result ? { area: String(result.netAreaM2), quantity: String(result.quantity) } : {}),
    },
    hash: "contact-form",
  };
  const typeName = type === "open" ? "Открытая" : "Закрытая";

  return (
    <section id="calculator-metallokasset" className="mt-12 scroll-mt-24 overflow-hidden border border-steel-orange/35 bg-[#101417] sm:mt-16">
      <div className="border-b border-white/10 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><CalculatorLogo /><p className="eyebrow">Предварительный расчёт</p></div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <h2 className="text-2xl font-semibold uppercase leading-tight sm:text-3xl">Калькулятор металлокассет</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              Укажите площадь или габариты стены, тип кассеты и толщину. Получите предварительную стоимость партии.
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
            <legend className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Тип кассеты</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["open", "closed"] as const).map((value) => {
                const selected = type === value;
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => selectType(value)} className={`min-h-16 border px-4 py-3 text-left transition ${selected ? "border-steel-orange bg-steel-orange/12" : "border-white/12 bg-[#0c1013] hover:border-steel-orange/60"}`}>
                    <span className="block text-sm font-semibold">{value === "open" ? "Открытая" : "Закрытая"}</span>
                    <span className="mt-1 block text-sm leading-6 text-white/75">{value === "open" ? "видимый крепёж · открытый шов" : "скрытый крепёж · замковый стык"}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {mode === "area" ? (
            <div className="mt-6">
              <label htmlFor="facade-area" className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Площадь фасада</label>
              <div className="mt-3 flex">
                <input id="facade-area" inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-xl font-semibold outline-none focus:border-steel-orange" aria-describedby="area-help" />
                <span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 bg-white/[.035] text-sm font-bold text-steel-orange">м²</span>
              </div>
              <p id="area-help" className="mt-2 text-sm leading-6 text-white/70">Быстрая оценка для первого бюджета. Точная раскладка зависит от геометрии стен и проёмов.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wall-width" className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Ширина стены</label>
                <div className="mt-3 flex"><input id="wall-width" inputMode="numeric" value={wallWidth} onChange={(event) => setWallWidth(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/75">мм</span></div>
              </div>
              <div>
                <label htmlFor="wall-height" className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Высота стены</label>
                <div className="mt-3 flex"><input id="wall-height" inputMode="numeric" value={wallHeight} onChange={(event) => setWallHeight(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/75">мм</span></div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="wall-openings" className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Площадь окон и дверей <span className="font-normal normal-case tracking-normal text-white/70">необязательно</span></label>
                <div className="mt-3 flex"><input id="wall-openings" inputMode="decimal" value={openings} onChange={(event) => setOpenings(event.target.value)} className="min-w-0 flex-1 border border-white/18 bg-[#0c1013] px-4 py-4 text-lg font-semibold outline-none focus:border-steel-orange" /><span className="flex min-w-16 items-center justify-center border-y border-r border-white/18 text-xs text-white/75">м²</span></div>
                <p className="mt-2 text-sm leading-6 text-white/70">Положение проёмов влияет на реальную подрезку, поэтому по одной их площади результат остаётся предварительным.</p>
              </div>
            </div>
          )}
          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Толщина металла</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thicknesses.map((item) => {
                const selected = thickness === item.value;
                return <button key={item.value} type="button" aria-pressed={selected} onClick={() => selectThickness(item.value)} className={`min-h-12 border px-3 text-sm font-semibold transition ${selected ? "border-steel-orange bg-steel-orange text-black" : "border-white/12 bg-[#0c1013] text-white/68 hover:border-steel-orange/60"}`}>{item.label} мм</button>;
              })}
            </div>
          </fieldset>
          <div className="mt-6 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/70">Типовой формат</p><p className="mt-2 text-sm font-semibold">1170 × 545 мм</p></div>
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/70">Конструкция</p><p className="mt-2 text-sm font-semibold">{type === "open" ? "открытый шов" : "замковый стык"}</p></div>
            <div className="bg-[#0c1013] p-4"><p className="text-xs uppercase tracking-[.1em] text-white/70">Статус</p><p className="mt-2 text-sm font-semibold">предварительный расчёт</p></div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col bg-[radial-gradient(circle_at_100%_0%,rgba(224,86,36,.14),transparent_45%)] p-5 sm:p-8">
          <div className="border-b border-white/12 pb-5">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Результат</p>
            <p className="mt-1 text-xs text-white/75">{typeName} кассета · {thickness.replace(".", ",")} мм</p>
          </div>
          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-white/75">Ориентировочная стоимость</p>
            <p aria-live="polite" className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {status === "loading" ? "…" : typeof amount === "number" && amount > 0 ? `≈ ${money.format(amount)} ₽` : "—"}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/75">Финальная цена подтверждается после проверки раскладки, чертежей и состава заказа.</p>
            <p className="mt-3 text-sm leading-6 text-white/60">{CALCULATION_DISCLAIMER}</p>
          </div>
          <dl className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/70">Площадь облицовки</dt><dd className="mt-2 text-xl font-semibold text-steel-orange">{result ? `${decimal.format(result.netAreaM2)} м²` : "—"}</dd></div>
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/70">Количество кассет</dt><dd className="mt-2 text-xl font-semibold">{result && result.quantity > 0 ? `≈ ${money.format(result.quantity)} шт.` : "—"}</dd></div>
            <div className="bg-[#0d1114] p-4"><dt className="text-xs uppercase tracking-[.1em] text-white/70">Толщина</dt><dd className="mt-2 text-lg font-semibold">{thickness.replace(".", ",")} мм</dd></div>
          </dl>
          {status === "error" ? <div className="mt-4 rounded-lg border border-red-300/30 p-4"><p role="alert" className="text-sm leading-6 text-red-200">{errorMessage}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 min-h-11 rounded border border-white/30 px-4 py-2 text-sm">Повторить расчёт</button></div> : null}
          <div className="mt-auto pt-7">
            <AttributionLink href={`${specialistHref.pathname}?${new URLSearchParams(specialistHref.query).toString()}#${specialistHref.hash}`} className="clip-corner flex min-h-12 items-center justify-center bg-steel-orange-deep px-6 py-4 text-center text-sm font-bold uppercase transition hover:bg-orange-600">Передать специалисту&nbsp; →</AttributionLink>
            <p className="mt-3 text-center text-sm leading-6 text-white/70">На следующем шаге можно приложить PDF, DXF, DWG, STEP, Excel, изображения или архив проекта.</p>
          </div>
        </div>
      </div>
    </section>
  );
}


export function MetalCassetteCalculator() {
  const [view, setView] = useState<"project" | "estimate">("project");
  return <div className="mt-12 sm:mt-16">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <CalculatorLogo />
      <div className="flex max-w-full flex-wrap gap-2" aria-label="Режим калькулятора металлокассет">
        {([ ["project", "Проект и раскладка"], ["estimate", "Быстрая оценка цены"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} aria-controls={`cassette-view-${key}`} onClick={() => setView(key)} className={`min-h-12 border px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${view === key ? "border-steel-orange bg-steel-orange text-black" : "border-white/25 text-white/80 hover:border-steel-orange"}`}>{label}</button>)}
      </div>
    </div>
    <div id="cassette-view-project" hidden={view !== "project"}><CassetteProjectEditor /></div>
    <div id="cassette-view-estimate" hidden={view !== "estimate"}><p className="border border-white/15 bg-[#101417] p-4 text-sm leading-7 text-white/75">Быстрая оценка по типовым допущениям. Она не использует проектную раскладку и не является ценой её ведомости. Стоимость рассчитывается автоматически.</p><MetalCassetteQuickEstimate /></div>
  </div>;
}
