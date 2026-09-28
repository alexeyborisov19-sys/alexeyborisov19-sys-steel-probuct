// URL parameters are editable customer inputs, never an authoritative quote.
export function cassetteHandoffSummary(params: URLSearchParams): string {
  const number = (key: string, allowZero = false) => {
    const raw = params.get(key);
    if (!raw || raw.length > 24 || !/^\d+(?:\.\d+)?$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value <= 1e12 && (allowZero ? value >= 0 : value > 0)
      ? raw.replace(".", ",") : null;
  };
  const type = params.get("type") === "closed" ? "Закрытая" : params.get("type") === "open" ? "Открытая" : null;
  const wall = params.get("mode") === "wall";
  const width = number("wallWidth"), height = number("wallHeight"), openings = number("openings", true);
  const area = number("area"), inputArea = number("inputArea"), quantity = number("quantity");
  const thickness = ["0.65", "0.7", "1.0", "1.2"].includes(params.get("thickness") ?? "") ? number("thickness") : null;
  return [
    "Прошу выполнить точный расчёт металлокассет по приложенным исходным данным.",
    type ? `Тип кассеты: ${type}.` : "",
    wall ? "Способ расчёта: по стене." : params.get("mode") === "area" ? "Способ расчёта: по площади." : "",
    wall && width && height ? `Размер стены: ${width}×${height} мм.` : "",
    wall && openings !== null ? `Проёмы: ${openings} м².` : "",
    area ? `Площадь облицовки${wall ? " за вычетом проёмов" : ""}: ${area} м².` : !wall && inputArea ? `Заданная площадь: ${inputArea} м².` : "",
    "Размер кассеты: 1170×545 мм. Руст: 20×20 мм.",
    thickness ? `Выбранная толщина металла: ${thickness} мм.` : "",
    quantity ? `Ориентировочное количество по калькулятору: ≈ ${quantity} шт.` : "Расчёт количества ещё не получен.",
    "Параметры переданы клиентом; необходима проверка специалистом и итоговое коммерческое предложение.",
  ].filter(Boolean).join("\n");
}
