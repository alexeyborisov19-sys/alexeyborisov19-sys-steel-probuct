import type { ManufacturingOperation, OperationInputs } from "@/lib/instant-quote/domain";

/**
 * Non-price defaults carried over from the approved metalworking calculator
 * table. Rates stay in the protected server basis; only editable quantities
 * needed to complete a selected operation are exposed to the client.
 */
export const OPERATION_TABLE_DEFAULTS = {
  countersinkCount: 4,
  assemblyMinutes: 10,
} as const;

function positiveInteger(value: number | null | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : null;
}

function positiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Returns only missing values. A STEP-derived countersink count takes priority;
 * otherwise the editable table default is used. An explicit existing value is
 * never overwritten.
 */
export function operationTableDefaultInputPatch(
  operation: ManufacturingOperation,
  current: OperationInputs,
  detectedCountersinkCount?: number | null,
): OperationInputs {
  if (operation === "countersink") {
    if (positiveInteger(current.countersinkCount) != null) return {};
    return {
      countersinkCount: positiveInteger(detectedCountersinkCount)
        ?? OPERATION_TABLE_DEFAULTS.countersinkCount,
    };
  }

  if (operation === "assembly") {
    if (positiveNumber(current.assemblyMinutes) != null) return {};
    return { assemblyMinutes: OPERATION_TABLE_DEFAULTS.assemblyMinutes };
  }

  return {};
}
