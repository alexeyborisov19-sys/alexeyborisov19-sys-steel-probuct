"use client";
import { useId } from "react";
import { cassettePanelStatusLabels, type CassetteElevation, type CassetteElevationLayout, type CassettePanel } from "@/lib/cassette-project/model";

const colours = { complete: "#334d5b", edge: "#9d6739", "opening-affected": "#80534e", "opening-removed": "#182126" };
export function CassetteElevationPreview({ elevation, layout, selectedId, onSelect, showMarks }: { elevation: CassetteElevation; layout: CassetteElevationLayout; selectedId: string | null; onSelect: (panel: CassettePanel) => void; showMarks: boolean }) {
  const titleId = useId(), descId = useId();
  const margin = Math.max(elevation.widthMm, elevation.heightMm) * .065;
  const font = Math.max(elevation.widthMm, elevation.heightMm) * .022;
  return <svg className="h-[320px] w-full bg-[#0c1013] sm:h-[440px]" viewBox={`${-margin} ${-margin} ${elevation.widthMm + 2 * margin} ${elevation.heightMm + 2 * margin}`} role="group" aria-labelledby={titleId} aria-describedby={descId}>
    <title id={titleId}>{`${elevation.name}: маркированная раскладка металлокассет`}</title>
    <desc id={descId}>Начало координат в левом нижнем углу. Выберите панель мышью или в списке ниже. Целые, краевые и затронутые проёмами позиции различаются цветом и текстовым статусом. Проёмы отмечены пунктиром.</desc>
    <rect x="0" y="0" width={elevation.widthMm} height={elevation.heightMm} fill="#080c0e" stroke="#8b9ba6" strokeWidth={Math.max(1, font * .045)} />
    {layout.panels.map(panel => {
      const y = elevation.heightMm - panel.yMm - panel.heightMm, selected = selectedId === panel.id;
      const labelFits = showMarks && layout.panels.length <= 300 && panel.widthMm > font * 3 && panel.heightMm > font;
      return <g key={panel.id} onClick={() => onSelect(panel)} className="cursor-pointer" aria-label={`${panel.mark}: ${cassettePanelStatusLabels[panel.status]}`}>
        <title>{`${panel.mark} · ${cassettePanelStatusLabels[panel.status]} · ${panel.widthMm} × ${panel.heightMm} мм`}</title>
        <rect x={panel.xMm} y={y} width={panel.widthMm} height={panel.heightMm} fill={colours[panel.status]} fillOpacity={panel.status === "opening-removed" ? .2 : .15} />
        {panel.remainingRects.map((rect, i) => <rect key={i} x={rect.xMm} y={elevation.heightMm - rect.yMm - rect.heightMm} width={rect.widthMm} height={rect.heightMm} fill={colours[panel.status]} />)}
        <rect x={panel.xMm} y={y} width={panel.widthMm} height={panel.heightMm} fill="transparent" stroke={selected ? "#ffb27c" : "#9eafb7"} strokeOpacity={selected ? 1 : .38} strokeWidth={selected ? font * .16 : font * .025} />
        {labelFits ? <text x={panel.xMm + panel.widthMm / 2} y={y + panel.heightMm / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={Math.min(font * .7, panel.widthMm / 7)} pointerEvents="none">{panel.row + 1}.{panel.column + 1}</text> : null}
      </g>;
    })}
    {elevation.openings.map(opening => <g key={opening.id} pointerEvents="none">
      <rect x={opening.xMm} y={elevation.heightMm - opening.yMm - opening.heightMm} width={opening.widthMm} height={opening.heightMm} fill="none" stroke="#dde8eb" strokeWidth={font * .07} strokeDasharray={`${font * .2} ${font * .13}`} />
      <text x={opening.xMm + opening.widthMm / 2} y={elevation.heightMm - opening.yMm - opening.heightMm / 2} textAnchor="middle" fill="#e5edf0" fontSize={Math.min(font * .75, opening.widthMm / 5)}>{opening.id.slice(0, 8)}</text>
    </g>)}
    <text x={elevation.widthMm / 2} y={-margin * .35} textAnchor="middle" fill="#b9c6ce" fontSize={font}>{elevation.widthMm} мм</text>
    <text x={-margin * .35} y={elevation.heightMm / 2} textAnchor="middle" fill="#b9c6ce" fontSize={font} transform={`rotate(-90 ${-margin * .35} ${elevation.heightMm / 2})`}>{elevation.heightMm} мм</text>
    <text x="0" y={elevation.heightMm + margin * .55} fill="#b9c6ce" fontSize={font * .7}>0,0 · X → · Y ↑</text>
  </svg>;
}
