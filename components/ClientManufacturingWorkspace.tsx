"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { ClientCad2DPreview } from "@/components/ClientCad2DPreview";
import { ClientOperationControls } from "@/components/instant-quote/ClientOperationControls";
import { ClientQuotePrintout } from "@/components/instant-quote/ClientQuotePrintout";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { siteConfig } from "@/lib/site";
import { createCalculationFormData } from "@/lib/instant-quote/client-calculation-request";
import { isClientCadPreview, isClientCalculationView, type CadAnalysisApiResponse, type CalculationApiResponse } from "@/lib/instant-quote/client-api-contracts";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { ClientCadPreview } from "@/lib/instant-quote/client-cad-preview-types";
import { createEmptyProject, type ManufacturingOperation, type OperationInputs } from "@/lib/instant-quote/domain";
import { CALCULATION_DISCLAIMER, CALCULATION_DISCLAIMER_SHORT, MATERIAL_LABELS, modelReadings, nearestThicknessOption, THICKNESS_OPTIONS } from "@/lib/instant-quote/client-labels";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import {
  addPartToProject,
  removePartFromProject,
  setActivePart,
  setPartMaterial,
  setPartQuantity,
  setPartState,
  setPartOperationInputs,
  setPartThickness,
  togglePartOperation,
  updatePartGeometry,
} from "@/lib/instant-quote/project";

const accepted = ".dxf,.dwg,.step,.stp";

const FORMAT_BADGES: ReadonlyArray<{ label: string; supported: boolean; hint: string }> = [
  { label: "DXF", supported: true, hint: "Плоская развёртка: габариты и контуры определяются автоматически." },
  { label: "STEP", supported: true, hint: "3D-модель: габариты и толщина определяются автоматически." },
  { label: "STP", supported: true, hint: "То же, что STEP." },
  { label: "DWG", supported: false, hint: "Принимаем в проект, но геометрию уточняет инженер." },
];
// The server manifest refuses a project with more than ten positions, so the
// eleventh is stopped here rather than after the whole project fails to price.
const MAX_PROJECT_PARTS = 10;

// Shown on the positions a previous run had priced, for as long as the next
// run is in flight. Named so that the failure path can recognise and replace it
// instead of leaving it behind once the attempt it describes is over.
const RECALCULATING_MESSAGE = "Идёт расчёт проекта…";

// Shared with the printed quote, so a material cannot get two names.
const MATERIAL_OPTIONS: ReadonlyArray<{ id: MaterialId; label: string }> =
  (["hot", "cold", "zinc"] as const).map((id) => ({ id, label: MATERIAL_LABELS[id] }));

function fmt(value: number) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function fmtMetric(value: number | null) {
  return value == null ? "—" : `${fmt(value)} мм`;
}

function materialIdOf(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return "hot";
}

function hasDraggedFiles(event: DragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function ClientManufacturingWorkspace({ mode = "public" }: { mode?: "public" | "production" } = {}) {
  const productionMode = mode === "production";
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [project, setProject] = useState(() => createEmptyProject());
  const [previewsByPartId, setPreviewsByPartId] = useState<Record<string, ClientCadPreview>>({});
  const [filesByPartId, setFilesByPartId] = useState<Record<string, File>>({});
  const [analyzingByPartId, setAnalyzingByPartId] = useState<Record<string, boolean>>({});
  const [statusByPartId, setStatusByPartId] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [projectCalculationMessage, setProjectCalculationMessage] = useState<string | null>(null);
  // A failed run and a normal status share one message slot, so the slot alone cannot
  // say which one it is holding. Without this the visitor who just uploaded a model
  // reads a server error in the same grey line that reports progress.
  const [calculationFailed, setCalculationFailed] = useState(false);
  const [calculation, setCalculation] = useState<ClientProjectCalculationView | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const activePart = useMemo(
    () => project.parts.find((part) => part.id === project.activePartId) ?? null,
    [project],
  );
  const activePreview = activePart ? previewsByPartId[activePart.id] ?? null : null;
  const activeCalculation = activePart
    ? calculation?.parts.find((part) => part.partId === activePart.id) ?? null
    : null;
  const approvedProjectTotalRub = useMemo(() => {
    if (!calculation || calculation.parts.length === 0) return null;
    const approved = calculation.parts.filter(
      (part) => part.price.status === "approved" && typeof part.price.totalRub === "number",
    );
    if (approved.length !== calculation.parts.length) return null;
    return approved.reduce((sum, part) => sum + (part.price.totalRub ?? 0), 0);
  }, [calculation]);
  // The public calculator never submits orders on its own: it hands the customer
  // over to the existing contacts form, which is the flow that records 152-ФЗ
  // consent and stores the lead. Only the customer's own inputs travel in the URL.
  // The calculation number travels with them so the incoming request can be
  // matched to the calculation an engineer already has, instead of being
  // re-quoted from scratch. It is an opaque identifier the server had already
  // published to this browser — no basis, rate or geometry rides along with it.
  const quoteHandoffHref = {
    pathname: "/contacts",
    query: {
      source: "online-order",
      parts: String(project.parts.length),
      ...(calculation == null ? {} : { calc: calculation.projectId }),
      ...(approvedProjectTotalRub == null ? {} : { total: String(Math.round(approvedProjectTotalRub)) }),
    },
    hash: "contact-form",
  };
  const isAnalyzing = activePart ? Boolean(analyzingByPartId[activePart.id]) : false;
  const materialId = materialIdOf(activePart?.configuration.materialId ?? null);
  const thickness = activePart?.configuration.thicknessMm ?? 1;
  const quantity = activePart?.configuration.quantity ?? 1;
  const allFilesPresent = project.parts.length > 0 && project.parts.every((part) => Boolean(filesByPartId[part.id]));
  const anyAnalyzing = Object.values(analyzingByPartId).some(Boolean);
  const canCalculate = allFilesPresent && !anyAnalyzing && !isCalculating;
  // Files are analysed in parallel, so the selected position can look ready
  // while another one is still being read. Without this the button is simply
  // dead and grey, with nothing on screen saying why.
  const calculateLabel = isCalculating ? "Выполняется расчёт…" : anyAnalyzing ? "Обрабатываем CAD…" : "Рассчитать проект";
  const calculateLabelShort = isCalculating ? "Считаем…" : anyAnalyzing ? "Читаем CAD…" : "Рассчитать";
  const analyzedPartCount = project.parts.filter((part) => previewsByPartId[part.id]?.status === "recognized").length;
  const workflowSteps = [
    { number: "01", label: "Файлы", detail: project.parts.length ? `${project.parts.length} поз.` : "Добавьте CAD", active: project.parts.length > 0 },
    { number: "02", label: "Геометрия", detail: project.parts.length ? `${analyzedPartCount}/${project.parts.length} распознано` : "Ожидает файл", active: analyzedPartCount > 0 },
    { number: "03", label: "Производство", detail: activePart ? "Материал и операции" : "После анализа", active: Boolean(activePart) },
    { number: "04", label: "Стоимость", detail: approvedProjectTotalRub == null ? "Не рассчитана" : `${fmt(approvedProjectTotalRub)} ₽`, active: approvedProjectTotalRub != null },
  ] as const;

  /**
   * One button prices the whole project, so a change to any position makes the
   * result stale for all of them. Clearing only the calculation left every
   * other position still showing the sentence that calculation gave it — a
   * price per position beside a project total that had gone back to «—».
   */
  const dropStaleCalculation = (options: { changed?: string; removed?: string; message?: string } = {}) => {
    const stale = calculation;
    const staleMessage = options.message ?? "Результат устарел: проект изменился. Нажмите «Рассчитать проект».";
    setStatusByPartId((current) => {
      const next = { ...current };
      for (const part of stale?.parts ?? []) {
        if (part.partId === options.changed || part.partId === options.removed) continue;
        next[part.partId] = staleMessage;
      }
      if (options.changed) {
        next[options.changed] = "Параметры изменены. Нажмите «Рассчитать проект», чтобы обновить результат.";
      }
      if (options.removed) delete next[options.removed];
      return next;
    });
    setProjectCalculationMessage(null);
    setCalculation(null);
  };

  const markConfigurationChanged = (partId: string) => {
    dropStaleCalculation({ changed: partId });
  };

  const ingestFiles = async (files: File[]) => {
    if (!files.length) return;
    let nextProject = project;
    const room = MAX_PROJECT_PARTS - nextProject.parts.length;
    const accepting = files.slice(0, Math.max(0, room));
    const overflowMessage = accepting.length < files.length
      ? `В одном проекте можно рассчитать не более ${MAX_PROJECT_PARTS} позиций. Лишние файлы не добавлены — рассчитайте их отдельным проектом.`
      : null;
    if (!accepting.length) {
      setProjectCalculationMessage(overflowMessage);
      return;
    }
    const jobs: Array<{ file: File; partId: string; format: "dxf" | "dwg" | "step" | "stp" }> = [];

    accepting.forEach((file, index) => {
      try {
        const addedAt = new Date(Date.now() + index);
        nextProject = addPartToProject(nextProject, { fileName: file.name, fileSizeBytes: file.size }, addedAt);
        const partId = nextProject.activePartId;
        if (partId) {
          nextProject = setPartMaterial(nextProject, partId, "cold", addedAt);
        }
        const part = partId ? nextProject.parts.find((item) => item.id === partId) : null;
        if (partId && part) jobs.push({ file, partId, format: part.format });
      } catch {
        // accept= limits common unsupported formats; invalid files remain ignored.
      }
    });

    setProject(nextProject);
    // A new position makes the project total stale, so the sentences the
    // priced positions are still showing go with it.
    dropStaleCalculation();
    setProjectCalculationMessage(overflowMessage);
    setFilesByPartId((current) => {
      const next = { ...current };
      for (const job of jobs) next[job.partId] = job.file;
      return next;
    });

    await Promise.all(jobs.map(async ({ file, partId, format }) => {
      if (format === "dwg") {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setStatusByPartId((current) => ({ ...current, [partId]: "DWG загружен. Для расчёта потребуется уточнение модели." }));
        return;
      }

      setAnalyzingByPartId((current) => ({ ...current, [partId]: true }));
      // The server says which part of the file it could not use and what to
      // change about it. Kept aside so the failure path shows that instead of a
      // single sentence that fits every cause and helps with none of them; a
      // transport failure has no such message and falls back below.
      let refusal: string | null = null;
      try {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch("/api/online-order/cad/analyze", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => null) as CadAnalysisApiResponse | null;
        if (!response.ok || !payload?.ok || !isClientCadPreview(payload.preview)) {
          refusal = typeof payload?.error === "string" && payload.error.trim() ? payload.error.trim() : null;
          throw new Error("CAD preview refused.");
        }

        const preview = payload.preview;
        setPreviewsByPartId((current) => ({ ...current, [partId]: preview }));
        setProject((current) => {
          const geometry = {
            ...(preview.cad.widthMm == null ? {} : { widthMm: preview.cad.widthMm }),
            ...(preview.cad.heightMm == null ? {} : { heightMm: preview.cad.heightMm }),
            ...(preview.cad.depthMm == null ? {} : { depthMm: preview.cad.depthMm }),
          };
          let next = updatePartGeometry(current, partId, geometry);
          // A STEP model carries its own sheet thickness. Selecting it here is
          // what keeps the default 1 mm from silently pricing a 3 mm part: the
          // server refuses a declared thickness its BRep contradicts.
          const measuredThickness = nearestThicknessOption(preview.cad.thicknessFromModelMm);
          if (measuredThickness != null) next = setPartThickness(next, partId, measuredThickness);
          // A STEP model that reports bends selects bending and fills in the
          // count, so the customer never counts them by hand.
          const bends = preview.cad.bendCountFromModel;
          if (bends != null && bends > 0) {
            next = togglePartOperation(next, partId, "bending", true);
            next = setPartOperationInputs(next, partId, { bendCount: bends });
          }
          return setPartState(next, partId, preview.status === "needs-review" ? "manual-review" : "configurable");
        });
        setStatusByPartId((current) => ({
          ...current,
          [partId]: preview.status === "needs-review"
            ? preview.message
            : `Модель распознана${modelReadings(preview.cad)}. Проверьте параметры и нажмите «Рассчитать проект».`,
        }));
      } catch {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setStatusByPartId((current) => ({
          ...current,
          [partId]: refusal
            ?? "Не удалось связаться с сервером расчёта. Проверьте соединение и загрузите файл ещё раз.",
        }));
      } finally {
        setAnalyzingByPartId((current) => ({ ...current, [partId]: false }));
      }
    }));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void ingestFiles(files);
  };
  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    void ingestFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const updateQuantity = (value: number) => {
    if (!activePart) return;
    setProject((current) => setPartQuantity(current, activePart.id, value));
    markConfigurationChanged(activePart.id);
  };
  const updateMaterial = (value: MaterialId) => {
    if (!activePart) return;
    setProject((current) => setPartMaterial(current, activePart.id, value));
    markConfigurationChanged(activePart.id);
  };
  const updateThickness = (value: number) => {
    if (!activePart) return;
    setProject((current) => setPartThickness(current, activePart.id, value));
    markConfigurationChanged(activePart.id);
  };
  const toggleOperation = (operation: ManufacturingOperation) => {
    if (!activePart) return;
    const enabled = !activePart.configuration.operations.includes(operation);
    setProject((current) => togglePartOperation(current, activePart.id, operation, enabled));
    markConfigurationChanged(activePart.id);
  };
  const updateOperationInputs = (patch: OperationInputs) => {
    if (!activePart) return;
    setProject((current) => setPartOperationInputs(current, activePart.id, patch));
    markConfigurationChanged(activePart.id);
  };
  const removeActivePart = () => {
    if (!activePart) return;
    const id = activePart.id;
    setProject((current) => removePartFromProject(current, id));
    setPreviewsByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setFilesByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    dropStaleCalculation({ removed: id });
  };

  const calculateProject = async () => {
    if (!canCalculate) return;
    setIsCalculating(true);
    // Pressing the button twice used to leave every position showing the price
    // from the previous run while the total read «—» and, if the second run
    // failed, beside an error saying there was no result.
    dropStaleCalculation({ message: RECALCULATING_MESSAGE });
    setCalculationFailed(false);
    setProjectCalculationMessage("Проверяем CAD и рассчитываем проект…");

    try {
      const formData = createCalculationFormData(project, filesByPartId);
      const response = await fetch("/api/online-order/calculate", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null) as CalculationApiResponse | null;

      if (!response.ok || !payload?.ok || !isClientCalculationView(payload.calculation)) {
        if (payload?.code === "CALCULATION_UNAVAILABLE") {
          throw new Error("Автоматический расчёт этой конфигурации сейчас недоступен. Модель и выбранные параметры можно продолжить редактировать.");
        }
        throw new Error(payload?.message || "Не удалось выполнить расчёт. Попробуйте ещё раз.");
      }

      const calculationResult = payload.calculation;
      setCalculation(calculationResult);
      setStatusByPartId((current) => {
        const next = { ...current };
        for (const part of calculationResult.parts) next[part.partId] = part.message;
        return next;
      });
      const allPricesApproved = calculationResult.parts.every(
        (part) => part.status === "ready" && part.price.status === "approved",
      );
      setProjectCalculationMessage(
        allPricesApproved
          ? "Расчёт проекта завершён."
          : "Расчёт выполнен, но автоматическая цена для части позиций не сформирована. Проверьте материал, толщину и исходные данные выбранных операций.",
      );
    } catch (error) {
      setCalculation(null);
      // The attempt is over, so the positions must stop saying it is running.
      // The reason itself goes in the project message below rather than being
      // repeated on every position.
      setStatusByPartId((current) => {
        const next = { ...current };
        for (const partId of Object.keys(next)) {
          if (next[partId] === RECALCULATING_MESSAGE) next[partId] = "Расчёт не выполнен.";
        }
        return next;
      });
      setCalculationFailed(true);
      setProjectCalculationMessage(error instanceof Error ? error.message : "Не удалось выполнить расчёт. Попробуйте ещё раз.");
    } finally {
      setIsCalculating(false);
    }
  };

  const clientMetrics = activePreview ? [
    ["X", fmtMetric(activePreview.cad.widthMm)],
    ["Y", fmtMetric(activePreview.cad.heightMm)],
    ["Z", fmtMetric(activePreview.cad.depthMm)],
  ] : [];

  return (
    <div className="bg-[#090c0e] pb-24 text-white xl:pb-10">
      <section className="border-b border-white/10 bg-[#0d1114]">
        <div className="container py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">{productionMode ? "Production calculator" : "CAD calculator"}</p>
              <h2 className="mt-2 text-2xl font-semibold uppercase tracking-tight sm:text-3xl">{productionMode ? "Производственный расчёт" : "Инженерный расчёт по CAD"}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
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
                    ? "border border-steel-orange/35 bg-steel-orange/[.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-steel-orange"
                    : "border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white/30"}
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
                  <span className={`font-mono text-[10px] font-bold ${step.active ? "text-steel-orange" : "text-white/25"}`}>{step.number}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/72">{step.label}</p>
                    <p className="mt-1 truncate text-[10px] text-white/34">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-6">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Проект</p>
              <div className="mt-2 flex items-center justify-between gap-3"><strong className="min-w-0 truncate text-sm" title={project.title}>{project.title}</strong><span className="shrink-0 text-[10px] text-white/30">{project.parts.length} поз.</span></div>
            </div>
            <div className="max-h-[610px] overflow-y-auto">
              {project.parts.map((part, index) => {
                const active = part.id === activePart?.id;
                return <button key={part.id} type="button" aria-current={active ? "true" : undefined} onClick={() => setProject((current) => setActivePart(current, part.id))} className={`block w-full border-b p-3 text-left ${active ? "border-steel-orange/35 bg-steel-orange/[.05]" : "border-white/10 hover:bg-white/[.03]"}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[.13em] text-steel-orange">#{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-1 truncate text-xs font-semibold">{part.fileName}</p>
                  <p className="mt-1 text-[9px] text-white/35">×{part.configuration.quantity} · {part.format.toUpperCase()}</p>
                </button>;
              })}
            </div>
            <button type="button" onClick={() => inputRef.current?.click()} className="m-4 w-[calc(100%-2rem)] border border-white/12 px-3 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-white/55 hover:border-steel-orange hover:text-white">+ Добавить CAD</button>

            <div className="border-t border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Предварительно, с НДС</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-steel-orange">
                {approvedProjectTotalRub == null
                ? (calculation ? "Нужны данные" : "—")
                : `${fmt(approvedProjectTotalRub)} ₽`}
              </p>
              <p className="mt-1 text-[10px] text-white/35">
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
              {calculation && (
                <button type="button" onClick={() => window.print()} className="mt-2 w-full border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-white/70 transition hover:border-steel-orange hover:text-white">
                  Печать / КП
                </button>
              )}
              <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-white/45">
                {productionMode ? "Внутренний производственный расчёт. Полные статьи и технологические проверки сохраняются в производственном отчёте." : CALCULATION_DISCLAIMER}{" "}
                {!productionMode ? <Link href="/legal/terms" className="underline decoration-white/30 underline-offset-2 hover:text-white">Условия</Link> : null}
              </p>
            </div>
          </aside>

          <div
            className="relative min-w-0 overflow-hidden border border-white/10 bg-[#101416]"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">Геометрия</span>
                <p className="mt-1 truncate text-sm font-semibold text-white/82">{activePart?.fileName ?? "Рабочая область модели"}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden text-[9px] font-bold uppercase tracking-[.12em] text-white/25 sm:inline">Перетащите CAD сюда</span>
                {activePart && <button type="button" onClick={removeActivePart} className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40 hover:text-red-300">Удалить</button>}
              </div>
            </div>
            <div className="relative min-h-[680px] bg-[#080b0d]">
              <AnimatePresence mode="wait">
                {!activePart ? <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-6 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 p-8 text-center" onClick={() => inputRef.current?.click()}>
                  <div className="flex h-16 w-16 items-center justify-center border border-steel-orange/55 text-3xl text-steel-orange">+</div>
                  <h2 className="mt-6 text-2xl font-semibold">Загрузите деталь или проект</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/42">Перетащите DXF, STEP, STP или DWG. Каждый файл станет отдельной позицией проекта.</p>
                  <button type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }} className="mt-6 border border-steel-orange bg-steel-orange px-6 py-3 text-xs font-bold uppercase tracking-[.12em] text-black transition hover:bg-white">Выбрать файлы</button>
                </motion.div> : isAnalyzing ? <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-center"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">CAD</p><h2 className="mt-3 text-xl font-semibold">Обрабатываем модель</h2><p className="mt-3 text-xs text-white/35">Подготавливаем предпросмотр и определяем габариты.</p></div></motion.div> : activePreview?.meshes.length ? <motion.div key={`mesh-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0"><CadMeshViewer meshes={activePreview.meshes} className="h-full" /></motion.div> : activePreview?.drawing ? <motion.div key={`dxf-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-6"><ClientCad2DPreview drawing={activePreview.drawing} animated /></motion.div> : <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center"><p className="max-w-lg text-sm leading-relaxed text-white/50">{statusByPartId[activePart.id] ?? "Файл добавлен в проект."}</p></motion.div>}
              </AnimatePresence>
              {activePreview && <div className="absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-3">{clientMetrics.map(([label, value]) => <div key={label} className="bg-[#101416]/95 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/28">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>}
            </div>
            {isDraggingFiles && <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center border-2 border-dashed border-steel-orange bg-[#080b0d]/95 p-6 backdrop-blur-sm"><div className="max-w-md border border-steel-orange/45 bg-[#101416]/95 px-8 py-7 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center border border-steel-orange/60 text-3xl text-steel-orange">+</div><p className="mt-5 text-xl font-semibold">Отпустите CAD-файлы здесь</p><p className="mt-2 text-sm text-white/45">DXF · STEP · STP · DWG · можно несколько файлов сразу</p></div></div>}
          </div>

          <aside className="border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Производство</p>
              <h2 className="mt-2 text-xl font-semibold">Конфигурация позиции</h2>
              <p className="mt-2 text-xs leading-5 text-white/38">Для быстрого расчёта достаточно материала, толщины и количества. Дополнительные операции можно раскрыть ниже.</p>
            </div>
            {activePart ? <>
              <div className="space-y-5 p-5">
                {activePreview ? (
                  <div className="border border-white/10 bg-[#0b0f12] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/42">Определено по файлу</p>
                      <span className={`text-[9px] font-bold uppercase tracking-[.12em] ${activePreview.status === "recognized" ? "text-emerald-300" : "text-amber-300"}`}>
                        {activePreview.status === "recognized" ? "геометрия распознана" : "нужна проверка"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-px bg-white/10">
                      <div className="bg-[#101416] p-3">
                        <p className="text-[9px] uppercase tracking-[.1em] text-white/30">Толщина модели</p>
                        <p className="mt-1 text-sm font-semibold">{activePreview.cad.thicknessFromModelMm == null ? "—" : `${fmt(activePreview.cad.thicknessFromModelMm)} мм`}</p>
                      </div>
                      <div className="bg-[#101416] p-3">
                        <p className="text-[9px] uppercase tracking-[.1em] text-white/30">Гибы модели</p>
                        <p className="mt-1 text-sm font-semibold">{activePreview.cad.bendCountFromModel == null ? "—" : activePreview.cad.bendCountFromModel}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-white/38">{activePreview.message}</p>
                  </div>
                ) : null}
                <div><p id="part-material-label" className="text-[11px] font-bold uppercase tracking-[.1em] text-white/70">Материал</p><div role="group" aria-labelledby="part-material-label" className="mt-2 grid grid-cols-3 gap-1">{MATERIAL_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={materialId === option.id} onClick={() => updateMaterial(option.id)} className={`border px-2 py-3 text-[10px] font-semibold transition ${materialId === option.id ? "border-steel-orange/50 bg-steel-orange/[.07] text-white" : "border-white/10 text-white/70 hover:border-white/25 hover:text-white"}`}>{option.label}</button>)}</div></div>
                <div><label htmlFor="part-thickness" className="text-[11px] font-bold uppercase tracking-[.1em] text-white/70">Толщина, мм</label><select id="part-thickness" value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm">{THICKNESS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <div><label htmlFor="part-quantity" className="text-[11px] font-bold uppercase tracking-[.1em] text-white/70">Количество</label><input id="part-quantity" value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} inputMode="numeric" className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm" /></div>
                {productionMode ? (
                  <div className="border border-white/10 bg-[#0b0f12] p-4">
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-steel-orange">Полный техпроцесс</p>
                      <p className="mt-1 text-xs leading-5 text-white/38">Все производственные операции доступны сразу. После расчёта полный отчёт появится во внутреннем контуре.</p>
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
                      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-white/55">Дополнительная обработка</p>
                      <p className="mt-1 text-xs text-white/35">
                        {activePart.configuration.operations.length > 1
                          ? `Выбрано операций: ${activePart.configuration.operations.length}`
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
                <button type="button" onClick={() => void calculateProject()} disabled={!canCalculate} className="w-full border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/25">
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
                {activeCalculation?.price.status === "approved" && typeof activeCalculation.price.totalRub === "number" && <div className="mt-4 border border-steel-orange/40 bg-steel-orange/[.08] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">Стоимость позиции</p><p className="mt-2 text-2xl font-semibold">{fmt(activeCalculation.price.totalRub)} ₽</p>{approvedProjectTotalRub != null && calculation && calculation.parts.length > 1 && <p className="mt-2 text-xs text-white/50">Итого по проекту: {fmt(approvedProjectTotalRub)} ₽</p>}</div>}
                <div className="mt-4 border border-steel-orange/25 bg-steel-orange/[.04] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">Статус проекта</p><p className="mt-3 text-sm leading-relaxed text-white/60">{statusByPartId[activePart.id] ?? "Проверьте параметры изделия и запустите расчёт."}</p><p className="mt-3 text-[10px] leading-relaxed text-white/45">{productionMode ? "После расчёта откройте производственный отчёт для себестоимости, DFM и технологической ревизии." : `${CALCULATION_DISCLAIMER} Оплата на сайте не подключена.`}</p></div>
              </div>
            </> : <div className="p-5 text-sm text-white/35">Добавьте CAD-файл.</div>}
          </aside>
        </div>
      </section>
      {project.parts.length > 0 && (
        <div className="mobile-quote-bar fixed inset-x-0 z-[80] flex items-center gap-3 border-t border-white/12 bg-[#101416]/95 px-4 py-3 backdrop-blur-sm xl:hidden">
          <div className="min-w-0 grow">
            <p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/35" title={CALCULATION_DISCLAIMER}>{CALCULATION_DISCLAIMER_SHORT}</p>
            <p className="truncate text-lg font-semibold tabular-nums text-steel-orange">
              {approvedProjectTotalRub == null ? "—" : `${fmt(approvedProjectTotalRub)} ₽`}
            </p>
          </div>
          {approvedProjectTotalRub == null ? (
            <button
              type="button"
              onClick={() => void calculateProject()}
              disabled={!canCalculate}
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-black disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/25"
            >
              {calculateLabelShort}
            </button>
          ) : productionMode ? (
            <Link
              href="/internal/production-calculations"
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-black"
            >
              Отчёты
            </Link>
          ) : (
            <Link
              href={quoteHandoffHref}
              className="shrink-0 border border-steel-orange bg-steel-orange px-4 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-black"
            >
              Отправить
            </Link>
          )}
        </div>
      )}
      {calculation && (
        <ClientQuotePrintout calculation={calculation} totalRub={approvedProjectTotalRub} preparedAt={new Date()} />
      )}
      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" />
    </div>
  );
}
