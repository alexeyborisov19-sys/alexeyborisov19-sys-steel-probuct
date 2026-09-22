import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";
import { CALCULATION_DISCLAIMER_SHORT, AI_REVIEW_UNAVAILABLE_NOTICE } from "@/lib/instant-quote/client-labels";

export type ClientCalculationSignal = {
  partId: string;
  status: "pending" | "ready" | "needs-review" | "blocked";
  approvedSalePriceRub?: number | null;
  /** Server-authorized commercial estimate; never a manufacturing approval. */
  estimatedSalePriceRub?: number | null;
  estimatedRateUsed?: boolean;
  unavailableReason?: "laser-rate" | "material-price" | "material-price-stale" | "operation-input" | "operation-rate";
  /** Server-owned outcome, never inferred from the existence of a price. */
  aiReviewed?: boolean;
  marketVerified?: boolean;
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
    status: "not-published" | "approved" | "estimate";
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

const unavailableMessages = {
  "laser-rate": "Для выбранных материала и толщины ещё не задан тариф лазерной резки.",
  "material-price": "Для выбранных материала и толщины нет подтверждённой актуальной цены металла.",
  "material-price-stale": "Цена металла устарела. Для расчёта требуется обновить прайс поставщика.",
  "operation-input": "Для расчёта заполните параметры выбранных операций: количество гибов, длину шва, площадь обработки или время сборки.",
  "operation-rate": "Для одной из выбранных операций ещё не задан подтверждённый тариф.",
} satisfies Record<NonNullable<ClientCalculationSignal["unavailableReason"]>, string>;

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
      const estimatedSalePrice = signal?.estimatedSalePriceRub;
      const hasEstimate = status === "needs-review" && Number.isFinite(estimatedSalePrice) && (estimatedSalePrice ?? 0) > 0;
      const price = hasApprovedSalePrice
        ? { status: "approved" as const, totalRub: approvedSalePrice! }
        : hasEstimate ? { status: "estimate" as const, totalRub: estimatedSalePrice! } : { status: "not-published" as const };
      const unavailableMessage = signal?.unavailableReason && Object.hasOwn(unavailableMessages, signal.unavailableReason) ? unavailableMessages[signal.unavailableReason] : null;
      const message = hasApprovedSalePrice
        ? `Предварительная стоимость позиции: ${rub(approvedSalePrice!)} ₽.`
        : hasEstimate ? `Ориентировочная стоимость позиции: ${rub(estimatedSalePrice!)} ₽. Изготовляемость, зоны гиба и окончательную цену должен подтвердить инженер; запуск в производство не согласован.`
        : unavailableMessage && (status === "blocked" || status === "needs-review") ? unavailableMessage
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
        message: `${message} ${hasEstimate && signal?.estimatedRateUsed === true ? "Ставка резки рассчитана по соседним толщинам и требует подтверждения. " : ""}${(hasApprovedSalePrice || hasEstimate) && signal?.marketVerified !== true ? "Среднерыночный ориентир не подтверждён. " : ""}${hasEstimate ? "Полная технологическая проверка не завершена. " : hasApprovedSalePrice && signal?.aiReviewed !== true ? `${AI_REVIEW_UNAVAILABLE_NOTICE} ` : ""}${CALCULATION_DISCLAIMER_SHORT}`,
      };
    }),
  };
}
