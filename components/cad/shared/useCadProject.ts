"use client";
import { trackLeadEvent } from "@/lib/analytics";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { bendConfigurationConflict } from "@/lib/instant-quote/cad-configuration-conflicts";
import { createCalculationFormData } from "@/lib/instant-quote/client-calculation-request";
import { isClientCadPreview, isClientCalculationView, type CadAnalysisApiResponse, type CalculationApiResponse } from "@/lib/instant-quote/client-api-contracts";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { ClientCadPreview } from "@/lib/instant-quote/client-cad-preview-types";
import { createEmptyProject, type ManufacturingOperation, type OperationInputs, type PartConfiguration } from "@/lib/instant-quote/domain";
import { modelReadings } from "@/lib/instant-quote/client-labels";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { prepareCadProjectRestore, verifyCadAttachment, type CadProjectFile, type CadProjectSource } from "@/lib/instant-quote/project-file";
import { addPartToProject, removePartFromProject, setPartMaterial, setPartQuantity, setPartState, setPartOperationInputs, setPartThickness, togglePartOperation, updatePartGeometry } from "@/lib/instant-quote/project";
import { applyCadDetectedConfiguration, parseCadQuantityDraft, validateCadUploadBudget, type CadEditedField } from "@/lib/instant-quote/cad-input-workflow";
const MAX_PROJECT_PARTS = 5;
const RECALCULATING_MESSAGE = "Идёт расчёт проекта…";
function fmt(value: number) { return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }
function fmtMetric(value: number | null) { return value == null ? "—" : `${fmt(value)} мм`; }
function materialIdOf(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return "hot";
}
function hasDraggedFiles(event: DragEvent<HTMLDivElement>) { return Array.from(event.dataTransfer.types).includes("Files"); }

/** Shared CAD state and server transport; no production arithmetic runs in the browser. */
export function useCadProject(trackPublicFunnel = false) {
  const ingestLock=useRef(false);
  const [isIngesting,setIsIngesting]=useState(false);
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
  const projectRef = useRef(project);
  projectRef.current = project;
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const editedFieldsByPartId = useRef(new Map<string, Set<CadEditedField>>());
  const markFieldEdited = (partId: string, field: CadEditedField) => {
    const fields = editedFieldsByPartId.current.get(partId) ?? new Set<CadEditedField>();
    fields.add(field);
    editedFieldsByPartId.current.set(partId, fields);
  };
  const [projectRevision, setProjectRevision] = useState(1);
  const [sourcesByPartId, setSourcesByPartId] = useState<Record<string, CadProjectSource>>({});
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
  const invalidQuantityParts = project.parts.filter(part => quantityDrafts[part.id] !== undefined && parseCadQuantityDraft(quantityDrafts[part.id]).error);
  const hasInvalidQuantity = invalidQuantityParts.length > 0;
  const quantityDraft = activePart ? quantityDrafts[activePart.id] ?? String(activePart.configuration.quantity) : "1";
  const quantityError = parseCadQuantityDraft(quantityDraft).error;
  // Preserve a matching valid quote internally, but never price an invalid draft.
  const currentCalculation = hasInvalidQuantity ? null : calculation;
  const activePreview = activePart ? previewsByPartId[activePart.id] ?? null : null;
  const activeCalculation = activePart
    ? currentCalculation?.parts.find((part) => part.partId === activePart.id) ?? null
    : null;
  const approvedProjectTotalRub = useMemo(() => {
    if (!currentCalculation || currentCalculation.parts.length === 0) return null;
    const approved = currentCalculation.parts.filter(
      (part) => part.price.status === "approved" && typeof part.price.totalRub === "number",
    );
    if (approved.length !== currentCalculation.parts.length) return null;
    return approved.reduce((sum, part) => sum + (part.price.totalRub ?? 0), 0);
  }, [currentCalculation]);
  const estimatedProjectTotalRub = useMemo(() => {
    if (!currentCalculation?.parts.length || !currentCalculation.parts.every(part =>
      ["approved", "estimate"].includes(part.price.status) && typeof part.price.totalRub === "number" && Number.isFinite(part.price.totalRub) && part.price.totalRub > 0)) return null;
    return currentCalculation.parts.reduce((sum,part) => sum + part.price.totalRub!, 0);
  }, [currentCalculation]);
  // The public calculator never submits orders on its own: it hands the customer
  // over to the existing contacts form, which is the flow that records 152-ФЗ
  // consent and stores the lead. Only the customer's own inputs travel in the URL.
  // The calculation number travels with them so the incoming request can be
  // matched to the calculation an engineer already has, instead of being
  // re-quoted from scratch. It is an opaque identifier the server had already
  // published to this browser — no basis, rate or geometry rides along with it.
  const quoteHandoffQuery = new URLSearchParams({
      source: "online-order",
      parts: String(project.parts.length),
      ...(currentCalculation == null ? {} : { calc: currentCalculation.projectId }),
      ...(approvedProjectTotalRub == null ? {} : { total: String(Math.round(approvedProjectTotalRub)) }),
  });
  const quoteHandoffHref = `/contacts?${quoteHandoffQuery.toString()}#contact-form`;
  const isAnalyzing = activePart ? Boolean(analyzingByPartId[activePart.id]) : false;
  const materialId = materialIdOf(activePart?.configuration.materialId ?? null);
  const thickness = activePart?.configuration.thicknessMm ?? 1;
  const quantity = activePart?.configuration.quantity ?? 1;
  const bendConflict = activePart ? bendConfigurationConflict(activePreview?.cad.bendCountFromModel, activePart.configuration.operations, activePart.configuration.operationInputs?.bendCount) : null;
  const allFilesPresent = project.parts.length > 0 && project.parts.every((part) => Boolean(filesByPartId[part.id]));
  const missingAttachments = project.parts.flatMap(part => {
    const source = sourcesByPartId[part.id];
    return !filesByPartId[part.id] && source?.kind === "cad" ? [{ partId: part.id, attachment: source.attachment }] : [];
  });
  const anyAnalyzing = Object.values(analyzingByPartId).some(Boolean);
  const canCalculate = !hasInvalidQuantity && allFilesPresent && !anyAnalyzing && !isCalculating && !isIngesting;
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
    setCalculationFailed(false);
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
    setProjectRevision(current => Math.min(1_000_000_000, current + 1));
    dropStaleCalculation({ changed: partId });
  };

  const analyzeFiles = async (jobs: Array<{ file: File; partId: string; format: "dxf" | "dwg" | "step" | "stp" }>, preserveConfiguration = false) => {
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
          // Late readings cannot silently replace an explicit customer choice.
          if (!preserveConfiguration) next = applyCadDetectedConfiguration(next, partId, preview.cad, editedFieldsByPartId.current.get(partId));
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

  const ingestFiles = async (files: File[], configurations?: PartConfiguration[], replaceId?: string) => {
    if(ingestLock.current)throw new Error("Дождитесь добавления текущих изделий.");
    if (!files.length) return;
    let nextProject = project;
    const replacing=replaceId?nextProject.parts.find(p=>p.id===replaceId):undefined;
    if(replaceId&&(!replacing||files.length!==1))throw new Error("Позиция для изменения не найдена.");
    const room = replacing ? 1 : MAX_PROJECT_PARTS - nextProject.parts.length;
    const accepting = files.slice(0, Math.max(0, room));
    const overflowMessage = accepting.length < files.length
      ? `В одном проекте можно рассчитать не более ${MAX_PROJECT_PARTS} позиций. Лишние файлы не добавлены — рассчитайте их отдельным проектом.`
      : null;
    if (!accepting.length) {
      setProjectCalculationMessage(overflowMessage);
      return;
    }
    validateCadUploadBudget(accepting, nextProject.parts.reduce((sum, part) => sum + (part.id === replaceId ? 0 : part.fileSizeBytes), 0));
    ingestLock.current=true;setIsIngesting(true);
    try {
    const rejectedFiles: string[] = [];
    const jobs: Array<{ file: File; partId: string; format: "dxf" | "dwg" | "step" | "stp" }> = [];

    accepting.forEach((file, index) => {
      try {
        const addedAt = new Date(Date.now() + index);
        if(replacing){nextProject={...nextProject,activePartId:replacing.id,parts:nextProject.parts.map(p=>p.id===replacing.id?{...p,fileName:file.name,fileSizeBytes:file.size,geometry:null,configuration:configurations?.[index]??p.configuration}:p)};}
        else nextProject = addPartToProject(nextProject, { fileName: file.name, fileSizeBytes: file.size }, addedAt);
        const partId = nextProject.activePartId;
        if (partId) {
          nextProject = setPartMaterial(nextProject, partId, configurations?.[index]?.materialId??"cold", addedAt);
          if(configurations?.[index])nextProject={...nextProject,parts:nextProject.parts.map(p=>p.id===partId?{...p,configuration:configurations[index]}:p)};
        }
        const part = partId ? nextProject.parts.find((item) => item.id === partId) : null;
        if (partId && part) jobs.push({ file, partId, format: part.format });
      } catch {
        rejectedFiles.push(`Файл «${file.name}» не добавлен: проверьте формат и размер.`);
      }
    });

    if (!jobs.length) {
      setProjectCalculationMessage([overflowMessage, ...rejectedFiles].filter(Boolean).join(" "));
      return;
    }
    for (const job of jobs) editedFieldsByPartId.current.delete(job.partId);
    setQuantityDrafts(current => { const next = { ...current }; for (const job of jobs) delete next[job.partId]; return next; });
    if (trackPublicFunnel && jobs.length) trackLeadEvent("calculator_parts_added", { parts_count: jobs.length, input_method: configurations ? "manual" : "cad" });
    setProject(nextProject);
    if (jobs.length) setProjectRevision(current => Math.min(1_000_000_000, current + 1));
    if(configurations)setMaterialConfirmed(current=>({...current,...Object.fromEntries(jobs.map(job=>[job.partId,true]))}));
    // A new position makes the project total stale, so the sentences the
    // priced positions are still showing go with it.
    dropStaleCalculation();
    if (overflowMessage || rejectedFiles.length) setProjectCalculationMessage([overflowMessage, ...rejectedFiles].filter(Boolean).join(" "));
    setPreviewsByPartId(current => {
      const next = { ...current };
      for (const job of jobs) delete next[job.partId];
      return next;
    });
    setFilesByPartId((current) => {
      const next = { ...current };
      for (const job of jobs) next[job.partId] = job.file;
      return next;
    });

    await analyzeFiles(jobs);
    } finally {ingestLock.current=false;setIsIngesting(false);}
  };

  const restoreProject = async (saved: CadProjectFile) => {
    if (ingestLock.current) throw new Error("Дождитесь обработки текущих изделий.");
    // No mutation until the entire package and every manual source are ready.
    const restored = prepareCadProjectRestore(saved);
    ingestLock.current = true;
    setIsIngesting(true);
    for (const controller of analysisControllers.current.values()) controller.abort();
    analysisControllers.current.clear();
    dropStaleCalculation();
    editedFieldsByPartId.current.clear();
    setQuantityDrafts({});
    setProject(restored.project);
    setProjectRevision(restored.revision);
    setSourcesByPartId(restored.sourcesByPartId);
    setFilesByPartId(restored.filesByPartId);
    setPreviewsByPartId({});
    setAnalyzingByPartId({});
    // A restored material is a saved selection, not a new confirmation.
    setMaterialConfirmed({});
    setStatusByPartId(Object.fromEntries(restored.project.parts.map(part => [part.id,
      restored.filesByPartId[part.id] ? "Размеры восстановлены. Повторно проверяем ручную заготовку." : "Исходный CAD не прикреплён. Выберите оригинал в разделе «Файл проекта».",
    ])));
    setProjectCalculationMessage("Проект восстановлен без старой цены. Проверьте параметры, прикрепите недостающие CAD и рассчитайте заново. Если выбрана сборка, её состав и окончательную стоимость уточнит специалист.");
    try {
      await analyzeFiles(restored.project.parts.flatMap(part => {
        const file = restored.filesByPartId[part.id];
        return file ? [{ file, partId: part.id, format: part.format }] : [];
      }), true);
    } finally { ingestLock.current = false; setIsIngesting(false); }
  };

  const reattachFile = async (partId: string, file: File) => {
    if (ingestLock.current) throw new Error("Дождитесь обработки текущих изделий.");
    const source = sourcesByPartId[partId];
    if (source?.kind !== "cad" || filesByPartId[partId]) throw new Error("Позиция уже восстановлена или не найдена.");
    ingestLock.current = true;
    setIsIngesting(true);
    try {
      await verifyCadAttachment(file, source.attachment);
      const part = projectRef.current.parts.find(part => part.id === partId);
      if (!part) throw new Error("Позиция удалена. Исходный файл не добавлен.");
      dropStaleCalculation();
      setFilesByPartId(current => ({ ...current, [partId]: file }));
      setStatusByPartId(current => ({ ...current, [partId]: "Контрольная сумма совпала. Повторно проверяем CAD." }));
      await analyzeFiles([{ file, partId, format: part.format }], true);
    } finally { ingestLock.current = false; setIsIngesting(false); }
  };

  const renameProject = (title: string) => {
    setProject(current => ({ ...current, title, updatedAt: new Date().toISOString() }));
    setProjectRevision(current => Math.min(1_000_000_000, current + 1));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void ingestFiles(files).catch(e=>setProjectCalculationMessage(e.message));
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
    void ingestFiles(Array.from(event.dataTransfer.files ?? [])).catch(e=>setProjectCalculationMessage(e.message));
  };

  const updateQuantity = (value: number | string) => {
    if (!activePart) return;
    const draft = String(value);
    setQuantityDrafts(current => ({ ...current, [activePart.id]: draft }));
    const parsed = parseCadQuantityDraft(draft);
    if (parsed.value == null || parsed.value === activePart.configuration.quantity) return;
    setProject((current) => setPartQuantity(current, activePart.id, parsed.value));
    markConfigurationChanged(activePart.id);
  };
  const updateMaterial = (value: MaterialId) => {
    if (!activePart) return;
    setMaterialConfirmed((current) => ({ ...current, [activePart.id]: true }));
    if (value === activePart.configuration.materialId) return;
    setProject((current) => setPartMaterial(current, activePart.id, value));
    markConfigurationChanged(activePart.id);
  };
  const updateThickness = (value: number) => {
    if (!activePart) return;
    markFieldEdited(activePart.id, "thickness");
    if (value === activePart.configuration.thicknessMm) return;
    setProject((current) => setPartThickness(current, activePart.id, value));
    markConfigurationChanged(activePart.id);
  };
  const toggleOperation = (operation: ManufacturingOperation) => {
    if (!activePart) return;
    if (operation === "bending" || operation === "countersink") markFieldEdited(activePart.id, operation);
    const enabled = !activePart.configuration.operations.includes(operation);
    setProject((current) => togglePartOperation(current, activePart.id, operation, enabled));
    markConfigurationChanged(activePart.id);
  };
  const updateOperationInputs = (patch: OperationInputs) => {
    if (!activePart) return;
    if ("bendCount" in patch) markFieldEdited(activePart.id, "bending");
    if ("countersinkCount" in patch) markFieldEdited(activePart.id, "countersink");
    if (Object.entries(patch).every(([key, value]) => activePart.configuration.operationInputs?.[key as keyof OperationInputs] === value)) return;
    setProject((current) => setPartOperationInputs(current, activePart.id, patch));
    markConfigurationChanged(activePart.id);
  };
  const removeActivePart = () => {
    if (!activePart) return;
    const id = activePart.id;
    editedFieldsByPartId.current.delete(id);
    setQuantityDrafts(current => { const next = { ...current }; delete next[id]; return next; });
    analysisControllers.current.get(id)?.abort(); analysisControllers.current.delete(id);
    setAnalyzingByPartId(current => { const next = { ...current }; delete next[id]; return next; });
    setProjectRevision(current => Math.min(1_000_000_000, current + 1));
    setSourcesByPartId(current => { const next = { ...current }; delete next[id]; return next; });
    setProject((current) => removePartFromProject(current, id));
    setPreviewsByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setFilesByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    dropStaleCalculation({ removed: id });
  };

  const calculateProject = async () => {
    if (!canCalculate) return;
    if (trackPublicFunnel) trackLeadEvent("calculator_calculation_started", { parts_count: project.parts.length });
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
      if (trackPublicFunnel) {
        const pricedCount = calculationResult.parts.filter(part => ["approved", "estimate"].includes(part.price.status) && part.price.totalRub != null).length;
        const event = pricedCount === project.parts.length && pricedCount > 0 ? "calculator_price_received" : pricedCount > 0 ? "calculator_partial_price" : "calculator_review_required";
        trackLeadEvent(event, { parts_count: project.parts.length, priced_count: pricedCount });
      }
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
      if (trackPublicFunnel) trackLeadEvent("calculator_calculation_error", { parts_count: project.parts.length });
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

  return { quantityDraft, quantityError, hasInvalidQuantity, invalidQuantityParts, projectRevision, sourcesByPartId, missingAttachments, restoreProject, reattachFile, renameProject, isIngesting, inputRef, project, setProject, activePart, activePreview, activeCalculation, approvedProjectTotalRub, estimatedProjectTotalRub, quoteHandoffHref, isAnalyzing, materialId, thickness, quantity, canCalculate, calculateLabel, calculateLabelShort, workflowSteps, dropStaleCalculation, ingestFiles, onChange, onDragEnter, onDragOver, onDragLeave, onDrop, updateQuantity, updateMaterial, updateThickness, toggleOperation, updateOperationInputs, removeActivePart, calculateProject, clientMetrics, isDraggingFiles, projectCalculationMessage, calculationFailed, statusByPartId, calculation: currentCalculation, calculatedAt, materialConfirmed, bendConflict, filesByPartId, previewsByPartId };
}
