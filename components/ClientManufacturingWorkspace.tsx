"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ClientCad2DPreview } from "@/components/ClientCad2DPreview";
import { ClientOperationControls } from "@/components/instant-quote/ClientOperationControls";
import { ClientQuotePrintout } from "@/components/instant-quote/ClientQuotePrintout";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { useCadProject } from "@/components/cad/shared/useCadProject";
import { siteConfig } from "@/lib/site";
import { CALCULATION_DISCLAIMER, CALCULATION_DISCLAIMER_SHORT, MATERIAL_LABELS, THICKNESS_OPTIONS, operationLabels } from "@/lib/instant-quote/client-labels";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { setActivePart } from "@/lib/instant-quote/project";
const accepted = ".dxf,.dwg,.step,.stp";
const FORMAT_BADGES: ReadonlyArray<{ label: string; supported: boolean; hint: string }> = [
  { label: "DXF", supported: true, hint: "Плоская развёртка: габариты и контуры определяются автоматически." },
  { label: "STEP", supported: true, hint: "3D-модель: габариты и толщина определяются автоматически." },
  { label: "STP", supported: true, hint: "То же, что STEP." },
  { label: "DWG", supported: false, hint: "Принимаем в проект, но геометрию уточняет инженер." },
];
const MATERIAL_OPTIONS: ReadonlyArray<{ id: MaterialId; label: string }> = (["hot", "cold", "zinc"] as const).map((id) => ({ id, label: MATERIAL_LABELS[id] }));
function fmt(value: number) { return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }

export function ClientManufacturingWorkspace({ mode = "public" }: { mode?: "public" | "production" } = {}) {
  const productionMode = mode === "production";
  const reducedMotion = useReducedMotion();
  const { inputRef, project, setProject, activePart, activePreview, activeCalculation, approvedProjectTotalRub, quoteHandoffHref, isAnalyzing, materialId, thickness, quantity, canCalculate, calculateLabel, calculateLabelShort, workflowSteps, onChange, onDragEnter, onDragOver, onDragLeave, onDrop, updateQuantity, updateMaterial, updateThickness, toggleOperation, updateOperationInputs, removeActivePart, calculateProject, clientMetrics, isDraggingFiles, projectCalculationMessage, calculationFailed, statusByPartId, calculation, calculatedAt, materialConfirmed, bendConflict } = useCadProject();

  return (
    <div className="cad-workspace bg-[#090c0e] pb-24 text-white xl:pb-10">
      <section className={productionMode && project.parts.length ? "border-b border-white/10 bg-[#0d1114]" : "hidden"}>
        <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-steel-orange">{productionMode ? "Production calculator" : "CAD calculator"}</p>
              <h2 className="mt-2 text-2xl font-semibold uppercase tracking-tight sm:text-3xl">{productionMode ? "Производственный расчёт" : "Инженерный расчёт по CAD"}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                {productionMode
                  ? "Полный внутренний расчёт: CAD-геометрия, технологические операции и последующий производственный отчёт."
                  : "Файл остаётся центром расчёта: сначала читаем геометрию, затем задаём материал и операции, после этого считаем проект."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FORMAT_BADGES.map((badge) => (
                <span
                  key={badge.label}
                  title={badge.hint}
                  className={badge.supported
                    ? "border border-steel-orange/35 bg-steel-orange/[.06] px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-steel-orange"
                    : "border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-white/70"}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <div key={step.number} className={`bg-[#101416] px-4 py-3 ${step.active ? "shadow-[inset_0_-2px_0_rgba(234,91,12,.75)]" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-bold ${step.active ? "text-steel-orange" : "text-white/70"}`}>{step.number}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-white/72">{step.label}</p>
                    <p className="mt-1 truncate text-xs text-white/70">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
        <div className={project.parts.length ? "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : "grid gap-4"}>
          {project.parts.length > 0 && <div className="flex min-w-0 flex-wrap items-start gap-3 lg:col-span-2">
            <details className="min-w-0 flex-1 border border-white/20 bg-[#101416]">
              <summary className="cursor-pointer px-4 py-3 text-sm">Позиции проекта: {project.parts.length} · {activePart?.fileName}</summary>
              <div className="flex max-h-48 flex-wrap overflow-y-auto">{project.parts.map((part, index) => <button key={part.id} type="button" aria-current={part.id === activePart?.id ? "true" : undefined} onClick={() => setProject((current) => setActivePart(current, part.id))} className="min-w-0 max-w-full flex-1 basis-48 border-t border-white/15 px-4 py-3 text-left text-sm hover:bg-white/10"><span className="text-steel-orange">{index + 1}. </span>{part.fileName} · {part.configuration.quantity} шт.</button>)}</div>
            </details>
            <button type="button" onClick={() => inputRef.current?.click()} className="min-h-11 border border-white/30 px-4 py-3 text-sm hover:border-steel-orange">+ Добавить CAD</button>
          </div>}

          <div
            className="relative min-w-0 overflow-hidden border border-white/10 bg-[#101416]"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Геометрия</span>
                <p className="mt-1 truncate text-sm font-semibold text-white/82">{activePart?.fileName ?? "Рабочая область модели"}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden text-xs font-bold uppercase tracking-[.12em] text-white/70 sm:inline">Перетащите CAD сюда</span>
                {activePart && <button type="button" onClick={removeActivePart} className="text-xs font-bold uppercase tracking-[.12em] text-white/70 hover:text-red-300">Удалить</button>}
              </div>
            </div>
            <div className="relative min-h-[380px] bg-[#080b0d] sm:min-h-[500px] lg:min-h-[620px]">
              <AnimatePresence mode="wait">
                {!activePart ? <motion.div key="drop" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-6 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 p-8 text-center" onClick={() => inputRef.current?.click()}>
                  <div className="flex h-16 w-16 items-center justify-center border border-steel-orange/55 text-3xl text-steel-orange">+</div>
                  <h2 className="mt-6 text-2xl font-semibold">Загрузите деталь или проект</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/70">Перетащите DXF, STEP, STP или DWG. Каждый файл станет отдельной позицией проекта.</p>
                  <Link href="/contacts?source=online-order#contact-form" className="mt-4 text-sm text-white/75 underline underline-offset-4">Нет CAD-файла — помощь инженера</Link>
                  <button type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }} className="mt-6 border border-steel-orange bg-steel-orange px-6 py-3 text-xs font-bold uppercase tracking-[.12em] text-black transition hover:bg-white">Выбрать файлы</button>
                </motion.div> : isAnalyzing ? <motion.div key="analyzing" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-center"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-steel-orange">CAD</p><h2 className="mt-3 text-xl font-semibold">Обрабатываем модель</h2><p className="mt-3 text-xs text-white/70">Подготавливаем предпросмотр и определяем габариты.</p></div></motion.div> : activePreview?.meshes.length ? <motion.div key={`mesh-${activePart.id}`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0"><CadMeshViewer meshes={activePreview.meshes} className="h-full" /></motion.div> : activePreview?.drawing ? <motion.div key={`dxf-${activePart.id}`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-6"><ClientCad2DPreview drawing={activePreview.drawing} /></motion.div> : <motion.div key="status" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center"><p className="max-w-lg text-sm leading-relaxed text-white/50">{statusByPartId[activePart.id] ?? "Файл добавлен в проект."}</p></motion.div>}
              </AnimatePresence>
              {activePreview && <div className="absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-3">{clientMetrics.map(([label, value]) => <div key={label} className="bg-[#101416]/95 p-3"><p className="text-xs font-bold uppercase tracking-[.14em] text-white/70">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>}
            </div>
            {isDraggingFiles && <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center border-2 border-dashed border-steel-orange bg-[#080b0d]/95 p-6 backdrop-blur-sm"><div className="max-w-md border border-steel-orange/45 bg-[#101416]/95 px-8 py-7 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center border border-steel-orange/60 text-3xl text-steel-orange">+</div><p className="mt-5 text-xl font-semibold">Отпустите CAD-файлы здесь</p><p className="mt-2 text-sm text-white/70">DXF · STEP · STP · DWG · можно несколько файлов сразу</p></div></div>}
          </div>

          {activePart && <aside className="min-w-0 border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-steel-orange">Производство</p>
              <h2 className="mt-2 text-xl font-semibold">Конфигурация позиции</h2>
              <p className="mt-2 text-xs leading-5 text-white/70">Для быстрого расчёта достаточно материала, толщины и количества. Дополнительные операции можно раскрыть ниже.</p>
            </div>
            {activePart ? <>
              <div className="space-y-5 p-5">
                {activePreview ? (
                  <div className="border border-white/10 bg-[#0b0f12] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[.14em] text-white/70">Определено по файлу</p>
                      <span className={`text-xs font-bold uppercase tracking-[.12em] ${activePreview.status === "recognized" ? "text-emerald-300" : "text-amber-300"}`}>
                        {activePreview.status === "recognized" ? "геометрия распознана" : "нужна проверка"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-px bg-white/10">
                      <div className="bg-[#101416] p-3">
                        <p className="text-xs uppercase tracking-[.1em] text-white/70">Толщина модели</p>
                        <p className="mt-1 text-sm font-semibold">{activePreview.cad.thicknessFromModelMm == null ? "—" : `${fmt(activePreview.cad.thicknessFromModelMm)} мм`}</p>
                      </div>
                      <div className="bg-[#101416] p-3">
                        <p className="text-xs uppercase tracking-[.1em] text-white/70">Гибы модели</p>
                        <p className="mt-1 text-sm font-semibold">{activePreview.cad.bendCountFromModel == null ? "—" : activePreview.cad.bendCountFromModel}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-white/70">{activePreview.message}</p>
                  </div>
                ) : null}
                <div><p id="part-material-label" className="text-xs font-bold uppercase tracking-[.1em] text-white/70">Материал</p><div role="group" aria-labelledby="part-material-label" className="mt-2 grid grid-cols-3 gap-1">{MATERIAL_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={materialId === option.id} onClick={() => updateMaterial(option.id)} className={`border px-2 py-3 text-xs font-semibold transition ${materialId === option.id ? "border-steel-orange/50 bg-steel-orange/[.07] text-white" : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"}`}>{option.label}</button>)}</div></div>
                <p className="text-sm text-white/70">Материал: {materialConfirmed[activePart.id] ? "указано вами" : "выбран по умолчанию — проверьте"}. Из CAD материал не определяется.</p>
                <div><label htmlFor="part-thickness" className="text-xs font-bold uppercase tracking-[.1em] text-white/70">Толщина, мм</label><select id="part-thickness" value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm">{THICKNESS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <p className="text-sm text-white/70">{activePreview?.cad.thicknessFromModelMm == null ? "Толщина: нужно указать по чертежу." : `Толщина по модели: ${fmt(activePreview.cad.thicknessFromModelMm)} мм. Проверьте соответствие выбранной.`}</p>
                <div><label htmlFor="part-quantity" className="text-xs font-bold uppercase tracking-[.1em] text-white/70">Количество</label><input id="part-quantity" value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} inputMode="numeric" className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm" /></div>
                {bendConflict && <p role="alert" className="border border-amber-400/40 p-3 text-sm text-amber-200">{bendConflict}</p>}
                {productionMode ? (
                  <div className="border border-white/10 bg-[#0b0f12] p-4">
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-[.13em] text-steel-orange">Полный техпроцесс</p>
                      <p className="mt-1 text-xs leading-5 text-white/70">Все производственные операции доступны сразу. После расчёта полный отчёт появится во внутреннем контуре.</p>
                    </div>
                    <ClientOperationControls
                      operations={activePart.configuration.operations}
                      operationInputs={activePart.configuration.operationInputs ?? {}}
                      detectedBendCount={activePreview?.cad.bendCountFromModel ?? null}
                      onToggle={toggleOperation}
                      onQuantityChange={updateOperationInputs}
                    />
                  </div>
                ) : (
                <details className="group border border-white/10 bg-[#0b0f12]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[.13em] text-white/55">Дополнительная обработка</p>
                      <p className="mt-1 text-xs text-white/70">
                        {activePart.configuration.operations.length > 1
                          ? operationLabels(activePart.configuration.operations).join(" · ")
                          : "Гибка, сварка, окраска и другие операции — при необходимости"}
                      </p>
                    </div>
                    <span className="text-lg text-steel-orange transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <div className="border-t border-white/10 p-4">
                    <ClientOperationControls
                      operations={activePart.configuration.operations}
                      operationInputs={activePart.configuration.operationInputs ?? {}}
                      detectedBendCount={activePreview?.cad.bendCountFromModel ?? null}
                      onToggle={toggleOperation}
                      onQuantityChange={updateOperationInputs}
                    />
                  </div>
                </details>
                )}
              </div>
              <div className="border-t border-white/10 p-5">
                <button type="button" onClick={() => void calculateProject()} disabled={!canCalculate} className="w-full border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/70">
                  {calculateLabel}
                </button>
                {projectCalculationMessage && <div
                  role={calculationFailed ? "alert" : "status"}
                  className={`mt-3 border px-3 py-3 text-xs leading-relaxed ${calculationFailed ? "border-steel-orange/50 bg-steel-orange/[.08] text-white/85" : "border-white/12 bg-white/[.03] text-white/70"}`}
                >
                  <p>{projectCalculationMessage}</p>
                  {calculationFailed && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    <button type="button" onClick={() => void calculateProject()} className="font-bold uppercase tracking-[.1em] text-steel-orange transition hover:text-white">Повторить расчёт</button>
                    <a href={`tel:${siteConfig.telephone}`} className="font-bold uppercase tracking-[.1em] text-steel-orange transition hover:text-white">Позвонить инженеру {siteConfig.telephoneDisplay}</a>
                  </div>}
                </div>}
            <div className="border-t border-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-white/70">Предварительная стоимость проекта</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-steel-orange">
                {approvedProjectTotalRub == null
                ? (calculation ? "Нужны данные" : "—")
                : `${fmt(approvedProjectTotalRub)} ₽`}
              </p>
              <p className="mt-1 text-xs text-white/70">
                {project.parts.length === 0
                  ? "Позиции не добавлены"
                  : approvedProjectTotalRub == null
                    ? `${project.parts.length} поз. · ${calculation ? "требуется уточнение" : "расчёт не выполнен"}`
                    : `${project.parts.length} поз.`}
              </p>
              {productionMode ? (
                <Link
                  href="/internal/production-calculations"
                  className="mt-4 block border border-steel-orange bg-steel-orange px-4 py-3 text-center text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white"
                >
                  Открыть производственные отчёты
                </Link>
              ) : (
                <Link
                  href={quoteHandoffHref}
                  className="mt-4 block border border-steel-orange bg-steel-orange px-4 py-3 text-center text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white"
                >
                  Отправить заявку
                </Link>
              )}
              {calculation && <p className="mt-3 break-all text-sm text-white/70">Расчёт {calculation.projectId}<br />{calculatedAt?.toLocaleString("ru-RU")}</p>}
              {calculation && (
                <button type="button" onClick={() => window.print()} className="mt-2 w-full border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-white/70 transition hover:border-steel-orange hover:text-white">
                  Печать / PDF
                </button>
              )}
              <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/70">
                {productionMode ? "Внутренний производственный расчёт. Полные статьи и технологические проверки сохраняются в производственном отчёте." : CALCULATION_DISCLAIMER}{" "}
                {!productionMode ? <Link href="/legal/terms" className="underline decoration-white/30 underline-offset-2 hover:text-white">Условия</Link> : null}
              </p>
            </div>

                {activeCalculation?.price.status === "approved" && typeof activeCalculation.price.totalRub === "number" && <div className="mt-4 border border-steel-orange/40 bg-steel-orange/[.08] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Стоимость позиции</p><p className="mt-2 text-2xl font-semibold">{fmt(activeCalculation.price.totalRub)} ₽</p>{approvedProjectTotalRub != null && calculation && calculation.parts.length > 1 && <p className="mt-2 text-xs text-white/50">Итого по проекту: {fmt(approvedProjectTotalRub)} ₽</p>}</div>}
                <div className="mt-4 border border-steel-orange/25 bg-steel-orange/[.04] p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Статус проекта</p><p className="mt-3 text-sm leading-relaxed text-white/60">{statusByPartId[activePart.id] ?? "Проверьте параметры изделия и запустите расчёт."}</p><p className="mt-3 text-xs leading-relaxed text-white/70">{productionMode ? "После расчёта откройте производственный отчёт для себестоимости, DFM и технологической ревизии." : `${CALCULATION_DISCLAIMER} Оплата на сайте не подключена.`}</p></div>
              </div>
            </> : <div className="p-5 text-sm text-white/70">Добавьте CAD-файл.</div>}
          </aside>}
        </div>
      </section>
      {project.parts.length > 0 && (
        <div className="mobile-quote-bar fixed inset-x-0 z-[80] flex items-center gap-3 border-t border-white/12 bg-[#101416]/95 px-4 py-3 backdrop-blur-sm xl:hidden">
          <div className="min-w-0 grow">
            <p className="text-xs leading-4 text-white/70" title={CALCULATION_DISCLAIMER}>{CALCULATION_DISCLAIMER_SHORT}</p>
            <p className="truncate text-lg font-semibold tabular-nums text-steel-orange">
              {approvedProjectTotalRub == null ? "—" : `${fmt(approvedProjectTotalRub)} ₽`}
            </p>
          </div>
          {approvedProjectTotalRub == null ? (
            <button
              type="button"
              onClick={() => void calculateProject()}
              disabled={!canCalculate}
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-black disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/70"
            >
              {calculateLabelShort}
            </button>
          ) : productionMode ? (
            <Link
              href="/internal/production-calculations"
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-black"
            >
              Отчёты
            </Link>
          ) : (
            <Link
              href={quoteHandoffHref}
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-black"
            >
              Отправить
            </Link>
          )}
        </div>
      )}
      {calculation && (
        <ClientQuotePrintout calculation={calculation} totalRub={approvedProjectTotalRub} preparedAt={calculatedAt ?? new Date()} />
      )}
      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" />
    </div>
  );
}
