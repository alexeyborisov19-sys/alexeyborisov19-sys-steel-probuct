import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";

export type ClientCalculationSignal = {
  partId: string;
  status: "pending" | "ready" | "needs-review" | "blocked";
  approvedSalePriceRub?: number | null;
  /** Safe customer-facing status only. Never include internal calculation detail. */
  message?: string;
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

/**
 * The only DTO allowed to cross from calculation infrastructure to a public
 * client. It is intentionally constructed from customer-owned configuration,
 * CAD bounding dimensions and a coarse status signal only.
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
      const hasApprovedSalePrice = Number.isFinite(approvedSalePrice) && (approvedSalePrice ?? 0) > 0;
      const status = signal?.status ?? "pending";
      const defaultMessage = status === "blocked"
        ? "Для этой детали требуется уточнение перед расчётом."
        : status === "needs-review"
          ? "Деталь проходит внутреннюю технологическую проверку."
          : status === "ready"
            ? "Внутренний расчёт завершён."
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
        price: hasApprovedSalePrice
          ? { status: "approved", totalRub: approvedSalePrice! }
          : { status: "not-published" },
        message: signal?.message?.trim() || defaultMessage,
      };
    }),
  };
}
