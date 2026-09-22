import type { ManufacturingOperation } from "@/lib/instant-quote/domain";
import type {
  ProductionOrder,
  ProductionOrderArtifact,
  ProductionOrderDelivery,
  ProductionOrderOperation,
  ProductionOrderPart,
} from "@/lib/production-order/domain";

const OPERATION_CODES = [
  "laser-cutting",
  "bending",
  "threading",
  "countersink",
  "welding",
  "assembly",
  "surface-preparation",
  "powder-coating",
  "packaging",
] as const satisfies readonly ManufacturingOperation[];

function record(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${field}`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, minimum = 1, maximum = 4_000) {
  const result = typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u001f]/g, " ").trim()
    : "";
  if (result.length < minimum || result.length > maximum) throw new Error(`Invalid ${field}`);
  return result;
}

function optionalText(value: unknown, field: string, maximum = 4_000) {
  if (value === null || value === undefined || value === "") return null;
  return text(value, field, 1, maximum);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${field}`);
  return value as T;
}

function integer(value: unknown, field: string, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Invalid ${field}`);
  return parsed;
}

function decimalOrNull(value: unknown, field: string, minimum = 0, maximum = 1_000_000_000) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Invalid ${field}`);
  return parsed;
}

function isoInstant(value: unknown, field: string) {
  const result = text(value, field, 20, 40);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field}`);
  return new Date(parsed).toISOString();
}

function dateOnlyOrNull(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const result = text(value, field, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`Invalid ${field}`);
  const parsed = Date.parse(`${result}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== result) throw new Error(`Invalid ${field}`);
  return result;
}

function safeFileName(value: unknown, field: string) {
  const result = text(value, field, 1, 220);
  if (result === "." || result === ".." || /[\\/]/.test(result)) throw new Error(`Invalid ${field}`);
  return result;
}

function operation(value: unknown, index: number): ProductionOrderOperation {
  const item = record(value, `parts.operations[${index}]`);
  return {
    code: enumValue(item.code, OPERATION_CODES, `parts.operations[${index}].code`),
    label: text(item.label, `parts.operations[${index}].label`, 1, 120),
    parameter: optionalText(item.parameter, `parts.operations[${index}].parameter`, 500),
    source: enumValue(item.source, ["cad", "calculation", "manual", "mixed"] as const, `parts.operations[${index}].source`),
  };
}

function part(value: unknown, index: number): ProductionOrderPart {
  const item = record(value, `parts[${index}]`);
  const dimensions = record(item.dimensionsMm, `parts[${index}].dimensionsMm`);
  const operations = item.operations;
  if (!Array.isArray(operations) || operations.length > 20) throw new Error(`Invalid parts[${index}].operations`);

  return {
    partId: text(item.partId, `parts[${index}].partId`, 1, 160),
    position: integer(item.position, `parts[${index}].position`, 1, 50),
    name: text(item.name, `parts[${index}].name`, 1, 200),
    quantity: integer(item.quantity, `parts[${index}].quantity`, 1, 1_000_000),
    fileName: safeFileName(item.fileName, `parts[${index}].fileName`),
    materialId: optionalText(item.materialId, `parts[${index}].materialId`, 80),
    materialLabel: text(item.materialLabel, `parts[${index}].materialLabel`, 1, 160),
    thicknessMm: decimalOrNull(item.thicknessMm, `parts[${index}].thicknessMm`, 0, 1_000),
    dimensionsMm: {
      width: decimalOrNull(dimensions.width, `parts[${index}].dimensionsMm.width`),
      height: decimalOrNull(dimensions.height, `parts[${index}].dimensionsMm.height`),
      depth: decimalOrNull(dimensions.depth, `parts[${index}].dimensionsMm.depth`),
    },
    operations: operations.map(operation),
    workshopNote: optionalText(item.workshopNote, `parts[${index}].workshopNote`, 2_000),
  };
}

function artifact(value: unknown, index: number, partIds: Set<string>): ProductionOrderArtifact {
  const item = record(value, `artifacts[${index}]`);
  const partId = optionalText(item.partId, `artifacts[${index}].partId`, 160);
  if (partId && !partIds.has(partId)) throw new Error(`Invalid artifacts[${index}].partId`);
  return {
    id: text(item.id, `artifacts[${index}].id`, 1, 160),
    kind: enumValue(item.kind, ["cad", "drawing", "attachment"] as const, `artifacts[${index}].kind`),
    fileName: safeFileName(item.fileName, `artifacts[${index}].fileName`),
    partId,
  };
}

function delivery(value: unknown): ProductionOrderDelivery | null {
  if (value === null || value === undefined) return null;
  const item = record(value, "delivery");
  return {
    method: enumValue(item.method, ["pickup", "transport-company", "delivery", "other"] as const, "delivery.method"),
    shipmentDate: dateOnlyOrNull(item.shipmentDate, "delivery.shipmentDate"),
    addressOrCarrier: optionalText(item.addressOrCarrier, "delivery.addressOrCarrier", 500),
    comment: optionalText(item.comment, "delivery.comment", 1_000),
  };
}

export function parseProductionOrder(value: unknown): ProductionOrder {
  const item = record(value, "productionOrder");
  if (item.schemaVersion !== "1") throw new Error("Invalid schemaVersion");
  if (!Array.isArray(item.parts) || item.parts.length < 1 || item.parts.length > 50) throw new Error("Invalid parts");

  const parts = item.parts.map(part);
  const partIds = new Set(parts.map((entry) => entry.partId));
  const positions = new Set(parts.map((entry) => entry.position));
  if (partIds.size !== parts.length || positions.size !== parts.length) throw new Error("Duplicate part identity");

  if (!Array.isArray(item.artifacts) || item.artifacts.length > 250) throw new Error("Invalid artifacts");
  const artifacts = item.artifacts.map((entry, index) => artifact(entry, index, partIds));
  if (new Set(artifacts.map((entry) => entry.id)).size !== artifacts.length) throw new Error("Duplicate artifact identity");

  const commercial = record(item.commercial, "commercial");
  return {
    schemaVersion: "1",
    orderId: text(item.orderId, "orderId", 1, 180),
    projectId: text(item.projectId, "projectId", 1, 180),
    quoteNumber: text(item.quoteNumber, "quoteNumber", 1, 40),
    quoteTitle: text(item.quoteTitle, "quoteTitle", 1, 160),
    customerName: text(item.customerName, "customerName", 1, 200),
    createdAt: isoInstant(item.createdAt, "createdAt"),
    launchDate: dateOnlyOrNull(item.launchDate, "launchDate"),
    dueDate: dateOnlyOrNull(item.dueDate, "dueDate"),
    priority: enumValue(item.priority, ["ordinary", "urgent", "critical"] as const, "priority"),
    responsible: optionalText(item.responsible, "responsible", 160),
    materialSource: enumValue(item.materialSource, ["production", "customer"] as const, "materialSource"),
    parts,
    artifacts,
    delivery: delivery(item.delivery),
    productionNote: optionalText(item.productionNote, "productionNote", 4_000),
    commercial: {
      totalRub: decimalOrNull(commercial.totalRub, "commercial.totalRub", 0, 1_000_000_000_000),
      currency: enumValue(commercial.currency, ["RUB"] as const, "commercial.currency"),
    },
  };
}
