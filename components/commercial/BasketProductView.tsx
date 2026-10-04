"use client";

import { useId, useState } from "react";
import { panelPatterns, type BasketDesign, type PanelPattern } from "@/lib/quote/basket-design";

type Props = {
  width: number;
  height: number;
  depth: number;
  color: string;
  ral: string;
  design: BasketDesign;
};

const validDimension = (value: number) => Number.isFinite(value) && value > 0 && value <= 10000;
const safeNumber = (value: number, fallback: number, minimum = 0) =>
  Number.isFinite(value) && value >= minimum ? value : fallback;

/** A material and proportion preview, intentionally not a fabrication model. */
function Panel({ id, width, height, pattern, paint, shade = false }: {
  id: string; width: number; height: number; pattern: PanelPattern; paint: string; shade?: boolean;
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
  const rim = Math.min(12, width / 12, height / 12);
  const lamellaPitch = Math.max(45, pitch);
  // This approved pattern has a fixed count. Its drawing dimensions are still
  // illustrative and must not inherit fields from another perforation pattern.
  const wideMargin = Math.min(20, width / 12, height / 12);
  const wideFieldWidth = Math.max(0, width - 2 * wideMargin);
  const wideFieldHeight = Math.max(0, height - 2 * wideMargin);
  const wideRowPitch = wideFieldHeight / 10;
  const wideSlotHeight = Math.min(10, wideRowPitch * .8, wideFieldWidth);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={shade ? ".05" : ".28"} />
          <stop offset=".36" stopColor="#fff" stopOpacity=".02" />
          <stop offset="1" stopColor="#000" stopOpacity={shade ? ".40" : ".19"} />
        </linearGradient>
        <pattern id={`${id}-holes`} width={pitch} height={pitch} x={margin} y={margin} patternUnits="userSpaceOnUse">
          {pattern.pattern === "round" ? (
            <circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill="#1e2529" />
          ) : (
            <rect width={slotLength} height={diameter} rx={diameter / 2} fill="#1e2529" />
          )}
        </pattern>
        <pattern id={`${id}-lamella`} width={width} height={lamellaPitch} patternUnits="userSpaceOnUse">
          <rect y={lamellaPitch - 9} width={width} height="8" fill="#1e2529" />
          <path d={`M0 ${lamellaPitch - 10}H${width}`} stroke="#fff" strokeOpacity=".32" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={paint} />
      <rect width={width} height={height} fill={`url(#${id}-metal)`} />
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
              fill="#1e2529"
            />
          ))}
        </g>
      )}
      {pattern.pattern === "lamella" && (
        <rect x={margin} y={margin} width={Math.max(0, width - 2 * margin)} height={Math.max(0, height - 2 * margin)} fill={`url(#${id}-lamella)`} />
      )}
      <rect width={width} height={rim} fill="#fff" opacity=".18" />
      <rect y={height - rim} width={width} height={rim} fill="#000" opacity=".10" />
      <path d={`M0 ${height}V0H${width}`} fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={`M${width} 0V${height}H0`} fill="none" stroke="#182128" strokeOpacity=".34" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function BasketProductView({ width, height, depth, color, ral, design }: Props) {
  const uid = useId().replace(/:/g, "");
  const [view, setView] = useState<"volume" | "front">("volume");
  const [dimensions, setDimensions] = useState(false);
  const valid = [width, height, depth].every(validDimension);
  const w = valid ? width : 900;
  const h = valid ? height : 600;
  const d = valid ? depth : 550;
  const paint = /^#[\da-f]{6}$/i.test(color) ? color : "#46505a";
  const volume = view === "volume";
  const scale = Math.min(350 / (w + (volume ? d * .52 : 0)), 248 / (h + (volume ? d * .30 : 0)));
  const dx = volume ? d * .52 * scale : 0;
  const dy = volume ? d * .30 * scale : 0;
  const fw = w * scale;
  const fh = h * scale;
  const left = (560 - fw - dx) / 2;
  const top = 60 + dy + (248 - fh - dy) / 2;
  const right = left + fw;
  const bottom = top + fh;
  const custom = design.front.pattern === "custom" || design.side.pattern === "custom";
  const slats = design.front.pattern === "lamella" || design.side.pattern === "lamella";
  const wideSlots = design.front.pattern === "wide-slots" || design.side.pattern === "wide-slots";
  const label = valid
    ? `Предварительный вид корзины ${width} на ${height} на ${depth} миллиметров. Передняя панель: ${panelPatterns[design.front.pattern]}. Боковые панели: ${panelPatterns[design.side.pattern]}. ${ral}.`
    : "Для просмотра корзины заполните её ширину, высоту и глубину.";
  const svgTitle = `${uid}-title`;
  return (
    <section aria-label="Внешний вид корзины" className="overflow-hidden rounded-2xl border border-[#dce0dc] bg-[#f3f3ef] text-[#242b2e]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a44513]">Сталь Продукт</p>
          <h3 className="mt-1 text-base font-semibold">Ваша корзина</h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d7dbd7] bg-white/80 px-3 py-1.5 text-xs font-medium">
          <span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: paint }} aria-hidden="true" />
          {ral || "Цвет не выбран"}
        </span>
      </div>
      <svg viewBox="0 0 560 380" role="img" aria-labelledby={svgTitle} className="block w-full" style={{ maxHeight: 380 }}>
        <title id={svgTitle}>{label}</title>
        <defs>
          <radialGradient id={`${uid}-floor`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#f3f3ef" />
          </radialGradient>
          <filter id={`${uid}-shadow`} x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <rect width="560" height="380" fill={`url(#${uid}-floor)`} />
        {valid ? (
          <>
            <ellipse cx="283" cy={bottom + 18} rx={Math.max(55, (fw + dx) * .51)} ry="14" fill="#293133" opacity=".18" filter={`url(#${uid}-shadow)`} />
            {volume && (
              <>
                {/* The left inner panel and the right outer panel; the rear and top stay open. */}
                <g transform={`matrix(${.52 * scale} ${-.30 * scale} 0 ${scale} ${left} ${top})`}>
                  <Panel id={`${uid}-inner`} width={d} height={h} pattern={design.side} paint={paint} shade />
                  <rect width={d} height={h} fill="#162125" opacity=".22" />
                </g>
                <path d={`M${left} ${top}l${dx} ${-dy}`} stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
                <g transform={`matrix(${.52 * scale} ${-.30 * scale} 0 ${scale} ${right} ${top})`}>
                  <Panel id={`${uid}-side`} width={d} height={h} pattern={design.side} paint={paint} shade />
                </g>
                <path d={`M${right + dx} ${top - dy}l-4 1v${fh - 2}l4 -1Z`} fill="#182128" opacity=".26" />
              </>
            )}
            <g transform={`translate(${left} ${top}) scale(${scale})`}>
              <Panel id={`${uid}-front`} width={w} height={h} pattern={design.front} paint={paint} />
            </g>
            {volume && <path d={`M${right} ${top}v${fh}`} stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />}
            {dimensions && (
              <g fill="#58635f" stroke="#84918a" strokeWidth="1" fontFamily="inherit" fontSize="12">
                <path d={`M${left} ${bottom + 15}v17M${right} ${bottom + 15}v17M${left} ${bottom + 25}H${right}`} />
                <rect x={(left + right) / 2 - 29} y={bottom + 16} width="58" height="18" fill="#f3f3ef" stroke="none" />
                <text x={(left + right) / 2} y={bottom + 29} textAnchor="middle" stroke="none">{width}</text>
                <path d={`M${left - 12} ${top}h-17M${left - 12} ${bottom}h-17M${left - 22} ${top}V${bottom}`} />
                <text transform={`translate(${left - 30} ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle" stroke="none" paintOrder="stroke" strokeWidth="6">{height}</text>
                {volume && <text x={right + dx / 2 + 6} y={top - dy / 2 - 13} textAnchor="middle" stroke="none">{depth}</text>}
              </g>
            )}
          </>
        ) : (
          <text x="280" y="188" textAnchor="middle" fill="#64716b" fontSize="15">Введите размеры корзины</text>
        )}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <div className="inline-flex rounded-full border border-[#cdd3cd] bg-white p-1" role="group" aria-label="Вид корзины">
          {([ ["volume", "Объёмный вид"], ["front", "Спереди"] ] as const).map(([value, text]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ac430d] ${view === value ? "bg-[#29332f] text-white" : "text-[#56625b] hover:bg-[#eef0eb]"}`}>{text}</button>
          ))}
        </div>
        <button type="button" aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)} className={`min-h-10 rounded-full border px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ac430d] ${dimensions ? "border-[#ad4a1c] bg-[#fff0e5] text-[#963900]" : "border-[#cdd3cd] bg-white text-[#56625b]"}`}>Размеры, мм</button>
      </div>
      <div className="border-t border-[#dce0dc] px-5 py-4">
        <p className="text-xs leading-5 text-[#65706a]">Визуализация формы и цвета. Оттенок RAL на экране приблизительный; конструкция уточняется по чертежу.</p>
        {custom && <p className="mt-2 text-xs leading-5 text-[#914315]">Рисунок по проекту не показан — добавьте его в задание инженеру.</p>}
        {slats && <p className="mt-2 text-xs leading-5 text-[#65706a]">Профиль и расположение ламелей показаны условно.</p>}
        {wideSlots && <p className="mt-2 text-xs leading-5 text-[#65706a]">10 прорезей на панель. Ширина и краевые отступы уточняются по чертежу.</p>}
      </div>
    </section>
  );
}
