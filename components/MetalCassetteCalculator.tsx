"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const cassette = {
  widthMm: 1170,
  heightMm: 545,
  rustMm: 20,
};

const thicknesses = ["0,5", "0,7", "1,0", "1,2"] as const;

const moduleWidthMm = cassette.widthMm + cassette.rustMm;
const moduleHeightMm = cassette.heightMm + cassette.rustMm;
const moduleArea = (moduleWidthMm / 1000) * (moduleHeightMm / 1000);

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const areaFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function MetalCassetteCalculator() {
  const [areaInput, setAreaInput] = useState("100");
  const [selectedThickness, setSelectedThickness] = useState<(typeof thicknesses)[number]>("0,5");

  const result = useMemo(() => {
    const parsedArea = Number(areaInput.trim().replace(/\s+/g, "").replace(",", "."));
    const area = Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : 0;
    const quantity = area > 0 ? Math.ceil(area / moduleArea) : 0;

    return {
      area,
      quantity,
    };
  }, [areaInput]);

  const specialistHref = result.area > 0
    ? {
        pathname: "/contacts",
        query: {
          source: "calculator-metallokassety",
          area: String(result.area),
          thickness: selectedThickness,
          quantity: String(result.quantity),
        },
        hash: "contact-form",
      }
    : "/contacts#contact-form";

  return (
    <section id="calculator-metallokasset" className="mt-16 scroll-mt-24 overflow-hidden border border-steel-orange/35 bg-[#101417]">
      <div className="grid min-w-0 lg:grid-cols-[1.02fr_.98fr]">
        <div className="relative min-w-0 border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 bg-[linear-gradient(135deg,transparent_49%,rgba(224,86,36,.26)_50%,transparent_51%)]" />
          <p className="eyebrow">Предварительный расчёт</p>
          <h2 className="mt-3 max-w-xl text-2xl font-semibold uppercase leading-tight sm:text-3xl">
            Калькулятор металлокассет
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/62">
            Укажите площадь фасада и предполагаемую толщину металла. Калькулятор определит ориентировочное количество кассет, а исходные данные можно сразу передать специалисту для коммерческого расчёта.
          </p>

          <div className="mt-7 border border-white/12 bg-[#0c1013] p-4 sm:p-5">
            <label htmlFor="facade-area" className="text-xs font-bold uppercase tracking-[.12em] text-white/60">
              Площадь фасада
            </label>
            <div className="mt-3 flex items-stretch">
              <input
                id="facade-area"
                type="text"
                inputMode="decimal"
                value={areaInput}
                onChange={(event) => setAreaInput(event.target.value)}
                placeholder="Например, 100"
                aria-describedby="facade-area-help"
                className="min-w-0 flex-1 border border-white/20 bg-[#111519] px-4 py-4 text-2xl font-semibold text-white outline-none transition placeholder:text-white/20 focus:border-steel-orange"
              />
              <span className="flex min-w-16 items-center justify-center border-y border-r border-white/20 bg-white/[.035] text-sm font-bold text-steel-orange">
                м²
              </span>
            </div>
            <p id="facade-area-help" className="mt-2 text-xs leading-5 text-white/40">
              Введите общую площадь облицовываемой поверхности без вычета рустов.
            </p>
          </div>

          <fieldset className="mt-6 min-w-0">
            <legend className="text-xs font-bold uppercase tracking-[.12em] text-white/60">
              Предполагаемая толщина металла
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {thicknesses.map((thickness) => {
                const isSelected = selectedThickness === thickness;

                return (
                  <button
                    key={thickness}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedThickness(thickness)}
                    className={`min-w-0 border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-steel-orange bg-steel-orange text-white"
                        : "border-white/15 bg-[#0c1013] text-white hover:border-steel-orange/70"
                    }`}
                  >
                    <span className="block text-lg font-semibold">{thickness} мм</span>
                    <span className={`mt-1 block text-xs font-bold uppercase tracking-[.08em] ${isSelected ? "text-white/75" : "text-white/40"}`}>
                      Передадим в заявку
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-7 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-[#0c1013] p-4">
              <p className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Кассета</p>
              <p className="mt-2 text-sm font-semibold">1170 × 545 мм</p>
            </div>
            <div className="bg-[#0c1013] p-4">
              <p className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Руст</p>
              <p className="mt-2 text-sm font-semibold">20 × 20 мм</p>
            </div>
            <div className="bg-[#0c1013] p-4">
              <p className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Расчётный модуль</p>
              <p className="mt-2 text-sm font-semibold">1190 × 565 мм</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col bg-[radial-gradient(circle_at_100%_0%,rgba(224,86,36,.13),transparent_42%)] p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-white/12 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-steel-orange">Результат</p>
              <p className="mt-1 text-xs text-white/45">Ориентировочное количество</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center border border-steel-orange/50 text-2xl text-steel-orange">Σ</span>
          </div>

          <div className="mt-7">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-white/45">
              Металлокассеты
            </p>
            <p aria-live="polite" className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {result.quantity > 0 ? `≈ ${numberFormatter.format(result.quantity)} шт.` : "—"}
            </p>
            <p className="mt-3 text-xs leading-5 text-white/45">
              Количество рассчитано по модулю 1190 × 565 мм. Точная раскладка определяется по геометрии фасада, проёмам, углам и рабочей документации.
            </p>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="bg-[#0d1114] p-4">
              <dt className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Площадь для оценки</dt>
              <dd className="mt-2 text-2xl font-semibold text-steel-orange">
                {result.area > 0 ? `${areaFormatter.format(result.area)} м²` : "—"}
              </dd>
            </div>
            <div className="bg-[#0d1114] p-4">
              <dt className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Предполагаемая толщина</dt>
              <dd className="mt-2 text-2xl font-semibold">{selectedThickness} мм</dd>
            </div>
            <div className="bg-[#0d1114] p-4">
              <dt className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Расчётный модуль</dt>
              <dd className="mt-2 text-lg font-semibold">1190 × 565 мм</dd>
            </div>
            <div className="bg-[#0d1114] p-4">
              <dt className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Коммерческая стоимость</dt>
              <dd className="mt-2 text-lg font-semibold">После проверки проекта</dd>
            </div>
          </dl>

          <p className="mt-5 text-[13px] leading-5 text-white/38">
            Расчёт количества носит предварительный характер. Коммерческая стоимость формируется после проверки раскладки, проёмов, углов, материала, покрытия, доборных элементов и объёма партии.
          </p>

          <Link
            href={specialistHref}
            className="clip-corner mt-7 inline-flex max-w-full justify-center break-words bg-steel-orange-deep px-7 py-4 text-center text-sm font-bold uppercase leading-snug transition hover:bg-steel-orange-deeper"
          >
            Передать специалисту для расчёта&nbsp; →
          </Link>
          <p className="mt-3 text-center text-[13px] leading-5 text-white/45">
            На следующем шаге можно прикрепить PDF, DXF, DWG, STEP, изображения и архивы.
          </p>
        </div>
      </div>
    </section>
  );
}
