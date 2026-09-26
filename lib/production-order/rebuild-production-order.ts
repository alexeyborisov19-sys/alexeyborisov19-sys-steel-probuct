import type { ProductionOrder, ProductionOrderCommercialStatus } from "@/lib/production-order/domain";
import { buildProductionOrderFromProject } from "@/lib/production-order/build-production-order";
import { parseProductionOrder } from "@/lib/production-order/parse-production-order";
import type { InternalProductionReport } from "@/lib/server/instant-quote/private-production-report";
import {
  productionOrderArtifactsFromReport,
  productionOrderCommercialByPartId,
} from "@/lib/server/production-order/calculation-adapter";

function commercialStatus(parts: ProductionOrder["parts"]): ProductionOrderCommercialStatus {
  if (!parts.every((part) => part.commercial.totalRub != null)) return "unavailable";
  if (parts.some((part) => part.commercial.status === "estimate")) return "estimate";
  return parts.every((part) => part.commercial.status === "approved") ? "approved" : "estimate";
}

/**
 * Rebuilds every non-editable manufacturing field from the protected report.
 * The browser may edit business labels, quantities and workshop notes, but it
 * cannot replace material, geometry, operations, prices or source-file links.
 */
export function rebuildProductionOrderFromReport(
  report: InternalProductionReport,
  requestedOrder: ProductionOrder,
): ProductionOrder {
  const snapshot = report.calculationInputSnapshot;
  if (!snapshot) throw new Error("В расчёте нет полного снимка исходных данных.");
  if (report.projectId !== requestedOrder.projectId || snapshot.project.id !== requestedOrder.projectId) {
    throw new Error("Заявка не относится к выбранному производственному расчёту.");
  }
  if (snapshot.project.parts.length !== requestedOrder.parts.length) {
    throw new Error("Состав позиций не совпадает с производственным расчётом.");
  }

  const requestedById = new Map(requestedOrder.parts.map((part) => [part.partId, part]));
  if (requestedById.size !== requestedOrder.parts.length) throw new Error("Повторяющиеся позиции заявки.");
  for (const [index, part] of snapshot.project.parts.entries()) {
    const requested = requestedById.get(part.id);
    if (!requested || requested.position !== index + 1) {
      throw new Error("Порядок позиций не совпадает с производственным расчётом.");
    }
  }

  const authoritative = buildProductionOrderFromProject({
    project: snapshot.project,
    quoteNumber: requestedOrder.quoteNumber,
    quoteTitle: requestedOrder.quoteTitle,
    customerName: requestedOrder.customerName,
    launchDate: requestedOrder.launchDate,
    dueDate: requestedOrder.dueDate,
    priority: requestedOrder.priority,
    responsible: requestedOrder.responsible,
    materialSource: requestedOrder.materialSource,
    productionParametersByPartId: report.productionParametersByPartId,
    artifacts: productionOrderArtifactsFromReport(report),
    delivery: requestedOrder.delivery,
    productionNote: requestedOrder.productionNote,
    commercialByPartId: productionOrderCommercialByPartId(report),
    now: new Date(requestedOrder.createdAt),
  });

  const parts = authoritative.parts.map((part, index) => {
    const requested = requestedById.get(part.partId)!;
    const sourcePart = snapshot.project.parts[index];
    const quantityChanged = requested.quantity !== sourcePart.configuration.quantity;
    return {
      ...part,
      name: requested.name,
      quantity: requested.quantity,
      workshopNote: requested.workshopNote,
      commercial: quantityChanged
        ? { totalRub: null, status: "unavailable" as const }
        : part.commercial,
    };
  });
  const status = commercialStatus(parts);

  return parseProductionOrder({
    ...authoritative,
    parts,
    commercial: {
      ...authoritative.commercial,
      totalRub: status === "unavailable"
        ? null
        : parts.reduce((sum, part) => sum + (part.commercial.totalRub ?? 0), 0),
      status,
    },
  });
}
