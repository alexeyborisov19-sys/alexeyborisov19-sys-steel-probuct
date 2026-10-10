"use client";

import { useId, useState } from "react";
import { panelPatterns, type BasketDesign, type PanelPattern } from "@/lib/quote/basket-design";
import { basketAcDimensionDisclaimer } from "@/lib/quote/basket-ac-reference";
import { requiredBasketSpace } from "@/lib/quote/basket-fit";

type Props = {
  width: number;
  height: number;
  depth: number;
  color: string;
  ral: string;
  design: BasketDesign;
  /** Optional initial state also supports deterministic server rendering. */
  initialUnitVisible?: boolean;
  compact?: boolean;
};

const validDimension = (value: number) => Number.isFinite(value) && value > 0 && value <= 10000;
const safeNumber = (value: number, fallback: number, minimum = 0) =>
  Number.isFinite(value) && value >= minimum ? value : fallback;

/** A material and proportion preview, intentionally not a fabrication model. */
function Panel({ id, width, height, pattern, paint, shade = false, translucent = false }: {
  id: string; width: number; height: number; pattern: PanelPattern; paint: string; shade?: boolean; translucent?: boolean;
}) {
  const diameter = Math.min(safeNumber(pattern.diameter, 10, 1), 500);
  const slotLength = Math.max(diameter, Math.min(safeNumber(pattern.slotLength, 30, 1), 1000));
  const holeWidth = pattern.pattern === "slots" ? slotLength : diameter;
  const pitch = Math.max(holeWidth + 1, safeNumber(pattern.pitch, 20, 1));
  const margin = Math.min(safeNumber(pattern.margin, 20), width / 2, height / 2);
  const cols = Math.max(0, Math.floor((width - 2 * margin - holeWidth) / pitch) + 1);
  const rows = Math.max(0, Math.floor((height - 2 * margin - diameter) / pitch) + 1);
  const fieldWidth = cols ? (cols - 1) * pitch + holeWidth : 0;
  const fieldHeight = rows ? (rows - 1) * pitch + diameter : 0;
  const perforated = pattern.pattern === "round" || pattern.pattern === "slots";
  const lamellaPitch = Math.max(45, pitch);
  // This approved pattern has a fixed count. Its drawing dimensions are still
  // illustrative and must not inherit fields from another perforation pattern.
  const wideMargin = Math.min(20, width / 12, height / 12);
  const wideFieldWidth = Math.max(0, width - 2 * wideMargin);
  const wideFieldHeight = Math.max(0, height - 2 * wideMargin);
  const wideRowPitch = wideFieldHeight / 10;
  const wideSlotHeight = Math.min(10, wideRowPitch * .8, wideFieldWidth);
  return (
    <g data-basket-panel={id.split("-").at(-1)} data-panel-width={width} data-panel-height={height} data-panel-pattern={pattern.pattern} opacity={translucent ? .32 : 1}>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={shade ? ".05" : ".28"} />
          <stop offset=".36" stopColor="#fff" stopOpacity=".02" />
          <stop offset="1" stopColor="#000" stopOpacity={shade ? ".40" : ".19"} />
        </linearGradient>
        <pattern id={`${id}-holes`} width={pitch} height={pitch} x={margin} y={margin} patternUnits="userSpaceOnUse">
          {pattern.pattern === "round" ? (
            <circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill="#000" />
          ) : (
            <rect width={slotLength} height={diameter} rx={diameter / 2} fill="#000" />
          )}
        </pattern>
        <pattern id={`${id}-lamella`} width={width} height={lamellaPitch} patternUnits="userSpaceOnUse">
          <rect y={lamellaPitch - 9} width={width} height="8" fill="#000" />
          <path d={`M0 ${lamellaPitch - 10}H${width}`} stroke="#fff" strokeOpacity=".32" strokeWidth="2" />
        </pattern>
        <mask id={`${id}-cutouts`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect width={width} height={height} fill="#fff"/>
      {perforated && cols > 0 && rows > 0 && (
        <rect x={margin} y={margin} width={fieldWidth} height={fieldHeight} fill={`url(#${id}-holes)`} />
      )}
      {pattern.pattern === "wide-slots" && wideSlotHeight > 0 && (
        <g data-basket-wide-panel="true">
          {Array.from({ length: 10 }, (_, row) => (
            <rect
              key={row}
              data-basket-wide-slot="true"
              x={wideMargin}
              y={wideMargin + row * wideRowPitch + (wideRowPitch - wideSlotHeight) / 2}
              width={wideFieldWidth}
              height={wideSlotHeight}
              rx={wideSlotHeight / 2}
              fill="#000"
            />
          ))}
        </g>
      )}
      {pattern.pattern === "lamella" && (
        <rect x={margin} y={margin} width={Math.max(0, width - 2 * margin)} height={Math.max(0, height - 2 * margin)} fill={`url(#${id}-lamella)`} />
      )}
        </mask>
      </defs>
      <g mask={`url(#${id}-cutouts)`}>
        <rect width={width} height={height} fill={paint}/>
        <rect width={width} height={height} fill={`url(#${id}-metal)`}/>
      </g>
      <path d={`M0 ${height}V0H${width}`} fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={`M${width} 0V${height}H0`} fill="none" stroke="#182128" strokeOpacity=".34" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

/** Position the supplied unit without inventing a gap, support or panel thickness. */
export function basketProductGeometry(width: number, height: number, depth: number, design: BasketDesign) {
  const valid = [width, height, depth].every(validDimension);
  const fit = design.fit;
  const required = requiredBasketSpace(fit);
  const unit = valid && required && fit && Object.values(required).every(n => n <= 10000)
    ? { width: fit.width!, height: fit.height!, depth: fit.depth!, x: fit.left!, y: fit.top!, z: fit.front! }
    : null;
  return {
    valid,
    // These proportions are an unmeasured shape illustration until dimensions exist.
    width: valid ? width : 900, height: valid ? height : 600, depth: valid ? depth : 550,
    unit,
    conflict: Boolean(valid && required && (design.sizing === "block"
      ? width !== Math.ceil(required.width) || height !== Math.ceil(required.height) || depth !== Math.ceil(required.depth)
      : width <= required.width || height <= required.height || depth <= required.depth)),
  };
}

function OutdoorUnit({ width, height, depth, project, id }: {
  width: number; height: number; depth: number; project: (x: number, y: number, z: number) => string; id: string;
}) {
  const front = [project(0, 0, 0), project(width, 0, 0), project(width, height, 0), project(0, height, 0)].join(" ");
  const top = [project(0, 0, 0), project(0, 0, depth), project(width, 0, depth), project(width, 0, 0)].join(" ");
  const side = [project(width, 0, 0), project(width, 0, depth), project(width, height, depth), project(width, height, 0)].join(" ");
  // The casing envelope follows supplied dimensions. Fan/louvre detailing is illustrative.
  const origin = project(0, 0, 0).split(",").map(Number);
  const end = project(width, height, 0).split(",").map(Number);
  const w = end[0] - origin[0]; const h = end[1] - origin[1];
  const r = Math.min(w * .29, h * .39);
  return <g data-basket-unit="true" data-unit-width={width} data-unit-height={height} data-unit-depth={depth}>
    <defs><linearGradient id={`${id}-case`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#d3dad8"/></linearGradient></defs>
    <polygon points={top} fill="#f8faf8" stroke="#9ba8a3" strokeWidth="1"/>
    <polygon points={side} fill="#bdc9c3" stroke="#8a9b93" strokeWidth="1"/>
    <polygon points={front} fill={`url(#${id}-case)`} stroke="#899b93" strokeWidth="1.2"/>
    <g transform={`translate(${origin[0]} ${origin[1]})`} aria-hidden="true">
      <circle cx={w * .38} cy={h / 2} r={r} fill="#697b76" stroke="#a6b4ae" strokeWidth="2"/>
      {[.24, .48, .72, .92].map(f => <circle key={f} cx={w * .38} cy={h / 2} r={r * f} fill="none" stroke="#dbe3dd" strokeWidth=".8"/>)}
      {[0, 45, 90, 135].map(a => <path key={a} d={`M${w * .38 - r} ${h / 2}h${r * 2}`} transform={`rotate(${a} ${w * .38} ${h / 2})`} stroke="#dbe3dd" strokeWidth=".8"/>)}
      <circle cx={w * .38} cy={h / 2} r={r * .13} fill="#d1dad6"/>
      {Array.from({length: 7}, (_, i) => <path key={i} d={`M${w * .77} ${h * (.28 + i * .065)}h${w * .13}`} stroke="#879b91" strokeWidth="1.2"/>)}
    </g>
  </g>;
}

export function BasketProductView({ width, height, depth, color, ral, design, initialUnitVisible = false, compact = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const [view, setView] = useState<"volume" | "front">("volume");
  const [dimensions, setDimensions] = useState(true);
  const [showUnit, setShowUnit] = useState(initialUnitVisible);
  const geometry = basketProductGeometry(width, height, depth, design);
  const { valid } = geometry;
  const fit = design.fit;
  const unitOnly = !valid && Boolean(fit && [fit.width, fit.height, fit.depth].every(n => typeof n === "number" && validDimension(n)));
  const unit = unitOnly && fit ? {width:fit.width!, height:fit.height!, depth:fit.depth!, x:0, y:0, z:0} : geometry.unit;
  const w = unitOnly && unit ? unit.width : geometry.width;
  const h = unitOnly && unit ? unit.height : geometry.height;
  const d = unitOnly && unit ? unit.depth : geometry.depth;
  const volume = view === "volume";
  const unitVisible = (showUnit || unitOnly) && Boolean(unit);
  const sceneWidth = Math.max(w, unitVisible && unit ? unit.x + unit.width : 0);
  const sceneHeight = Math.max(h, unitVisible && unit ? unit.y + unit.height : 0);
  const sceneDepth = Math.max(d, unitVisible && unit ? unit.z + unit.depth : 0);
  const scale = Math.min(385 / (sceneWidth + (volume ? sceneDepth * .55 : 0)), 240 / (sceneHeight + (volume ? sceneDepth * .34 : 0)));
  const dx = volume ? d * .55 * scale : 0;
  const dy = volume ? d * .34 * scale : 0;
  const fw = w * scale; const fh = h * scale;
  const left = (560 - (sceneWidth + (volume ? sceneDepth * .55 : 0)) * scale) / 2;
  const top = 43 + (volume ? sceneDepth * .34 * scale : 0) + (240 - (sceneHeight + (volume ? sceneDepth * .34 : 0)) * scale) / 2;
  const right = left + fw; const bottom = top + fh;
  const paint = /^#[\da-f]{6}$/i.test(color) ? color : "#46505a";
  const custom = design.front.pattern === "custom" || design.side.pattern === "custom";
  const slats = design.front.pattern === "lamella" || design.side.pattern === "lamella";
  const wideSlots = design.front.pattern === "wide-slots" || design.side.pattern === "wide-slots";
  const inner = design.sizing === "block";
  const sizeLabel = inner ? "Расчётный внутренний объём" : "Наружные размеры корзины";
  const number = (n: number) => n.toLocaleString("ru-RU", {maximumFractionDigits: 2});
  const unitProject = (x: number, y: number, z: number) => `${left + ((unit?.x ?? 0) + x + (volume ? ((unit?.z ?? 0) + z) * .55 : 0)) * scale},${top + ((unit?.y ?? 0) + y - (volume ? ((unit?.z ?? 0) + z) * .34 : 0)) * scale}`;
  const colorLabel = ral ? /^RAL /i.test(ral) ? ral : `RAL ${ral}` : "Цвет не выбран";
  const label = `${unitOnly && unit ? `Предварительный эскиз блока ${unit.width} на ${unit.height} на ${unit.depth} миллиметров. Размер корзины не определён, зазоры не подтверждены.` : valid ? `${sizeLabel}: ${width} на ${height} на ${depth} миллиметров.` : "Пример формы корзины без масштаба. Укажите размеры для своей модели."}${!unitOnly ? ` Передняя панель: ${panelPatterns[design.front.pattern]}. Боковые панели: ${panelPatterns[design.side.pattern]}. ${colorLabel}. Верх открыт.` : ""}${unitVisible && unit ? ` Блок ${unit.width} на ${unit.height} на ${unit.depth} миллиметров; корпус и вентилятор показаны условно, совместимость не подтверждена.` : ""}`;
  return (
    <section aria-label="Внешний вид корзины" className="overflow-hidden rounded-2xl border border-[#d3dad4] bg-[#f3f4ef] text-[#242b2e]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div><p className="text-xs font-medium text-[#626d65]">{unitOnly ? "Предварительный эскиз · зазоры нужно уточнить" : valid ? "По вашим параметрам" : "Пример формы · без масштаба"}</p><h3 className="mt-1 text-lg font-semibold">{unitOnly ? "Наружный блок" : unitVisible ? "Корзина и наружный блок" : "Ваша корзина"}</h3></div>
        {!unitOnly && <span className="inline-flex items-center gap-2 rounded-full border border-[#d7dbd7] bg-white/80 px-3 py-2 text-xs font-medium"><span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: paint }} aria-hidden="true" />{colorLabel}</span>}
      </div>
      <svg viewBox="0 0 560 340" role="img" aria-labelledby={`${uid}-title`} className="block w-full" style={{maxHeight: 360}} data-basket-model={unitOnly ? "unit-only" : valid ? "configured" : "illustrative"}>
        <title id={`${uid}-title`}>{label}</title>
        <defs><radialGradient id={`${uid}-floor`}><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#f3f4ef"/></radialGradient><filter id={`${uid}-shadow`} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="8"/></filter></defs>
        <rect width="560" height="340" fill={`url(#${uid}-floor)`}/>
        <ellipse cx={left + (fw + dx) / 2} cy={bottom + 16} rx={Math.max(35, (fw + dx) * .51)} ry="12" fill="#293133" opacity=".17" filter={`url(#${uid}-shadow)`}/>
        {volume && !unitOnly && <g transform={`matrix(${.55 * scale} ${-.34 * scale} 0 ${scale} ${left} ${top})`}><Panel id={`${uid}-inner`} width={d} height={h} pattern={design.side} paint={paint} shade/></g>}
        {unitVisible && unit && <OutdoorUnit {...unit} project={unitProject} id={uid}/>}
        {volume && !unitOnly && <><g transform={`matrix(${.55 * scale} ${-.34 * scale} 0 ${scale} ${right} ${top})`}><Panel id={`${uid}-side`} width={d} height={h} pattern={design.side} paint={paint} shade translucent={unitVisible}/></g><path d={`M${right + dx} ${top - dy}v${fh}`} stroke="#1f2e28" strokeOpacity=".5" strokeWidth="2"/></>}
        {!unitOnly && <g transform={`translate(${left} ${top}) scale(${scale})`}><Panel id={`${uid}-front`} width={w} height={h} pattern={design.front} paint={paint} translucent={unitVisible}/></g>}
        {volume && !unitOnly && <path d={`M${left} ${top}l${dx} ${-dy}M${right} ${top}l${dx} ${-dy}M${right} ${top}v${fh}`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" fill="none"/>}
        {dimensions && valid && <g fill="#46584c" stroke="#819286" strokeWidth="1" fontFamily="inherit" fontSize="14">
          <path d={`M${left} ${bottom + 12}v20M${right} ${bottom + 12}v20M${left} ${bottom + 25}H${right}`}/>
          <rect x={(left + right) / 2 - 42} y={bottom + 16} width="84" height="20" fill="#f3f4ef" stroke="none"/><text x={(left + right) / 2} y={bottom + 31} textAnchor="middle" stroke="none">Ш {number(width)}</text>
          <path d={`M${left - 12} ${top}h-17M${left - 12} ${bottom}h-17M${left - 23} ${top}V${bottom}`}/><text transform={`translate(${left - 32} ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle" stroke="none">В {number(height)}</text>
          {volume && <><path d={`M${right + 10} ${top - 12}l${dx} ${-dy}`} strokeDasharray="3 3"/><text x={right + dx / 2 + 10} y={top - dy / 2 - 18} textAnchor="middle" stroke="none">Г {number(depth)}</text></>}
        </g>}
      </svg>
      {!compact && <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 sm:px-5">
        <div className="inline-flex gap-1 rounded-lg border border-[#cdd3cd] bg-white p-1" role="group" aria-label="Вид корзины">
          {([["volume", "Объёмный вид"], ["front", "Спереди"]] as const).map(([value, text]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-11 rounded-md px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ac430d] ${view === value ? "bg-[#293b31] text-white" : "text-[#46544b] hover:bg-[#eef0eb]"}`}>{text}</button>)}
        </div>
        {valid && <button type="button" aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)} className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${dimensions ? "border-[#ad4a1c] bg-[#fff0e5] text-[#963900]" : "border-[#cdd3cd] bg-white text-[#56625b]"}`}>Размеры, мм</button>}
        {unit && !unitOnly && <button type="button" aria-pressed={unitVisible} onClick={() => setShowUnit(!showUnit)} className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${unitVisible ? "border-[#567562] bg-[#e6ede4] text-[#294334]" : "border-[#b9c5ba] bg-white text-[#405847]"}`}>Показать блок</button>}
      </div>}
      <div className="border-t border-[#d3dad4] bg-white/60 px-4 py-4 sm:px-5">
        {valid ? <><p className="text-xs text-[#54645a]">{sizeLabel}, Ш × В × Г</p><p className="mt-1 text-base font-semibold tabular-nums">{number(width)} × {number(height)} × {number(depth)} мм</p></> : <p className="text-sm leading-6 text-[#46574b]">{unitOnly ? "Размер корзины ещё не рассчитан. Уточните шесть зазоров вокруг блока." : "Введите габариты, чтобы увидеть свою корзину в правильных пропорциях."}</p>}
        {unit && <p className="mt-2 text-xs leading-5 text-[#46574b]">Блок: {number(unit.width)} × {number(unit.height)} × {number(unit.depth)} мм. {unitOnly ? "Форма корпуса условная; пропорции по указанным размерам." : unitVisible ? "Панели полупрозрачны, чтобы показать расположение блока." : compact ? "Расположение блока показано на шаге «Крепление»." : "Нажмите «Показать блок», чтобы посмотреть его расположение."}</p>}
        {geometry.conflict && <p role="status" className="mt-2 text-sm font-medium leading-5 text-[#9b3b15]">Размеры корзины и требуемого объёма не согласованы. Проверьте зазоры на шаге «Крепление».</p>}
        {(design.capacityClass || design.acReference) && <p className="mt-2 text-xs leading-5 text-[#8b451b]">{basketAcDimensionDisclaimer}.</p>}
        {!unitOnly && <p className="mt-2 text-xs leading-5 text-[#54645a]">Открытый верх. Размеры и оттенок RAL уточняются перед изготовлением.</p>}
        <details className="mt-2 text-xs leading-5 text-[#54645a]"><summary className="font-medium">Что показано условно</summary><p className="mt-2">Это визуализация, не рабочий чертёж. 1 передняя и 2 боковые панели. {inner ? "Панели показаны по расчётному объёму; наружные размеры уточняются." : "Внутренний просвет уточняется по чертежу."} Корпус и вентилятор блока условны. Кронштейны, анкеры и узлы крепления не показаны: их размеры и несущая способность требуют подбора. Совместимость и воздухообмен не подтверждены.</p>
          {custom && <p className="mt-2">Рисунок по проекту не показан; добавьте его в задание инженеру.</p>}{slats && <p className="mt-2">Профиль и расположение ламелей показаны условно.</p>}{wideSlots && <p className="mt-2">10 прорезей на панель. Ширина и краевые отступы уточняются по чертежу.</p>}
        </details>
      </div>
    </section>
  );
}
