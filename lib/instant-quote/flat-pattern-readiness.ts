import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";

export type ApprovedBendRule = {
  id: string;
  materialId: string;
  thicknessMm: number;
  kFactor: number;
  approvedAt: string;
};

export type FlatBoundaryEvidence = {
  contourCount: number;
  cutLengthMm: number;
  areaMm2: number;
};

export type FlatPatternGate = {
  code:
    | "step-brep"
    | "thickness-candidate"
    | "thickness-confirmation"
    | "bend-topology"
    | "bend-rule"
    | "flat-boundary";
  status: "pass" | "manual" | "blocked";
  detail: string;
};

export type FlatPatternReadiness = {
  ready: boolean;
  confirmedThicknessMm?: number;
  gates: FlatPatternGate[];
};

export type FlatPatternReadinessInput = {
  model: NormalizedCadModel;
  confirmedThicknessMm?: number;
  bendRule?: ApprovedBendRule;
  boundary?: FlatBoundaryEvidence;
};

function closeEnough(left: number, right: number) {
  const tolerance = Math.max(0.05, Math.max(Math.abs(left), Math.abs(right)) * 0.02);
  return Math.abs(left - right) <= tolerance;
}

function validBoundary(boundary?: FlatBoundaryEvidence) {
  return Boolean(
    boundary &&
      Number.isInteger(boundary.contourCount) &&
      boundary.contourCount > 0 &&
      Number.isFinite(boundary.cutLengthMm) &&
      boundary.cutLengthMm > 0 &&
      Number.isFinite(boundary.areaMm2) &&
      boundary.areaMm2 > 0,
  );
}

/**
 * Safety gate between 3D BRep interpretation and any authoritative flat pattern.
 *
 * A geometric thickness candidate is deliberately not accepted as production
 * thickness on its own. Likewise, detected bend topology cannot be unfolded
 * without a production-approved bend rule, and pricing cannot consume a flat
 * pattern until boundary geometry has been independently extracted.
 */
export function evaluateFlatPatternReadiness(input: FlatPatternReadinessInput): FlatPatternReadiness {
  const { model, confirmedThicknessMm, bendRule, boundary } = input;
  const gates: FlatPatternGate[] = [];
  const isStep = model.format === "step" || model.format === "stp";
  const sheetMetal = model.sheetMetal;

  gates.push({
    code: "step-brep",
    status: isStep && sheetMetal ? "pass" : "blocked",
    detail: isStep && sheetMetal
      ? "STEP имеет нормализованный BRep-анализ листовой геометрии."
      : "Для автоматической развёртки нужен STEP/STP с успешным BRep-анализом.",
  });

  const candidate = sheetMetal?.thicknessCandidate;
  const usableCandidate = Boolean(candidate && candidate.confidence === "medium");
  gates.push({
    code: "thickness-candidate",
    status: usableCandidate ? "pass" : "manual",
    detail: usableCandidate
      ? `BRep-кандидат толщины: ${candidate?.thicknessMm} мм.`
      : "Нет кандидата толщины с достаточной геометрической уверенностью.",
  });

  const thicknessConfirmed = Boolean(
    usableCandidate &&
      confirmedThicknessMm &&
      confirmedThicknessMm > 0 &&
      closeEnough(confirmedThicknessMm, candidate!.thicknessMm),
  );
  gates.push({
    code: "thickness-confirmation",
    status: thicknessConfirmed ? "pass" : "manual",
    detail: thicknessConfirmed
      ? `Технологически подтверждённая толщина: ${confirmedThicknessMm} мм.`
      : "BRep-кандидат толщины должен быть подтверждён пользователем или технологическим правилом; автоматически принимать его как производственную толщину нельзя.",
  });

  const bendCandidates = sheetMetal?.bendCandidates ?? [];
  const hasUnresolvedCylinders = Boolean(
    sheetMetal && sheetMetal.cylindricalFaceCount > bendCandidates.length * 2,
  );
  gates.push({
    code: "bend-topology",
    status: hasUnresolvedCylinders ? "manual" : "pass",
    detail: hasUnresolvedCylinders
      ? "В STEP остаются цилиндрические поверхности, не классифицированные как парные гибы. До автоматической развёртки их нужно классифицировать как отверстия, прокатные поверхности или иные элементы."
      : bendCandidates.length
        ? `Парных BRep-кандидатов гиба: ${bendCandidates.length}.`
        : "Парные зоны гиба не обнаружены.",
  });

  const bendRuleRequired = bendCandidates.length > 0;
  const bendRuleValid = Boolean(
    !bendRuleRequired ||
      (bendRule &&
        Number.isFinite(bendRule.thicknessMm) &&
        bendRule.thicknessMm > 0 &&
        Number.isFinite(bendRule.kFactor) &&
        bendRule.kFactor > 0 &&
        bendRule.kFactor < 1 &&
        confirmedThicknessMm &&
        closeEnough(bendRule.thicknessMm, confirmedThicknessMm) &&
        !Number.isNaN(Date.parse(bendRule.approvedAt))),
  );
  gates.push({
    code: "bend-rule",
    status: bendRuleValid ? "pass" : "blocked",
    detail: bendRuleValid
      ? bendRuleRequired
        ? `Используется утверждённое правило гибки ${bendRule!.id}; K-factor не подставляется эвристически.`
        : "Правило bend allowance не требуется: парные зоны гиба не обнаружены."
      : "Для развёртки детали с гибами нужна утверждённая производственная таблица bend allowance / K-factor для материала и толщины.",
  });

  const boundaryValid = validBoundary(boundary);
  gates.push({
    code: "flat-boundary",
    status: boundaryValid ? "pass" : "blocked",
    detail: boundaryValid
      ? `Получен проверяемый 2D-контур: ${boundary!.contourCount} конт.; рез ${Math.round(boundary!.cutLengthMm)} мм.`
      : "2D boundary развёртки ещё не построен; длина реза, площадь заготовки и цена должны оставаться недоступными.",
  });

  return {
    ready: gates.every((gate) => gate.status === "pass"),
    confirmedThicknessMm: thicknessConfirmed ? confirmedThicknessMm : undefined,
    gates,
  };
}
