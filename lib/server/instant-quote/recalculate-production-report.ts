import "server-only";

import { resolveEffectiveFactualInputs } from "@/lib/instant-quote/factual-input-resolution";
import type { PartFactualInputs, ProjectDxfEvidence } from "@/lib/instant-quote/project-factual-calculation";
import { calculateProjectFactualCost } from "@/lib/instant-quote/project-factual-calculation";
import { deriveProductionParameters, type ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import { loadPrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";
import {
  createInternalProductionReport,
  readInternalProductionReport,
  writeInternalProductionReport,
  type InternalCalculationInputSnapshot,
  type InternalProductionReport,
} from "@/lib/server/instant-quote/private-production-report";

export type PartFactualRevisionPatch = {
  bendCount?: number | null;
  weldLengthM?: number | null;
  powderAreaM2?: number | null;
  assemblyMinutes?: number | null;
  surfacePreparationAreaM2?: number | null;
};

export type InternalProductionRevisionInput = {
  reason: string;
  changedByUserId: string;
  changedByDisplayName: string;
  factualByPartId?: Record<string, PartFactualRevisionPatch>;
  powderSidesByPartId?: Record<string, 1 | 2 | null>;
  internalNote?: string;
};

function asMaterialId(value: string | null): MaterialId | null {
  if (value === "cold" || value === "hot" || value === "zinc" || value === "inox" || value === "alu" || value === "copper" || value === "brass") return value;
  return null;
}

function finiteNonNegative(value: number | null | undefined, label: string) {
  if (value == null) return value;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid revision value: ${label}`);
  return value;
}

function finitePositive(value: number | null | undefined, label: string) {
  if (value == null) return value;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid revision value: ${label}`);
  return value;
}

function mergeFactualInputs(
  previous: Record<string, PartFactualInputs>,
  patch: Record<string, PartFactualRevisionPatch> | undefined,
  validPartIds: Set<string>,
) {
  const next: Record<string, PartFactualInputs> = Object.fromEntries(
    Object.entries(previous).map(([partId, value]) => [partId, { ...value }]),
  );

  for (const [partId, value] of Object.entries(patch ?? {})) {
    if (!validPartIds.has(partId)) throw new Error(`Unknown part in revision: ${partId}`);
    const row = { ...(next[partId] ?? {}) };

    if (Object.prototype.hasOwnProperty.call(value, "bendCount")) {
      const bendCount = finiteNonNegative(value.bendCount, `${partId}.bendCount`);
      if (bendCount == null) delete row.bendCount;
      else row.bendCount = Math.floor(bendCount);
    }
    if (Object.prototype.hasOwnProperty.call(value, "weldLengthM")) {
      const weldLengthM = finitePositive(value.weldLengthM, `${partId}.weldLengthM`);
      if (weldLengthM == null) delete row.weldLengthM;
      else row.weldLengthM = weldLengthM;
    }
    if (Object.prototype.hasOwnProperty.call(value, "powderAreaM2")) {
      const powderAreaM2 = finitePositive(value.powderAreaM2, `${partId}.powderAreaM2`);
      if (powderAreaM2 == null) delete row.powderAreaM2;
      else row.powderAreaM2 = powderAreaM2;
    }
    if (Object.prototype.hasOwnProperty.call(value, "assemblyMinutes")) {
      const assemblyMinutes = finitePositive(value.assemblyMinutes, `${partId}.assemblyMinutes`);
      if (assemblyMinutes == null) delete row.assemblyMinutes;
      else row.assemblyMinutes = assemblyMinutes;
    }
    if (Object.prototype.hasOwnProperty.call(value, "surfacePreparationAreaM2")) {
      const surfacePreparationAreaM2 = finitePositive(value.surfacePreparationAreaM2, `${partId}.surfacePreparationAreaM2`);
      if (surfacePreparationAreaM2 == null) delete row.surfacePreparationAreaM2;
      else row.surfacePreparationAreaM2 = surfacePreparationAreaM2;
    }

    if (Object.keys(row).length) next[partId] = row;
    else delete next[partId];
  }

  return next;
}

function mergePowderSides(
  previous: Record<string, 1 | 2>,
  patch: Record<string, 1 | 2 | null> | undefined,
  validPartIds: Set<string>,
) {
  const next = { ...previous };
  for (const [partId, value] of Object.entries(patch ?? {})) {
    if (!validPartIds.has(partId)) throw new Error(`Unknown part in revision: ${partId}`);
    if (value == null) delete next[partId];
    else if (value === 1 || value === 2) next[partId] = value;
    else throw new Error(`Invalid revision value: ${partId}.powderSides`);
  }
  return next;
}

function evidenceFromSnapshot(snapshot: InternalCalculationInputSnapshot): ProjectDxfEvidence {
  return Object.fromEntries(snapshot.project.parts.map((part) => [
    part.id,
    { unsupportedEntities: [...(snapshot.unsupportedEntitiesByPartId[part.id] ?? [])] },
  ]));
}

/**
 * Creates a new immutable confidential report revision. The previous report is
 * never modified. Rates and supplier prices are reloaded from the current
 * private basis, so a revision always records which basis version was used.
 */
export async function recalculateInternalProductionReport(
  fileName: string,
  input: InternalProductionRevisionInput,
  now = new Date(),
): Promise<{ report: InternalProductionReport; fileName: string }> {
  const previous = await readInternalProductionReport(fileName);
  const snapshot = previous.calculationInputSnapshot;
  if (!snapshot) throw new Error("This legacy report has no recalculation input snapshot");

  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) throw new Error("Revision reason must be 3-500 characters");
  if (!input.changedByUserId.trim() || !input.changedByDisplayName.trim()) throw new Error("Revision actor is required");

  const validPartIds = new Set(snapshot.project.parts.map((part) => part.id));
  const factualByPartId = mergeFactualInputs(snapshot.factualByPartId, input.factualByPartId, validPartIds);
  const authoritativeFactualByPartId = snapshot.authoritativeFactualByPartId ?? {};
  const powderSidesByPartId = mergePowderSides(snapshot.powderSidesByPartId, input.powderSidesByPartId, validPartIds);
  const effectiveFactualByPartId = resolveEffectiveFactualInputs(
    snapshot.project,
    factualByPartId,
    powderSidesByPartId,
    authoritativeFactualByPartId,
  );
  const basis = await loadPrivateCalculationBasis();
  const evidence = evidenceFromSnapshot(snapshot);

  const calculation = calculateProjectFactualCost(
    snapshot.project,
    evidence,
    basis.materialPriceSnapshots,
    basis.rateBook,
    effectiveFactualByPartId,
    now,
  );

  const productionParametersByPartId: Record<string, ProductionParameterSummary> = {};
  for (const part of snapshot.project.parts) {
    const materialId = asMaterialId(part.configuration.materialId);
    const thicknessMm = part.configuration.thicknessMm;
    if (!materialId || !(thicknessMm && thicknessMm > 0) || !part.geometry) continue;
    const factual = effectiveFactualByPartId[part.id] ?? {};
    productionParametersByPartId[part.id] = deriveProductionParameters({
      materialId,
      thicknessMm,
      quantity: part.configuration.quantity,
      geometry: part.geometry,
      weldLengthMEach: factual.weldLengthM,
      powderSides: powderSidesByPartId[part.id],
      explicitPowderAreaM2Each: factual.powderAreaM2,
      assemblyMinutesEach: factual.assemblyMinutes,
      surfacePreparationAreaM2Each: factual.surfacePreparationAreaM2,
      packagingSelected: part.configuration.operations.includes("packaging"),
    });
  }

  const nextSnapshot: InternalCalculationInputSnapshot = {
    project: snapshot.project,
    factualByPartId,
    authoritativeFactualByPartId,
    powderSidesByPartId,
    unsupportedEntitiesByPartId: snapshot.unsupportedEntitiesByPartId,
  };
  const internalNotes = [...previous.internalNotes];
  if (input.internalNote?.trim()) internalNotes.push(input.internalNote.trim().slice(0, 1000));

  const report = createInternalProductionReport({
    projectId: snapshot.project.id,
    basisVersion: basis.version,
    calculation,
    productionParametersByPartId,
    internalNotes,
    calculationInputSnapshot: nextSnapshot,
    revision: {
      supersedesReportId: previous.reportId,
      changedAt: now.toISOString(),
      changedByUserId: input.changedByUserId.trim(),
      changedByDisplayName: input.changedByDisplayName.trim(),
      reason,
    },
    now,
  });
  const stored = await writeInternalProductionReport(report);
  return { report, fileName: stored.fileName };
}