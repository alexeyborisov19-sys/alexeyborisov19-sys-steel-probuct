"use client";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { bendConfigurationConflict } from "@/lib/instant-quote/cad-configuration-conflicts";
import { createCalculationFormData } from "@/lib/instant-quote/client-calculation-request";
import { isClientCadPreview, isClientCalculationView, type CadAnalysisApiResponse, type CalculationApiResponse } from "@/lib/instant-quote/client-api-contracts";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { ClientCadPreview } from "@/lib/instant-quote/client-cad-preview-types";
import { createEmptyProject, type ManufacturingOperation, type OperationInputs } from "@/lib/instant-quote/domain";
import { modelReadings, nearestThicknessOption } from "@/lib/instant-quote/client-labels";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { addPartToProject, removePartFromProject, setPartMaterial, setPartQuantity, setPartState, setPartOperationInputs, setPartThickness, togglePartOperation, updatePartGeometry } from "@/lib/instant-quote/project";
const MAX_PROJECT_PARTS = 10;
const RECALCULATING_MESSAGE = "Идёт расчёт проекта…";
function fmt(value: number) { return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }
function fmtMetric(value: number | null) { return value == null ? "—" : `${fmt(value)} мм`; }
function materialIdOf(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return "hot";
}
function hasDraggedFiles(event: DragEvent<HTMLDivElement>) { return Array.from(event.dataTransfer.types).includes("Files"); }

/** Shared CAD state and server transport; no production arithmetic runs in the browser. */
export function useCadProject() {
  const analysisControllers = useRef(new Map<string, AbortController>());
  useEffect(() => () => { for (const controller of analysisControllers.current.values()) controller.abort(); }, []);
  const calculationEpoch = useRef(0);
  const calculationAbort = useRef<AbortController | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);
  const [materialConfirmed, setMaterialConfirmed] = useState<Record<string, boolean>>({});
  useEffect(() => () => { calculationEpoch.current += 1; calculationAbort.current?.abort(); }, []);
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
  const estimatedProjectTotalRub = useMemo(() => {
    if (!calculation?.parts.length || !calculation.parts.every(part =>
      ["approved", "estimate"].includes(part.price.status) && typeof part.price.totalRub === "number" && Number.isFinite(part.price.totalRub) && part.price.totalRub > 0)) return null;
    return calculation.parts.reduce((sum,part) => sum + part.price.totalRub!, 0);
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
  const bendConflict = activePart ? bendConfigurationConflict(activePreview?.cad.bendCountFromModel, activePart.configuration.operations, activePart.configuration.operationInputs?.bendCount) : null;
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
    calculationEpoch.current += 1;
    calculationAbort.current?.abort();
    calculationAbort.current = null;
    setIsCalculating(false);
    setCalculatedAt(null);
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
    const rejectedFiles: string[] = [];
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
        rejectedFiles.push(`Файл «${file.name}» не добавлен: проверьте формат и размер.`);
      }
    });

    setProject(nextProject);
    // A new position makes the project total stale, so the sentences the
    // priced positions are still showing go with it.
    dropStaleCalculation();
    if (overflowMessage || rejectedFiles.length) setProjectCalculationMessage([overflowMessage, ...rejectedFiles].filter(Boolean).join(" "));
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
      const analysisController = new AbortController();
      analysisControllers.current.set(partId, analysisController);
      let refusal: string | null = null;
      try {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch("/api/online-order/cad/analyze", {
          signal: analysisController.signal,
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => null) as CadAnalysisApiResponse | null;
        if (!response.ok || !payload?.ok || !isClientCadPreview(payload.preview)) {
          refusal = typeof payload?.error === "string" && payload.error.trim() ? payload.error.trim() : response.status === 413 ? "Файл слишком большой. Допустимо до 50 МБ на CAD-файл и 100 МБ на проект." : null;
          throw new Error("CAD preview refused.");
        }

        if (analysisController.signal.aborted) return;
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
          const countersinks = preview.cad.countersinkCountFromModel;
          if (countersinks != null && countersinks > 0) {
            next = togglePartOperation(next, partId, "countersink", true);
            const declared = next.parts.find(part => part.id === partId)?.configuration.operationInputs?.countersinkCount;
            next = setPartOperationInputs(next, partId, { countersinkCount: Math.max(countersinks, declared ?? 0) });
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
        if (analysisController.signal.aborted) return;
        setProject((current) => setPartState(current, partId, "manual-review"));
        setStatusByPartId((current) => ({
          ...current,
          [partId]: refusal
            ?? "Не удалось связаться с сервером расчёта. Проверьте соединение и загрузите файл ещё раз.",
        }));
      } finally {
        if (!analysisController.signal.aborted) {
          analysisControllers.current.delete(partId);
          setAnalyzingByPartId((current) => ({ ...current, [partId]: false }));
        }
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
    setMaterialConfirmed((current) => ({ ...current, [activePart.id]: true }));
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
    analysisControllers.current.get(id)?.abort(); analysisControllers.current.delete(id);
    setAnalyzingByPartId(current => { const next = { ...current }; delete next[id]; return next; });
    setProject((current) => removePartFromProject(current, id));
    setPreviewsByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setFilesByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    dropStaleCalculation({ removed: id });
  };

  const calculateProject = async () => {
    if (!canCalculate) return;
    // Pressing the button twice used to leave every position showing the price
    // from the previous run while the total read «—» and, if the second run
    // failed, beside an error saying there was no result.
    dropStaleCalculation({ message: RECALCULATING_MESSAGE });
    const epoch = calculationEpoch.current;
    const controller = new AbortController();
    calculationAbort.current = controller;
    setIsCalculating(true);
    setCalculationFailed(false);
    setProjectCalculationMessage("Проверяем CAD и рассчитываем проект…");

    try {
      const formData = createCalculationFormData(project, filesByPartId);
      const response = await fetch("/api/online-order/calculate", {
        signal: controller.signal,
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

      if (epoch !== calculationEpoch.current) return;
      const calculationResult = payload.calculation;
      setCalculatedAt(new Date());
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
          : calculationResult.parts.every(part => ["approved", "estimate"].includes(part.price.status))
            ? "Ориентировочная стоимость рассчитана. Изготовляемость и окончательную цену должен подтвердить инженер."
          : "Расчёт выполнен, но автоматическая цена для части позиций не сформирована. Проверьте материал, толщину и исходные данные выбранных операций.",
      );
    } catch (error) {
      if (epoch !== calculationEpoch.current) return;
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
      if (epoch === calculationEpoch.current) setIsCalculating(false);
    }
  };

  const clientMetrics = activePreview ? [
    ["X", fmtMetric(activePreview.cad.widthMm)],
    ["Y", fmtMetric(activePreview.cad.heightMm)],
    ["Z", fmtMetric(activePreview.cad.depthMm)],
  ] : [];

  return { inputRef, project, setProject, activePart, activePreview, activeCalculation, approvedProjectTotalRub, estimatedProjectTotalRub, quoteHandoffHref, isAnalyzing, materialId, thickness, quantity, canCalculate, calculateLabel, calculateLabelShort, workflowSteps, dropStaleCalculation, ingestFiles, onChange, onDragEnter, onDragOver, onDragLeave, onDrop, updateQuantity, updateMaterial, updateThickness, toggleOperation, updateOperationInputs, removeActivePart, calculateProject, clientMetrics, isDraggingFiles, projectCalculationMessage, calculationFailed, statusByPartId, calculation, calculatedAt, materialConfirmed, bendConflict, filesByPartId, previewsByPartId };
}
