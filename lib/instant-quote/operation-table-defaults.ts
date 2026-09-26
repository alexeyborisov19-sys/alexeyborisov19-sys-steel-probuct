import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";

/**
 * Editable non-price defaults carried over from the approved metalworking
 * calculator table. Rates stay in the protected server basis; only quantities
 * needed to complete a selected operation are exposed to the browser.
 */
export const OPERATION_TABLE_DEFAULTS = {
  bendCount: 2,
  weldLengthM: 1,
  countersinkCount: 4,
  assemblyMinutes: 10,
  powderSides: 2,
  surfacePreparationSides: 2,
} as const;

export type OperationInputEvidence = {
  detectedBendCount?: number | null;
  detectedCountersinkCount?: number | null;
  manualHoleCount?: number | null;
};

function positiveInteger(value: number | null | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : null;
}

function positiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function selectedSides(value: number | null | undefined): 1 | 2 | null {
  return value === 1 || value === 2 ? value : null;
}

function wasExplicitlyCleared(current: OperationInputs, field: keyof OperationInputs) {
  return Object.prototype.hasOwnProperty.call(current, field) && current[field] === undefined;
}

function normalizeEvidence(
  value: OperationInputEvidence | number | null | undefined,
): OperationInputEvidence {
  // Backward compatibility for the first implementation, whose third argument
  // was only the STEP countersink count.
  return typeof value === "number" || value === null
    ? { detectedCountersinkCount: value }
    : value ?? {};
}

/**
 * Returns only missing values. Existing user input is never overwritten.
 * Authoritative STEP evidence wins over manual geometry, and manual geometry
 * wins over the table fallback.
 */
export function operationTableDefaultInputPatch(
  operation: ManufacturingOperation,
  current: OperationInputs,
  evidenceValue: OperationInputEvidence | number | null = {},
): OperationInputs {
  const evidence = normalizeEvidence(evidenceValue);

  if (operation === "bending") {
    if (positiveInteger(current.bendCount) != null || wasExplicitlyCleared(current, "bendCount")) return {};
    return {
      bendCount: positiveInteger(evidence.detectedBendCount)
        ?? OPERATION_TABLE_DEFAULTS.bendCount,
    };
  }

  if (operation === "welding") {
    if (positiveNumber(current.weldLengthM) != null || wasExplicitlyCleared(current, "weldLengthM")) return {};
    return { weldLengthM: OPERATION_TABLE_DEFAULTS.weldLengthM };
  }

  if (operation === "countersink") {
    if (positiveInteger(current.countersinkCount) != null || wasExplicitlyCleared(current, "countersinkCount")) return {};
    return {
      countersinkCount: positiveInteger(evidence.detectedCountersinkCount)
        ?? positiveInteger(evidence.manualHoleCount)
        ?? OPERATION_TABLE_DEFAULTS.countersinkCount,
    };
  }

  if (operation === "assembly") {
    if (positiveNumber(current.assemblyMinutes) != null || wasExplicitlyCleared(current, "assemblyMinutes")) return {};
    return { assemblyMinutes: OPERATION_TABLE_DEFAULTS.assemblyMinutes };
  }

  if (operation === "powder-coating") {
    if (selectedSides(current.powderSides) != null || wasExplicitlyCleared(current, "powderSides")) return {};
    return { powderSides: OPERATION_TABLE_DEFAULTS.powderSides };
  }

  if (operation === "surface-preparation") {
    if (selectedSides(current.surfacePreparationSides) != null || wasExplicitlyCleared(current, "surfacePreparationSides")) return {};
    return { surfacePreparationSides: OPERATION_TABLE_DEFAULTS.surfacePreparationSides };
  }

  return {};
}

export function completeSelectedOperationInputs(
  operations: readonly ManufacturingOperation[],
  current: OperationInputs,
  evidence: OperationInputEvidence = {},
): OperationInputs {
  let result: OperationInputs = { ...current };
  for (const operation of operations) {
    result = {
      ...result,
      ...operationTableDefaultInputPatch(operation, result, evidence),
    };
  }
  return result;
}

/**
 * Keeps a manually entered blank and its operation inputs in sync.
 *
 * Hole count is pre-seeded even before countersinking is selected, so selecting
 * it later uses the exact count entered in the manual geometry instead of the
 * generic fallback. During an edit, an automatically derived old count follows
 * the new geometry; a deliberately changed user count remains untouched.
 */
export function reconcileManualOperationInputs(
  operations: readonly ManufacturingOperation[],
  current: OperationInputs,
  previousManualHoleCount: number | null,
  nextManualHoleCount: number | null,
): OperationInputs {
  const previousCount = positiveInteger(previousManualHoleCount);
  const nextCount = positiveInteger(nextManualHoleCount);
  const currentCount = positiveInteger(current.countersinkCount);
  const explicitlyUnknown = wasExplicitlyCleared(current, "countersinkCount");
  const followsManualGeometry = currentCount == null
    || (previousCount != null && currentCount === previousCount)
    || (previousCount == null && currentCount === OPERATION_TABLE_DEFAULTS.countersinkCount);

  const prepared: OperationInputs = { ...current };
  if (!explicitlyUnknown && followsManualGeometry) {
    if (nextCount != null) prepared.countersinkCount = nextCount;
    else delete prepared.countersinkCount;
  }

  return completeSelectedOperationInputs(operations, prepared, {
    manualHoleCount: nextCount,
  });
}
