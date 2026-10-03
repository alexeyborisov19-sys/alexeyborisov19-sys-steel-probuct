"use client";

import { useState } from "react";
import { AttributionLink } from "@/components/AttributionLink";
import {
  basketBriefHref,
  basketBriefSummary,
  basketColors,
  basketScreens,
  basketSizeExamples,
  validBasketBrief,
} from "@/lib/quote/basket-brief";

export function BasketConfigurator() {
  const [dimensions, setDimensions] = useState({
    width: "1000",
    height: "700",
    depth: "550",
    quantity: "1",
  });
  const [ral, setRal] = useState("7024");
  const [screen, setScreen] = useState("round");
  const input = {
    width: Number(dimensions.width),
    height: Number(dimensions.height),
    depth: Number(dimensions.depth),
    quantity: Number(dimensions.quantity),
    ral,
    screen,
  };
  const valid = validBasketBrief(input);
  const color = basketColors.find((c) => c.ral === ral)!;
  const href = valid ? basketBriefHref(input) : "";
  const summary = valid
    ? basketBriefSummary(new URLSearchParams(href.split("?")[1].split("#")[0]))!
    : "";
  const scale = valid
    ? Math.min(275 / input.width, 220 / input.height, 110 / input.depth)
    : 0.25;
  const w = valid ? input.width * scale : 250,
    h = valid ? input.height * scale : 175,
    d = valid ? input.depth * scale * 0.65 : 70;
  const x = 85,
    y = 110;
  function download() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + summary], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Задание-корзины.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className="mt-8 grid overflow-hidden border border-white/15 lg:grid-cols-[1fr_1.05fr]"
      data-basket-configurator
    >
      <div className="flex flex-col bg-[#eef0ed] p-5 text-[#25292c] sm:p-9">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-widest">
            Эскиз вашего задания
          </span>
          <span className="border border-black/20 px-2 py-1 font-mono text-xs">
            Ш × В × Г
          </span>
        </div>
        <svg
          viewBox="0 0 480 420"
          role="img"
          aria-label={`Условная схема корзины: ${valid ? `${input.width} на ${input.height} на ${input.depth} миллиметров` : "уточните размеры"}`}
          className="my-auto w-full"
        >
          <defs>
            <pattern
              id="basket-round"
              width="13"
              height="13"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="6" cy="6" r="2.2" fill="#111" opacity=".7" />
            </pattern>
            <pattern
              id="basket-slots"
              width="17"
              height="15"
              patternUnits="userSpaceOnUse"
            >
              <rect
                x="4"
                y="4"
                width="10"
                height="3"
                fill="#111"
                opacity=".7"
              />
            </pattern>
          </defs>
          <path
            d={`M${x},${y} l${d},${-d * 0.6} h${w} v${h} l${-d},${d * 0.6}Z`}
            fill={color.hex}
            stroke="#222"
            strokeWidth="1.5"
          />
          <path
            d={`M${x + w},${y} l${d},${-d * 0.6} v${h} l${-d},${d * 0.6}Z`}
            fill="#000"
            opacity=".22"
          />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={color.hex}
            stroke="#222"
            strokeWidth="1.5"
          />
          {screen !== "custom" && (
            <rect
              x={x + 10}
              y={y + 10}
              width={Math.max(1, w - 20)}
              height={Math.max(1, h - 20)}
              fill={`url(#basket-${screen})`}
            />
          )}
          <g stroke="#60686c" fill="none">
            <path
              d={`M${x},${y + h + 18} v15 m0,-7 h${w} m0,-8 v15 M${x - 18},${y} h-15 m7,0 v${h} m-7,0 h15`}
            />
          </g>
          <g fill="#25292c" fontSize="16" fontFamily="monospace">
            <text x={x + w / 2} y={y + h + 52} textAnchor="middle">
              Ш {valid ? input.width : "—"}
            </text>
            <text
              x="25"
              y={y + h / 2}
              textAnchor="middle"
              transform={`rotate(-90 25 ${y + h / 2})`}
            >
              В {valid ? input.height : "—"}
            </text>
            <text x={x + w + d / 2} y={y - 25 - d * 0.3} textAnchor="middle">
              Г {valid ? input.depth : "—"}
            </text>
          </g>
        </svg>
        <p className="text-sm leading-6">
          Условная схема, не рабочий чертёж. Цвет на экране приблизительный.
          Крепёж, зазоры и конструкцию согласуем отдельно.
        </p>
      </div>
      <div className="bg-[#181c1f] p-5 sm:p-9">
        <h3 className="text-xl font-semibold">Задайте габариты корзины</h3>
        <p
          id="basket-size-help"
          className="mt-2 text-sm leading-6 text-white/75"
        >
          Наружные размеры, мм. Можно изменить любой размер. Это задание
          инженеру, не автоматическая проверка совместимости.
        </p>
        <div
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Примеры габаритов"
        >
          {basketSizeExamples.map((size) => (
            <button
              type="button"
              key={size.width}
              onClick={() =>
                setDimensions({
                  ...dimensions,
                  width: String(size.width),
                  height: String(size.height),
                  depth: String(size.depth),
                })
              }
              className="min-h-11 border border-white/25 px-3 py-2 font-mono text-xs hover:border-steel-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange"
            >
              {size.width} × {size.height} × {size.depth}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {(
            [
              { key: "width", label: "Ширина, мм" },
              { key: "height", label: "Высота, мм" },
              { key: "depth", label: "Глубина, мм" },
              { key: "quantity", label: "Количество, шт." },
            ] as const
          ).map((field) => (
            <label
              key={field.key}
              className="text-sm text-white/85"
              htmlFor={`basket-${field.key}`}
            >
              {field.label}
              <input
                id={`basket-${field.key}`}
                type="number"
                min="1"
                max="10000"
                step="1"
                value={dimensions[field.key]}
                aria-describedby="basket-size-help"
                onChange={(e) =>
                  setDimensions({ ...dimensions, [field.key]: e.target.value })
                }
                className="mt-2 block min-h-12 w-full border border-white/25 bg-[#0d1114] px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange"
              />
            </label>
          ))}
        </div>
        <label
          className="mt-5 block text-sm text-white/85"
          htmlFor="basket-screen"
        >
          Исполнение экрана
          <select
            id="basket-screen"
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
            className="mt-2 block min-h-12 w-full border border-white/25 bg-[#0d1114] px-3 text-base text-white"
          >
            {Object.entries(basketScreens).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="mt-5">
          <legend className="text-sm text-white/85">
            Цвет: RAL {ral} · {color.name}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {basketColors.map((c) => (
              <button
                type="button"
                key={c.ral}
                aria-label={`RAL ${c.ral}, ${c.name}`}
                aria-pressed={ral === c.ral}
                onClick={() => setRal(c.ral)}
                className={`min-h-11 min-w-11 border-2 p-1 ${ral === c.ral ? "border-steel-orange" : "border-white/25"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-white`}
              >
                <span
                  className="block h-7 w-7"
                  style={{ backgroundColor: c.hex }}
                />
              </button>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-xs leading-5 text-white/70">
          Нужен другой RAL или фактура? Укажите их в заявке. Покрытие
          подтверждается по образцу.
        </p>
        <div className="mt-6" aria-live="polite">
          {valid ? (
            <p className="font-mono text-sm">
              {input.width} × {input.height} × {input.depth} мм ·{" "}
              {input.quantity} шт.
            </p>
          ) : (
            <p className="text-sm text-orange-200">
              Введите целые положительные размеры и количество до 10 000. Это
              предел формы, не производственный допуск.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {valid ? (
            <AttributionLink
              href={href}
              className="clip-corner bg-steel-orange-deep px-5 py-4 text-center text-sm font-bold"
            >
              Передать параметры инженеру →
            </AttributionLink>
          ) : (
            <button
              disabled
              className="bg-white/10 px-5 py-4 text-sm text-white/60"
            >
              Уточните параметры
            </button>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={download}
            className="min-h-11 border border-white/25 px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Скачать задание · TXT ↓
          </button>
        </div>
      </div>
    </div>
  );
}
