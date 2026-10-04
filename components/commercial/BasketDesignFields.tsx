"use client";
import {
  type BasketDesign,
  type PanelPattern,
  panelPatterns,
  panelCutting,
  validBasketDesign,
} from "@/lib/quote/basket-design";
const control =
  "mt-2 block min-h-12 w-full border border-white/25 bg-[#0d1114] px-3 text-base text-white";
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
    key:
      | "blockWidth"
      | "blockHeight"
      | "blockDepth"
      | "mass"
      | "facade"
      | "offset",
    label: string,
    max: number,
  ) {
    return (
      <label className="text-sm" key={key}>
        {label}
        <input
          className={control}
          type="number"
          min="0"
          max={max}
          value={design[key] ?? ""}
          placeholder="Неизвестно"
          onChange={(e) =>
            onChange({
              ...design,
              [key]:
                e.target.value === ""
                  ? key === "facade" || key === "offset"
                    ? null
                    : 0
                  : Number(e.target.value),
            })
          }
        />
      </label>
    );
  }
  function panel(key: "front" | "side", title: string) {
    const p = design[key];
    const set = (patch: Partial<PanelPattern>) =>
      onChange({ ...design, [key]: { ...p, ...patch } });
    return (
      <fieldset className="mt-5 border border-white/20 p-4">
        <legend className="px-2 font-semibold">{title}</legend>
        <label className="text-sm">
          Рисунок
          <select
            className={control}
            value={p.pattern}
            onChange={(e) =>
              set({
                pattern: e.target.value as PanelPattern["pattern"],
                pitch: Math.max(p.pitch, p.slotLength + 5),
              })
            }
          >
            {Object.entries(panelPatterns).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {["round", "slots"].includes(p.pattern) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              [
                {
                  key: "diameter",
                  label:
                    p.pattern === "slots"
                      ? "Ширина отверстия, мм"
                      : "Диаметр, мм",
                },
                { key: "slotLength", label: "Длина отверстия, мм" },
                { key: "pitch", label: "Шаг по осям, мм" },
                { key: "margin", label: "Поле от края, мм" },
              ] as const
            )
              .filter((f) => p.pattern === "slots" || f.key !== "slotLength")
              .map((f) => (
                <label key={f.key} className="text-sm">
                  {f.label}
                  <input
                    className={control}
                    type="number"
                    value={p[f.key]}
                    min={f.key === "margin" ? 0 : 1}
                    onChange={(e) =>
                      set({
                        [f.key]: Number(e.target.value),
                        ...(f.key === "diameter"
                          ? {
                              slotLength: Math.max(
                                p.slotLength,
                                Number(e.target.value),
                              ),
                            }
                          : {}),
                      })
                    }
                  />
                </label>
              ))}
          </div>
        )}
      </fieldset>
    );
  }
  if (step === 1)
    return (
      <div>
        <h3 className="text-xl font-semibold">Блок и крепление</h3>
        <p className="mt-3 text-sm text-white/75">
          Данные с шильдика или чертежа. Неизвестные размеры можно оставить
          пустыми — подбор согласуем.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {number("blockWidth", "Ширина блока, мм", 10000)}
          {number("blockHeight", "Высота блока, мм", 10000)}
          {number("blockDepth", "Глубина блока, мм", 10000)}
          {number("mass", "Масса блока, кг", 2000)}
        </div>
        <label className="mt-5 block text-sm">
          На чём стоит кондиционер?
          <select
            className={control}
            value={design.mount}
            onChange={(e) =>
              onChange({
                ...design,
                mount: e.target.value as BasketDesign["mount"],
              })
            }
          >
            <option value="unknown">Нужно уточнить</option>
            <option value="existing">Есть отдельные опоры, нужен экран</option>
            <option value="bearing">Нужны несущие кронштейны</option>
          </select>
        </label>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {number("facade", "Толщина фасада от стены, мм", 2000)}
          {number("offset", "Отступ от облицовки, мм", 2000)}
        </div>
        <p className="mt-4 text-sm text-white/75">
          Несущая стена → фасад → отступ → корзина. Сумма первых двух расстояний
          не равна полной длине кронштейна. Сечение, толщину и анкеры подбираем
          с учётом нагрузки и основания.
        </p>
      </div>
    );
  if (step === 2)
    return (
      <div>
        <h3 className="text-xl font-semibold">Перфорация панелей</h3>
        <p className="mt-3 text-sm text-white/75">
          Расчёт для прямых рядов отверстий на прямоугольных полях. Начальные
          параметры — пример рисунка, а не утверждённая конструкция.
        </p>
        {panel("front", "Передняя панель")}
        {panel("side", "Две боковые панели")}
        <button
          type="button"
          className="mt-4 min-h-11 underline underline-offset-4"
          onClick={() => onChange({ ...design, side: { ...design.front } })}
        >
          Применить передний рисунок к боковым
        </button>
      </div>
    );
  if (step !== 3) return null;
  const valid =
    validBasketDesign(design) &&
    [width, height, depth, quantity].every(
      (n) => Number.isFinite(n) && n >= 1 && n <= 10000,
    );
  const front = valid ? panelCutting(width, height, design.front) : null;
  const side = valid ? panelCutting(depth, height, design.side) : null;
  return (
    <div>
      <h3 className="text-xl font-semibold">Результат подбора</h3>
      <p className="mt-3 text-sm text-white/75">
        {width} × {height} × {depth} мм · {quantity} шт.
      </p>
      {front && side ? (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-white/70">Отверстия, 3 панели</dt>
              <dd className="mt-1 text-xl">
                {front.known && side.known
                  ? (front.holes + 2 * side.holes).toLocaleString("ru-RU")
                  : "По чертежу"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Рез, 3 панели</dt>
              <dd className="mt-1 text-xl">
                {front.known && side.known
                  ? `${(front.cutLengthM + 2 * side.cutLengthM).toFixed(2)} м`
                  : "По чертежу"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">
                Открытая площадь спереди
              </dt>
              <dd>
                {front.known
                  ? `${front.openPercent.toFixed(1)} %`
                  : "По чертежу"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Открытая площадь сбоку</dt>
              <dd>
                {side.known ? `${side.openPercent.toFixed(1)} %` : "По чертежу"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-white/75">
            На одну корзину, включая наружные прямоугольные контуры. Без
            припусков на гибку и крепёжных вырезов. Доля отверстий не
            подтверждает достаточность вентиляции.
          </p>
          {(((design.front.pattern === "round" ||
            design.front.pattern === "slots") &&
            front.holes === 0) ||
            ((design.side.pattern === "round" ||
              design.side.pattern === "slots") &&
              side.holes === 0)) && (
            <p className="mt-3 text-orange-200">
              В выбранном поле отверстия не помещаются. Измените рисунок или
              размеры.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-orange-200">
          Проверьте размеры и рисунок: шаг должен быть больше отверстия.
        </p>
      )}
      <div className="mt-5 border border-steel-orange/50 p-4">
        <b>Стоимость — после проверки комплектации</b>
        <p className="mt-2 text-sm text-white/75">
          Кронштейны, развёртки, гибы и сборка ещё требуют подтверждения. Не
          выдаём цену трёх панелей за стоимость готовой корзины. Передайте
          задание инженеру — параметры сохранятся.
        </p>
      </div>
    </div>
  );
}
