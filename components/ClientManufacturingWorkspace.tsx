"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { ClientCad2DPreview } from "@/components/ClientCad2DPreview";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { createCalculationFormData } from "@/lib/instant-quote/client-calculation-request";
import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import type { ClientCadPreview } from "@/lib/instant-quote/client-cad-preview-types";
import { createEmptyProject, type ManufacturingOperation } from "@/lib/instant-quote/domain";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import {
  addPartToProject,
  removePartFromProject,
  setActivePart,
  setPartMaterial,
  setPartQuantity,
  setPartState,
  setPartThickness,
  togglePartOperation,
  updatePartGeometry,
} from "@/lib/instant-quote/project";

const accepted = ".dxf,.dwg,.step,.stp";
const thicknessOptions = [0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40];

const MATERIAL_OPTIONS: Array<{ id: MaterialId; label: string }> = [
  { id: "hot", label: "Сталь г/к" },
  { id: "cold", label: "Сталь х/к" },
  { id: "zinc", label: "Оцинкованная сталь" },
];

const OPERATION_OPTIONS: Array<{ id: ManufacturingOperation; label: string }> = [
  { id: "bending", label: "Гибка" },
  { id: "welding", label: "Сварка" },
  { id: "assembly", label: "Сборка" },
  { id: "surface-preparation", label: "Подготовка поверхности" },
  { id: "powder-coating", label: "Порошковая окраска" },
  { id: "packaging", label: "Упаковка" },
];

type CalculationApiResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  calculation?: ClientProjectCalculationView;
};

type CadAnalysisApiResponse = {
  ok?: boolean;
  error?: string;
  preview?: ClientCadPreview;
};

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

function isClientCalculationView(value: unknown): value is ClientProjectCalculationView {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClientProjectCalculationView>;
  return candidate.kind === "client-calculation" && Array.isArray(candidate.parts) && candidate.paymentEnabled === false;
}

function isClientCadPreview(value: unknown): value is ClientCadPreview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClientCadPreview>;
  return candidate.kind === "client-cad-preview"
    && candidate.units === "mm"
    && (candidate.status === "recognized" || candidate.status === "needs-review")
    && Boolean(candidate.cad && typeof candidate.cad === "object")
    && Array.isArray(candidate.meshes);
}

export function ClientManufacturingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState(() => createEmptyProject());
  const [previewsByPartId, setPreviewsByPartId] = useState<Record<string, ClientCadPreview>>({});
  const [filesByPartId, setFilesByPartId] = useState<Record<string, File>>({});
  const [analyzingByPartId, setAnalyzingByPartId] = useState<Record<string, boolean>>({});
  const [statusByPartId, setStatusByPartId] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [projectCalculationMessage, setProjectCalculationMessage] = useState<string | null>(null);

  const activePart = useMemo(
    () => project.parts.find((part) => part.id === project.activePartId) ?? null,
    [project],
  );
  const activePreview = activePart ? previewsByPartId[activePart.id] ?? null : null;
  const isAnalyzing = activePart ? Boolean(analyzingByPartId[activePart.id]) : false;
  const materialId = materialIdOf(activePart?.configuration.materialId ?? null);
  const thickness = activePart?.configuration.thicknessMm ?? 1;
  const quantity = activePart?.configuration.quantity ?? 1;
  const allFilesPresent = project.parts.length > 0 && project.parts.every((part) => Boolean(filesByPartId[part.id]));
  const anyAnalyzing = Object.values(analyzingByPartId).some(Boolean);
  const canCalculate = allFilesPresent && !anyAnalyzing && !isCalculating;

  const markConfigurationChanged = (partId: string) => {
    setStatusByPartId((current) => ({
      ...current,
      [partId]: "Параметры изменены. Нажмите «Рассчитать проект», чтобы обновить результат.",
    }));
    setProjectCalculationMessage(null);
  };

  const ingestFiles = async (files: File[]) => {
    if (!files.length) return;
    let nextProject = project;
    const jobs: Array<{ file: File; partId: string; format: "dxf" | "dwg" | "step" | "stp" }> = [];

    files.forEach((file, index) => {
      try {
        nextProject = addPartToProject(nextProject, { fileName: file.name, fileSizeBytes: file.size }, new Date(Date.now() + index));
        const partId = nextProject.activePartId;
        const part = partId ? nextProject.parts.find((item) => item.id === partId) : null;
        if (partId && part) jobs.push({ file, partId, format: part.format });
      } catch {
        // accept= limits common unsupported formats; invalid files remain ignored.
      }
    });

    setProject(nextProject);
    setProjectCalculationMessage(null);
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
          throw new Error(payload?.error || "CAD analysis failed.");
        }

        const preview = payload.preview;
        setPreviewsByPartId((current) => ({ ...current, [partId]: preview }));
        setProject((current) => {
          const geometry = {
            ...(preview.cad.widthMm == null ? {} : { widthMm: preview.cad.widthMm }),
            ...(preview.cad.heightMm == null ? {} : { heightMm: preview.cad.heightMm }),
            ...(preview.cad.depthMm == null ? {} : { depthMm: preview.cad.depthMm }),
          };
          const withGeometry = updatePartGeometry(current, partId, geometry);
          return setPartState(withGeometry, partId, preview.status === "needs-review" ? "manual-review" : "configurable");
        });
        setStatusByPartId((current) => ({
          ...current,
          [partId]: preview.status === "needs-review"
            ? preview.message
            : "Модель распознана. Проверьте параметры и нажмите «Рассчитать проект».",
        }));
      } catch {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setStatusByPartId((current) => ({
          ...current,
          [partId]: "Не удалось построить предпросмотр модели. Попробуйте загрузить файл ещё раз или используйте другой CAD-файл.",
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
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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
  const removeActivePart = () => {
    if (!activePart) return;
    const id = activePart.id;
    setProject((current) => removePartFromProject(current, id));
    setPreviewsByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setFilesByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setStatusByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setProjectCalculationMessage(null);
  };

  const calculateProject = async () => {
    if (!canCalculate) return;
    setIsCalculating(true);
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

      const calculation = payload.calculation;
      setStatusByPartId((current) => {
        const next = { ...current };
        for (const part of calculation.parts) next[part.partId] = part.message;
        return next;
      });
      setProjectCalculationMessage(
        calculation.parts.every((part) => part.status === "ready")
          ? "Расчёт проекта завершён."
          : "Проект обработан. Для некоторых позиций потребуется уточнение параметров.",
      );
    } catch (error) {
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
    <main className="min-h-screen bg-[#090c0e] text-white">
      <section className="border-b border-white/10 bg-[#101416]">
        <div className="container py-8">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-steel-orange">Steel Product Online</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">CAD → конфигурация → расчёт</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/50">Загрузите CAD-модель, проверьте габариты, выберите материал, толщину, количество и необходимые операции.</p>
        </div>
      </section>

      <section className="container py-6">
        <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_380px]">
          <aside className="border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Проект</p>
              <div className="mt-2 flex items-center justify-between gap-3"><strong className="min-w-0 truncate text-sm" title={project.title}>{project.title}</strong><span className="shrink-0 text-[10px] text-white/30">{project.parts.length} поз.</span></div>
            </div>
            <div className="max-h-[610px] overflow-y-auto">
              {project.parts.map((part, index) => {
                const active = part.id === activePart?.id;
                return <button key={part.id} onClick={() => setProject((current) => setActivePart(current, part.id))} className={`block w-full border-b p-3 text-left ${active ? "border-steel-orange/35 bg-steel-orange/[.05]" : "border-white/10 hover:bg-white/[.03]"}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[.13em] text-steel-orange">#{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-1 truncate text-xs font-semibold">{part.fileName}</p>
                  <p className="mt-1 text-[9px] text-white/35">×{part.configuration.quantity} · {part.format.toUpperCase()}</p>
                </button>;
              })}
            </div>
            <button onClick={() => inputRef.current?.click()} className="m-4 w-[calc(100%-2rem)] border border-white/12 px-3 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-white/55 hover:border-steel-orange hover:text-white">+ Добавить CAD</button>
          </aside>

          <div className="min-w-0 overflow-hidden border border-white/10 bg-[#101416]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-[.14em] text-white/40">Модель</span>
              {activePart && <button onClick={removeActivePart} className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40 hover:text-red-300">Удалить</button>}
            </div>
            <div className="relative min-h-[650px] bg-[#080b0d]">
              <AnimatePresence mode="wait">
                {!activePart ? <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-6 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 p-8 text-center" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}>
                  <div className="flex h-16 w-16 items-center justify-center border border-steel-orange/55 text-3xl text-steel-orange">+</div>
                  <h2 className="mt-6 text-2xl font-semibold">Перетащите CAD-файлы</h2>
                  <p className="mt-3 text-sm text-white/40">DXF · STEP · STP · DWG</p>
                </motion.div> : isAnalyzing ? <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center text-center"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">CAD</p><h2 className="mt-3 text-xl font-semibold">Обрабатываем модель</h2><p className="mt-3 text-xs text-white/35">Подготавливаем предпросмотр и определяем габариты.</p></div></motion.div> : activePreview?.meshes.length ? <motion.div key={`mesh-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0"><CadMeshViewer meshes={activePreview.meshes} className="h-full" /></motion.div> : activePreview?.drawing ? <motion.div key={`dxf-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-6"><ClientCad2DPreview drawing={activePreview.drawing} animated /></motion.div> : <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center"><p className="max-w-lg text-sm leading-relaxed text-white/50">{statusByPartId[activePart.id] ?? "Файл добавлен в проект."}</p></motion.div>}
              </AnimatePresence>
              {activePreview && <div className="absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-3">{clientMetrics.map(([label, value]) => <div key={label} className="bg-[#101416]/95 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/28">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>}
            </div>
          </div>

          <aside className="border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Параметры</p><h2 className="mt-2 text-xl font-semibold">Конфигурация изделия</h2></div>
            {activePart ? <>
              <div className="space-y-5 p-5">
                <div><label className="text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Материал</label><div className="mt-2 grid grid-cols-3 gap-1">{MATERIAL_OPTIONS.map((option) => <button key={option.id} onClick={() => updateMaterial(option.id)} className={`border px-2 py-3 text-[10px] font-semibold ${materialId === option.id ? "border-steel-orange/50 bg-steel-orange/[.07]" : "border-white/10"}`}>{option.label}</button>)}</div></div>
                <div><label className="text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Толщина, мм</label><select value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none">{thicknessOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <div><label className="text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Количество</label><input value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-white/35">Операции</p><div className="mt-2 grid gap-2">{OPERATION_OPTIONS.map((option) => { const enabled = activePart.configuration.operations.includes(option.id); return <button key={option.id} onClick={() => toggleOperation(option.id)} className={`flex items-center justify-between border px-4 py-3 text-left text-sm ${enabled ? "border-steel-orange/45 bg-steel-orange/[.06]" : "border-white/10"}`}><span>{option.label}</span><span>{enabled ? "✓" : ""}</span></button>; })}</div></div>
              </div>
              <div className="border-t border-white/10 p-5">
                <button type="button" onClick={() => void calculateProject()} disabled={!canCalculate} className="w-full border border-steel-orange bg-steel-orange px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[.04] disabled:text-white/25">
                  {isCalculating ? "Выполняется расчёт…" : "Рассчитать проект"}
                </button>
                {projectCalculationMessage && <p className="mt-3 text-xs leading-relaxed text-white/50">{projectCalculationMessage}</p>}
                <div className="mt-4 border border-steel-orange/25 bg-steel-orange/[.04] p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-steel-orange">Статус проекта</p><p className="mt-3 text-sm leading-relaxed text-white/60">{statusByPartId[activePart.id] ?? "Проверьте параметры изделия и запустите расчёт."}</p><p className="mt-3 text-[10px] leading-relaxed text-white/30">Расчёт на сайте является предварительным и зависит от качества исходной CAD-модели. Оплата пока не подключена.</p></div>
              </div>
            </> : <div className="p-5 text-sm text-white/35">Добавьте CAD-файл.</div>}
          </aside>
        </div>
      </section>
      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" />
    </main>
  );
}
