"use client";
import { useId } from "react";
import type { BasketDesign } from "@/lib/quote/basket-design";
import { basketMountingDimensions } from "@/lib/quote/basket-mounting";

/** Explanatory section only. No wall thickness, bracket geometry or anchors are inferred. */
export function BasketWallSection({design}:{design:BasketDesign}) {
  const id=useId().replace(/:/g, "");
  const m=basketMountingDimensions(design);
  const layered=m.wallKind !== "wall";
  const facadeEnd=layered ? 200 : 80;
  const unitX=layered ? 292 : 208;
  const facadeText=m.facadeMm === null ? "Неизвестно" : `${m.facadeMm} мм`;
  const rearText=m.rearMm === null ? "Неизвестно" : `${m.rearMm} мм`;
  return <figure className="mt-5 overflow-hidden rounded-xl border border-slate-300 bg-[#f6f8f3]">
    <svg viewBox="0 0 440 220" className="block w-full" style={{maxHeight:220}} role="img" aria-labelledby={`${id}-wall-title`}>
      <title id={`${id}-wall-title`}>{`Условный разрез: несущая стена, ${layered ? `общая глубина фасада ${facadeText}, ` : "без дополнительного фасадного слоя, "}задний зазор блока ${rearText}. Толщины показаны без масштаба. Кронштейны и анкеры не показаны.`}</title>
      <defs><pattern id={`${id}-insulation`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#bcae74" strokeWidth="1"/></pattern></defs>
      <rect x="45" y="32" width="35" height="136" fill="#7b8880"/>
      <text x="62" y="22" textAnchor="middle" fontSize="12" fill="#435247">Стена</text>
      {layered && <><rect x="80" y="40" width="120" height="120" fill="#e0e5dc" stroke="#98a695" strokeDasharray={m.facadeMm === null ? "5 4" : undefined}/>
        {design.wallAssembly?.insulation === "yes" && <rect x="84" y="42" width="74" height="116" fill={`url(#${id}-insulation)`}/>}
        <rect x="194" y="32" width="6" height="136" fill="#8fa397"/><text x="142" y="22" textAnchor="middle" fontSize="12" fill="#435247">Весь слой фасада</text>
        <path d="M80 177v14m120-14v14M80 185h120" fill="none" stroke="#738677"/><text x="140" y="208" textAnchor="middle" fontSize="13" fill="#3a5140">{facadeText}</text></>}
      <path d={`M${facadeEnd} 176v15m${unitX-facadeEnd} -15v15M${facadeEnd} 184h${unitX-facadeEnd}`} fill="none" stroke="#a2643a"/>
      <text x={(facadeEnd+unitX)/2} y="208" textAnchor="middle" fontSize="13" fill="#83512d">{rearText}</text>
      <text x={(facadeEnd+unitX)/2} y="77" textAnchor="middle" fontSize="12" fill="#83512d">Зазор</text>
      <rect x={unitX} y="48" width="94" height="111" rx="3" fill="#fefefe" stroke="#788e7d" strokeWidth="1.5"/>
      <path d={`M${unitX+16} 73h60m-60 13h60m-60 13h60m-60 13h60m-60 13h60`} stroke="#bfcec0" strokeWidth="2"/>
      <text x={unitX+47} y="22" textAnchor="middle" fontSize="12" fill="#435247">Блок, вид сбоку</text>
    </svg>
    <figcaption className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">Схема без масштаба. Утеплитель входит в общую глубину фасада и не прибавляется второй раз. Крепление и нагрузки здесь не рассчитаны.</figcaption>
  </figure>;
}
