import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";
import { CALCULATION_DISCLAIMER_SHORT } from "@/lib/instant-quote/client-labels";

export type ClientCalculationSignal = {
  partId: string;
  status: "pending" | "ready" | "needs-review" | "blocked";
  approvedSalePriceRub?: number | null;
};

export type ClientPartCalculationView = {
  partId: string;
  fileName: string;
  format: string;
  status: ClientCalculationSignal["status"];
  configuration: {
    materialId: string | null;
    thicknessMm: number | null;
    quantity: number;
    operations: ManufacturingOperation[];
  };
  cad: {
    widthMm: number | null;
    heightMm: number | null;
    depthMm: number | null;
  };
  price: {
    status: "not-published" | "approved";
    totalRub?: number;
  };
  message: string;
};

export type ClientProjectCalculationView = {
  kind: "client-calculation";
  projectId: string;
  title: string;
  parts: ClientPartCalculationView[];
  paymentEnabled: false;
};

function rub(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

/**
 * The only DTO allowed to cross from calculation infrastructure to a public
 * client. It is intentionally constructed from customer-owned configuration,
 * CAD bounding dimensions, a coarse status signal and an approved sale total.
 *
 * Never add supplier prices, production rates, direct cost, toolpath lengths,
 * pierces, mass, stock allocation, waste, machine rules, detailed DFM reasons
 * or internal report identifiers here.
 */
export function createClientCalculationView(
  project: InstantQuoteProject,
  signals: ClientCalculationSignal[] = [],
): ClientProjectCalculationView {
  const byPartId = new Map(signals.map((signal) => [signal.partId, signal]));

  return {
    kind: "client-calculation",
    projectId: project.id,
    title: project.title,
    paymentEnabled: false,
    parts: project.parts.map((part) => {
      const signal = byPartId.get(part.id);
      const approvedSalePrice = signal?.approvedSalePriceRub;
      const status = signal?.status ?? "pending";
      // A stale amount must not survive a failed/unfinished calculation or review.
      const hasApprovedSalePrice = status === "ready" && Number.isFinite(approvedSalePrice)
        && (approvedSalePrice ?? 0) > 0;
      const price = hasApprovedSalePrice
        ? { status: "approved" as const, totalRub: approvedSalePrice! }
        : { status: "not-published" as const };
      const message = hasApprovedSalePrice
        ? `Предварительная стоимость позиции: ${rub(approvedSalePrice!)} ₽.`
        : status === "blocked"
          ? "Для этой детали требуется уточнение перед расчётом."
          : status === "needs-review"
            ? "Для итоговой цены требуется проверка исходных и производственных данных."
            : status === "ready"
              ? "Предварительный расчёт завершён."
              : "Деталь принята в расчёт.";

      return {
        partId: part.id,
        fileName: part.fileName,
        format: part.format,
        status,
        configuration: {
          materialId: part.configuration.materialId,
          thicknessMm: part.configuration.thicknessMm,
          quantity: part.configuration.quantity,
          operations: [...part.configuration.operations],
        },
        cad: {
          widthMm: part.geometry?.widthMm ?? null,
          heightMm: part.geometry?.heightMm ?? null,
          depthMm: part.geometry?.depthMm ?? null,
        },
        price,
        message: `${message} ${CALCULATION_DISCLAIMER_SHORT}`,
      };
    }),
  };
}
