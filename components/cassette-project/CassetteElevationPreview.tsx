"use client";
import { useId } from "react";
import { cassettePanelStatusLabels, type CassetteElevation, type CassetteElevationLayout, type CassettePanel } from "@/lib/cassette-project/model";
import { cassettePolygon, cassetteRectPoints, createCassetteProjection, type CassetteView } from "./cassette-visual-geometry";

const colours = { complete: "#334d5b", edge: "#9d6739", "opening-affected": "#80534e", "opening-removed": "#182126" };
export function CassetteElevationPreview({ elevation, layout, selectedId, onSelect, showMarks, view = "plan", showStatuses = false }: { elevation: CassetteElevation; layout: CassetteElevationLayout; selectedId: string | null; onSelect: (panel: CassettePanel) => void; showMarks: boolean; view?: CassetteView; showStatuses?: boolean }) {
  const prefix = useId().replaceAll(":", ""), titleId = `${prefix}-title`, descId = `${prefix}-description`;
  const project = createCassetteProjection(elevation.widthMm, elevation.heightMm, view);
  const facade = cassettePolygon(cassetteRectPoints({ xMm: 0, yMm: 0, widthMm: elevation.widthMm, heightMm: elevation.heightMm }, project));
  const technical = view === "plan";
  return <svg className="h-[200px] w-full bg-[#10171d] sm:h-[360px] xl:h-[420px]" viewBox="0 0 800 440" role="group" aria-labelledby={titleId} aria-describedby={descId} data-cassette-view={view}>
    <title id={titleId}>{`${elevation.name}: маркированная раскладка металлокассет`}</title>
    <desc id={descId}>{technical ? "Вид спереди. " : "Перспективный вид лицевых поверхностей без бортов и замков. "}Начало координат в левом нижнем углу. Выберите панель мышью или в списке ниже. Размеры, марки и статусы доступны в текстовом виде. Проёмы показаны пустыми и обведены пунктиром.</desc>
    <defs>
      <linearGradient id={`${prefix}-scene`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#24313b" /><stop offset="1" stopColor="#10171d" /></linearGradient>
      <linearGradient id={`${prefix}-metal`} gradientUnits="userSpaceOnUse" x1="40" y1="30" x2="750" y2="390"><stop stopColor="#b7c2ca" /><stop offset=".38" stopColor="#8496a3" /><stop offset=".62" stopColor="#9babb6" /><stop offset="1" stopColor="#506773" /></linearGradient>
      <radialGradient id={`${prefix}-shadow`}><stop stopColor="#000" stopOpacity=".5" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="800" height="440" fill={`url(#${prefix}-scene)`} />
    {!technical ? <ellipse cx="410" cy="398" rx="330" ry="30" fill={`url(#${prefix}-shadow)`} /> : null}
    <polygon points={facade} fill="#091119" stroke="#52606b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    {layout.panels.map(panel => {
      const selected = selectedId === panel.id;
      const cell = cassetteRectPoints(panel, project), middle = project(panel.xMm + panel.widthMm / 2, panel.yMm + panel.heightMm / 2);
      const labelFits = technical && showMarks && layout.panels.length <= 100 && Math.abs(cell[1].x - cell[0].x) > 42 && Math.abs(cell[3].y - cell[0].y) > 24;
      return <g key={panel.id} onClick={() => onSelect(panel)} className="cursor-pointer" aria-label={`${panel.mark}: ${cassettePanelStatusLabels[panel.status]}`} data-panel-status={panel.status} data-panel-id={panel.id}>
        <title>{`${panel.mark} · ${cassettePanelStatusLabels[panel.status]} · ${panel.widthMm} × ${panel.heightMm} мм`}</title>
        {panel.remainingRects.map((rect, i) => <polygon key={i} data-face-rectangle="true" points={cassettePolygon(cassetteRectPoints(rect, project))} fill={technical || showStatuses ? colours[panel.status] : `url(#${prefix}-metal)`} />)}
        {/* This highlight is a surface outline, never a fabricated folded edge or thickness. */}
        {panel.coordinationRect ? <polygon points={cassettePolygon(cassetteRectPoints(panel.coordinationRect, project))} fill="none" stroke={technical ? "#9eafb7" : "#d5e0e5"} strokeOpacity={technical ? .55 : .65} strokeWidth=".65" vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
        <polygon points={cassettePolygon(cell)} fill="transparent" stroke={selected ? "#ffb27c" : "none"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {labelFits ? <text x={middle.x} y={middle.y} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="15" className="hidden sm:block" pointerEvents="none">{panel.row + 1}.{panel.column + 1}</text> : null}
      </g>;
    })}
    {elevation.openings.map(opening => <g key={opening.id} pointerEvents="none">
      <title>{`${opening.name}: ${opening.widthMm} × ${opening.heightMm} мм; X ${opening.xMm}, Y ${opening.yMm} мм`}</title>
      <polygon data-opening-id={opening.id} points={cassettePolygon(cassetteRectPoints(opening, project))} fill="none" stroke="#dde8eb" strokeWidth="1.2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
    </g>)}
  </svg>;
}
