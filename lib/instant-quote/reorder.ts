import type { ManufacturingOperation, PartConfiguration } from "@/lib/instant-quote/domain";
import type { ManufacturingOrder } from "@/lib/instant-quote/order-lifecycle";

export type CadRevisionRef = {
  assetId: string;
  revisionId: string;
  fileName: string;
  sha256: string;
};

export type ReorderLineSeed = {
  sourceOrderLineIndex: number;
  sourcePartId: string;
  fileName: string;
  cadRevision: CadRevisionRef | null;
  configuration: PartConfiguration;
  pricingState: "needs-reprice";
  quoteState: "not-requested";
};

export type ReorderIntent = {
  id: string;
  sourceOrderId: string;
  sourceProjectId: string;
  createdAt: string;
  status: "ready-for-reprice" | "needs-cad-restore";
  lines: ReorderLineSeed[];
  requiresFreshDfm: true;
  requiresFreshMaterialPrices: true;
  requiresFreshQuote: true;
};

function normalizeOperations(operations: string[]): ManufacturingOperation[] {
  const allowed = new Set<ManufacturingOperation>([
    "laser-cutting",
    "bending",
    "welding",
    "countersink",
    "assembly",
    "surface-preparation",
    "powder-coating",
    "packaging",
  ]);
  return operations.filter((operation): operation is ManufacturingOperation => allowed.has(operation as ManufacturingOperation));
}

/**
 * Starts a reorder from an immutable historical order. The previous commercial
 * price is deliberately discarded. CAD linkage is supplied separately by the
 * persistence layer; until every line has a matching stored CAD revision the
 * intent cannot proceed to DFM/repricing.
 */
export function createReorderIntent(input: {
  order: ManufacturingOrder;
  cadRevisionsByPartId?: ReadonlyMap<string, CadRevisionRef>;
  now?: Date;
}): ReorderIntent {
  const { order, cadRevisionsByPartId = new Map<string, CadRevisionRef>(), now = new Date() } = input;
  if (order.status !== "completed" && order.status !== "shipped") {
    throw new Error(`Only shipped or completed orders can be reordered; current status is ${order.status}.`);
  }

  const lines = order.lines.map<ReorderLineSeed>((line, index) => ({
    sourceOrderLineIndex: index,
    sourcePartId: line.partId,
    fileName: line.fileName,
    cadRevision: cadRevisionsByPartId.get(line.partId) ?? null,
    configuration: {
      materialId: line.materialId,
      thicknessMm: line.thicknessMm,
      quantity: line.quantity,
      operations: normalizeOperations(line.operations),
    },
    pricingState: "needs-reprice",
    quoteState: "not-requested",
  }));

  const allCadLinked = lines.length > 0 && lines.every((line) => line.cadRevision !== null);
  return {
    id: `reorder-${order.id}-${now.getTime()}`,
    sourceOrderId: order.id,
    sourceProjectId: order.projectId,
    createdAt: now.toISOString(),
    status: allCadLinked ? "ready-for-reprice" : "needs-cad-restore",
    lines,
    requiresFreshDfm: true,
    requiresFreshMaterialPrices: true,
    requiresFreshQuote: true,
  };
}

export function attachCadRevisionToReorder(
  intent: ReorderIntent,
  sourcePartId: string,
  revision: CadRevisionRef,
): ReorderIntent {
  const lines = intent.lines.map((line) => line.sourcePartId === sourcePartId
    ? { ...line, cadRevision: { ...revision } }
    : line);
  if (!lines.some((line) => line.sourcePartId === sourcePartId)) {
    throw new Error(`Reorder does not contain source part ${sourcePartId}.`);
  }
  return {
    ...intent,
    lines,
    status: lines.every((line) => line.cadRevision !== null) ? "ready-for-reprice" : "needs-cad-restore",
  };
}
