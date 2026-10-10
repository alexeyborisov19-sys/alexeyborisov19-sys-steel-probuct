"use client";
import { useId, useMemo, useState } from 'react';
import { CassetteDepthSurface } from './CassetteDepthSurface';
import { cassetteGeometry, cassetteProfiles, type Vec3 } from '@/lib/bim/cassette-geometry';
import { validateCassetteBim, type CassetteBimInput } from '@/lib/bim/cassette';
import { canInspectCassetteNeighbours, cassetteInspectionColour, cassetteInspectionSeam, createCassetteInspectionInstances, projectCassetteInspection, type CassetteInspectionAxis, type CassetteInspectionMode } from '@/lib/bim/cassette-inspection';
import { PRODUCT_CALCULATION_NOTICE } from '@/lib/product-calculation-notice';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
const modes = [['single', 'Одна кассета'], ['neighbours', 'Соседние'], ['exploded', 'Разнесённо']] as const;
const modeTitles = { single: 'Конструкция одной кассеты', neighbours: 'Проверка взаимного расположения', exploded: 'Разнесённый вид двух кассет' };
const coordinationNotice = 'Предварительная координационная компоновка. Узел зацепления и крепёж не подтверждены исходными моделями.';
const pointString = (point: Vec3) => `${Number(point[0].toFixed(4))},${Number(point[1].toFixed(4))}`;

/** Exported separately so SSR verification exercises every actual inspection mode. */
export function CassetteInspectionView({ input, colour = '#a8b5b9', mode = 'single', axis = 'horizontal', yaw = 145, pitch = 20 }: { input: CassetteBimInput; colour?: string; mode?: CassetteInspectionMode; axis?: CassetteInspectionAxis; yaw?: number; pitch?: number }) {
  const prefix = useId().replaceAll(':', '');
  const [depthReady, setDepthReady] = useState(false);
  const effectiveMode = canInspectCassetteNeighbours(input) ? mode : 'single';
  const geometry = useMemo(() => {
    try {
      const errors = validateCassetteBim(input);
      if (errors.length) return { error: errors[0], solids: null };
      return { error: '', solids: cassetteGeometry(input) };
    } catch { return { error: 'Проверьте параметры исходной модели.', solids: null }; }
  }, [input]);
  const scene = useMemo(() => {
    if (!geometry.solids) return { error: geometry.error, result: null };
    try {
      const instances = createCassetteInspectionInstances(input, geometry.solids, effectiveMode, axis);
      return { error: '', result: { ...projectCassetteInspection(instances, yaw, pitch), instances } };
    } catch (error) { return { error: error instanceof Error ? error.message : 'Не удалось построить предпросмотр.', result: null }; }
  }, [geometry, input, effectiveMode, axis, yaw, pitch]);
  if (!scene.result) return <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900">Предпросмотр скрыт. {scene.error}</p>;
  const projected = scene.result;
  const xs = projected.polygons.flatMap(poly => poly.points.map(point => point[0]));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const frameWidth = effectiveMode === 'single' ? Math.min(900, Math.max(420, maxX - minX + 100)) : 900;
  const frameX = Math.max(0, Math.min(900 - frameWidth, (minX + maxX - frameWidth) / 2));
  const seam = cassetteInspectionSeam(input, axis).map(point => projected.project(point));
  const dx = seam[1][0] - seam[0][0], dy = seam[1][1] - seam[0][1], length = Math.hypot(dx, dy);
  let normal = length > 1e-9 ? [-dy / length, dx / length] : [0, -1];
  if ((axis === 'horizontal' && normal[1] > 0) || (axis === 'vertical' && normal[0] > 0)) normal = normal.map(value => -value);
  const dimension = seam.map(point => [point[0] + normal[0] * 32, point[1] + normal[1] * 32, point[2]] as Vec3);
  const second = projected.instances[1];
  const centre: Vec3 = [input.widthMm / 2 + (second?.offset[0] ?? 0), input.heightMm / 2 + (second?.offset[1] ?? 0), 0];
  const source = input.profile === 'open' || input.profile === 'closed' ? 'Борта, гибы и отверстия — из исходной STEP-модели.' : input.profile === 'corner' ? 'Угловая кассета — упрощённая геометрия по чертежу, без отверстий и радиусов.' : 'Упрощённая геометрия прямых бортов.';
  return <figure className="mt-4" data-testid="cassette-bim-inspection" data-inspection-mode={effectiveMode}>
    <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-2 text-sm leading-6 text-[#4d6066]">
      <div><h4 className="font-semibold text-[#182a30]">{modeTitles[effectiveMode]}</h4><p>Лицо {number.format(input.widthMm)} × {number.format(input.heightMm)} мм · борт {number.format(input.depthMm)} мм</p></div>
      {effectiveMode !== 'single' ? <p className="rounded-md border border-[#a7b9bf] bg-white px-3 py-1 text-[#253c45]">{effectiveMode === 'exploded' ? 'Шов до разноса' : 'Шов между лицами'}: {number.format(input.jointMm)} мм</p> : null}
    </figcaption>
    <svg role="img" aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-description`} viewBox={`${frameX} 0 ${frameWidth} 560`} style={{ aspectRatio: `${frameWidth} / 560`, height: 'auto' }} className="block max-h-[560px] w-full rounded-xl border border-[#b7c7cd] bg-[#e3eaed]" data-solid-instances={projected.instances.length}>
      <title id={`${prefix}-title`}>{`${input.profile ? cassetteProfiles[input.profile].label : 'Кассета'}: ${modeTitles[effectiveMode]}`}</title>
      <desc id={`${prefix}-description`}>{source} {effectiveMode === 'single' ? 'Одна цельная кассета с исходными бортами и толщиной.' : `${axis === 'horizontal' ? 'Два экземпляра по горизонтали.' : 'Два экземпляра по вертикали.'} Шов ${input.jointMm} мм задан между лицевыми габаритами. ${coordinationNotice}`} {effectiveMode === 'exploded' ? 'Цельные кассеты разнесены для осмотра. Визуальное расстояние условное и не является монтажным зазором.' : ''}</desc>
      <defs><linearGradient id={`${prefix}-background`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5f8f9" /><stop offset="1" stopColor="#d8e3e7" /></linearGradient><radialGradient id={`${prefix}-shadow`}><stop stopColor="#536b76" stopOpacity=".2" /><stop offset="1" stopColor="#536b76" stopOpacity="0" /></radialGradient></defs>
      <rect width="900" height="560" fill={`url(#${prefix}-background)`} />
      <ellipse cx="450" cy="503" rx="350" ry="34" fill={`url(#${prefix}-shadow)`} />
      {!depthReady && projected.polygons.map(poly => <g key={poly.key} data-inspection-part={poly.instanceId}>
        <polygon points={poly.points.map(pointString).join(' ')} fill={cassetteInspectionColour(colour, poly.light)} stroke={cassetteInspectionColour(colour, poly.light)} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {poly.edges.length ? <path d={poly.edges.filter(edge => !edge.silhouette).map(edge => `M${pointString(edge.points[0])}L${pointString(edge.points[1])}`).join(' ')} fill="none" stroke="#263d47" strokeOpacity=".55" strokeWidth=".65" vectorEffect="non-scaling-stroke" /> : null}
        {poly.edges.some(edge => edge.silhouette) ? <path d={poly.edges.filter(edge => edge.silhouette).map(edge => `M${pointString(edge.points[0])}L${pointString(edge.points[1])}`).join(' ')} fill="none" stroke="#213741" strokeOpacity=".8" strokeWidth="1.05" vectorEffect="non-scaling-stroke" /> : null}
      </g>)}
      <CassetteDepthSurface polygons={projected.polygons} colour={colour} onAvailability={setDepthReady} />
      {effectiveMode === 'neighbours' && length > 8 ? <g aria-hidden="true" data-seam-reference="face-envelopes" fill="none" stroke="#36515c" strokeWidth="1" vectorEffect="non-scaling-stroke">
        {seam.map((point, index) => <line key={index} x1={point[0]} y1={point[1]} x2={dimension[index][0] + normal[0] * 5} y2={dimension[index][1] + normal[1] * 5} strokeOpacity=".65" />)}
        <line x1={dimension[0][0]} y1={dimension[0][1]} x2={dimension[1][0]} y2={dimension[1][1]} />
        {dimension.map((point, index) => <line key={index} x1={point[0] - normal[0] * 5} y1={point[1] - normal[1] * 5} x2={point[0] + normal[0] * 5} y2={point[1] + normal[1] * 5} />)}
      </g> : null}
      {effectiveMode === 'exploded' && second ? <line aria-hidden="true" data-illustrative-separation="true" x1={projected.project(centre)[0]} y1={projected.project(centre)[1]} x2={projected.project([centre[0], centre[1], second.offset[2]])[0]} y2={projected.project([centre[0], centre[1], second.offset[2]])[1]} stroke="#476878" strokeDasharray="6 6" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
    {!depthReady ? <p className="mt-2 text-xs text-[#52636b]">Упрощённый показ поверхностей. Для проверки формы используйте исходную модель IFC.</p> : null}
    <p className="mt-3 text-sm leading-6 text-[#4d6066]">{source} Геометрия деталей совпадает с IFC; ракурс и разнос меняют только показ.</p>
    {input.profile === 'corner' ? <p className="mt-2 text-sm leading-6 text-[#6b4e20]">Показана одна угловая кассета. Узел её примыкания не подтверждён исходными моделями.</p> : null}
    {effectiveMode !== 'single' ? <p className="mt-2 rounded-lg border border-[#dac69f] bg-[#fff9ed] px-3 py-2 text-sm leading-6 text-[#674a1e]">{coordinationNotice} {effectiveMode === 'exploded' ? 'Разнос условный, только для осмотра; это не монтажный зазор.' : 'Шов измеряется между лицевыми габаритами, а не между бортами.'}</p> : null}
  </figure>;
}

export function CassetteBimShapePreview({ input, colour = '#a8b5b9' }: { input: CassetteBimInput; colour?: string }) {
  const [yaw, setYaw] = useState(145), [pitch, setPitch] = useState(20);
  const [mode, setMode] = useState<CassetteInspectionMode>('single'), [axis, setAxis] = useState<CassetteInspectionAxis>('horizontal');
  const canPair = canInspectCassetteNeighbours(input), effectiveMode = canPair ? mode : 'single';
  const buttonClass = 'min-h-11 rounded-md border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cf5c22]';
  return <section className="border-b border-[#ced8dc] p-4 sm:px-7 sm:py-6" aria-label="Проверка формы кассеты">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-[#162a32]">Рассмотрите конструкцию</h3>{canPair ? <div role="group" aria-label="Режим осмотра кассет" className="flex w-full flex-wrap gap-2 sm:w-auto">{modes.map(([value, label]) => <button key={value} type="button" aria-pressed={effectiveMode === value} onClick={() => setMode(value)} className={`${buttonClass} flex-1 sm:flex-none ${effectiveMode === value ? 'border-[#cf5c22] bg-[#fff0e5] text-[#803309]' : 'border-[#bac8ce] bg-white text-[#354b54] hover:border-[#526d79]'}`}>{label}</button>)}</div> : null}</div>
    <CassetteInspectionView input={input} colour={colour} mode={effectiveMode} axis={axis} yaw={yaw} pitch={pitch} />
    <details className="mt-3 rounded-lg border border-[#ccd7dc] bg-white px-4 py-1"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#354b54] focus-visible:outline focus-visible:outline-[#cf5c22]">Ракурс и расположение</summary>
      <div className="mb-4 space-y-4">
        <div role="group" aria-label="Ракурс кассеты" className="flex flex-wrap gap-2">{([['Лицо', 0, 0], ['Обратная сторона', 180, 0], ['Объёмный вид', 145, 20], ['Профиль', 90, 0]] as const).map(([label, y, p]) => <button key={label} type="button" aria-pressed={yaw === y && pitch === p} onClick={() => { setYaw(y); setPitch(p); }} className={`${buttonClass} ${yaw === y && pitch === p ? 'border-[#cf5c22] bg-[#fff0e5] text-[#803309]' : 'border-[#bac8ce] text-[#354b54] hover:border-[#526d79]'}`}>{label}</button>)}</div>
        {canPair && effectiveMode !== 'single' ? <label className="block text-sm text-[#354b54]">Расположение соседних кассет<select aria-label="Расположение соседних кассет" value={axis} onChange={event => setAxis(event.target.value as CassetteInspectionAxis)} className="mt-2 min-h-11 w-full max-w-sm rounded-md border border-[#bac8ce] bg-white px-3 text-base"><option value="horizontal">По горизонтали</option><option value="vertical">По вертикали</option></select></label> : null}
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm text-[#354b54]">Поворот модели<input type="range" min="0" max="360" value={yaw} onChange={event => setYaw(Number(event.target.value))} className="mt-2 block min-h-11 w-full accent-[#cf5c22]" /></label><label className="block text-sm text-[#354b54]">Наклон модели<input type="range" min="-80" max="80" value={pitch} onChange={event => setPitch(Number(event.target.value))} className="mt-2 block min-h-11 w-full accent-[#cf5c22]" /></label></div>
        <p className="text-sm leading-6 text-[#52636b]">В режимах с соседними деталями показаны два экземпляра текущей кассеты. Количество в проекте не меняется. Цвет на экране приблизительный.</p>
      </div>
    </details>
    <p className="mt-3 text-sm leading-6 text-[#52636b]">{PRODUCT_CALCULATION_NOTICE}</p>
  </section>;
}
