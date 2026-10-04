"use client";
import { BasketVolumePrice } from "./BasketVolumePrice";
import { BasketCutComparison } from "./BasketCutComparison";
import { BasketFitFields, BasketFitResult } from "./BasketFitFields";
import { BasketNumberInput } from "./BasketNumberInput";
import { basketReference } from "@/lib/quote/basket-reference";
import {
  type BasketDesign,
  type PanelPattern,
  panelPatterns,
  panelCutting,
  validBasketDesign,
} from "@/lib/quote/basket-design";

const control =
  "mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 transition focus:border-steel-orange focus:outline-none focus:ring-2 focus:ring-steel-orange/20";
const panelOrder: PanelPattern["pattern"][] = ["wide-slots", "round", "slots", "lamella", "solid", "custom"];

function PatternSample({ pattern }: { pattern: PanelPattern["pattern"] }) {
  return (
    <svg viewBox="0 0 120 64" className="h-14 w-full" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="114" height="58" rx="5" fill="#dbe2e7" />
      {pattern === "wide-slots" && Array.from({ length: 10 }, (_, n) => (
        <rect key={n} x="13" y={9 + n * 5} width="94" height="2.5" rx="1.25" fill="#64748b" />
      ))}
      {pattern === "round" && Array.from({ length: 28 }, (_, n) => (
        <circle key={n} cx={18 + (n % 7) * 14} cy={14 + Math.floor(n / 7) * 12} r="3.5" fill="#64748b" />
      ))}
      {pattern === "slots" && Array.from({ length: 12 }, (_, n) => (
        <rect key={n} x={13 + (n % 3) * 33} y={11 + Math.floor(n / 3) * 12} width="27" height="5" rx="2.5" fill="#64748b" />
      ))}
      {pattern === "lamella" && Array.from({ length: 4 }, (_, n) => (
        <g key={n}>
          <path d={`M10 ${9 + n * 13} H110 L104 ${17 + n * 13} H10 Z`} fill="#9baab8" />
          <path d={`M10 ${17 + n * 13} H104`} stroke="#64748b" strokeWidth="2" />
        </g>
      ))}
      {pattern === "solid" && <path d="M10 10 H110 M10 10 V54" fill="none" stroke="#f8fafc" strokeWidth="2" />}
      {pattern === "custom" && (
        <g fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 22 L34 12 L47 22 L34 34 Z M49 42 L62 32 L75 42 L62 54 Z M76 22 L89 12 L102 22 L89 34 Z" />
        </g>
      )}
    </svg>
  );
}

export function BasketDesignFields({
  step,
  design,
  onChange,
  width,
  height,
  depth,
  quantity,
}: {
  step: number;
  design: BasketDesign;
  onChange: (d: BasketDesign) => void;
  width: number;
  height: number;
  depth: number;
  quantity: number;
}) {
  function number(
    key: "blockWidth" | "blockHeight" | "blockDepth" | "mass" | "facade" | "offset",
    label: string,
    max: number,
  ) {
    return (
      <label className="text-sm font-medium text-slate-700" key={key}>
        {label}
        <BasketNumberInput
          className={control}
          min={0}
          max={max}
          value={design[key] === 0 && key !== "facade" && key !== "offset" ? null : design[key]}
          emptyValue={key === "facade" || key === "offset" ? null : 0}
          placeholder="Неизвестно"
          onValue={(value) => onChange({ ...design, [key]: value })}
        />
      </label>
    );
  }
  function panel(key: "front" | "side", title: string) {
    const p = design[key];
    const set = (patch: Partial<PanelPattern>) => onChange({ ...design, [key]: { ...p, ...patch } });
    return (
      <fieldset className="mt-7 min-w-0">
        <legend className="font-semibold text-slate-800">{title}</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {panelOrder.map((pattern) => (
            <button
              key={pattern}
              type="button"
              aria-pressed={p.pattern === pattern}
              onClick={() => {
                const bounded = (value:number, min:number, max:number, fallback:number) => Number.isFinite(value) && value >= min && value <= max ? value : fallback;
                const diameter = bounded(p.diameter, 1, 500, 10);
                const slotLength = bounded(p.slotLength, diameter, 1000, Math.max(30, diameter));
                set({ pattern, diameter, slotLength, margin: bounded(p.margin, 0, 1000, 20),
                  pitch: Math.max(bounded(p.pitch, 1, 2000, 20), (pattern === "slots" ? slotLength : diameter) + 5) });
              }}
              className={`min-h-28 rounded-xl border p-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange ${p.pattern === pattern ? "border-steel-orange bg-orange-50 ring-1 ring-steel-orange" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}
            >
              <PatternSample pattern={pattern} />
              <span className="mt-2 block text-xs font-semibold leading-5 text-slate-800">{panelPatterns[pattern]}</span>
            </button>
          ))}
        </div>
        {["round", "slots"].includes(p.pattern) && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Параметры рисунка</summary>
            <p className="mt-2 text-xs leading-5 text-slate-600">Настройте размер отверстий и расстояние между их центрами.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([
                { key: "diameter", label: p.pattern === "slots" ? "Ширина отверстия, мм" : "Диаметр, мм" },
                { key: "slotLength", label: "Длина отверстия, мм" },
                { key: "pitch", label: "Шаг по осям, мм" },
                { key: "margin", label: "Поле от края, мм" },
              ] as const).filter((f) => p.pattern === "slots" || f.key !== "slotLength").map((f) => (
                <label key={f.key} className="text-sm text-slate-700">
                  {f.label}
                  <BasketNumberInput
                    className={control}
                    value={p[f.key]}
                    min={f.key === "margin" ? 0 : 1}
                    max={f.key === "diameter" ? 500 : f.key === "pitch" ? 2000 : 1000}
                    onValue={(value) => set({
                      [f.key]: value ?? NaN,
                      ...(f.key === "diameter" && Number.isFinite(value) ? {
                        slotLength: Math.max(Number.isFinite(p.slotLength) ? p.slotLength : 0, value!),
                      } : {}),
                    })}
                  />
                </label>
              ))}
            </div>
          </details>
        )}
        {p.pattern === "wide-slots" && <p className="mt-3 text-sm leading-6 text-slate-600">10 прорезей на панель; ширина и краевые отступы уточняются по чертежу.</p>}
        {p.pattern === "custom" && <p className="mt-3 text-sm leading-6 text-slate-600">Рисунок и стоимость изготовления уточним по вашему эскизу или чертежу.</p>}
        {p.pattern === "lamella" && <p className="mt-3 text-sm leading-6 text-slate-600">Профиль и шаг ламелей уточняются при подготовке конструкции.</p>}
        {p.pattern === "solid" && <p className="mt-3 text-sm leading-6 text-slate-600">Сплошная панель требует отдельной проверки воздухообмена.</p>}
      </fieldset>
    );
  }
  if (step === 1) return (
    <div className="text-slate-800">
      <h3 className="text-xl font-semibold">Блок и крепление</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Укажите известные данные из паспорта кондиционера. Остальное можно уточнить с инженером.</p>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {number("blockWidth", "Ширина блока, мм", 10000)}
        {number("blockHeight", "Высота блока, мм", 10000)}
        {number("blockDepth", "Глубина блока, мм", 10000)}
        {number("mass", "Масса блока, кг", 2000)}
      </div>
      <label className="mt-5 block text-sm font-medium text-slate-700">
        На чём стоит кондиционер?
        <select aria-label="На чём стоит кондиционер?" className={control} value={design.mount} onChange={(e) => onChange({ ...design, mount: e.target.value as BasketDesign["mount"] })}>
          <option value="unknown">Нужно уточнить</option>
          <option value="existing">Есть кронштейны блока, нужна корзина</option>
          <option value="bearing">Нужны несущие кронштейны</option>
        </select>
      </label>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {number("facade", "Толщина фасада от стены, мм", 2000)}
        {number("offset", "Отступ от облицовки, мм", 2000)}
      </div>
      <BasketFitFields value={design.fit} onChange={(fit) => onChange({ ...design, fit })} />
      <p className="mt-4 text-xs leading-5 text-slate-600">Толщина фасада и отступ помогают определить вылет крепления. Сечение, толщину металла и анкеры проверяем по нагрузке и основанию.</p>
    </div>
  );
  if (step === 2) return (
    <div className="text-slate-800">
      <h3 className="text-xl font-semibold">Исполнение панелей</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Выберите рисунок отдельно для передней и боковых панелей. Его параметры можно уточнить ниже.</p>
      {panel("front", "Передняя панель")}
      <details className="mt-5 rounded-xl border border-slate-200 p-4">
        <summary className="text-sm font-semibold">Боковые панели · {panelPatterns[design.side.pattern]}</summary>
        {panel("side", "Две боковые панели")}
      </details>
      <button type="button" className="mt-4 min-h-11 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950" onClick={() => onChange({ ...design, side: { ...design.front } })}>
        Применить передний рисунок к боковым
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-600">Образцы показывают характер рисунка. Начальные параметры — ориентир; вентиляцию и конструкцию проверяем по выбранному кондиционеру.</p>
    </div>
  );
  if (step !== 3) return null;
  const valid = validBasketDesign(design) && [width, height, depth, quantity].every((n) => Number.isFinite(n) && n >= 1 && n <= 10000);
  const front = valid ? panelCutting(width, height, design.front) : null;
  const side = valid ? panelCutting(depth, height, design.side) : null;
  const emptyPattern = front && side && (((design.front.pattern === "round" || design.front.pattern === "slots") && front.holes === 0) || ((design.side.pattern === "round" || design.side.pattern === "slots") && side.holes === 0));
  return (
    <div className="text-slate-800">
      <h3 className="text-xl font-semibold">Ваша корзина</h3>
      <p className="mt-2 text-sm text-slate-600">{width} × {height} × {depth} мм · {quantity} шт.</p>
      <p className="mt-3 text-sm text-slate-600">Передняя и две боковые панели. Без верхней крышки. Корзина закрепляется на кронштейнах наружного блока; задние отгибы не крепятся к стене.</p>
      <dl className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-600">Передняя панель</dt><dd className="font-medium">{panelPatterns[design.front.pattern]}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-600">Боковые панели</dt><dd className="font-medium">{panelPatterns[design.side.pattern]}</dd></div>
        <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-600">Крепление</dt><dd className="font-medium">{design.mount === "existing" ? "На кронштейнах блока" : design.mount === "bearing" ? "Нужны несущие кронштейны" : "Уточнить с инженером"}</dd></div>
      </dl>
      {!valid && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-900" role="status">Проверьте размеры и рисунок: шаг должен быть больше отверстия.</p>}
      {emptyPattern && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-900" role="status">В выбранном поле отверстия не помещаются. Измените рисунок или размеры.</p>}
      <BasketVolumePrice quantity={quantity} width={width} height={height} depth={depth} design={design} />
      <p className="mt-4 text-sm leading-6 text-slate-600">Габариты, вентиляцию и крепления проверим перед изготовлением. Индивидуальный рисунок и несущие кронштейны уточняются при согласовании комплектации.</p>
      <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Технические данные и проверка размеров</summary>
        {front && side && (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-600">Отверстия, 3 панели</dt><dd className="mt-1 text-lg font-semibold">{front.known && side.known ? (front.holes + 2 * side.holes).toLocaleString("ru-RU") : "По чертежу"}</dd></div>
              <div><dt className="text-slate-600">Рез, 3 панели</dt><dd className="mt-1 text-lg font-semibold">{front.known && side.known ? `${(front.cutLengthM + 2 * side.cutLengthM).toFixed(2)} м` : "По чертежу"}</dd></div>
              <div><dt className="text-slate-600">Открытая площадь спереди</dt><dd className="mt-1 font-medium">{front.known ? `${front.openPercent.toFixed(1)} %` : "По чертежу"}</dd></div>
              <div><dt className="text-slate-600">Открытая площадь сбоку</dt><dd className="mt-1 font-medium">{side.known ? `${side.openPercent.toFixed(1)} %` : "По чертежу"}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-600">На одну корзину, включая наружные прямоугольные контуры. Без припусков на гибку и крепёжных вырезов. Доля отверстий не подтверждает достаточность вентиляции.</p>
          </>
        )}
        <BasketCutComparison design={design} width={width} height={height} depth={depth} quantity={quantity} />
        <BasketFitResult fit={design.fit} width={width} height={height} depth={depth} />
        <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">Состав производственного образца 1180 × 630 × 510 мм</summary>
          <p className="mt-3 text-sm leading-6 text-slate-600">По сборочному чертежу. Образец состава не подтверждает пригодность для выбранного блока или фасада. При изменении размеров и крепления состав пересматривается.</p>
          <ul className="mt-3 space-y-2 text-sm">{basketReference.parts.map((part) => <li key={part.name}>{part.name}: {part.quantity} шт. · оцинкованная сталь {part.thicknessMm} мм</li>)}</ul>
          <p className="mt-3 text-sm leading-6 text-slate-600">Крепёж по сборке: {basketReference.fasteners.map((p) => `${p.name} — ${p.quantity} шт.`).join("; ")}. Анкеры основания подбираются отдельно.</p>
        </details>
      </details>
    </div>
  );
}
