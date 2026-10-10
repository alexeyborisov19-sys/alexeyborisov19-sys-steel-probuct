"use client";
import { basketAcDimensionDisclaimer } from "@/lib/quote/basket-ac-reference";
import { useId, useState } from "react";
import type { BasketBrief } from "@/lib/quote/basket-brief";
import { basketClearanceGeometry, basketServiceSides } from "@/lib/quote/basket-review";
import styles from "./BasketConfigurator.module.css";

const number = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
export function BasketClearanceView({ input }: { input: BasketBrief }) {
  const [view, setView] = useState<"front" | "plan">("plan");
  const id = useId().replace(/:/g, "");
  const geometry = basketClearanceGeometry(input);
  const fit = input.design?.fit;
  const front = view === "front";
  const service = input.review?.serviceSide ?? "unknown";
  const horizontal = geometry?.envelope.width ?? 1;
  const vertical = (front ? geometry?.envelope.height : geometry?.envelope.depth) ?? 1;
  const scale = Math.min(330 / horizontal, 202 / vertical);
  const w = horizontal * scale;
  const h = vertical * scale;
  const x = (560 - w) / 2;
  const y = 84 + (202 - h) / 2;
  const ux = x + (geometry?.unit.x ?? 0) * scale;
  const uy = y + (front ? geometry?.unit.y ?? 0 : geometry?.unit.z ?? 0) * scale;
  const uw = (geometry?.unit.width ?? 1) * scale;
  const uh = (front ? geometry?.unit.height ?? 1 : geometry?.unit.depth ?? 1) * scale;
  const valid = Boolean(geometry && fit);
  return <section className={styles.clearanceView} aria-label="Блок и зазоры по вашим данным">
    <div className={styles.clearanceHeader}><div><p className={styles.eyebrow}>СХЕМА РАЗМЕЩЕНИЯ</p><h3>Блок и свободный объём</h3></div><span>мм</span></div>
    <div className={styles.drawingSwitch} role="group" aria-label="Проекция размещения блока">
      <button type="button" aria-pressed={!front} onClick={() => setView("plan")}>Вид сверху</button>
      <button type="button" aria-pressed={front} onClick={() => setView("front")}>Вид спереди</button>
    </div>
    {valid ? <>
      <svg viewBox="0 0 560 370" role="img" aria-labelledby={`${id}-title`} className={styles.clearanceSvg}>
        <title id={`${id}-title`}>{`${front ? "Вид спереди" : "Вид сверху"}: требуемый свободный объём ${number(horizontal)} на ${number(vertical)} мм. Блок ${number(geometry!.unit.width)} на ${number(front ? geometry!.unit.height : geometry!.unit.depth)} мм. Зазоры слева ${fit!.left}, справа ${fit!.right}, ${front ? `сверху ${fit!.top}, снизу ${fit!.bottom}` : `сзади ${fit!.rear}, спереди ${fit!.front}`} мм. Размеры введены заказчиком.`}</title>
        <defs><pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e1e7e4" strokeWidth=".6" /></pattern></defs>
        <rect width="560" height="370" fill={`url(#${id}-grid)`} />
        {!front && <><rect x={x - 16} y={y - 40} width={w + 32} height="9" fill="#60706a" /><text x="280" y={y - 48} textAnchor="middle" fontSize="13" fill="#4e5d56">Наружная плоскость стены / облицовки</text></>}
        <rect x={x} y={y} width={w} height={h} rx="2" fill="#e6eeeb" fillOpacity=".7" stroke="#74867d" strokeWidth="1.5" strokeDasharray="6 4" />
        <rect x={ux} y={uy} width={uw} height={uh} rx="3" fill="#fff" stroke="#354a42" strokeWidth="2" />
        {uw > 90 && uh > 55 && <g aria-hidden="true" stroke="#789087" fill="none"><circle cx={ux + uw * .4} cy={uy + uh / 2} r={Math.min(uw * .22, uh * .35)} /><circle cx={ux + uw * .4} cy={uy + uh / 2} r={Math.min(uw * .16, uh * .24)} /><path d={`M${ux + uw * .72} ${uy + uh * .3}h${uw * .16}m${-uw * .16} ${uh * .15}h${uw * .16}m${-uw * .16} ${uh * .15}h${uw * .16}`} /></g>}
        <g fill="#314a3f" stroke="#789087" strokeWidth="1" fontSize="14" textAnchor="middle">
          <path d={`M${x} ${y + h + 24}H${x + w}M${x} ${y + h + 18}v12M${x + w} ${y + h + 18}v12`} />
          <text x="280" y={y + h + 46} stroke="none">Ш {number(horizontal)}</text>
          <path d={`M${x + w + 22} ${y}V${y + h}M${x + w + 16} ${y}h12M${x + w + 16} ${y + h}h12`} />
          <text transform={`translate(${x + w + 42} ${y + h / 2}) rotate(-90)`} stroke="none">{front ? "В" : "Г"} {number(vertical)}</text>
          <path d={`M${x} ${y + h / 2}H${ux}M${ux + uw} ${y + h / 2}H${x + w}`} strokeDasharray="3 3" />
          <path d={`M${x + w / 2} ${y}V${uy}M${x + w / 2} ${uy + uh}V${y + h}`} strokeDasharray="3 3" />
        </g>
        <g fill="#783a18" fontSize="14" fontWeight="600" textAnchor="middle" paintOrder="stroke" stroke="#f5f8f6" strokeWidth="4">
          <text x={x - 32} y={y + h / 2 + 5}>{number(fit!.left!)}</text>
          <text x={x + w + 4} y={y + h / 2 - 14} textAnchor="end">{number(fit!.right!)}</text>
          <text x="280" y={y - 10}>{front ? "Верх" : "Задний"} {number(front ? fit!.top! : fit!.rear!)}</text>
          <text x="280" y={y + h + 15}>{front ? "Низ" : "Передний"} {number(front ? fit!.bottom! : fit!.front!)}</text>
        </g>
        {service !== "unknown" && <g stroke="#b5480e" strokeWidth="4" strokeLinecap="round">
          {service === "left" && <path d={`M${x - 6} ${y}v${h}`} />}
          {service === "right" && <path d={`M${x + w + 6} ${y}v${h}`} />}
          {service === "front" && !front && <path d={`M${x} ${y + h + 6}h${w}`} />}
          {service === "top" && front && <path d={`M${x} ${y - 6}h${w}`} />}
        </g>}
      </svg>
      <div className={styles.drawingLegend}><span><i />Наружный блок, условно</span><span><i />Требуемый свободный объём</span><span><i />Сервисная сторона: {basketServiceSides[service].toLowerCase()}</span></div>
      <dl className={styles.clearanceDimensions}>
        {geometry!.axes.map(axis => <div key={axis.key}><dt>{axis.label}</dt><dd>{number(axis.requiredMm)} <span>мм внутри</span><small>{geometry!.inner ? "Расчёт корзины" : "Наружный размер"}: {number(axis.selectedMm)} мм</small></dd></div>)}
      </dl>
      <p className={styles.drawingNote}>{basketAcDimensionDisclaimer}.</p>
      <p className={styles.drawingNote}>Схема показывает габариты и заданные отступы. Панели, опоры и трассы условны; внутренний просвет и воздухообмен ещё не проверены. Верх корзины открыт.</p>
      {geometry!.wallToBlockRearMm !== null && <p className={styles.drawingNote}>От несущей стены до задней стенки блока: {number(geometry!.wallToBlockRearMm)} мм. Слой фасада не прибавлен к габариту корзины.</p>}
    </> : <div className={styles.drawingEmpty}><svg viewBox="0 0 200 100" aria-hidden="true"><rect x="25" y="10" width="150" height="80" fill="none" stroke="#91a29a" strokeDasharray="5 4" /><rect x="50" y="25" width="100" height="50" rx="3" fill="#e5ede8" stroke="#61776b" /></svg><strong>Разместим блок на схеме</strong><p>Укажите три размера установки и все шесть отступов на шаге «Размеры». Неизвестные расстояния не подставляются автоматически.</p></div>}
  </section>;
}
