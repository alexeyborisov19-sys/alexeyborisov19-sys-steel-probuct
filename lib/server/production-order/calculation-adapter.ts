import type { ProductionOrderArtifact, ProductionOrderCommercialStatus } from "@/lib/production-order/domain";
import type { ProductionOrderCommercialPartInput } from "@/lib/production-order/build-production-order";
import type { InternalProductionReport } from "@/lib/server/instant-quote/private-production-report";

type QuoteSignal = {
  partId?: unknown;
  approvedSalePriceRub?: unknown;
  estimatedSalePriceRub?: unknown;
};

type ReportWithQuoteControl = InternalProductionReport & {
  quoteControl?: {
    signals?: QuoteSignal[];
  };
};

const STORAGE_NOTE = /^CAD (\d+): quarantine request (CALC-[A-F0-9]{8}-[A-F0-9]{3}), storage ([0-9a-f-]+\.([a-z0-9]+)), format ([a-z0-9]+), antivirus (clean|not-configured|blocked)\.$/i;

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Calculation uploads already live in the protected quarantine. Earlier report
 * schemas wrote their references into internal notes rather than a structured
 * field. This adapter turns those protected references into deterministic order
 * artifacts without exposing a filesystem path to the browser.
 */
export function productionOrderArtifactsFromReport(report: InternalProductionReport): ProductionOrderArtifact[] {
  const project = report.calculationInputSnapshot?.project;
  if (!project) return [];

  const artifacts: ProductionOrderArtifact[] = [];
  const usedParts = new Set<string>();
  for (const note of report.internalNotes) {
    const match = STORAGE_NOTE.exec(note.trim());
    if (!match || match[6].toLowerCase() === "blocked") continue;
    const fileIndex = Number(match[1]) - 1;
    const part = project.parts[fileIndex];
    if (!part || usedParts.has(part.id)) continue;

    const storageId = match[3];
    const storageExtension = match[4].toLowerCase();
    const declaredExtension = match[5].toLowerCase();
    if (storageExtension !== declaredExtension) continue;

    artifacts.push({
      id: `cad:${part.id}`,
      kind: "cad",
      fileName: part.fileName,
      partId: part.id,
      source: {
        kind: "quarantine",
        requestId: match[2].toUpperCase(),
        storageId,
        extension: storageExtension,
      },
    });
    usedParts.add(part.id);
  }
  return artifacts;
}

export function productionOrderCommercialByPartId(
  report: InternalProductionReport,
): Record<string, ProductionOrderCommercialPartInput> {
  const signals = (report as ReportWithQuoteControl).quoteControl?.signals;
  if (!Array.isArray(signals)) return {};

  const result: Record<string, ProductionOrderCommercialPartInput> = {};
  for (const signal of signals) {
    if (typeof signal.partId !== "string" || !signal.partId) continue;
    const approved = finitePositive(signal.approvedSalePriceRub);
    const estimate = finitePositive(signal.estimatedSalePriceRub);
    const status: ProductionOrderCommercialStatus = approved != null
      ? "approved"
      : estimate != null
        ? "estimate"
        : "unavailable";
    result[signal.partId] = {
      totalRub: approved ?? estimate,
      status,
    };
  }
  return result;
}
