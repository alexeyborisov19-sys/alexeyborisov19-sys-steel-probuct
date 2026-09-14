"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { Cad2DViewer } from "@/components/Cad2DViewer";
import { CadMeshViewer } from "@/components/CadMeshViewer";
import { StepFlatPatternViewer } from "@/components/StepFlatPatternViewer";
import { analyzeCadBytes } from "@/lib/instant-quote/cad-dispatcher";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";
import { runVerifiedLaserDfm, type DfmResult } from "@/lib/instant-quote/dfm";
import { parseAsciiDxf, type ParsedDxf } from "@/lib/instant-quote/dxf";
import { createEmptyProject, type ManufacturingOperation } from "@/lib/instant-quote/domain";
import { selectBestStoredPrice } from "@/lib/instant-quote/material-price-feed";
import { calculateModelProjectPricing } from "@/lib/instant-quote/model-pricing";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { FALLBACK_METAL_PRICE_SNAPSHOTS } from "@/lib/instant-quote/price-seed";
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

const MATERIAL_OPTIONS: Array<{ id: MaterialId; label: string; note: string }> = [
  { id: "hot", label: "Сталь г/к", note: "чёрная сталь" },
  { id: "cold", label: "Сталь х/к", note: "чёрная сталь" },
  { id: "zinc", label: "Оцинковка", note: "DFM review" },
];

// Public configurator exposes only operations confirmed by the company's
// manufacturing source of truth. Laser cutting is the base route below.
const OPERATION_OPTIONS: Array<{ id: ManufacturingOperation; label: string }> = [
  { id: "bending", label: "Гибка" },
  { id: "welding", label: "Сварка" },
  { id: "assembly", label: "Сборка" },
  { id: "surface-preparation", label: "Подготовка поверхности" },
  { id: "powder-coating", label: "Порошковая окраска" },
  { id: "packaging", label: "Упаковка" },
];

type WorkspaceTab = "model" | "flat" | "dfm";

function fmt(value: number, digits = Math.abs(value) < 1000 ? 2 : 0) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function money(value: number) {
  return `${Math.ceil(value).toLocaleString("ru-RU")} ₽`;
}

function materialIdOf(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return "hot";
}

function statusLabel(status: string) {
  if (status === "calculated") return "РАССЧИТАНО";
  if (status === "blocked") return "DFM BLOCK";
  if (status === "missing-price") return "НЕТ ЦЕНЫ";
  if (status === "missing-geometry") return "CAD";
  return "REVIEW";
}

function severityTone(severity: DfmResult["severity"]) {
  if (severity === "pass") return "border-emerald-400/25 bg-emerald-400/5 text-emerald-300";
  if (severity === "error") return "border-red-400/30 bg-red-400/5 text-red-300";
  if (severity === "warning") return "border-amber-400/30 bg-amber-400/5 text-amber-300";
  return "border-white/12 bg-white/[.025] text-white/65";
}

function trustedPlanarFlat(model: NormalizedCadModel) {
  const flat = model.sheetMetal?.flatPatternCandidate;
  return flat?.source === "planar-prism" && flat.confidence === "high" ? flat : null;
}

function stepThicknessMatches(model: NormalizedCadModel, selectedThicknessMm: number) {
  const detected = model.sheetMetal?.thicknessCandidate?.thicknessMm;
  if (!(detected && detected > 0)) return false;
  return Math.abs(selectedThicknessMm - detected) <= Math.max(0.05, detected * 0.02);
}

function stepDfm(model: NormalizedCadModel, selectedThicknessMm: number, materialId: MaterialId): DfmResult[] {
  const geometry = model.geometry;
  const flat = trustedPlanarFlat(model);
  const detectedThickness = model.sheetMetal?.thicknessCandidate?.thicknessMm;
  const results: DfmResult[] = [
    {
      code: "step-read",
      title: "3D-геометрия STEP распознана",
      detail: `Габарит ${fmt(geometry.widthMm ?? 0)} × ${fmt(geometry.heightMm ?? 0)} × ${fmt(geometry.depthMm ?? 0)} мм. Тела: ${geometry.bodyCount ?? model.meshes.length}.`,
      severity: "pass",
    },
  ];

  if (geometry.volumeMm3 && geometry.volumeMm3 > 0) {
    results.push({
      code: "step-volume",
      title: "Замкнутый объём получен",
      detail: `OpenCascade определил объём ${fmt(geometry.volumeMm3)} мм³.`,
      severity: "pass",
    });
  }

  if (flat) {
    results.push({
      code: "step-flat-pattern",
      title: "Плоская листовая геометрия подтверждена",
      detail: `BRep-проверка подтвердила planar-prism: ${fmt(flat.widthMm)} × ${fmt(flat.heightMm)} мм, контур реза ${fmt(flat.cutLengthMm)} мм, контуров ${flat.contourCount}. Объём согласован с площадью и толщиной.`,
      severity: "pass",
    });

    if (detectedThickness && stepThicknessMatches(model, selectedThicknessMm)) {
      results.push({
        code: "step-thickness-match",
        title: "Толщина STEP совпадает с конфигурацией",
        detail: `BRep-кандидат толщины ${fmt(detectedThickness)} мм; выбрано ${fmt(selectedThicknessMm)} мм.`,
        severity: "pass",
      });
    } else {
      results.push({
        code: "step-thickness-mismatch",
        title: "Толщина конфигурации не совпадает с STEP",
        detail: detectedThickness
          ? `OpenCascade определил ${fmt(detectedThickness)} мм, а в конфигураторе выбрано ${fmt(selectedThicknessMm)} мм. Автоматическая цена заблокирована.`
          : "Не удалось подтвердить толщину STEP для выбранной конфигурации.",
        severity: "error",
      });
    }

    results.push(
      ...runVerifiedLaserDfm(
        { width: flat.widthMm, height: flat.heightMm, units: "мм" },
        selectedThicknessMm,
        materialId,
      ),
    );
  } else {
    if (detectedThickness) {
      results.push({
        code: "step-thickness-candidate",
        title: "Кандидат толщины найден",
        detail: `BRep-анализ оценивает толщину как ${fmt(detectedThickness)} мм, но без подтверждённой развёртки это ещё не производственный параметр.`,
        severity: "manual",
      });
    }

    if ((model.sheetMetal?.bendCandidates.length ?? 0) > 0) {
      results.push({
        code: "step-bend-candidates",
        title: "Обнаружены кандидаты зон гиба",
        detail: `Найдено ${model.sheetMetal?.bendCandidates.length ?? 0} BRep-зон, похожих на гиб. Для автоматической развёртки ещё нужна утверждённая технологическая таблица bend allowance / K-factor.`,
        severity: "manual",
      });
    }

    results.push({
      code: "step-unfold",
      title: "Нужна подтверждённая листовая развёртка",
      detail: "3D STEP не получает фиктивную длину лазерного реза или коммерческую цену, пока Sheet Metal Engine не подтвердит flat pattern.",
      severity: "manual",
    });
  }

  for (const [index, warning] of model.warnings.entries()) {
    results.push({ code: `step-warning-${index}`, title: "Проверка STEP", detail: warning, severity: "manual" });
  }

  return results;
}

export function ManufacturingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState(() => createEmptyProject());
  const [modelsByPartId, setModelsByPartId] = useState<Record<string, NormalizedCadModel>>({});
  const [parsedByPartId, setParsedByPartId] = useState<Record<string, ParsedDxf>>({});
  const [messageByPartId, setMessageByPartId] = useState<Record<string, string>>({});
  const [analyzingByPartId, setAnalyzingByPartId] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<WorkspaceTab>("model");

  const activePart = useMemo(
    () => project.parts.find((part) => part.id === project.activePartId) ?? null,
    [project],
  );
  const activeModel = activePart ? modelsByPartId[activePart.id] ?? null : null;
  const activeParsed = activePart ? parsedByPartId[activePart.id] ?? null : null;
  const message = activePart ? messageByPartId[activePart.id] ?? null : null;
  const isAnalyzing = activePart ? Boolean(analyzingByPartId[activePart.id]) : false;
  const materialId = materialIdOf(activePart?.configuration.materialId ?? null);
  const thickness = activePart?.configuration.thicknessMm ?? 1;
  const quantity = activePart?.configuration.quantity ?? 1;

  const projectPricing = useMemo(
    () => calculateModelProjectPricing(project, modelsByPartId, FALLBACK_METAL_PRICE_SNAPSHOTS),
    [modelsByPartId, project],
  );
  const activePricing = activePart
    ? projectPricing.parts.find((item) => item.partId === activePart.id) ?? null
    : null;
  const provisionalPrice = activePricing?.price ?? null;

  const selectedPrice = useMemo(() => {
    if (!activePart) return null;
    return selectBestStoredPrice(FALLBACK_METAL_PRICE_SNAPSHOTS, materialId, thickness);
  }, [activePart, materialId, thickness]);

  const dfm = useMemo<DfmResult[]>(() => {
    if (!activeModel || !activePart) return [];
    if (activeModel.format === "step" || activeModel.format === "stp") return stepDfm(activeModel, thickness, materialId);

    const width = activeModel.geometry.widthMm ?? 0;
    const height = activeModel.geometry.heightMm ?? 0;
    if (!(width > 0 && height > 0)) return [];

    const results = runVerifiedLaserDfm({ width, height, units: "мм" }, thickness, materialId);
    activeModel.warnings.forEach((warning, index) => {
      results.push({ code: `cad-warning-${index}`, title: "CAD требует проверки", detail: warning, severity: "manual" });
    });
    return results;
  }, [activeModel, activePart, materialId, thickness]);

  const blocking = dfm.some((item) => item.severity === "error");
  const manual = dfm.some((item) => item.severity === "manual" || item.severity === "warning");

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
        // Browser accept list handles the common unsupported-file path.
      }
    });

    setProject(nextProject);
    setTab("model");

    await Promise.all(jobs.map(async ({ file, partId, format }) => {
      if (format === "dwg") {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setMessageByPartId((current) => ({ ...current, [partId]: "DWG сохранён в проекте. Authoritative DWG parser будет подключён отдельным CAD-модулем." }));
        return;
      }

      setAnalyzingByPartId((current) => ({ ...current, [partId]: true }));
      setMessageByPartId((current) => ({ ...current, [partId]: "" }));

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());

        if (format === "dxf") {
          const sourceText = new TextDecoder("utf-8").decode(bytes);
          const sourceParsed = parseAsciiDxf(sourceText);
          setParsedByPartId((current) => ({ ...current, [partId]: sourceParsed }));
        }

        const model = await analyzeCadBytes(file.name, format, bytes);
        setModelsByPartId((current) => ({ ...current, [partId]: model }));
        setProject((current) => {
          const withGeometry = updatePartGeometry(current, partId, model.geometry);
          const stepModel = model.format === "step" || model.format === "stp";
          const trustedFlat = stepModel && Boolean(trustedPlanarFlat(model));
          const state = model.warnings.length || (stepModel && !trustedFlat)
            ? "manual-review"
            : "configurable";
          return setPartState(withGeometry, partId, state);
        });

        const parts: string[] = [];
        if (model.format === "step" || model.format === "stp") {
          parts.push(
            trustedPlanarFlat(model)
              ? "STEP распознан OpenCascade. Плоская листовая геометрия подтверждена BRep-проверкой."
              : "STEP распознан OpenCascade и готов к 3D-просмотру. Для сложной листовой геометрии требуется технологическая проверка.",
          );
        }
        parts.push(...model.warnings);
        if (parts.length) setMessageByPartId((current) => ({ ...current, [partId]: parts.join(" ") }));
      } catch (error) {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setMessageByPartId((current) => ({
          ...current,
          [partId]: error instanceof Error ? error.message : "Не удалось проанализировать CAD-файл.",
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

  const removeActivePart = () => {
    if (!activePart) return;
    const id = activePart.id;
    setProject((current) => removePartFromProject(current, id));
    setModelsByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setParsedByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
    setMessageByPartId((current) => { const next = { ...current }; delete next[id]; return next; });
  };

  const updateQuantity = (value: number) => {
    if (activePart) setProject((current) => setPartQuantity(current, activePart.id, value));
  };
  const updateMaterial = (value: MaterialId) => {
    if (activePart) setProject((current) => setPartMaterial(current, activePart.id, value));
  };
  const updateThickness = (value: number) => {
    if (activePart) setProject((current) => setPartThickness(current, activePart.id, value));
  };
  const toggleOperation = (operation: ManufacturingOperation) => {
    if (!activePart) return;
    const enabled = !activePart.configuration.operations.includes(operation);
    setProject((current) => togglePartOperation(current, activePart.id, operation, enabled));
  };

  const stages = [
    ["01", "CAD", project.parts.length > 0],
    ["02", "Геометрия", Boolean(activeModel)],
    ["03", "DFM", Boolean(activeModel && !blocking)],
    ["04", "Конфигурация", Boolean(activePart?.configuration.materialId && activePart.configuration.thicknessMm)],
    ["05", "Цена", Boolean(provisionalPrice)],
  ] as const;

  const isStep = activeModel?.format === "step" || activeModel?.format === "stp";
  const activeFlat = activeModel ? trustedPlanarFlat(activeModel) : null;
  const flatPreview = activeFlat?.preview ?? null;
  const isTrustedPlanarStep = Boolean(isStep && activeFlat);
  const detectedStepThickness = activeModel?.sheetMetal?.thicknessCandidate?.thicknessMm;
  const bendCandidateCount = activeModel?.sheetMetal?.bendCandidates.length ?? 0;
  const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "model", label: isStep ? "3D модель" : "2D модель" },
    ...(flatPreview ? [{ id: "flat" as const, label: "Развёртка 2D" }] : []),
    { id: "dfm", label: `DFM ${dfm.length ? `· ${dfm.length}` : ""}` },
  ];
  const modelMetrics = isTrustedPlanarStep && activeFlat
    ? [
        ["X", `${fmt(activeFlat.widthMm)} мм`],
        ["Y", `${fmt(activeFlat.heightMm)} мм`],
        ["Рез", `${fmt(activeFlat.cutLengthMm)} мм`],
        ["Контуры", String(activeFlat.contourCount)],
      ]
    : [
        ["X", `${fmt(activeModel?.geometry.widthMm ?? 0)} мм`],
        ["Y", `${fmt(activeModel?.geometry.heightMm ?? 0)} мм`],
        [isStep ? "Z" : "Рез", isStep ? `${fmt(activeModel?.geometry.depthMm ?? 0)} мм` : `${fmt(activeModel?.geometry.cutLengthMm ?? 0)} мм`],
        [isStep ? "Тела" : "Прожиги", String(isStep ? activeModel?.geometry.bodyCount ?? 0 : activeModel?.geometry.pierceCount ?? 0)],
      ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#090c0e] text-white">
      <section className="relative border-b border-white/10 bg-[#101416]">
        <div className="pointer-events-none absolute inset-0 opacity-[.17]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
        <div className="container relative py-7 sm:py-9">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-steel-orange"><span className="h-px w-8 bg-steel-orange" /> Steel Product Online</div>
              <h1 className="mt-4 max-w-5xl text-3xl font-semibold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">CAD → DFM → цена → производство</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55 sm:text-base">Закрытая Alpha производственной платформы: DXF в 2D, STEP/STP в настоящем 3D, единый проект и предварительная экономика.</p>
            </div>
            <div className="grid grid-cols-5 gap-px overflow-hidden border border-white/10 bg-white/10">
              {stages.map(([number, label, done]) => <div key={number} className={`min-w-[74px] bg-[#111518] px-3 py-3 ${done ? "text-white" : "text-white/35"}`}><div className={`text-[10px] font-bold tracking-[.16em] ${done ? "text-steel-orange" : "text-white/25"}`}>{number}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.1em]">{label}</div></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5 lg:py-7">
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_390px]">
          <aside className="order-2 border border-white/10 bg-[#101416] xl:order-1">
            <div className="border-b border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Проект</p>
              <div className="mt-2 flex items-center justify-between gap-3"><strong className="truncate text-sm">{project.title}</strong><span className="whitespace-nowrap text-[10px] text-white/30">{project.parts.length} поз.</span></div>
              {projectPricing.totalRub > 0 && <div className="mt-3 border-t border-white/10 pt-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-white/30">Предварительно</p><p className="mt-1 text-lg font-semibold">{money(projectPricing.totalRub)}</p><p className="mt-1 text-[9px] text-white/30">рассчитано {projectPricing.calculatedParts} / {projectPricing.totalParts} поз.</p></div>}
            </div>

            <div className="max-h-[610px] overflow-y-auto">
              {project.parts.map((part, index) => {
                const model = modelsByPartId[part.id];
                const parsed = parsedByPartId[part.id];
                const pricing = projectPricing.parts.find((item) => item.partId === part.id);
                const active = part.id === activePart?.id;
                return (
                  <button key={part.id} onClick={() => { setProject((current) => setActivePart(current, part.id)); setTab("model"); }} className={`block w-full border-b p-3 text-left transition ${active ? "border-steel-orange/35 bg-steel-orange/[.055]" : "border-white/10 hover:bg-white/[.03]"}`}>
                    <div className="flex gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#090c0e] p-2">
                        {parsed ? <Cad2DViewer parsed={parsed} /> : model?.meshes.length ? <span className="text-center text-[9px] font-bold uppercase tracking-[.12em] text-steel-orange">3D<br />STEP</span> : <span className="text-[10px] font-bold uppercase tracking-[.12em] text-white/25">{part.format}</span>}
                      </div>
                      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-steel-orange">#{String(index + 1).padStart(2, "0")}</p><span className="text-[8px] font-bold uppercase tracking-[.08em] text-white/25">{statusLabel(pricing?.status ?? part.state)}</span></div><p className="mt-1 truncate text-xs font-semibold">{part.fileName}</p><div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-white/32"><span>×{part.configuration.quantity}</span>{pricing?.price && <strong className="text-white/60">{money(pricing.price.totalRub)}</strong>}</div></div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => inputRef.current?.click()} className="m-4 w-[calc(100%-2rem)] border border-white/12 px-3 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-white/55 transition hover:border-steel-orange hover:text-white">+ Добавить позиции</button>
          </aside>

          <div className="order-1 min-w-0 overflow-hidden border border-white/10 bg-[#101416] xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex gap-1">{workspaceTabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${tab === item.id ? "bg-steel-orange text-black" : "text-white/45 hover:text-white"}`}>{item.label}</button>)}</div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[.12em] text-white/35">{activeModel && <span className="border border-white/10 px-2 py-1">{activeModel.metadata.parser}</span>}{activePart && <span className="max-w-[220px] truncate">{activePart.fileName}</span>}{activePart && <button onClick={removeActivePart} className="font-bold text-white/45 hover:text-red-300">Удалить</button>}</div>
            </div>

            <div className="relative min-h-[660px] overflow-hidden bg-[#080b0d]">
              <div className="pointer-events-none absolute inset-0 opacity-[.14]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
              <AnimatePresence mode="wait">
                {!activePart ? (
                  <motion.div key="drop" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 bg-black/15 p-8 text-center sm:inset-8" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}>
                    <motion.div animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }} className="relative flex h-20 w-20 items-center justify-center border border-steel-orange/55 text-4xl font-light text-steel-orange">+<span className="absolute -bottom-px -right-px h-5 w-5 border-l border-t border-steel-orange" /></motion.div>
                    <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Перетащите CAD-файлы</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">DXF анализируется в 2D. STEP/STP проходит через OpenCascade и открывается как интерактивная 3D-модель. Можно загружать несколько деталей сразу.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/35">{["DXF", "STEP", "STP", "DWG"].map((ext) => <span key={ext} className="border border-white/10 px-3 py-2">{ext}</span>)}</div>
                  </motion.div>
                ) : isAnalyzing ? (
                  <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center"><div className="w-full max-w-md px-8 text-center"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">CAD geometry engine</p><h2 className="mt-4 text-2xl font-semibold">{activePart.format === "step" || activePart.format === "stp" ? "OpenCascade разбирает STEP" : "Разбираем и нормализуем CAD"}</h2><div className="relative mt-7 h-px overflow-hidden bg-white/10"><motion.span className="absolute inset-y-0 w-1/3 bg-steel-orange" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }} /></div><p className="mt-4 text-xs text-white/35">геометрия · единицы · BRep · габариты · DFM</p></div></motion.div>
                ) : tab === "flat" && activeFlat && flatPreview ? (
                  <motion.div key={`flat-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-5 sm:p-8">
                    <StepFlatPatternViewer preview={flatPreview} widthMm={activeFlat.widthMm} heightMm={activeFlat.heightMm} />
                    <div className="absolute right-5 top-5 max-w-xs border border-white/10 bg-black/70 p-3 text-[9px] leading-relaxed text-white/45">2D-линии дискретизированы только для просмотра. Расчётная длина реза {fmt(activeFlat.cutLengthMm)} мм получена непосредственно из BRep и не зависит от плотности SVG-точек.</div>
                  </motion.div>
                ) : tab === "dfm" ? (
                  <motion.div key={`dfm-${activePart.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="relative p-5 sm:p-8">
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Design for manufacturability</p><h2 className="mt-2 text-2xl font-semibold">Автоматическая проверка</h2></div><span className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] ${blocking ? "border-red-400/30 text-red-300" : manual ? "border-amber-400/25 text-amber-300" : "border-emerald-400/25 text-emerald-300"}`}>{blocking ? "Есть блокировка" : manual ? "Нужна проверка" : "Проверка пройдена"}</span></div>
                    <div className="grid gap-3">{dfm.length ? dfm.map((item, index) => <motion.article key={`${item.code}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`border p-4 ${severityTone(item.severity)}`}><div className="flex gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[9px] font-bold">{item.severity === "pass" ? "✓" : item.severity === "error" ? "!" : "?"}</span><div><h3 className="text-sm font-semibold text-white">{item.title}</h3><p className="mt-2 text-xs leading-relaxed opacity-75">{item.detail}</p></div></div></motion.article>) : <div className="border border-amber-400/20 p-4 text-sm text-amber-200/70">CAD ещё не готов к DFM.</div>}</div>
                  </motion.div>
                ) : activeModel?.meshes.length ? (
                  <motion.div key={`mesh-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0"><CadMeshViewer meshes={activeModel.meshes} className="h-full" />{message && <div className="absolute right-5 top-16 max-w-[46%] border border-amber-400/20 bg-black/75 p-3 text-[9px] leading-relaxed text-amber-100/70">{message}</div>}</motion.div>
                ) : activeParsed && activeModel ? (
                  <motion.div key={`dxf-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-5 sm:p-8"><Cad2DViewer parsed={activeParsed} animated /><motion.div className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-steel-orange/65 to-transparent" animate={{ top: ["12%", "88%", "12%"] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} />{message && <div className="absolute right-5 top-5 max-w-[48%] border border-amber-400/20 bg-black/70 p-3 text-[9px] leading-relaxed text-amber-100/70">{message}</div>}</motion.div>
                ) : (
                  <motion.div key="message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center"><div className="max-w-xl border border-white/10 bg-[#101416] p-7"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">CAD intake</p><h2 className="mt-3 text-xl font-semibold">Позиция сохранена в проекте</h2><p className="mt-4 text-sm leading-relaxed text-white/50">{message ?? "Для этой позиции требуется CAD-анализ."}</p></div></motion.div>
                )}
              </AnimatePresence>

              {(tab === "model" || tab === "flat") && activeModel && <div className="pointer-events-none absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-4">{modelMetrics.map(([label, value]) => <div key={label} className="bg-[#101416]/95 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/28">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>}
            </div>
          </div>

          <aside className="order-3 border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Конфигуратор</p><h2 className="mt-2 text-xl font-semibold">Маршрут изготовления</h2><p className="mt-2 text-xs leading-relaxed text-white/38">Материал, толщина, количество и операции привязаны к конкретной CAD-позиции.</p></div>

            {activePart ? <>
              <div className="space-y-5 p-5">
                {isStep && <div className={`border p-3 text-[10px] leading-relaxed ${isTrustedPlanarStep ? "border-emerald-400/20 bg-emerald-400/[.04] text-white/52" : "border-steel-orange/20 bg-steel-orange/[.04] text-white/48"}`}>
                  {isTrustedPlanarStep ? <><strong className="text-emerald-300">STEP лист:</strong> плоская листовая геометрия подтверждена. BRep-толщина {detectedStepThickness ? `${fmt(detectedStepThickness)} мм` : "требует проверки"}; выбранная толщина должна совпадать с CAD.{flatPreview ? " Доступна отдельная 2D-вкладка BRep-контура." : ""}</> : <><strong className="text-steel-orange">STEP 3D:</strong> BRep-анализ выполнен{detectedStepThickness ? `; кандидат толщины ${fmt(detectedStepThickness)} мм` : ""}{bendCandidateCount ? `; кандидатов зон гиба ${bendCandidateCount}` : ""}. До подтверждённой развёртки цена не рассчитывается автоматически.</>}
                </div>}
                <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Материал</label><div className="mt-2 grid grid-cols-3 gap-1">{MATERIAL_OPTIONS.map((option) => <button key={option.id} onClick={() => updateMaterial(option.id)} className={`border px-2 py-3 text-left transition ${materialId === option.id ? "border-steel-orange/50 bg-steel-orange/[.075]" : "border-white/10 bg-[#0b0e10] hover:border-white/20"}`}><span className="block text-[11px] font-semibold">{option.label}</span><span className="mt-1 block text-[8px] leading-tight text-white/30">{option.note}</span></button>)}</div></div>
                <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Толщина, мм</label><select value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none focus:border-steel-orange">{thicknessOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
                <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Количество</label><div className="mt-2 grid grid-cols-[44px_1fr_44px] border border-white/12 bg-[#090c0e]"><button onClick={() => updateQuantity(quantity - 1)} className="border-r border-white/10 text-white/50 hover:text-steel-orange">−</button><input value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} className="bg-transparent px-3 py-3 text-center text-sm outline-none" /><button onClick={() => updateQuantity(quantity + 1)} className="border-l border-white/10 text-white/50 hover:text-steel-orange">+</button></div>{provisionalPrice && <p className="mt-2 text-[10px] text-white/32">Лазер: {fmt(provisionalPrice.laserRubPerM, 1)} ₽/м · материал партии {fmt(provisionalPrice.batchPurchasedMassKg, 1)} кг</p>}</div>
                <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Операции</p><div className="mt-2 grid gap-2"><div className="flex items-center justify-between border border-steel-orange/35 bg-steel-orange/[.05] px-4 py-3 text-sm"><span>Лазерная резка</span><span className="text-[9px] font-bold uppercase tracking-[.1em] text-steel-orange">base</span></div>{OPERATION_OPTIONS.map((option) => { const enabled = activePart.configuration.operations.includes(option.id); return <button key={option.id} onClick={() => toggleOperation(option.id)} className={`flex items-center justify-between border px-4 py-3 text-left text-sm transition ${enabled ? "border-steel-orange/45 bg-steel-orange/[.07]" : "border-white/10 bg-[#0b0e10] hover:border-white/20"}`}><span>{option.label}</span><span className={`flex h-5 w-5 items-center justify-center border text-[10px] ${enabled ? "border-steel-orange bg-steel-orange text-black" : "border-white/15 text-transparent"}`}>✓</span></button>; })}</div></div>
              </div>

              <div className="border-t border-white/10 p-5">
                <div className="relative overflow-hidden border border-steel-orange/30 bg-steel-orange/[.045] p-4">
                  <motion.span className="absolute bottom-0 left-0 h-px bg-steel-orange" animate={{ width: provisionalPrice ? ["28%", "100%", "28%"] : ["10%", "52%", "10%"] }} transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }} />
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Preliminary pricing</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-white/30">не оферта · закрытая alpha</p></div>{selectedPrice && <span className={`border px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] ${selectedPrice.stale ? "border-amber-400/25 text-amber-300" : "border-emerald-400/25 text-emerald-300"}`}>{selectedPrice.stale ? "прайс устарел" : "прайс актуален"}</span>}</div>

                  {provisionalPrice ? <>
                    <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold">{money(provisionalPrice.totalRub)}</p><p className="mt-1 text-xs text-white/45">{money(provisionalPrice.unitRub)} / шт.</p></div><span className="text-xs text-white/30">× {quantity}</span></div>
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[10px] text-white/45"><div className="flex justify-between gap-3"><span>Металл +5%</span><strong className="text-white/75">{money(provisionalPrice.materialRubEach)} / шт.</strong></div><div className="flex justify-between gap-3"><span>Лазер по контуру</span><strong className="text-white/75">{money(provisionalPrice.laserRubEach)} / шт.</strong></div><div className="flex justify-between gap-3"><span>Операции</span><strong className="text-white/75">{money(provisionalPrice.operationsRubEach)} / шт.</strong></div><div className="flex justify-between gap-3"><span>Подготовка позиции</span><strong className="text-white/75">{money(provisionalPrice.setupRubEach)} / шт.</strong></div></div>
                    <div className="mt-4 grid grid-cols-3 gap-px bg-white/10 text-center"><div className="bg-[#0b0e10] p-2"><p className="text-[8px] uppercase tracking-[.08em] text-white/25">чистая площадь</p><p className="mt-1 text-[10px] font-semibold">{fmt(provisionalPrice.netAreaMm2 / 1_000_000, 3)} м²</p></div><div className="bg-[#0b0e10] p-2"><p className="text-[8px] uppercase tracking-[.08em] text-white/25">заготовка</p><p className="mt-1 text-[10px] font-semibold">{fmt(provisionalPrice.blankAreaMm2 / 1_000_000, 3)} м²</p></div><div className="bg-[#0b0e10] p-2"><p className="text-[8px] uppercase tracking-[.08em] text-white/25">обрезь</p><p className="mt-1 text-[10px] font-semibold">{provisionalPrice.blankWastePct == null ? "—" : `${fmt(provisionalPrice.blankWastePct, 1)}%`}</p></div></div>
                    {selectedPrice?.price && <div className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/32">Металл: {fmt(provisionalPrice.materialMarketRubPerTon)} ₽/т ({provisionalPrice.materialMarketTier === "from-3t" ? "от 3 т" : "до 3 т"}) → {fmt(provisionalPrice.materialPricedRubPerTon)} ₽/т с +5%. Источник: {selectedPrice.price.source}, прайс {selectedPrice.price.sourceDate}.</div>}
                  </> : <div className="mt-4"><p className="text-xl font-semibold">{isStep && !isTrustedPlanarStep ? "3D готово — цена после развёртки" : "Цена пока не рассчитана"}</p><p className="mt-2 text-[10px] leading-relaxed text-white/36">{activePricing?.blockingReasons.concat(activePricing?.reviewReasons ?? []).join(" ") || "Нужны нормализованная геометрия, цена металла и отсутствие блокирующей DFM-ошибки."}</p></div>}
                </div>
                <button disabled={!provisionalPrice || selectedPrice?.stale || blocking} className="mt-3 w-full bg-steel-orange px-4 py-4 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30">{isStep && !isTrustedPlanarStep ? "Нужна развёртка STEP" : blocking ? "Исправьте DFM-ошибки" : selectedPrice?.stale ? "Нужен свежий прайс металла" : manual ? "Отправить на проверку" : "Продолжить к заказу"}</button>
              </div>
            </> : <div className="p-5 text-sm leading-relaxed text-white/35">Добавьте CAD-файл, чтобы открыть конфигуратор детали.</div>}
          </aside>
        </div>
      </section>

      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" />
    </main>
  );
}
