import type { BendTopologyGraph } from "@/lib/instant-quote/bend-topology";

export type ApprovedBendAllowanceEntry = {
  insideRadiusMm: number;
  angleDeg: number;
  bendAllowanceMm: number;
};

export type ApprovedBendAllowanceTable = {
  id: string;
  materialId: string;
  thicknessMm: number;
  approvedAt: string;
  approvedBy: string;
  source: string;
  entries: ApprovedBendAllowanceEntry[];
};

export type ResolvedBendAllowance = {
  bendId: string;
  tableId: string;
  insideRadiusMm: number;
  angleDeg: number;
  bendAllowanceMm: number;
};

export type BendAllowanceResolution = {
  ok: boolean;
  values: ResolvedBendAllowance[];
  errors: string[];
};

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function closeEnough(left: number, right: number, absoluteTolerance: number, relativeTolerance: number) {
  return Math.abs(left - right) <= Math.max(absoluteTolerance, Math.max(Math.abs(left), Math.abs(right)) * relativeTolerance);
}

export function validateApprovedBendAllowanceTable(table: ApprovedBendAllowanceTable) {
  const errors: string[] = [];
  if (!table.id) errors.push("Bend allowance table requires an id.");
  if (!table.materialId) errors.push("Bend allowance table requires a material id.");
  if (!finitePositive(table.thicknessMm)) errors.push("Bend allowance table thickness must be positive.");
  if (!table.approvedBy.trim()) errors.push("Bend allowance table requires an approver.");
  if (!table.source.trim()) errors.push("Bend allowance table requires a source reference.");
  if (Number.isNaN(Date.parse(table.approvedAt))) errors.push("Bend allowance table approval date is invalid.");
  if (!Array.isArray(table.entries) || !table.entries.length) errors.push("Bend allowance table requires at least one explicit entry.");

  const keys = new Set<string>();
  for (const entry of table.entries ?? []) {
    if (!finitePositive(entry.insideRadiusMm)) errors.push("Every bend allowance entry requires a positive inside radius.");
    if (!finitePositive(entry.angleDeg) || entry.angleDeg >= 180) errors.push("Every bend allowance entry requires an angle between 0 and 180 degrees.");
    if (!finitePositive(entry.bendAllowanceMm)) errors.push("Every bend allowance entry requires a positive bend allowance.");
    const key = `${entry.insideRadiusMm.toFixed(6)}:${entry.angleDeg.toFixed(6)}`;
    if (keys.has(key)) errors.push(`Duplicate bend allowance entry for radius ${entry.insideRadiusMm} mm and angle ${entry.angleDeg}°.`);
    keys.add(key);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Resolves only explicit production-approved values. There is deliberately no
 * interpolation, nearest-neighbour fallback or implicit K-factor. Missing rows
 * must stop automatic unfold and be completed by production engineering.
 */
export function resolveApprovedBendAllowances(input: {
  graph: BendTopologyGraph;
  table: ApprovedBendAllowanceTable;
  materialId: string;
  confirmedThicknessMm: number;
}): BendAllowanceResolution {
  const { graph, table, materialId, confirmedThicknessMm } = input;
  const errors = [...validateApprovedBendAllowanceTable(table).errors];
  const values: ResolvedBendAllowance[] = [];

  if (graph.status !== "tree") errors.push("Bend allowance can only be resolved automatically for an unambiguous connected bend tree.");
  if (table.materialId !== materialId) errors.push(`Bend allowance table ${table.id} is approved for ${table.materialId}, not ${materialId}.`);
  if (!finitePositive(confirmedThicknessMm)) errors.push("Confirmed production thickness is required.");
  else if (!closeEnough(table.thicknessMm, confirmedThicknessMm, 0.05, 0.02)) {
    errors.push(`Bend allowance table thickness ${table.thicknessMm} mm does not match confirmed thickness ${confirmedThicknessMm} mm.`);
  }

  if (errors.length) return { ok: false, values: [], errors };

  for (const edge of graph.edges) {
    const matches = table.entries.filter(
      (entry) =>
        closeEnough(entry.insideRadiusMm, edge.insideRadiusMm, 0.02, 0.005) &&
        closeEnough(entry.angleDeg, edge.angleDeg, 0.1, 0.001),
    );

    if (matches.length !== 1) {
      errors.push(
        matches.length === 0
          ? `No approved bend allowance row for bend ${edge.bendId}: R${edge.insideRadiusMm} mm / ${edge.angleDeg}°.`
          : `Multiple approved bend allowance rows match bend ${edge.bendId}; automatic selection is ambiguous.`,
      );
      continue;
    }

    const match = matches[0];
    values.push({
      bendId: edge.bendId,
      tableId: table.id,
      insideRadiusMm: edge.insideRadiusMm,
      angleDeg: edge.angleDeg,
      bendAllowanceMm: match.bendAllowanceMm,
    });
  }

  return {
    ok: errors.length === 0 && values.length === graph.edges.length,
    values: errors.length ? [] : values,
    errors,
  };
}
