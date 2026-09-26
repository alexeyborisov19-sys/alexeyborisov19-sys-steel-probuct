import type { ManufacturingOperation } from "@/lib/instant-quote/domain";

export type ProductionOrderPriority = "ordinary" | "urgent" | "critical";
export type ProductionOrderMaterialSource = "production" | "customer";
export type ProductionOrderOperationSource = "cad" | "calculation" | "manual" | "mixed";
export type ProductionOrderArtifactKind = "cad" | "drawing" | "attachment";
export type ProductionOrderCommercialStatus = "approved" | "estimate" | "unavailable";

export type ProductionOrderOperation = {
  code: ManufacturingOperation;
  label: string;
  parameter: string | null;
  source: ProductionOrderOperationSource;
};

export type ProductionOrderPart = {
  partId: string;
  position: number;
  name: string;
  quantity: number;
  fileName: string;
  materialId: string | null;
  materialLabel: string;
  thicknessMm: number | null;
  dimensionsMm: {
    width: number | null;
    height: number | null;
    depth: number | null;
  };
  operations: ProductionOrderOperation[];
  workshopNote: string | null;
  commercial: {
    totalRub: number | null;
    status: ProductionOrderCommercialStatus;
  };
};

export type ProductionOrderArtifactSource = {
  kind: "quarantine";
  requestId: string;
  storageId: string;
  extension: string;
};

export type ProductionOrderArtifact = {
  id: string;
  kind: ProductionOrderArtifactKind;
  fileName: string;
  partId?: string | null;
  source?: ProductionOrderArtifactSource | null;
};

export type ProductionOrderDelivery = {
  method: "pickup" | "transport-company" | "delivery" | "other";
  shipmentDate: string | null;
  addressOrCarrier: string | null;
  comment: string | null;
};

export type ProductionOrder = {
  schemaVersion: "1";
  orderId: string;
  projectId: string;
  quoteNumber: string;
  quoteTitle: string;
  customerName: string;
  createdAt: string;
  launchDate: string | null;
  dueDate: string | null;
  priority: ProductionOrderPriority;
  responsible: string | null;
  materialSource: ProductionOrderMaterialSource;
  parts: ProductionOrderPart[];
  artifacts: ProductionOrderArtifact[];
  delivery: ProductionOrderDelivery | null;
  productionNote: string | null;
  commercial: {
    totalRub: number | null;
    currency: "RUB";
    status: ProductionOrderCommercialStatus;
  };
};

export type ProductionOrderRoute = {
  code: ManufacturingOperation;
  label: string;
  parameter: string | null;
  source: ProductionOrderOperationSource;
  positions: number[];
};

export type ProductionOrderVisibleSections = {
  routes: boolean;
  coating: boolean;
  delivery: boolean;
  files: boolean;
};
