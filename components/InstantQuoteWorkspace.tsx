"use client";

import { DragEvent, ChangeEvent, useMemo, useRef, useState } from "react";

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
    if (!Number.isFinite(code)) continue;
    pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

function detectUnits(pairs: Array<[number, string]>) {
  const labels: Record<string, string> = {
    "1": "дюймы",
    "2": "футы",
    "4": "мм",
    "5": "см",
    "6": "м",
  };
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

    const entity = value;
    const fields: Array<[number, string]> = [];
    let j = i + 1;
    while (j < pairs.length && pairs[j][0] !== 0) {
      fields.push(pairs[j]);
      j++;
    }
    i = j - 1;

    const first = (c: number) => fields.find(([code2]) => code2 === c)?.[1];
    const num = (c: number) => {
      const raw = first(c);
      if (raw == null) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };

    if (entity === "LINE") {
      const x1 = num(10), y1 = num(20), x2 = num(11), y2 = num(21);
      if ([x1, y1, x2, y2].every((n) => typeof n === "number")) {
        shapes.push({ kind: "line", a: { x: x1!, y: y1! }, b: { x: x2!, y: y2! } });
      }
    }

    if (entity === "CIRCLE") {
      const x = num(10), y = num(20), r = num(40);
      if ([x, y, r].every((n) => typeof n === "number") && r! > 0) {
        shapes.push({ kind: "circle", c: { x: x!, y: y! }, r: r! });
      }
    }

    if (entity === "ARC") {
      const x = num(10), y = num(20), r = num(40), start = num(50), end = num(51);
      if ([x, y, r, start, end].every((n) => typeof n === "number") && r! > 0) {
        shapes.push({ kind: "arc", c: { x: x!, y: y! }, r: r!, start: start!, end: end! });
      }
    }

    if (entity === "LWPOLYLINE") {
      const points: Point[] = [];
      let currentX: number | undefined;
      for (const [fieldCode, fieldValue] of fields) {
        if (fieldCode === 10) currentX = Number(fieldValue);
        if (fieldCode === 20 && currentX != null) {
          const y = Number(fieldValue);
          if (Number.isFinite(currentX) && Number.isFinite(y)) points.push({ x: currentX, y });
          currentX = undefined;
        }
      }
      const flags = Number(first(70) ?? "0");
      if (points.length >= 2) shapes.push({ kind: "polyline", points, closed: (flags & 1) === 1 });
    }
  }

  if (!shapes.length) throw new Error("В DXF не найдены поддерживаемые 2D-объекты (LINE, LWPOLYLINE, CIRCLE, ARC).");

  const pointsForBounds: Point[] = [];
  let cutLength = 0;
  let contours = 0;

  for (const shape of shapes) {
    if (shape.kind === "line") {
      pointsForBounds.push(shape.a, shape.b);
      cutLength += distance(shape.a, shape.b);
      contours += 1;
    } else if (shape.kind === "polyline") {
      pointsForBounds.push(...shape.points);
      for (let i = 1; i < shape.points.length; i++) cutLength += distance(shape.points[i - 1], shape.points[i]);
      if (shape.closed) cutLength += distance(shape.points[shape.points.length - 1], shape.points[0]);
      contours += 1;
    } else if (shape.kind === "circle") {
      pointsForBounds.push(
        { x: shape.c.x - shape.r, y: shape.c.y - shape.r },
        { x: shape.c.x + shape.r, y: shape.c.y + shape.r },
      );
      cutLength += 2 * Math.PI * shape.r;
      contours += 1;
    } else {
      pointsForBounds.push(
        { x: shape.c.x - shape.r, y: shape.c.y - shape.r },
        { x: shape.c.x + shape.r, y: shape.c.y + shape.r },
      );
      cutLength += 2 * Math.PI * shape.r * (normalizeArc(shape.start, shape.end) / 360);
      contours += 1;
    }
  }

  const xs = pointsForBounds.map((p) => p.x);
  const ys = pointsForBounds.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);

  return {
    shapes,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
    cutLength,
    contours,
    units,
  };
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
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function InstantQuoteWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedDxf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Загрузите CAD-файл детали");
  const [material, setMaterial] = useState("Черная сталь");
  const [thickness, setThickness] = useState("1.0");
  const [qty, setQty] = useState(1);
  const [operations, setOperations] = useState({ bend: false, weld: false, paint: false });

  const load = async (next: File) => {
    setFile(next);
    setParsed(null);
    setError(null);
    const ext = next.name.split(".").pop()?.toLowerCase();

    if (ext !== "dxf") {
      setStatus("Файл принят. 3D-разбор STEP/STP и DWG подключается следующим модулем.");
      return;
    }

    try {
      setStatus("Анализируем геометрию DXF…");
      const text = await next.text();
      const result = parseDxf(text);
      setParsed(result);
      setStatus("DXF разобран. Проверьте геометрию и параметры заказа.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось разобрать DXF.");
      setStatus("Нужна проверка файла");
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

  const bounds = useMemo(() => {
    if (!parsed) return null;
    const pad = Math.max(parsed.width, parsed.height, 10) * 0.08;
    return {
      x: parsed.minX - pad,
      y: parsed.minY - pad,
      w: Math.max(parsed.width + pad * 2, 1),
      h: Math.max(parsed.height + pad * 2, 1),
    };
  }, [parsed]);

  const y = (v: number) => (parsed ? parsed.minY + parsed.maxY - v : v);

  return (
    <main className="min-h-screen bg-[#0c0f11] text-white">
      <section className="border-b border-white/10 bg-[#111416]">
        <div className="container py-7 sm:py-9">
          <p className="eyebrow">Steel Product Online</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">Закажите деталь прямо из CAD</h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
                Загрузите файл, проверьте геометрию, выберите материал и производственные операции. Система готовит данные для расчёта и заказа без переписки по каждому базовому параметру.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/55">
              {["1 Файл", "2 Материал", "3 Операции", "4 Заказ"].map((step, i) => (
                <span key={step} className={i === 0 ? "border border-steel-orange bg-steel-orange/10 px-3 py-2 text-steel-orange" : "border border-white/10 px-3 py-2"}>{step}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-5 py-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,.7fr)] lg:py-8">
        <div className="overflow-hidden border border-white/10 bg-[#13171a]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">CAD workspace</p>
              <p className="mt-1 text-sm text-white/60">{status}</p>
            </div>
            {file && <button className="text-xs font-bold uppercase tracking-[.12em] text-white/55 hover:text-white" onClick={() => inputRef.current?.click()}>Заменить файл</button>}
          </div>

          <div className="min-h-[520px] p-4 sm:p-6">
            {!file ? (
              <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()} className="flex min-h-[470px] cursor-pointer flex-col items-center justify-center border border-dashed border-white/20 bg-[#0d1012] px-6 text-center transition hover:border-steel-orange/70 hover:bg-[#101417]">
                <div className="flex h-16 w-16 items-center justify-center border border-steel-orange/50 text-3xl text-steel-orange">+</div>
                <h2 className="mt-6 text-2xl font-semibold">Перетащите CAD-файл сюда</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/52">DXF уже разбирается в браузере. STEP/STP и DWG предусмотрены архитектурой и будут подключены через отдельный CAD-модуль.</p>
                <button type="button" className="mt-7 bg-steel-orange px-6 py-3 text-sm font-bold uppercase tracking-[.1em] text-black">Выбрать файл</button>
              </div>
            ) : parsed && bounds ? (
              <div className="grid gap-4">
                <div className="relative min-h-[420px] overflow-hidden border border-white/10 bg-[#090c0e]">
                  <svg className="h-[480px] w-full" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} preserveAspectRatio="xMidYMid meet">
                    {parsed.shapes.map((shape, i) => {
                      const common = { fill: "none", stroke: "#f58220", strokeWidth: Math.max(bounds.w, bounds.h) / 600, vectorEffect: "non-scaling-stroke" as const };
                      if (shape.kind === "line") return <line key={i} x1={shape.a.x} y1={y(shape.a.y)} x2={shape.b.x} y2={y(shape.b.y)} {...common} />;
                      if (shape.kind === "polyline") {
                        const pts = [...shape.points, ...(shape.closed ? [shape.points[0]] : [])].map((p) => `${p.x},${y(p.y)}`).join(" ");
                        return <polyline key={i} points={pts} {...common} />;
                      }
                      if (shape.kind === "circle") return <circle key={i} cx={shape.c.x} cy={y(shape.c.y)} r={shape.r} {...common} />;
                      const pts = arcPoints(shape).map((p) => `${p.x},${y(p.y)}`).join(" ");
                      return <polyline key={i} points={pts} {...common} />;
                    })}
                  </svg>
                  <div className="absolute left-4 top-4 border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/65">2D DXF preview</div>
                </div>
                <div className="grid gap-px bg-white/10 sm:grid-cols-4">
                  {[
                    ["Габарит X", `${fmt(parsed.width)} ${parsed.units === "не указаны" ? "ед." : parsed.units}`],
                    ["Габарит Y", `${fmt(parsed.height)} ${parsed.units === "не указаны" ? "ед." : parsed.units}`],
                    ["Длина контура", `${fmt(parsed.cutLength)} ${parsed.units === "не указаны" ? "ед." : parsed.units}`],
                    ["Объектов", String(parsed.contours)],
                  ].map(([label, value]) => <div key={label} className="bg-[#101416] p-4"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-white/40">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[470px] items-center justify-center border border-white/10 bg-[#0d1012] p-8 text-center">
                <div>
                  <p className="text-xl font-semibold">{file.name}</p>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">{error ?? status}</p>
                  {error && <button className="mt-5 border border-white/15 px-5 py-2 text-xs font-bold uppercase tracking-[.12em]" onClick={() => inputRef.current?.click()}>Выбрать другой файл</button>}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="border border-white/10 bg-[#13171a] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Параметры заказа</p>
          <h2 className="mt-2 text-2xl font-semibold">Настройте изготовление</h2>

          <label className="mt-7 block text-xs font-bold uppercase tracking-[.12em] text-white/50">Материал</label>
          <select value={material} onChange={(e) => setMaterial(e.target.value)} className="mt-2 w-full border border-white/12 bg-[#0b0e10] px-4 py-3 text-sm outline-none focus:border-steel-orange">
            <option>Черная сталь</option><option>Оцинкованная сталь</option><option>Нержавеющая сталь</option><option>Алюминий</option>
          </select>

          <label className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-white/50">Толщина, мм</label>
          <select value={thickness} onChange={(e) => setThickness(e.target.value)} className="mt-2 w-full border border-white/12 bg-[#0b0e10] px-4 py-3 text-sm outline-none focus:border-steel-orange">
            {["0.5","0.7","0.8","1.0","1.2","1.5","2.0","3.0","4.0","5.0","6.0"].map((v) => <option key={v}>{v}</option>)}
          </select>

          <label className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-white/50">Количество</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="mt-2 w-full border border-white/12 bg-[#0b0e10] px-4 py-3 text-sm outline-none focus:border-steel-orange" />

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-white/50">Дополнительные операции</p>
            <div className="mt-3 space-y-2">
              {([
                ["bend", "Гибка"], ["weld", "Сварка / сборка"], ["paint", "Порошковая окраска"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between border border-white/10 bg-[#0d1012] px-4 py-3 text-sm">
                  <span>{label}</span>
                  <input type="checkbox" checked={operations[key]} onChange={(e) => setOperations((s) => ({ ...s, [key]: e.target.checked }))} className="h-4 w-4 accent-[#f58220]" />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-steel-orange/35 bg-steel-orange/5 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-steel-orange">Расчёт цены</p>
            <p className="mt-2 text-sm leading-relaxed text-white/65">Цену намеренно не имитируем: следующий модуль свяжет геометрию CAD с утверждёнными производственными тарифами и правилами технологичности.</p>
          </div>

          <button disabled={!parsed} className="mt-5 w-full bg-steel-orange px-5 py-4 text-sm font-bold uppercase tracking-[.1em] text-black disabled:cursor-not-allowed disabled:opacity-35">Продолжить к расчёту</button>
          <p className="mt-3 text-xs leading-relaxed text-white/35">DXF-превью сейчас является предварительной проверкой геометрии и не заменяет технологическую проверку перед запуском в производство.</p>
        </aside>
      </section>

      <input ref={inputRef} type="file" accept={accepted} onChange={onChange} className="hidden" />
    </main>
  );
}
