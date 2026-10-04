"use client";
import { useRef, useState } from "react";
import {
  type BasketBrief,
  basketBriefSummary,
  basketBriefHref,
} from "@/lib/quote/basket-brief";
import {
  serializeBasketProject,
  parseBasketProject,
  MAX_BASKET_POSITIONS,
} from "@/lib/quote/basket-project";
export function BasketSpecification({
  items,
  onChange,
  onEdit,
}: {
  items: BasketBrief[];
  onChange: (v: BasketBrief[]) => void;
  onEdit: (v: BasketBrief, index: number) => void;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const latestItems = useRef(items);
  latestItems.current = items;
  const [message, setMessage] = useState("");
  function download(name: string, text: string) {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      aria-labelledby="basket-spec-title"
      className="border-t border-white/20 bg-[#111519] p-5 sm:p-9 lg:col-span-2"
    >
      <h3 id="basket-spec-title" className="text-xl font-semibold">
        Спецификация корзин
      </h3>
      <p className="mt-2 text-sm text-white/75">
        Добавляйте разные размеры и рисунки по одному. До 100 позиций. Сохраните
        файл, чтобы позднее открыть его здесь; данные не сохраняются
        автоматически.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 border border-white/25 px-4"
          onClick={() => upload.current?.click()}
        >
          Открыть спецификацию
        </button>
        <button
          type="button"
          disabled={!items.length}
          className="min-h-11 border border-white/25 px-4 disabled:opacity-40"
          onClick={() =>
            download("Корзины.baskets.json", serializeBasketProject(items))
          }
        >
          Сохранить файл
        </button>
        <button
          type="button"
          disabled={!items.length}
          className="min-h-11 border border-white/25 px-4 disabled:opacity-40"
          onClick={() =>
            download(
              "Задание-корзины-все.txt",
              items
                .map(
                  (x, i) =>
                    `ПОЗИЦИЯ ${i + 1}\n${basketBriefSummary(new URL(basketBriefHref(x), "https://www.steelprodukt.ru").searchParams)}`,
                )
                .join("\n\n"),
            )
          }
        >
          Скачать общее задание
        </button>
        <input
          ref={upload}
          type="file"
          accept=".json"
          className="hidden"
          aria-label="Файл спецификации корзин"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              if (f.size > 200000)
                throw Error("Размер файла превышает 200 КБ.");
              const added = parseBasketProject(
                (await f.text()).replace(/^\uFEFF/, ""),
              );
              if (
                latestItems.current.length + added.length >
                MAX_BASKET_POSITIONS
              )
                throw Error("Общий предел — 100 позиций.");
              onChange([...latestItems.current, ...added]);
              setMessage(`Добавлено позиций из файла: ${added.length}.`);
            } catch (err) {
              setMessage(
                err instanceof Error
                  ? err.message
                  : "Не удалось прочитать файл.",
              );
            }
          }}
        />
      </div>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
      {items.length ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Состав заказа корзин</caption>
              <thead>
                <tr>
                  {["№", "Ш × В × Г, мм", "Количество", "RAL", "Действия"].map(
                    (x) => (
                      <th
                        className="whitespace-nowrap border-b border-white/20 p-3"
                        key={x}
                      >
                        {x}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((x, i) => (
                  <tr key={i}>
                    <td className="p-3">{i + 1}</td>
                    <td className="whitespace-nowrap p-3">
                      {x.width} × {x.height} × {x.depth}
                    </td>
                    <td className="p-3">{x.quantity}</td>
                    <td className="p-3">{x.ral}</td>
                    <td className="flex gap-2 p-3">
                      <button
                        type="button"
                        className="min-h-11 underline"
                        onClick={() => onEdit(x, i)}
                        aria-label={`Изменить позицию ${i + 1}`}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="min-h-11 underline"
                        disabled={items.length >= MAX_BASKET_POSITIONS}
                        onClick={() => onChange([...items, structuredClone(x)])}
                        aria-label={`Копировать позицию ${i + 1}`}
                      >
                        Копия
                      </button>
                      <button
                        type="button"
                        className="min-h-11 underline"
                        onClick={() =>
                          onChange(items.filter((_, n) => n !== i))
                        }
                        aria-label={`Удалить позицию ${i + 1}`}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-semibold">
            Всего корзин: {items.reduce((n, x) => n + x.quantity, 0)} · Позиций:{" "}
            {items.length}
          </p>
        </>
      ) : (
        <p className="mt-4 text-white/70">
          Задайте параметры выше и нажмите «Добавить в спецификацию».
        </p>
      )}
    </section>
  );
}
