import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";
import type { ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import type {
  ProductionOrder,
  ProductionOrderArtifact,
  ProductionOrderCommercialStatus,
  ProductionOrderDelivery,
  ProductionOrderMaterialSource,
  ProductionOrderOperation,
  ProductionOrderOperationSource,
  ProductionOrderPriority,
  ProductionOrderRoute,
  ProductionOrderVisibleSections,
} from "@/lib/production-order/domain";

const MAX_PARTS = 50;

const MATERIAL_LABELS: Record<string, string> = {
  hot: "Сталь г/к",
  cold: "Сталь х/к",
  zinc: "Оцинкованная сталь",
  inox: "Нержавеющая сталь",
  alu: "Алюминий",
  copper: "Медь",
  brass: "Латунь",
};

const OPERATION_LABELS: Record<ManufacturingOperation, string> = {
  "laser-cutting": "Лазерная резка",
  bending: "Гибка",
  threading: "Резьба",
  countersink: "Зенковка",
  welding: "Сварка",
  assembly: "Сборка",
  "surface-preparation": "Подготовка поверхности",
  "powder-coating": "Порошковая окраска",
  packaging: "Упаковка",
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveInteger(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(1_000_000, Math.floor(value)));
}

function fmt(value: number, digits = 2) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function dateOnly(value: string | null | undefined, field: string) {
  if (value == null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid ${field}: expected YYYY-MM-DD`);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function cleanRequired(value: string, field: string, max = 160) {
  const cleaned = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  if (!cleaned) throw new Error(`${field} is required`);
  return cleaned;
}

function cleanOptional(value: string | null | undefined, max = 1000) {
  const cleaned = value?.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) ?? "";
  return cleaned || null;
}

function operationDetail(
  code: ManufacturingOperation,
  parameters: ProductionParameterSummary | undefined,
): { parameter: string | null; source: ProductionOrderOperationSource } {
  if (!parameters) return { parameter: null, source: "manual" };

  if (code === "laser-cutting") {
    const pieces: string[] = [];
    if (parameters.cutting.cutLengthMBatch != null) pieces.push(`${fmt(parameters.cutting.cutLengthMBatch)} м реза`);
    if (parameters.cutting.pierceCountBatch != null) pieces.push(`${fmt(parameters.cutting.pierceCountBatch, 0)} прожигов`);
    return { parameter: pieces.join(" · ") || null, source: pieces.length ? "calculation" : "manual" };
  }
  if (code === "bending") {
    return parameters.bending.bendCountBatch == null
      ? { parameter: null, source: "manual" }
      : { parameter: `${fmt(parameters.bending.bendCountBatch, 0)} гибов`, source: "calculation" };
  }
  if (code === "countersink") {
    const count = parameters.countersink?.countBatch ?? null;
    return count == null ? { parameter: null, source: "manual" } : { parameter: `${fmt(count, 0)} шт.`, source: "calculation" };
  }
  if (code === "welding") {
    return parameters.welding.weldLengthMBatch == null
      ? { parameter: null, source: "manual" }
      : { parameter: `${fmt(parameters.welding.weldLengthMBatch)} м шва`, source: "calculation" };
  }
  if (code === "powder-coating") {
    const pieces: string[] = [];
    if (parameters.coating.powderAreaM2Batch != null) pieces.push(`${fmt(parameters.coating.powderAreaM2Batch)} м²`);
    if (parameters.coating.powderSides != null) pieces.push(`${parameters.coating.powderSides} стор.`);
    return { parameter: pieces.join(" · ") || null, source: pieces.length ? "calculation" : "manual" };
  }
  if (code === "surface-preparation") {
    return parameters.surfacePreparation.areaM2Batch == null
      ? { parameter: null, source: "manual" }
      : { parameter: `${fmt(parameters.surfacePreparation.areaM2Batch)} м²`, source: "calculation" };
  }
  if (code === "assembly") {
    return parameters.assembly.hoursBatch == null
      ? { parameter: null, source: "manual" }
      : { parameter: `${fmt(parameters.assembly.hoursBatch)} ч`, source: "calculation" };
  }
  if (code === "packaging") {
    return parameters.packaging.unitsBatch == null
      ? { parameter: null, source: "manual" }
      : { parameter: `${fmt(parameters.packaging.unitsBatch, 0)} изделий`, source: "calculation" };
  }
  return { parameter: null, source: "manual" };
}

function buildOperation(
  code: ManufacturingOperation,
  parameters: ProductionParameterSummary | undefined,
): ProductionOrderOperation {
  const detail = operationDetail(code, parameters);
  return { code, label: OPERATION_LABELS[code], ...detail };
}

function stableOrderId(projectId: string, quoteNumber: string) {
  const token = `${projectId}-${quoteNumber}`
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9А-Яа-яЁё._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `SP-ORDER-${token || "order"}`;
}

export type ProductionOrderCommercialPartInput = {
  totalRub: number | null;
  status: ProductionOrderCommercialStatus;
};

export type BuildProductionOrderInput = {
  project: InstantQuoteProject;
  quoteNumber: string;
  quoteTitle: string;
  customerName: string;
  launchDate?: string | null;
  dueDate?: string | null;
  priority?: ProductionOrderPriority;
  responsible?: string | null;
  materialSource?: ProductionOrderMaterialSource;
  productionParametersByPartId?: Record<string, ProductionParameterSummary>;
  artifacts?: ProductionOrderArtifact[];
  delivery?: ProductionOrderDelivery | null;
  productionNote?: string | null;
  commercialByPartId?: Record<string, ProductionOrderCommercialPartInput>;
  commercialTotalRub?: number | null;
  now?: Date;
};

export function buildProductionOrderFromProject(input: BuildProductionOrderInput): ProductionOrder {
  if (input.project.parts.length === 0) throw new Error("Production order requires at least one part");
  if (input.project.parts.length > MAX_PARTS) throw new Error(`Production order supports up to ${MAX_PARTS} parts`);

  const quoteNumber = cleanRequired(input.quoteNumber, "quoteNumber", 40);
  const quoteTitle = cleanRequired(input.quoteTitle, "quoteTitle", 160);
  const customerName = cleanRequired(input.customerName, "customerName", 200);
  const now = input.now ?? new Date();

  const parts = input.project.parts.map((part, index) => {
    const production = input.productionParametersByPartId?.[part.id];
    const operations = [...new Set(part.configuration.operations)].map((code) => buildOperation(code, production));
    const suppliedCommercial = input.commercialByPartId?.[part.id];
    const commercialTotalRub = finite(suppliedCommercial?.totalRub);
    const commercialStatus = commercialTotalRub == null ? "unavailable" : suppliedCommercial?.status ?? "estimate";
    return {
      partId: part.id,
      position: index + 1,
      name: part.fileName.replace(/\.[^.]+$/, "") || `Позиция ${index + 1}`,
      quantity: positiveInteger(part.configuration.quantity),
      fileName: part.fileName,
      materialId: part.configuration.materialId,
      materialLabel: (part.configuration.materialId && MATERIAL_LABELS[part.configuration.materialId]) || part.configuration.materialId || "Не указан",
      thicknessMm: finite(part.configuration.thicknessMm),
      dimensionsMm: {
        width: finite(part.geometry?.widthMm),
        height: finite(part.geometry?.heightMm),
        depth: finite(part.geometry?.depthMm),
      },
      operations,
      workshopNote: null,
      commercial: {
        totalRub: commercialTotalRub,
        status: commercialStatus,
      },
    };
  });

  const allPartPricesKnown = parts.every((part) => part.commercial.totalRub != null);
  const calculatedTotal = allPartPricesKnown
    ? parts.reduce((sum, part) => sum + (part.commercial.totalRub ?? 0), 0)
    : finite(input.commercialTotalRub);
  const commercialStatus: ProductionOrderCommercialStatus = calculatedTotal == null
    ? "unavailable"
    : parts.some((part) => part.commercial.status === "estimate")
      ? "estimate"
      : parts.every((part) => part.commercial.status === "approved")
        ? "approved"
        : "estimate";

  return {
    schemaVersion: "1",
    orderId: stableOrderId(input.project.id, quoteNumber),
    projectId: input.project.id,
    quoteNumber,
    quoteTitle,
    customerName,
    createdAt: now.toISOString(),
    launchDate: dateOnly(input.launchDate, "launchDate"),
    dueDate: dateOnly(input.dueDate, "dueDate"),
    priority: input.priority ?? "ordinary",
    responsible: cleanOptional(input.responsible, 160),
    materialSource: input.materialSource ?? "production",
    parts,
    artifacts: [...(input.artifacts ?? [])],
    delivery: input.delivery ?? null,
    productionNote: cleanOptional(input.productionNote, 4000),
    commercial: {
      totalRub: calculatedTotal,
      currency: "RUB",
      status: commercialStatus,
    },
  };
}

export function groupProductionOrderRoutes(order: ProductionOrder): ProductionOrderRoute[] {
  const grouped = new Map<string, ProductionOrderRoute>();
  for (const part of order.parts) {
    for (const operation of part.operations) {
      const key = [operation.code, operation.parameter ?? "", operation.source].join("|");
      const existing = grouped.get(key);
      if (existing) {
        existing.positions.push(part.position);
      } else {
        grouped.set(key, {
          code: operation.code,
          label: operation.label,
          parameter: operation.parameter,
          source: operation.source,
          positions: [part.position],
        });
      }
    }
  }
  return [...grouped.values()].sort((a, b) => {
    const pos = (a.positions[0] ?? 0) - (b.positions[0] ?? 0);
    return pos || a.label.localeCompare(b.label, "ru");
  });
}

export function productionOrderVisibleSections(order: ProductionOrder): ProductionOrderVisibleSections {
  const operations = order.parts.flatMap((part) => part.operations.map((item) => item.code));
  return {
    routes: operations.length > 0,
    coating: operations.includes("powder-coating"),
    delivery: Boolean(order.delivery),
    files: order.artifacts.length > 0,
  };
}
