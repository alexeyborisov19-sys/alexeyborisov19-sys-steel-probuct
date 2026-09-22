import { laserCuttingCapabilities, laserFeatureNorms } from "@/data/manufacturing-facts";

import { validateVerifiedFlatFeatures, type VerifiedFlatFeatures } from "./verified-flat-features";

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
  materialId: string = "unknown",
  features?: VerifiedFlatFeatures,
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
  } else {
    results.push({
      code: "material-thickness-review",
      title: "Диапазон материала требует подтверждения",
      detail: "Для выбранного материала программа пока не применяет диапазон толщин чёрной стали автоматически. Материал и толщина должны быть подтверждены технологической базой.",
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

  if (features) {
    const validation = validateVerifiedFlatFeatures(features, {
      ...laserFeatureNorms, materialId, thicknessMm,
      minHoleDiameterMm: thicknessMm * laserFeatureNorms.minHoleDiameterThicknessRatio,
    }, { materialId, thicknessMm });
    results.push({ code: "feature-rules", severity: validation.status === "pass" ? "pass" : validation.status === "blocked" ? "error" : "manual",
      title: validation.status === "pass" ? "Отверстия и перемычки соответствуют утверждённым нормам" : validation.reasons.join(" "),
      detail: `Минимальное отверстие: ${thicknessMm} мм; перемычка: ${laserFeatureNorms.minLigamentMm} мм. Отдельного минимального размера детали нет. Нормы ${laserFeatureNorms.version}.`,
    });
  } else {
    results.push({ code: "feature-rules", title: "Отверстия и перемычки требуют проверки геометрии", detail: "Нормы утверждены: отверстие не меньше толщины, перемычка не меньше 3 мм. Автоматические измерения для этого контура пока не подтверждены.", severity: "manual" });
  }

  return results;
}
