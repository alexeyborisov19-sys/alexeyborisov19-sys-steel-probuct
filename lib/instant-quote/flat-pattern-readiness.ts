import type { ApprovedBendAllowanceTable } from "@/lib/instant-quote/bend-allowance";
import { resolveApprovedBendAllowances } from "@/lib/instant-quote/bend-allowance";
import { buildBendTopologyGraph } from "@/lib/instant-quote/bend-topology";
import type { NormalizedCadModel } from "@/lib/instant-quote/cad-model";

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
  materialId?: string;
  confirmedThicknessMm?: number;
  bendAllowanceTable?: ApprovedBendAllowanceTable;
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
 * thickness on its own. Detected bends must form an unambiguous topology tree
 * and every bend must resolve to one explicit production-approved bend-
 * allowance row. No default K-factor, interpolation or nearest-match fallback is
 * permitted. Pricing cannot consume a flat pattern until independent boundary
 * geometry also exists.
 */
export function evaluateFlatPatternReadiness(input: FlatPatternReadinessInput): FlatPatternReadiness {
  const { model, materialId, confirmedThicknessMm, bendAllowanceTable, boundary } = input;
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
  const topology = buildBendTopologyGraph(sheetMetal);
  const topologyReady = bendCandidates.length === 0 || topology.status === "tree";
  gates.push({
    code: "bend-topology",
    status: hasUnresolvedCylinders
      ? "manual"
      : topologyReady
        ? "pass"
        : "blocked",
    detail: hasUnresolvedCylinders
      ? "В STEP остаются цилиндрические поверхности, не классифицированные как парные гибы. До автоматической развёртки их нужно классифицировать как отверстия, прокатные поверхности или иные элементы."
      : bendCandidates.length === 0
        ? "Парные зоны гиба не обнаружены."
        : topology.status === "tree"
          ? `BRep-граф гибов однозначен: ${topology.nodes.length} плоских регионов, ${topology.edges.length} гибов.`
          : `BRep-граф гибов не готов к автоматическому traversal: ${topology.issues.join(" ") || topology.status}.`,
  });

  const bendRuleRequired = bendCandidates.length > 0;
  let bendRuleStatus: FlatPatternGate["status"] = "pass";
  let bendRuleDetail = "Правило bend allowance не требуется: парные зоны гиба не обнаружены.";

  if (bendRuleRequired) {
    if (!thicknessConfirmed || !materialId || !bendAllowanceTable || topology.status !== "tree") {
      bendRuleStatus = "blocked";
      bendRuleDetail = "Для детали с гибами нужны подтверждённая толщина, материал, однозначный BRep-граф и утверждённая explicit bend allowance table.";
    } else {
      const resolution = resolveApprovedBendAllowances({
        graph: topology,
        table: bendAllowanceTable,
        materialId,
        confirmedThicknessMm: confirmedThicknessMm!,
      });
      bendRuleStatus = resolution.ok ? "pass" : "blocked";
      bendRuleDetail = resolution.ok
        ? `Все ${resolution.values.length} гиба сопоставлены с утверждённой таблицей ${bendAllowanceTable.id}; интерполяция и K-factor по умолчанию не используются.`
        : `Bend allowance не разрешён: ${resolution.errors.join(" ")}`;
    }
  }

  gates.push({ code: "bend-rule", status: bendRuleStatus, detail: bendRuleDetail });

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
