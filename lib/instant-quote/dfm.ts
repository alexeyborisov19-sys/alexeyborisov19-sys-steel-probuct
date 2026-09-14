import { laserCuttingCapabilities } from "@/data/manufacturing-facts";

export type DfmSeverity = "pass" | "warning" | "error" | "manual";

export type DfmResult = {
  code: string;
  title: string;
  detail: string;
  severity: DfmSeverity;
};

export type DfmGeometryInput = {
  width: number;
  height: number;
  units: string;
};

function parseMmRange(value: string) {
  const matches = value.match(/([0-9]+(?:[,.][0-9]+)?)\s*[–-]\s*([0-9]+(?:[,.][0-9]+)?)/);
  if (!matches) return null;
  return {
    min: Number(matches[1].replace(",", ".")),
    max: Number(matches[2].replace(",", ".")),
  };
}

function parseTable(value: string) {
  const matches = value.match(/([0-9]+)\s*[×x]\s*([0-9]+)/i);
  if (!matches) return null;
  return {
    short: Math.min(Number(matches[1]), Number(matches[2])),
    long: Math.max(Number(matches[1]), Number(matches[2])),
  };
}

export function runVerifiedLaserDfm(
  geometry: DfmGeometryInput,
  thicknessMm: number,
  materialId: string = "hot",
): DfmResult[] {
  const results: DfmResult[] = [];
  const range = parseMmRange(laserCuttingCapabilities.thicknessRange);
  const table = parseTable(laserCuttingCapabilities.tableWorkingArea);

  if (geometry.units !== "мм") {
    results.push({
      code: "units-review",
      title: "Проверьте единицы CAD",
      detail: geometry.units === "не указаны"
        ? "В DXF не указаны единицы измерения. Перед расчётом их должен подтвердить пользователь или технолог."
        : `Файл использует единицы «${geometry.units}». Для автоматической проверки габаритов требуется нормализация в миллиметры.`,
      severity: "manual",
    });
    return results;
  }

  const isConfirmedBlackSteel = materialId === "hot" || materialId === "cold";
  if (range && isConfirmedBlackSteel) {
    results.push(
      thicknessMm >= range.min && thicknessMm <= range.max
        ? {
            code: "thickness",
            title: "Толщина в подтверждённом диапазоне",
            detail: `Для лазерной резки чёрной стали на сайте подтверждён диапазон ${laserCuttingCapabilities.thicknessRange}.`,
            severity: "pass",
          }
        : {
            code: "thickness",
            title: "Толщина вне подтверждённого диапазона",
            detail: `Подтверждённый диапазон лазерной резки чёрной стали: ${laserCuttingCapabilities.thicknessRange}.`,
            severity: "error",
          },
    );
  } else if (!isConfirmedBlackSteel) {
    results.push({
      code: "material-thickness-review",
      title: "Диапазон материала требует подтверждения",
      detail: "Для выбранного материала пока не заведена отдельная подтверждённая таблица допустимых толщин. Программа не переносит нормы чёрной стали автоматически.",
      severity: "manual",
    });
  }

  if (table) {
    const a = Math.min(geometry.width, geometry.height);
    const b = Math.max(geometry.width, geometry.height);
    results.push(
      a <= table.short && b <= table.long
        ? {
            code: "table",
            title: "Деталь помещается в рабочее поле",
            detail: `Габарит детали ${geometry.width.toFixed(1)} × ${geometry.height.toFixed(1)} мм; подтверждённое рабочее поле ${laserCuttingCapabilities.tableWorkingArea}.`,
            severity: "pass",
          }
        : {
            code: "table",
            title: "Габарит превышает рабочее поле",
            detail: `Габарит детали ${geometry.width.toFixed(1)} × ${geometry.height.toFixed(1)} мм; подтверждённое рабочее поле ${laserCuttingCapabilities.tableWorkingArea}.`,
            severity: "error",
          },
    );
  }

  results.push({
    code: "feature-rules",
    title: "Feature-проверки требуют технологической базы",
    detail: "Минимальные отверстия, перемычки, радиусы, зоны гиба и инструмент не проверяются, пока для них не заведены подтверждённые производственные нормы.",
    severity: "manual",
  });

  return results;
}
