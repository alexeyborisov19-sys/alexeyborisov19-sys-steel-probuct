import type { PartGeometrySummary } from "@/lib/instant-quote/domain";
import type { FactualCalculationResult } from "@/lib/instant-quote/factual-calculation";

/**
 * The AI-control layer the brief calls for (§8, §9, §11, §17, §20) is
 * deliberately NOT an LLM call: §26 requires the core math to work whether or
 * not AI is reachable, and a pass/fail judgement that only an LLM can render
 * is not reproducible — the same input could get a different verdict on a
 * different day. Every check here is a plain, deterministic, mathematically
 * or structurally grounded rule; an LLM may be layered on top later to
 * *narrate* a finding in plain Russian, but never to decide whether one
 * fires. That keeps "почему система пришла именно к этой цене" (§23)
 * answerable the same way twice.
 */

export type VerificationSeverity = "info" | "warning" | "blocking";

export type VerificationFinding = {
  code: string;
  severity: VerificationSeverity;
  /** Names the finding AND its likely cause — §11's "не скрывать проблему, определить возможную причину". */
  message: string;
};

export type VerificationReport = {
  /** false only when a "blocking" finding is present; warnings never block, only accompany the result. */
  ok: boolean;
  findings: VerificationFinding[];
};

function report(findings: VerificationFinding[]): VerificationReport {
  return { ok: !findings.some((finding) => finding.severity === "blocking"), findings };
}

const TYPICAL_SHEET_MAX_SIDE_MM = 6000;
const MIN_PLAUSIBLE_SIDE_MM = 5;

/**
 * Sanity on the geometry itself, before it is priced. The area/perimeter
 * check is not a tuned heuristic: the isoperimetric inequality guarantees
 * that any simple closed planar curve of area A has perimeter ≥ 2√(πA), with
 * equality only for a circle. Holes and re-entrant outlines only ever add
 * cut length relative to the smaller net area they leave — they can push a
 * real part's ratio up, never down past this floor. A cut length below it is
 * not an unusual part; it is geometry that cannot exist, almost always a
 * unit mix-up (mm vs cm, or an area pasted in as if it were length).
 */
export function verifyTechnicalGeometry(geometry: PartGeometrySummary): VerificationReport {
  const findings: VerificationFinding[] = [];
  const { widthMm, heightMm, blankAreaMm2, cutLengthMm, areaMm2 } = geometry;

  if (blankAreaMm2 != null && areaMm2 != null && areaMm2 > blankAreaMm2 * 1.0001) {
    findings.push({
      code: "area-exceeds-blank",
      severity: "blocking",
      message: `Чистая площадь детали (${areaMm2.toFixed(0)} мм²) больше площади заготовки `
        + `(${blankAreaMm2.toFixed(0)} мм²) — заготовка не может быть меньше самой детали. `
        + "Вероятная причина: перепутаны единицы измерения или геометрия прочитана неверно.",
    });
  }

  if (cutLengthMm != null && areaMm2 != null && areaMm2 > 0) {
    const minPossiblePerimeterMm = 2 * Math.sqrt(Math.PI * areaMm2);
    if (cutLengthMm < minPossiblePerimeterMm * 0.98) {
      findings.push({
        code: "cut-length-below-isoperimetric-bound",
        severity: "blocking",
        message: `Длина реза (${cutLengthMm.toFixed(0)} мм) меньше минимально возможной для площади `
          + `${areaMm2.toFixed(0)} мм² (не менее ${minPossiblePerimeterMm.toFixed(0)} мм). `
          + "Геометрия прочитана некорректно — такой контур физически не существует.",
      });
    }
  }

  if (widthMm != null && heightMm != null && widthMm > 0 && heightMm > 0) {
    const maxSideMm = Math.max(widthMm, heightMm);
    if (maxSideMm > TYPICAL_SHEET_MAX_SIDE_MM) {
      findings.push({
        code: "oversized-part",
        severity: "warning",
        message: `Наибольший габарит ${maxSideMm.toFixed(0)} мм превышает типовой лист металла `
          + `(до ${TYPICAL_SHEET_MAX_SIDE_MM} мм) — потребуется составная заготовка или сварка нескольких частей.`,
      });
    }

    // The SMALLEST side, not the largest: a 2×400 mm part reads as a normal
    // 400 mm part if the largest side is checked, but one absurdly thin
    // dimension is exactly what a cm/mm mix-up on a single field looks like.
    const minSideMm = Math.min(widthMm, heightMm);
    if (minSideMm < MIN_PLAUSIBLE_SIDE_MM) {
      findings.push({
        code: "undersized-part",
        severity: "warning",
        message: `Наименьший габарит ${minSideMm.toFixed(2)} мм меньше ${MIN_PLAUSIBLE_SIDE_MM} мм — `
          + "проверьте единицы измерения (не перепутаны ли мм и см).",
      });
    }
  }

  return report(findings);
}

const LABOR_TO_MATERIAL_RATIO_WARNING = 20;

/**
 * Sanity on an already-computed cost result. Deliberately does not
 * re-derive staleness or missing rates — `calculateFactualProductionCost`
 * already reports both (`missing[].code === "material-price-stale"`) and
 * re-implementing that check here risks the two definitions drifting apart;
 * this only surfaces the existing signal in the same structured shape as
 * every other finding, per §11's requirement that staleness never pass
 * silently into the price.
 */
export function verifyCostResult(
  result: Pick<FactualCalculationResult, "lines" | "missing" | "parameters">,
): VerificationReport {
  const findings: VerificationFinding[] = [];

  if (result.missing.some((item) => item.code === "material-price-stale")) {
    findings.push({
      code: "material-price-stale",
      severity: "warning",
      message: "Цена металла в расчёте устарела: снимок прайса поставщика просрочен. "
        + "Стоимость может не отражать текущий рынок металла.",
    });
  }

  const materialLine = result.lines.find((line) => line.code === "material");
  const worksTotalRubEach = result.lines
    .filter((line) => line.code !== "material")
    .reduce((sum, line) => sum + line.amountRubEach, 0);

  if (materialLine && materialLine.amountRubEach > 0
    && worksTotalRubEach > materialLine.amountRubEach * LABOR_TO_MATERIAL_RATIO_WARNING) {
    findings.push({
      code: "labor-to-material-ratio-high",
      severity: "warning",
      message: `Стоимость операций (${worksTotalRubEach.toFixed(2)} ₽) более чем в `
        + `${LABOR_TO_MATERIAL_RATIO_WARNING} раз превышает стоимость металла `
        + `(${materialLine.amountRubEach.toFixed(2)} ₽) на деталь. Вероятная причина: сложная `
        + "деталь с малым весом металла, либо ошибка в количестве операций.",
    });
  }

  if (materialLine && materialLine.amountRubEach > 0) {
    // The gate is "is there a mass to check", not "is the mass positive" —
    // netMassKgEach === 0 is exactly the inconsistency this looks for: money
    // charged for metal whose mass came back zero, and `0 > 0` would have
    // skipped that case instead of catching it.
    const netMassKgEach = result.parameters.netMassKgEach;
    if (netMassKgEach == null || !(netMassKgEach > 0) || !Number.isFinite(materialLine.amountRubEach / netMassKgEach)) {
      findings.push({
        code: "material-rate-invalid",
        severity: "blocking",
        message: "В расчёте есть стоимость металла, но масса детали не определена или равна нулю — "
          + "результат внутренне противоречив.",
      });
    }
  }

  return report(findings);
}
