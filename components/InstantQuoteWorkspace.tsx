"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { runVerifiedLaserDfm, type DfmResult } from "@/lib/instant-quote/dfm";
import { arcPoints, parseAsciiDxf, type ParsedDxf } from "@/lib/instant-quote/dxf";
import { createEmptyProject, type ManufacturingOperation } from "@/lib/instant-quote/domain";
import { selectBestStoredPrice } from "@/lib/instant-quote/material-price-feed";
import {
  calculateProvisionalPartPrice,
  type MaterialId,
} from "@/lib/instant-quote/pricing";
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
  { id: "zinc", label: "Оцинковка", note: "требует отдельной DFM-базы" },
];

const OPERATION_OPTIONS: Array<{ id: ManufacturingOperation; label: string }> = [
  { id: "bending", label: "Гибка" },
  { id: "welding", label: "Сварка" },
  { id: "assembly", label: "Сборка" },
  { id: "powder-coating", label: "Порошковая окраска" },
  { id: "packaging", label: "Упаковка" },
];

function fmt(n: number, maximumFractionDigits = Math.abs(n) < 1000 ? 2 : 0) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits });
}

function money(n: number) {
  return `${Math.ceil(n).toLocaleString("ru-RU")} ₽`;
}

function severityTone(severity: DfmResult["severity"]) {
  if (severity === "pass") return "border-emerald-400/25 bg-emerald-400/5 text-emerald-300";
  if (severity === "error") return "border-red-400/30 bg-red-400/5 text-red-300";
  if (severity === "warning") return "border-amber-400/30 bg-amber-400/5 text-amber-300";
  return "border-white/12 bg-white/[.025] text-white/65";
}

function materialIdOf(value: string | null): MaterialId {
  if (value === "hot" || value === "cold" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return "hot";
}

function DxfGeometry({ parsed, animated = false }: { parsed: ParsedDxf; animated?: boolean }) {
  const pad = Math.max(parsed.width, parsed.height, 10) * 0.09;
  const bounds = {
    x: parsed.minX - pad,
    y: parsed.minY - pad,
    w: Math.max(parsed.width + pad * 2, 1),
    h: Math.max(parsed.height + pad * 2, 1),
  };
  const y = (value: number) => parsed.minY + parsed.maxY - value;
  const common = {
    fill: "none",
    stroke: "#f58220",
    strokeWidth: Math.max(bounds.w, bounds.h) / 720,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <svg className="h-full w-full" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet">
      {parsed.shapes.map((shape, index) => {
        if (shape.kind === "line") {
          return animated ? (
            <motion.line
              key={index}
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: Math.min(index * 0.012, 0.45) }}
              x1={shape.a.x}
              y1={y(shape.a.y)}
              x2={shape.b.x}
              y2={y(shape.b.y)}
              {...common}
            />
          ) : <line key={index} x1={shape.a.x} y1={y(shape.a.y)} x2={shape.b.x} y2={y(shape.b.y)} {...common} />;
        }
        if (shape.kind === "polyline") {
          const points = [...shape.points, ...(shape.closed ? [shape.points[0]] : [])]
            .map((point) => `${point.x},${y(point.y)}`)
            .join(" ");
          return <polyline key={index} points={points} {...common} />;
        }
        if (shape.kind === "circle") {
          return <circle key={index} cx={shape.c.x} cy={y(shape.c.y)} r={shape.r} {...common} />;
        }
        return <polyline key={index} points={arcPoints(shape).map((point) => `${point.x},${y(point.y)}`).join(" ")} {...common} />;
      })}
    </svg>
  );
}

export function InstantQuoteWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState(() => createEmptyProject());
  const [parsedByPartId, setParsedByPartId] = useState<Record<string, ParsedDxf>>({});
  const [messageByPartId, setMessageByPartId] = useState<Record<string, string>>({});
  const [analyzingByPartId, setAnalyzingByPartId] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"model" | "dfm">("model");

  const activePart = useMemo(
    () => project.parts.find((part) => part.id === project.activePartId) ?? null,
    [project],
  );
  const parsed = activePart ? parsedByPartId[activePart.id] ?? null : null;
  const materialId = materialIdOf(activePart?.configuration.materialId ?? null);
  const thickness = activePart?.configuration.thicknessMm ?? 1;
  const quantity = activePart?.configuration.quantity ?? 1;
  const isAnalyzing = activePart ? Boolean(analyzingByPartId[activePart.id]) : false;
  const message = activePart ? messageByPartId[activePart.id] ?? null : null;

  const dfm = useMemo(() => {
    if (!parsed) return [];
    const results = runVerifiedLaserDfm(parsed, thickness);
    if (materialId === "zinc") {
      results.push({
        code: "zinc-capability-review",
        title: "Оцинкованная сталь — отдельная технологическая проверка",
        detail: "Автоматический диапазон толщин для оцинкованного листа пока не утверждён в технологической базе. Габарит и единицы проверены, совместимость материала подтверждает технолог.",
        severity: "manual",
      });
    }
    if (parsed.unsupportedEntities.length) {
      results.push({
        code: "unsupported-dxf-entities",
        title: "В DXF есть геометрия, требующая расширенного парсера",
        detail: `Обнаружено: ${parsed.unsupportedEntities.join(", ")}. Предварительный контур показан, но автоматический заказ требует проверки.` ,
        severity: "manual",
      });
    }
    return results;
  }, [materialId, parsed, thickness]);

  const blocking = dfm.some((item) => item.severity === "error");
  const manual = dfm.some((item) => item.severity === "manual" || item.severity === "warning");

  const selectedPrice = useMemo(() => {
    if (!activePart) return null;
    return selectBestStoredPrice(
      FALLBACK_METAL_PRICE_SNAPSHOTS,
      materialId,
      thickness,
    );
  }, [activePart, materialId, thickness]);

  const provisionalPrice = useMemo(() => {
    if (!activePart?.geometry || !parsed || parsed.units !== "мм" || blocking || !selectedPrice?.price) return null;
    return calculateProvisionalPartPrice({
      materialId,
      thicknessMm: thickness,
      quantity,
      geometry: activePart.geometry,
      marketPrice: selectedPrice.price,
      operations: activePart.configuration.operations,
      materialUsageFactor: 1.15,
    });
  }, [activePart, blocking, materialId, parsed, quantity, selectedPrice, thickness]);

  const projectTotal = useMemo(() => {
    return project.parts.reduce((sum, part) => {
      if (part.id === activePart?.id && provisionalPrice) return sum + provisionalPrice.totalRub;
      if (part.quote.kind === "calculated") return sum + part.quote.totalRub;
      return sum;
    }, 0);
  }, [activePart?.id, project.parts, provisionalPrice]);

  const ingestFiles = async (files: File[]) => {
    if (!files.length) return;
    let nextProject = project;
    const jobs: Array<{ file: File; partId: string }> = [];

    files.forEach((file, index) => {
      const now = new Date(Date.now() + index);
      try {
        nextProject = addPartToProject(nextProject, { fileName: file.name, fileSizeBytes: file.size }, now);
        if (nextProject.activePartId) jobs.push({ file, partId: nextProject.activePartId });
      } catch {
        // unsupported files are skipped; the input accept list already prevents the common case
      }
    });

    setProject(nextProject);
    setTab("model");

    await Promise.all(jobs.map(async ({ file, partId }) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "dxf") {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setMessageByPartId((current) => ({
          ...current,
          [partId]: "Файл добавлен в проект. STEP/STP и DWG будут обрабатываться authoritative CAD-модулем; в текущей Alpha полностью разбирается DXF.",
        }));
        return;
      }

      setAnalyzingByPartId((current) => ({ ...current, [partId]: true }));
      setMessageByPartId((current) => ({ ...current, [partId]: "" }));
      try {
        const result = parseAsciiDxf(await file.text());
        setParsedByPartId((current) => ({ ...current, [partId]: result }));
        setProject((current) => {
          const withGeometry = updatePartGeometry(current, partId, {
            widthMm: result.width,
            heightMm: result.height,
            cutLengthMm: result.cutLength,
            contourCount: result.contours,
          });
          return setPartState(withGeometry, partId, "configurable");
        });
      } catch (error) {
        setProject((current) => setPartState(current, partId, "manual-review"));
        setMessageByPartId((current) => ({
          ...current,
          [partId]: error instanceof Error ? error.message : "Не удалось разобрать DXF.",
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

  const updateQuantity = (next: number) => {
    if (!activePart) return;
    setProject((current) => setPartQuantity(current, activePart.id, next));
  };

  const updateMaterial = (next: MaterialId) => {
    if (!activePart) return;
    setProject((current) => setPartMaterial(current, activePart.id, next));
  };

  const updateThickness = (next: number) => {
    if (!activePart) return;
    setProject((current) => setPartThickness(current, activePart.id, next));
  };

  const toggleOperation = (operation: ManufacturingOperation) => {
    if (!activePart) return;
    const enabled = !activePart.configuration.operations.includes(operation);
    setProject((current) => togglePartOperation(current, activePart.id, operation, enabled));
  };

  const removeActivePart = () => {
    if (!activePart) return;
    const id = activePart.id;
    setProject((current) => removePartFromProject(current, id));
    setParsedByPartId((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setMessageByPartId((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const stages = [
    ["01", "CAD", project.parts.length > 0],
    ["02", "Геометрия", Boolean(parsed)],
    ["03", "DFM", Boolean(parsed && !blocking)],
    ["04", "Конфигурация", Boolean(activePart?.configuration.materialId && activePart.configuration.thicknessMm)],
    ["05", "Цена", Boolean(provisionalPrice)],
  ] as const;

  return (
    <main className="min-h-screen overflow-hidden bg-[#090c0e] text-white">
      <section className="relative border-b border-white/10 bg-[#101416]">
        <div className="pointer-events-none absolute inset-0 opacity-[.18]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
        <div className="container relative py-7 sm:py-9">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-steel-orange"><span className="h-px w-8 bg-steel-orange" /> Steel Product Online</div>
              <h1 className="mt-4 max-w-5xl text-3xl font-semibold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">CAD → проверка → цена → производство</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55 sm:text-base">Закрытая Alpha: несколько деталей в проекте, DXF-геометрия, DFM и предварительный производственный расчёт на одной рабочей поверхности.</p>
            </div>
            <div className="grid grid-cols-5 gap-px overflow-hidden border border-white/10 bg-white/10">
              {stages.map(([number, label, done]) => (
                <div key={number} className={`min-w-[74px] bg-[#111518] px-3 py-3 ${done ? "text-white" : "text-white/35"}`}>
                  <div className={`text-[10px] font-bold tracking-[.16em] ${done ? "text-steel-orange" : "text-white/25"}`}>{number}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[.1em]">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5 lg:py-7">
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_380px]">
          <aside className="order-2 border border-white/10 bg-[#101416] xl:order-1">
            <div className="border-b border-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Проект</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <strong className="truncate text-sm">{project.title}</strong>
                <span className="whitespace-nowrap text-[10px] text-white/30">{project.parts.length} поз.</span>
              </div>
              {projectTotal > 0 && <p className="mt-3 text-xs text-white/45">В расчёте: <strong className="text-white">{money(projectTotal)}</strong></p>}
            </div>

            <div className="max-h-[610px] overflow-y-auto">
              {project.parts.map((part, index) => {
                const itemParsed = parsedByPartId[part.id];
                const active = part.id === activePart?.id;
                return (
                  <button
                    key={part.id}
                    onClick={() => { setProject((current) => setActivePart(current, part.id)); setTab("model"); }}
                    className={`block w-full border-b p-3 text-left transition ${active ? "border-steel-orange/35 bg-steel-orange/[.055]" : "border-white/10 hover:bg-white/[.03]"}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#090c0e] p-2">
                        {itemParsed ? <DxfGeometry parsed={itemParsed} /> : <span className="text-[10px] font-bold uppercase tracking-[.12em] text-white/25">{part.format}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-[.14em] text-steel-orange">#{String(index + 1).padStart(2, "0")}</p>
                        <p className="mt-1 truncate text-xs font-semibold">{part.fileName}</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[.1em] text-white/32">{part.state.replaceAll("-", " ")} · ×{part.configuration.quantity}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button onClick={() => inputRef.current?.click()} className="m-4 w-[calc(100%-2rem)] border border-white/12 px-3 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-white/55 transition hover:border-steel-orange hover:text-white">+ Добавить позиции</button>
          </aside>

          <div className="order-1 min-w-0 overflow-hidden border border-white/10 bg-[#101416] xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex gap-1">
                {(["model", "dfm"] as const).map((item) => (
                  <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${tab === item ? "bg-steel-orange text-black" : "text-white/45 hover:text-white"}`}>
                    {item === "model" ? "Модель" : `DFM ${dfm.length ? `· ${dfm.length}` : ""}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[.12em] text-white/35">
                {activePart && <span className="max-w-[220px] truncate">{activePart.fileName}</span>}
                {activePart && <button onClick={removeActivePart} className="font-bold text-white/45 hover:text-red-300">Удалить</button>}
              </div>
            </div>

            <div className="relative min-h-[650px] overflow-hidden bg-[#080b0d]">
              <div className="pointer-events-none absolute inset-0 opacity-[.16]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
              <AnimatePresence mode="wait">
                {!activePart ? (
                  <motion.div key="drop" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 bg-black/15 p-8 text-center sm:inset-8" onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}>
                    <motion.div animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }} className="relative flex h-20 w-20 items-center justify-center border border-steel-orange/55 text-4xl font-light text-steel-orange">+<span className="absolute -bottom-px -right-px h-5 w-5 border-l border-t border-steel-orange" /></motion.div>
                    <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Перетащите CAD-файлы</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">Можно загрузить сразу несколько деталей. DXF разбирается локально; STEP/STP и DWG уже входят в проектную модель и ждут следующего CAD-движка.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/35">{["DXF", "STEP", "STP", "DWG"].map((ext) => <span key={ext} className="border border-white/10 px-3 py-2">{ext}</span>)}</div>
                  </motion.div>
                ) : isAnalyzing ? (
                  <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full max-w-md px-8 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">Geometry engine</p>
                      <h2 className="mt-4 text-2xl font-semibold">Разбираем геометрию</h2>
                      <div className="relative mt-7 h-px overflow-hidden bg-white/10"><motion.span className="absolute inset-y-0 w-1/3 bg-steel-orange" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }} /></div>
                      <p className="mt-4 text-xs text-white/35">Контуры · габариты · длина реза · единицы · unsupported entities</p>
                    </div>
                  </motion.div>
                ) : message && !parsed ? (
                  <motion.div key="message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center">
                    <div className="max-w-xl border border-white/10 bg-[#101416] p-7">
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">CAD intake</p>
                      <h2 className="mt-3 text-xl font-semibold">Позиция сохранена в проекте</h2>
                      <p className="mt-4 text-sm leading-relaxed text-white/50">{message}</p>
                    </div>
                  </motion.div>
                ) : tab === "model" && parsed ? (
                  <motion.div key={`model-${activePart.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-5 sm:p-8">
                    <DxfGeometry parsed={parsed} animated />
                    <motion.div className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-steel-orange/65 to-transparent" animate={{ top: ["12%", "88%", "12%"] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} />
                    <div className="absolute left-5 top-5 flex gap-2">
                      <span className="border border-white/10 bg-black/55 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/45">2D Geometry · live</span>
                      {parsed.unsupportedEntities.length > 0 && <span className="border border-amber-400/25 bg-black/55 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-amber-300">review</span>}
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-4">
                      {[["X", `${fmt(parsed.width)} ${parsed.units}`], ["Y", `${fmt(parsed.height)} ${parsed.units}`], ["Рез", `${fmt(parsed.cutLength)} ${parsed.units}`], ["Объекты", String(parsed.contours)]].map(([label, value]) => (
                        <div key={label} className="bg-[#101416]/95 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/28">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
                      ))}
                    </div>
                  </motion.div>
                ) : parsed ? (
                  <motion.div key={`dfm-${activePart.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="relative p-5 sm:p-8">
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Design for manufacturability</p><h2 className="mt-2 text-2xl font-semibold">Автоматическая проверка</h2></div>
                      <span className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] ${blocking ? "border-red-400/30 text-red-300" : manual ? "border-amber-400/25 text-amber-300" : "border-emerald-400/25 text-emerald-300"}`}>{blocking ? "Есть блокировка" : manual ? "Нужна проверка" : "Проверка пройдена"}</span>
                    </div>
                    <div className="grid gap-3">
                      {dfm.map((item, index) => (
                        <motion.article key={item.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className={`border p-4 ${severityTone(item.severity)}`}>
                          <div className="flex gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[9px] font-bold">{item.severity === "pass" ? "✓" : item.severity === "error" ? "!" : "?"}</span><div><h3 className="text-sm font-semibold text-white">{item.title}</h3><p className="mt-2 text-xs leading-relaxed opacity-75">{item.detail}</p></div></div>
                        </motion.article>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <aside className="order-3 border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Конфигуратор</p>
              <h2 className="mt-2 text-xl font-semibold">Маршрут изготовления</h2>
              <p className="mt-2 text-xs leading-relaxed text-white/38">Изменения пересчитывают предварительную цену сразу. Неподтверждённые параметры остаются на review технолога.</p>
            </div>

            {activePart ? (
              <>
                <div className="space-y-5 p-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Материал</label>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {MATERIAL_OPTIONS.map((option) => (
                        <button key={option.id} onClick={() => updateMaterial(option.id)} className={`border px-2 py-3 text-left transition ${materialId === option.id ? "border-steel-orange/50 bg-steel-orange/[.075]" : "border-white/10 bg-[#0b0e10] hover:border-white/20"}`}>
                          <span className="block text-[11px] font-semibold">{option.label}</span><span className="mt-1 block text-[8px] leading-tight text-white/30">{option.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Толщина, мм</label>
                    <select value={thickness} onChange={(event) => updateThickness(Number(event.target.value))} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none focus:border-steel-orange">
                      {thicknessOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Количество</label>
                    <div className="mt-2 grid grid-cols-[44px_1fr_44px] border border-white/12 bg-[#090c0e]">
                      <button onClick={() => updateQuantity(quantity - 1)} className="border-r border-white/10 text-white/50 hover:text-steel-orange">−</button>
                      <input value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} type="number" min={1} className="bg-transparent px-3 py-3 text-center text-sm outline-none" />
                      <button onClick={() => updateQuantity(quantity + 1)} className="border-l border-white/10 text-white/50 hover:text-steel-orange">+</button>
                    </div>
                    {provisionalPrice && <p className="mt-2 text-[10px] text-white/32">Тариф лазера сейчас: {fmt(provisionalPrice.laserRubPerM, 1)} ₽/м по общему метражу партии.</p>}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Операции</p>
                    <div className="mt-2 grid gap-2">
                      {OPERATION_OPTIONS.map((option) => {
                        const enabled = activePart.configuration.operations.includes(option.id);
                        return (
                          <button key={option.id} onClick={() => toggleOperation(option.id)} className={`flex items-center justify-between border px-4 py-3 text-left text-sm transition ${enabled ? "border-steel-orange/45 bg-steel-orange/[.07]" : "border-white/10 bg-[#0b0e10] hover:border-white/20"}`}>
                            <span>{option.label}</span><span className={`flex h-5 w-5 items-center justify-center border text-[10px] ${enabled ? "border-steel-orange bg-steel-orange text-black" : "border-white/15 text-transparent"}`}>✓</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 p-5">
                  <div className="relative overflow-hidden border border-steel-orange/30 bg-steel-orange/[.045] p-4">
                    <motion.span className="absolute bottom-0 left-0 h-px bg-steel-orange" animate={{ width: provisionalPrice ? ["28%", "100%", "28%"] : ["10%", "52%", "10%"] }} transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }} />
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Preliminary pricing</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-white/30">не оферта · закрытая alpha</p></div>
                      {selectedPrice && <span className={`border px-2 py-1 text-[8px] font-bold uppercase tracking-[.1em] ${selectedPrice.stale ? "border-amber-400/25 text-amber-300" : "border-emerald-400/25 text-emerald-300"}`}>{selectedPrice.stale ? "price stale" : "price live"}</span>}
                    </div>

                    {provisionalPrice ? (
                      <>
                        <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold">{money(provisionalPrice.totalRub)}</p><p className="mt-1 text-xs text-white/45">{money(provisionalPrice.unitRub)} / шт.</p></div><span className="text-xs text-white/30">× {quantity}</span></div>
                        <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[10px] text-white/45">
                          <div className="flex justify-between gap-3"><span>Металл +5%</span><strong className="text-white/75">{money(provisionalPrice.materialRubEach)} / шт.</strong></div>
                          <div className="flex justify-between gap-3"><span>Лазер</span><strong className="text-white/75">{money(provisionalPrice.laserRubEach)} / шт.</strong></div>
                          <div className="flex justify-between gap-3"><span>Операции</span><strong className="text-white/75">{money(provisionalPrice.operationsRubEach)} / шт.</strong></div>
                          <div className="flex justify-between gap-3"><span>Подготовка позиции</span><strong className="text-white/75">{money(provisionalPrice.setupRubEach)} / шт.</strong></div>
                        </div>
                        {selectedPrice?.price && <div className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-white/32">Металл: {fmt(selectedPrice.price.rubPerTon)} ₽/т → {fmt(provisionalPrice.materialPricedRubPerTon)} ₽/т с +5%. Источник: {selectedPrice.price.source}, {selectedPrice.price.sourceDate}.</div>}
                        {provisionalPrice.warnings.length > 0 && <div className="mt-3 border border-amber-400/20 bg-amber-400/[.04] p-3 text-[9px] leading-relaxed text-amber-200/75">{provisionalPrice.warnings.join(" ")}</div>}
                      </>
                    ) : (
                      <div className="mt-4"><p className="text-xl font-semibold">Цена пока не рассчитана</p><p className="mt-2 text-[10px] leading-relaxed text-white/32">Нужны DXF в миллиметрах, цена металла и отсутствие блокирующей DFM-ошибки.</p></div>
                    )}
                  </div>

                  <button disabled={!provisionalPrice || selectedPrice?.stale || blocking} className="mt-3 w-full bg-steel-orange px-4 py-4 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30">
                    {blocking ? "Исправьте DFM-ошибки" : selectedPrice?.stale ? "Нужен свежий прайс металла" : "Продолжить к заказу"}
                  </button>
                  {manual && !blocking && <p className="mt-3 text-[10px] leading-relaxed text-white/32">Часть правил требует review технолога. Предварительная цена может отображаться, но автоматический запуск производства будет заблокирован до подтверждения.</p>}
                </div>
              </>
            ) : (
              <div className="p-5 text-sm leading-relaxed text-white/35">Добавьте CAD-файл, чтобы открыть конфигуратор детали.</div>
            )}
          </aside>
        </div>
      </section>

      <input ref={inputRef} type="file" accept={accepted} multiple onChange={onChange} className="hidden" />
    </main>
  );
}
