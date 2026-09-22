"use client";

import { useState } from "react";
import Link from "next/link";
import { CalculatorLogo } from "@/components/CalculatorLogo";
import { ClientCad2DPreview } from "@/components/ClientCad2DPreview";
import { ClientOperationSummary } from "@/components/cad/public/ClientOperationSummary";
import { ClientOperationControls } from "@/components/instant-quote/ClientOperationControls";
import { ClientQuotePrintout } from "@/components/instant-quote/ClientQuotePrintout";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { useCadProject } from "@/components/cad/shared/useCadProject";
import { CALCULATION_DISCLAIMER, CALCULATION_DISCLAIMER_SHORT, MATERIAL_LABELS, THICKNESS_OPTIONS } from "@/lib/instant-quote/client-labels";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { setActivePart } from "@/lib/instant-quote/project";

const accepted = ".dxf,.dwg,.step,.stp";
const materials = (["hot", "cold", "zinc"] as const).map((id) => ({ id: id as MaterialId, label: MATERIAL_LABELS[id] }));
const fmt = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-[#0b1014] px-3 py-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange";
const actionClass = "inline-flex min-h-12 items-center justify-center rounded-lg bg-steel-orange px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel-orange disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50";

export function ClientManufacturingWorkspace({ mode = "public" }: { mode?: "public" | "production" } = {}) {
  const { inputRef, project, setProject, activePart, activePreview, activeCalculation, approvedProjectTotalRub, estimatedProjectTotalRub, quoteHandoffHref, isAnalyzing, materialId, thickness, quantity, canCalculate, calculateLabel, calculateLabelShort, onChange, onDragEnter, onDragOver, onDragLeave, onDrop, updateQuantity, updateMaterial, updateThickness, toggleOperation, updateOperationInputs, removeActivePart, calculateProject, clientMetrics, isDraggingFiles, projectCalculationMessage, calculationFailed, statusByPartId, calculation, calculatedAt, materialConfirmed, bendConflict } = useCadProject();
  const [preferredView, setPreferredView] = useState<"2d" | "3d">("3d");
  const hasParts = project.parts.length > 0;
  const showMesh = Boolean(activePreview?.meshes.length) && (preferredView === "3d" || !activePreview?.drawing);
  const activeTotal = activeCalculation && ["approved", "estimate"].includes(activeCalculation.price.status) ? activeCalculation.price.totalRub : null;
  const needsReview = Boolean(calculation?.parts.some(part => part.price.status !== "approved"));
  const displayedTotalRub = approvedProjectTotalRub ?? estimatedProjectTotalRub;
  const hasEstimate = Boolean(calculation?.parts.some(part => part.price.status === "estimate"));
  const handoffHref = mode === "production" ? "/internal/production-calculations" : quoteHandoffHref;
  const operations = activePart?.configuration.operations ?? [];
  const operationInputs = activePart?.configuration.operationInputs ?? {};


  return (
    <div className="cad-workspace bg-[#0c1115] pb-28 text-white lg:pb-12">
      <section className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10" aria-label="CAD-калькулятор">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <CalculatorLogo className="w-40 sm:w-48" />
          <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm" aria-label="Порядок расчёта">
            {["Загрузить CAD", "Выбрать параметры", "Получить расчёт"].map((label, index) => <li key={label} className={(index === 0 && !hasParts) || (index === 1 && hasParts && !calculation) || (index === 2 && calculation) ? "text-white" : "text-white/55"}><span className="mr-2 font-mono text-steel-orange">0{index + 1}</span>{label}</li>)}
          </ol>
        </header>

        {hasParts && <nav className="mb-4 flex min-w-0 flex-wrap items-start gap-3" aria-label="Детали проекта">
          <details className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#141b21]">
            <summary className="cursor-pointer truncate px-4 py-3 text-sm"><span className="mr-2 text-steel-orange">{project.parts.length} поз.</span>{activePart?.fileName}</summary>
            <div className="max-h-64 overflow-y-auto border-t border-white/10">{project.parts.map((part, index) => <button key={part.id} type="button" aria-current={part.id === activePart?.id ? "true" : undefined} onClick={() => setProject((current) => setActivePart(current, part.id))} className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/10 ${part.id === activePart?.id ? "bg-white/10" : ""}`}><span className="font-mono text-white/50">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate">{part.fileName}</span><span className="shrink-0 text-white/70">{part.configuration.quantity} шт.</span></button>)}</div>
          </details>
          <button type="button" onClick={() => inputRef.current?.click()} className="min-h-12 rounded-lg border border-white/25 px-4 py-3 text-sm hover:border-steel-orange">+ Добавить CAD</button>
        </nav>}

        <div className={hasParts ? "grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]" : ""}>
          <div className="min-w-0">
            <div className={`relative overflow-hidden rounded-xl border ${isDraggingFiles ? "border-steel-orange" : "border-white/15"}`} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
              {hasParts && <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 bg-[#172028] px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{activePart?.fileName}</p>
                <div className="flex items-center gap-2">
                  {activePreview?.drawing && Boolean(activePreview.meshes.length) && <div className="flex gap-1" aria-label="Вид модели">{(["2d", "3d"] as const).map((view) => <button key={view} type="button" onClick={() => setPreferredView(view)} aria-pressed={preferredView === view} className={`min-h-11 rounded px-3 text-xs ${preferredView === view ? "bg-steel-orange text-black" : "bg-white/10"}`}>{view.toUpperCase()}</button>)}</div>}
                  <button type="button" onClick={removeActivePart} className="min-h-11 px-2 text-xs text-white/65 hover:text-red-300">Удалить</button>
                </div>
              </div>}
              {!hasParts ? <div className="grid min-h-[420px] gap-8 bg-[#141c22] p-6 sm:p-10 lg:grid-cols-[1fr_.65fr] lg:items-center lg:p-14">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[.16em] text-steel-orange">От модели к готовой детали</span>
                  <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">Ваш чертёж.<br />Наше производство.</h2>
                  <p className="mt-4 max-w-lg text-base leading-7 text-white/70">DXF или STEP до 50 МБ на файл, до 100 МБ на проект. Выберите материал и количество. Посмотрите деталь и получите предварительный расчёт без регистрации.</p>
                  <button type="button" onClick={() => inputRef.current?.click()} className={`${actionClass} mt-7`}>Выбрать файлы <span aria-hidden="true" className="ml-5">↑</span></button>
                  <p className="mt-3 text-sm text-white/60">Или перетащите файлы в эту область</p>
                  <Link href="/contacts?source=online-order#contact-form" className="mt-6 inline-flex min-h-11 items-center text-sm text-white/80 underline underline-offset-4">Нет CAD-файла — помощь инженера</Link>
                </div>
                <div className="rounded-xl border border-white/15 bg-[#0c1115] p-6">
                  <p className="mb-5 text-sm font-semibold">Что можно загрузить</p>
                  {[ ["DXF", "Плоская деталь или развёртка"], ["STEP / STP", "Трёхмерная модель детали"], ["DWG", "Проверка геометрии инженером"] ].map(([format, description]) => <div key={format} className="flex items-center gap-4 border-t border-white/10 py-4"><span className="w-24 shrink-0 font-mono text-sm text-steel-orange">{format}</span><p className="text-sm leading-5 text-white/75">{description}</p></div>)}
                  <p className="mt-3 text-xs leading-5 text-white/55">Можно выбрать несколько файлов. Каждый файл — отдельная позиция проекта.</p>
                </div>
              </div> : <>
                <div className={`relative h-[360px] sm:h-[480px] xl:h-[560px] ${activePreview?.drawing && !showMesh ? "bg-[#e9eef0] text-[#18232b] [&_button]:border-slate-400 [&_p]:text-slate-700 [&_p_span]:text-slate-800" : "bg-[#080d11]"}`}>
                  {isAnalyzing ? <div role="status" className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"><span className="mb-4 h-8 w-8 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" /><p className="text-lg font-medium">Обрабатываем модель</p><p className="mt-2 text-sm opacity-70">Подготавливаем предпросмотр и определяем габариты.</p></div> : showMesh && activePreview ? <CadMeshViewer key={activePart?.id} meshes={activePreview.meshes} className="h-full" /> : activePreview?.drawing ? <div className="absolute inset-0 p-4 sm:p-6"><ClientCad2DPreview key={activePart?.id} drawing={activePreview.drawing} /></div> : <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"><p className="text-xl">Предпросмотр недоступен</p><p className="mt-3 max-w-md text-sm leading-6 text-white/70">{activePart && statusByPartId[activePart.id] || "Файл добавлен. Его геометрию проверит инженер."}</p><Link href={quoteHandoffHref} className="mt-5 text-sm text-steel-orange underline underline-offset-4">Передать на проверку</Link></div>}
                </div>
                {activePreview && <div className="grid grid-cols-3 gap-px bg-white/10">{clientMetrics.map(([label, value]) => <div key={label} className="bg-[#172028] px-4 py-3"><p className="text-xs text-white/60">Габарит {label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>)}</div>}
              </>}
              {isDraggingFiles && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0c1115]/95 p-8 text-center text-xl text-steel-orange">Отпустите файлы, чтобы добавить в проект</div>}
            </div>
            {activePart && <div className={`mt-4 rounded-lg border px-4 py-4 ${needsReview || bendConflict ? "border-amber-300/35 bg-amber-300/[.05]" : "border-white/15"}`}>
              <p className="text-sm font-medium">{needsReview ? "Нужна проверка инженером" : "Проверка геометрии"}</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{statusByPartId[activePart.id] ?? activePreview?.message ?? "Проверьте параметры и запустите расчёт."}</p>
              {activePreview?.cad.bendCountFromModel != null && <p className="mt-2 text-sm text-white/75">Гибы по модели: {activePreview.cad.bendCountFromModel}. Проверьте состав обработки справа.</p>}
              {bendConflict && <p role="alert" className="mt-2 text-sm text-amber-200">{bendConflict}</p>}
            </div>}
          </div>

          {activePart && <aside className="min-w-0 space-y-4 lg:sticky lg:top-24" aria-label="Параметры и стоимость">
            <section className="rounded-xl border border-white/15 bg-[#141b21] p-5">
              <h2 className="text-lg font-semibold">Параметры детали</h2>
              <div className="mt-5"><p id="part-material-label" className="text-sm font-medium">Материал</p><div role="group" aria-labelledby="part-material-label" className="mt-2 grid grid-cols-3 gap-2">{materials.map((option) => <button key={option.id} type="button" aria-pressed={materialId === option.id} onClick={() => updateMaterial(option.id)} className={`min-h-14 rounded-lg border px-2 py-3 text-xs font-medium transition ${materialId === option.id ? "border-steel-orange bg-steel-orange/10 text-white" : "border-white/20 text-white/70 hover:border-white/50"}`}>{option.label}</button>)}</div><p className="mt-2 text-xs leading-5 text-white/65">{materialConfirmed[activePart.id] ? "Материал указан вами." : "Выбран по умолчанию — проверьте. Из CAD материал не определяется."}</p></div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div><label htmlFor="part-thickness" className="text-sm font-medium">Толщина, мм</label><select id="part-thickness" value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className={fieldClass}>{THICKNESS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <div><label htmlFor="part-quantity" className="text-sm font-medium">Количество, шт.</label><input id="part-quantity" value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} inputMode="numeric" className={fieldClass} /></div>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/65">{activePreview?.cad.thicknessFromModelMm == null ? "Толщину нужно указать по чертежу." : `По модели: ${fmt(activePreview.cad.thicknessFromModelMm)} мм. Проверьте выбранную толщину.`}</p>
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Быстрый выбор количества">{[1, 10, 25, 50, 100].map((value) => <button key={value} type="button" aria-pressed={quantity === value} onClick={() => updateQuantity(value)} className={`min-h-11 min-w-11 rounded-md border px-3 text-xs ${quantity === value ? "border-steel-orange text-steel-orange" : "border-white/15 text-white/70 hover:border-white/40"}`}>{value}</button>)}</div>
              <details className="group mt-5 rounded-lg border border-white/15">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4"><span className="text-sm font-medium">Дополнительная обработка</span><span aria-hidden="true" className="text-xl text-steel-orange group-open:rotate-45">+</span></summary>
                <div className="border-t border-white/10 p-3 [&_p]:text-xs [&_p]:text-white/70 [&_label_span]:text-xs [&_label_span]:text-white/70"><ClientOperationControls operations={operations} operationInputs={operationInputs} detectedBendCount={activePreview?.cad.bendCountFromModel ?? null} onToggle={toggleOperation} onQuantityChange={updateOperationInputs} /></div>
              </details>
              <ClientOperationSummary quantity={quantity} operations={operations} operationInputs={operationInputs} detectedBendCount={activePreview?.cad.bendCountFromModel ?? null} />
            </section>

            <section className="rounded-xl border border-steel-orange/35 bg-[#172028] p-5" aria-label="Результат расчёта">
              <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium text-white/75">{hasEstimate ? "Ориентировочная стоимость" : "Предварительная стоимость"}</h2><span className="shrink-0 text-xs text-white/55">{project.parts.length} поз.</span></div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-steel-orange tabular-nums">{displayedTotalRub != null ? `${fmt(displayedTotalRub!)} ₽` : calculation ? "На проверке" : "—"}</p>
              {typeof activeTotal === "number" && <p className="mt-2 text-sm text-white/75">{project.parts.length > 1 ? `Эта позиция: ${fmt(activeTotal)} ₽ · ` : ""}{fmt(activeTotal / quantity)} ₽ / шт. при {quantity} шт.</p>}
              {displayedTotalRub != null && calculation?.parts.some(part => part.price.materialPriceDate) && <p className="mt-2 text-xs text-white/75">Прайс металла от {[...new Set(calculation.parts.map(part => part.price.materialPriceDate).filter(Boolean))].join(", ")}</p>}
              {displayedTotalRub != null && <p className="mt-2 text-xs text-white/65">Налоговые условия и окончательная цена — в коммерческом предложении.</p>}
              {hasEstimate && <p className="mt-3 text-sm text-amber-200">Изготовляемость и окончательную цену подтвердит инженер. Запуск в производство не согласован.</p>}
              <button type="button" onClick={() => void calculateProject()} disabled={!canCalculate} className={`${actionClass} mt-5 w-full`}>{calculateLabel}</button>
              {projectCalculationMessage && <div role={calculationFailed ? "alert" : "status"} className={`mt-3 text-sm leading-6 ${calculationFailed ? "text-amber-200" : "text-white/75"}`}><p>{projectCalculationMessage}</p>{calculationFailed && <button type="button" onClick={() => void calculateProject()} className="mt-2 min-h-11 text-steel-orange underline underline-offset-4">Повторить расчёт</button>}</div>}
              <Link href={handoffHref} className="mt-3 flex min-h-12 items-center justify-center rounded-lg border border-white/25 px-4 py-3 text-center text-sm font-medium transition hover:border-steel-orange">{needsReview ? "Передать инженеру на проверку" : "Отправить заявку"}<span className="ml-3" aria-hidden="true">→</span></Link>
              {calculation && <div className="mt-4 border-t border-white/15 pt-3"><p className="break-all text-xs leading-5 text-white/65">Расчёт {calculation.projectId}<br />{calculatedAt?.toLocaleString("ru-RU")}</p><button type="button" onClick={() => window.print()} className="mt-2 min-h-11 text-sm text-white/80 underline underline-offset-4">Печать / PDF</button></div>}
              <p className="mt-4 text-xs leading-5 text-white/65">Цена металла обновляется из прайса поставщика. При отсутствии актуальной цены потребуется проверка инженером.</p>
              <p className="mt-3 border-t border-white/15 pt-3 text-xs leading-5 text-white/65">{CALCULATION_DISCLAIMER} <Link href="/legal/terms" className="underline underline-offset-2">Условия</Link></p>
            </section>
          </aside>}
        </div>
      </section>
      {hasParts && <div className="mobile-quote-bar fixed inset-x-0 z-[80] flex items-center gap-3 border-t border-white/20 bg-[#141b21]/95 px-4 py-3 backdrop-blur-sm lg:hidden"><div className="min-w-0 grow"><p className="text-xs leading-4 text-white/70" title={CALCULATION_DISCLAIMER}>{hasEstimate ? "Ориентировочно · проверит инженер" : CALCULATION_DISCLAIMER_SHORT}</p><p className="truncate text-lg font-semibold text-steel-orange">{displayedTotalRub != null ? `${fmt(displayedTotalRub!)} ₽` : needsReview ? "Нужна проверка" : "—"}</p></div>{displayedTotalRub != null || needsReview ? <Link href={handoffHref} className={`${actionClass} shrink-0`}>{needsReview ? "Инженеру" : "Отправить"}</Link> : <button type="button" onClick={() => void calculateProject()} disabled={!canCalculate} className={`${actionClass} shrink-0`}>{calculateLabelShort}</button>}</div>}
      {calculation && <ClientQuotePrintout calculation={calculation} totalRub={displayedTotalRub} preparedAt={calculatedAt ?? new Date()} />}
      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" aria-label="Загрузить CAD-файлы" />
    </div>
  );
}
