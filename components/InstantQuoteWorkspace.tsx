"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChangeEvent, DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { runVerifiedLaserDfm, type DfmResult } from "@/lib/instant-quote/dfm";

type Point = { x: number; y: number };
type Shape =
  | { kind: "line"; a: Point; b: Point }
  | { kind: "polyline"; points: Point[]; closed: boolean }
  | { kind: "circle"; c: Point; r: number }
  | { kind: "arc"; c: Point; r: number; start: number; end: number };

type ParsedDxf = {
  shapes: Shape[];
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cutLength: number;
  contours: number;
  units: string;
};

const accepted = ".dxf,.dwg,.step,.stp";
const thicknessOptions = ["0.5", "0.7", "0.8", "1.0", "1.2", "1.5", "2.0", "3.0", "4.0", "5.0", "6.0", "8.0", "10.0", "12.0", "16.0", "20.0", "25.0", "30.0", "40.0"];

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalizeArc(start: number, end: number) {
  let delta = end - start;
  while (delta < 0) delta += 360;
  while (delta >= 360) delta -= 360;
  return delta;
}

function parsePairs(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: Array<[number, string]> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (Number.isFinite(code)) pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

function detectUnits(pairs: Array<[number, string]>) {
  const labels: Record<string, string> = { "1": "дюймы", "2": "футы", "4": "мм", "5": "см", "6": "м" };
  for (let i = 0; i < pairs.length - 2; i++) {
    if (pairs[i][0] === 9 && pairs[i][1] === "$INSUNITS") {
      for (let j = i + 1; j < Math.min(i + 6, pairs.length); j++) {
        if (pairs[j][0] === 70) return labels[pairs[j][1]] ?? `код ${pairs[j][1]}`;
      }
    }
  }
  return "не указаны";
}

function parseDxf(text: string): ParsedDxf {
  const pairs = parsePairs(text);
  const units = detectUnits(pairs);
  const shapes: Shape[] = [];
  let inEntities = false;

  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") {
      const next = pairs[i + 1];
      if (next?.[0] === 2 && next[1] === "ENTITIES") inEntities = true;
      continue;
    }
    if (inEntities && code === 0 && value === "ENDSEC") {
      inEntities = false;
      continue;
    }
    if (!inEntities || code !== 0) continue;

    const fields: Array<[number, string]> = [];
    let j = i + 1;
    while (j < pairs.length && pairs[j][0] !== 0) {
      fields.push(pairs[j]);
      j++;
    }
    i = j - 1;

    const first = (c: number) => fields.find(([fieldCode]) => fieldCode === c)?.[1];
    const num = (c: number) => {
      const raw = first(c);
      if (raw == null) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    if (value === "LINE") {
      const x1 = num(10), y1 = num(20), x2 = num(11), y2 = num(21);
      if ([x1, y1, x2, y2].every((n) => typeof n === "number")) shapes.push({ kind: "line", a: { x: x1!, y: y1! }, b: { x: x2!, y: y2! } });
    }
    if (value === "CIRCLE") {
      const x = num(10), y0 = num(20), r = num(40);
      if ([x, y0, r].every((n) => typeof n === "number") && r! > 0) shapes.push({ kind: "circle", c: { x: x!, y: y0! }, r: r! });
    }
    if (value === "ARC") {
      const x = num(10), y0 = num(20), r = num(40), start = num(50), end = num(51);
      if ([x, y0, r, start, end].every((n) => typeof n === "number") && r! > 0) shapes.push({ kind: "arc", c: { x: x!, y: y0! }, r: r!, start: start!, end: end! });
    }
    if (value === "LWPOLYLINE") {
      const points: Point[] = [];
      let currentX: number | undefined;
      for (const [fieldCode, fieldValue] of fields) {
        if (fieldCode === 10) currentX = Number(fieldValue);
        if (fieldCode === 20 && currentX != null) {
          const y0 = Number(fieldValue);
          if (Number.isFinite(currentX) && Number.isFinite(y0)) points.push({ x: currentX, y: y0 });
          currentX = undefined;
        }
      }
      const flags = Number(first(70) ?? "0");
      if (points.length >= 2) shapes.push({ kind: "polyline", points, closed: (flags & 1) === 1 });
    }
  }

  if (!shapes.length) throw new Error("В DXF не найдены поддерживаемые 2D-объекты LINE, LWPOLYLINE, CIRCLE или ARC.");

  const pointsForBounds: Point[] = [];
  let cutLength = 0;
  let contours = 0;
  for (const shape of shapes) {
    if (shape.kind === "line") {
      pointsForBounds.push(shape.a, shape.b);
      cutLength += distance(shape.a, shape.b);
    } else if (shape.kind === "polyline") {
      pointsForBounds.push(...shape.points);
      for (let i = 1; i < shape.points.length; i++) cutLength += distance(shape.points[i - 1], shape.points[i]);
      if (shape.closed) cutLength += distance(shape.points.at(-1)!, shape.points[0]);
    } else if (shape.kind === "circle") {
      pointsForBounds.push({ x: shape.c.x - shape.r, y: shape.c.y - shape.r }, { x: shape.c.x + shape.r, y: shape.c.y + shape.r });
      cutLength += Math.PI * shape.r * 2;
    } else {
      pointsForBounds.push({ x: shape.c.x - shape.r, y: shape.c.y - shape.r }, { x: shape.c.x + shape.r, y: shape.c.y + shape.r });
      cutLength += 2 * Math.PI * shape.r * (normalizeArc(shape.start, shape.end) / 360);
    }
    contours++;
  }

  const xs = pointsForBounds.map((p) => p.x);
  const ys = pointsForBounds.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { shapes, width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY, cutLength, contours, units };
}

function arcPoints(shape: Extract<Shape, { kind: "arc" }>) {
  const delta = normalizeArc(shape.start, shape.end);
  const steps = Math.max(8, Math.ceil(delta / 8));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((shape.start + (delta * i) / steps) * Math.PI) / 180;
    return { x: shape.c.x + Math.cos(a) * shape.r, y: shape.c.y + Math.sin(a) * shape.r };
  });
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: Math.abs(n) < 1000 ? 2 : 0 });
}

function severityTone(severity: DfmResult["severity"]) {
  if (severity === "pass") return "border-emerald-400/25 bg-emerald-400/5 text-emerald-300";
  if (severity === "error") return "border-red-400/30 bg-red-400/5 text-red-300";
  if (severity === "warning") return "border-amber-400/30 bg-amber-400/5 text-amber-300";
  return "border-white/12 bg-white/[.025] text-white/65";
}

export function InstantQuoteWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedDxf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [material] = useState("Чёрная сталь");
  const [thickness, setThickness] = useState("1.0");
  const [qty, setQty] = useState(1);
  const [operations, setOperations] = useState({ bend: false, weld: false, paint: false, assembly: false });
  const [tab, setTab] = useState<"model" | "dfm">("model");

  const bounds = useMemo(() => {
    if (!parsed) return null;
    const pad = Math.max(parsed.width, parsed.height, 10) * 0.09;
    return { x: parsed.minX - pad, y: parsed.minY - pad, w: Math.max(parsed.width + pad * 2, 1), h: Math.max(parsed.height + pad * 2, 1) };
  }, [parsed]);

  const dfm = useMemo(() => parsed ? runVerifiedLaserDfm(parsed, Number(thickness)) : [], [parsed, thickness]);
  const blocking = dfm.some((item) => item.severity === "error");
  const manual = dfm.some((item) => item.severity === "manual");
  const y = (v: number) => parsed ? parsed.minY + parsed.maxY - v : v;

  const load = async (next: File) => {
    setFile(next);
    setParsed(null);
    setError(null);
    setTab("model");
    const ext = next.name.split(".").pop()?.toLowerCase();
    if (ext !== "dxf") {
      setError("Файл сохранён в рабочем сценарии, но authoritative-разбор STEP/STP и DWG ещё не подключён. Сейчас полностью работает первый формат — DXF.");
      return;
    }

    try {
      setIsAnalyzing(true);
      await new Promise((resolve) => setTimeout(resolve, 650));
      const result = parseDxf(await next.text());
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось разобрать DXF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0];
    if (next) void load(next);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const next = e.dataTransfer.files?.[0];
    if (next) void load(next);
  };

  const stages = [
    ["01", "CAD", Boolean(file)],
    ["02", "Геометрия", Boolean(parsed)],
    ["03", "DFM", Boolean(parsed && !blocking)],
    ["04", "Конфигурация", Boolean(parsed)],
    ["05", "Цена", false],
  ] as const;

  return (
    <main className="min-h-screen overflow-hidden bg-[#090c0e] text-white">
      <section className="relative border-b border-white/10 bg-[#101416]">
        <div className="pointer-events-none absolute inset-0 opacity-[.18]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
        <div className="container relative py-7 sm:py-9">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-steel-orange"><span className="h-px w-8 bg-steel-orange" /> Steel Product Online</div>
              <h1 className="mt-4 max-w-5xl text-3xl font-semibold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">CAD → проверка → производство</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55 sm:text-base">Цифровое рабочее пространство заказа деталей: загрузка CAD, разбор геометрии, проверка технологичности и настройка производственного маршрута.</p>
            </div>
            <div className="grid grid-cols-5 gap-px overflow-hidden border border-white/10 bg-white/10">
              {stages.map(([n, label, done]) => <div key={n} className={`min-w-[74px] bg-[#111518] px-3 py-3 ${done ? "text-white" : "text-white/35"}`}><div className={`text-[10px] font-bold tracking-[.16em] ${done ? "text-steel-orange" : "text-white/25"}`}>{n}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.1em]">{label}</div></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5 lg:py-7">
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
          <aside className="order-2 border border-white/10 bg-[#101416] xl:order-1">
            <div className="border-b border-white/10 p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/35">Проект</p><div className="mt-2 flex items-center justify-between"><strong className="text-sm">Новый заказ</strong><span className="text-[10px] text-white/30">1 позиция</span></div></div>
            <button onClick={() => inputRef.current?.click()} className="group block w-full border-b border-white/10 p-4 text-left transition hover:bg-white/[.035]">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden border border-white/10 bg-[#090c0e]">
                {parsed ? <svg className="h-[80%] w-[80%]" viewBox={`${parsed.minX} ${parsed.minY} ${Math.max(parsed.width, 1)} ${Math.max(parsed.height, 1)}`} preserveAspectRatio="xMidYMid meet">{parsed.shapes.slice(0, 120).map((shape, i) => shape.kind === "line" ? <line key={i} x1={shape.a.x} y1={y(shape.a.y)} x2={shape.b.x} y2={y(shape.b.y)} stroke="#f58220" vectorEffect="non-scaling-stroke" /> : null)}</svg> : <span className="text-3xl font-light text-white/20 transition group-hover:text-steel-orange">+</span>}
                <span className="absolute bottom-0 right-0 h-5 w-5 border-l border-t border-steel-orange/55" />
              </div>
              <p className="mt-3 truncate text-xs font-semibold">{file?.name ?? "Добавить деталь"}</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-white/32">{parsed ? "DXF · распознано" : "DXF / STEP / STP / DWG"}</p>
            </button>
            <button onClick={() => inputRef.current?.click()} className="m-4 w-[calc(100%-2rem)] border border-white/12 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/55 transition hover:border-steel-orange hover:text-white">+ Добавить позицию</button>
          </aside>

          <div className="order-1 min-w-0 overflow-hidden border border-white/10 bg-[#101416] xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex gap-1">{(["model", "dfm"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${tab === item ? "bg-steel-orange text-black" : "text-white/45 hover:text-white"}`}>{item === "model" ? "Модель" : `DFM ${dfm.length ? `· ${dfm.length}` : ""}`}</button>)}</div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[.12em] text-white/35">{file && <span className="max-w-[220px] truncate">{file.name}</span>}<button onClick={() => inputRef.current?.click()} className="font-bold text-white/55 hover:text-steel-orange">Заменить</button></div>
            </div>

            <div className="relative min-h-[610px] overflow-hidden bg-[#080b0d]">
              <div className="pointer-events-none absolute inset-0 opacity-[.16]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
              <AnimatePresence mode="wait">
                {!file ? (
                  <motion.div key="drop" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .99 }} className="absolute inset-5 flex cursor-pointer flex-col items-center justify-center border border-dashed border-white/16 bg-black/15 p-8 text-center sm:inset-8" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}>
                    <motion.div animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }} className="relative flex h-20 w-20 items-center justify-center border border-steel-orange/55 text-4xl font-light text-steel-orange">+<span className="absolute -bottom-px -right-px h-5 w-5 border-l border-t border-steel-orange" /></motion.div>
                    <h2 className="mt-7 text-2xl font-semibold sm:text-3xl">Перетащите CAD-файл</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">В Alpha A уже работает реальный разбор ASCII DXF. STEP/STP и DWG подключаются как следующий authoritative CAD-модуль.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/35">{["DXF", "STEP", "STP", "DWG"].map((ext) => <span key={ext} className="border border-white/10 px-3 py-2">{ext}</span>)}</div>
                  </motion.div>
                ) : isAnalyzing ? (
                  <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center"><div className="w-full max-w-md px-8 text-center"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-steel-orange">Geometry engine</p><h2 className="mt-4 text-2xl font-semibold">Разбираем геометрию</h2><div className="relative mt-7 h-px overflow-hidden bg-white/10"><motion.span className="absolute inset-y-0 w-1/3 bg-steel-orange" animate={{ x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }} /></div><p className="mt-4 text-xs text-white/35">Контуры · габариты · длина реза · единицы измерения</p></div></motion.div>
                ) : error ? (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center p-8 text-center"><div className="max-w-xl border border-white/10 bg-[#101416] p-7"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">CAD intake</p><h2 className="mt-3 text-xl font-semibold">Файл принят</h2><p className="mt-4 text-sm leading-relaxed text-white/50">{error}</p><button onClick={() => inputRef.current?.click()} className="mt-6 border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[.12em] hover:border-steel-orange">Выбрать другой файл</button></div></motion.div>
                ) : tab === "model" && parsed && bounds ? (
                  <motion.div key="model" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 p-5 sm:p-8">
                    <svg className="h-full w-full" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet">
                      {parsed.shapes.map((shape, i) => {
                        const common = { fill: "none", stroke: "#f58220", strokeWidth: Math.max(bounds.w, bounds.h) / 720, vectorEffect: "non-scaling-stroke" as const };
                        if (shape.kind === "line") return <motion.line key={i} initial={{ pathLength: 0, opacity: .2 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: .5, delay: Math.min(i * .012, .45) }} x1={shape.a.x} y1={y(shape.a.y)} x2={shape.b.x} y2={y(shape.b.y)} {...common} />;
                        if (shape.kind === "polyline") { const pts = [...shape.points, ...(shape.closed ? [shape.points[0]] : [])].map((p) => `${p.x},${y(p.y)}`).join(" "); return <motion.polyline key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * .012, .45) }} points={pts} {...common} />; }
                        if (shape.kind === "circle") return <motion.circle key={i} initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * .012, .45) }} cx={shape.c.x} cy={y(shape.c.y)} r={shape.r} {...common} />;
                        return <polyline key={i} points={arcPoints(shape).map((p) => `${p.x},${y(p.y)}`).join(" ")} {...common} />;
                      })}
                    </svg>
                    <motion.div className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-steel-orange/65 to-transparent" animate={{ top: ["12%", "88%", "12%"] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} />
                    <div className="absolute left-5 top-5 border border-white/10 bg-black/55 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-white/45">2D Geometry · live</div>
                    <div className="absolute bottom-5 left-5 right-5 grid gap-px bg-white/10 sm:grid-cols-4">{[["X", `${fmt(parsed.width)} ${parsed.units}`], ["Y", `${fmt(parsed.height)} ${parsed.units}`], ["Контур", `${fmt(parsed.cutLength)} ${parsed.units}`], ["Объекты", String(parsed.contours)]].map(([label, value]) => <div key={label} className="bg-[#101416]/95 p-3"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/28">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}</div>
                  </motion.div>
                ) : parsed ? (
                  <motion.div key="dfm" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="relative p-5 sm:p-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Design for manufacturability</p><h2 className="mt-2 text-2xl font-semibold">Автоматическая проверка</h2></div><span className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] ${blocking ? "border-red-400/30 text-red-300" : manual ? "border-amber-400/25 text-amber-300" : "border-emerald-400/25 text-emerald-300"}`}>{blocking ? "Есть блокировка" : manual ? "Нужна проверка" : "Проверка пройдена"}</span></div><div className="grid gap-3">{dfm.map((item, i) => <motion.article key={item.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }} className={`border p-4 ${severityTone(item.severity)}`}><div className="flex gap-3"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[9px] font-bold">{item.severity === "pass" ? "✓" : item.severity === "error" ? "!" : "?"}</span><div><h3 className="text-sm font-semibold text-white">{item.title}</h3><p className="mt-2 text-xs leading-relaxed opacity-75">{item.detail}</p></div></div></motion.article>)}</div></motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <aside className="order-3 border border-white/10 bg-[#101416]">
            <div className="border-b border-white/10 p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-steel-orange">Конфигуратор</p><h2 className="mt-2 text-xl font-semibold">Маршрут изготовления</h2><p className="mt-2 text-xs leading-relaxed text-white/38">Показываем только подтверждённые производственные направления; точные совместимости будут задаваться технологической базой.</p></div>
            <div className="space-y-5 p-5">
              <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Материал</label><div className="mt-2 border border-steel-orange/35 bg-steel-orange/[.06] px-4 py-3 text-sm font-semibold">{material}</div></div>
              <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Толщина, мм</label><select value={thickness} onChange={(e) => setThickness(e.target.value)} className="mt-2 w-full border border-white/12 bg-[#090c0e] px-4 py-3 text-sm outline-none focus:border-steel-orange">{thicknessOptions.map((v) => <option key={v}>{v}</option>)}</select></div>
              <div><label className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Количество</label><div className="mt-2 grid grid-cols-[44px_1fr_44px] border border-white/12 bg-[#090c0e]"><button onClick={() => setQty((q) => Math.max(1, q - 1))} className="border-r border-white/10 text-white/50 hover:text-steel-orange">−</button><input value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} type="number" min={1} className="bg-transparent px-3 py-3 text-center text-sm outline-none"/><button onClick={() => setQty((q) => q + 1)} className="border-l border-white/10 text-white/50 hover:text-steel-orange">+</button></div></div>
              <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Операции</p><div className="mt-2 grid gap-2">{([ ["bend", "Гибка"], ["weld", "Сварка"], ["assembly", "Сборка"], ["paint", "Порошковая окраска"] ] as const).map(([key, label]) => <button key={key} onClick={() => setOperations((s) => ({ ...s, [key]: !s[key] }))} className={`flex items-center justify-between border px-4 py-3 text-left text-sm transition ${operations[key] ? "border-steel-orange/45 bg-steel-orange/[.07]" : "border-white/10 bg-[#0b0e10] hover:border-white/20"}`}><span>{label}</span><span className={`flex h-5 w-5 items-center justify-center border text-[10px] ${operations[key] ? "border-steel-orange bg-steel-orange text-black" : "border-white/15 text-transparent"}`}>✓</span></button>)}</div></div>
            </div>
            <div className="border-t border-white/10 p-5"><div className="relative overflow-hidden border border-steel-orange/30 bg-steel-orange/[.045] p-4"><motion.span className="absolute bottom-0 left-0 h-px bg-steel-orange" animate={{ width: parsed ? ["15%", "72%", "15%"] : "0%" }} transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }} /><p className="text-[10px] font-bold uppercase tracking-[.15em] text-steel-orange">Commercial engine</p><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-2xl font-semibold">Цена —</p><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-white/30">настройка тарифов не утверждена</p></div><span className="text-xs text-white/30">× {qty}</span></div></div><button disabled={!parsed || blocking} className="mt-3 w-full bg-steel-orange px-4 py-4 text-xs font-bold uppercase tracking-[.14em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30">{blocking ? "Исправьте DFM-ошибки" : "Продолжить к расчёту"}</button>{parsed && manual && !blocking && <p className="mt-3 text-[10px] leading-relaxed text-white/32">Часть технологических правил ещё требует подтверждённых норм. Такой заказ будет отправлен технологу на review.</p>}</div>
          </aside>
        </div>
      </section>
      <input ref={inputRef} type="file" accept={accepted} onChange={onChange} className="hidden" />
    </main>
  );
}
