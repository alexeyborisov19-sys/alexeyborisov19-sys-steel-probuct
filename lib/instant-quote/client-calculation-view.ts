import type { InstantQuoteProject, ManufacturingOperation } from "@/lib/instant-quote/domain";
import { CALCULATION_DISCLAIMER_SHORT, AI_REVIEW_UNAVAILABLE_NOTICE, OPERATION_LABELS } from "@/lib/instant-quote/client-labels";

export type ClientCalculationSignal = {
  partId: string;
  status: "pending" | "ready" | "needs-review" | "blocked";
  approvedSalePriceRub?: number | null;
  /** Server-authorized commercial estimate; never a manufacturing approval. */
  estimatedSalePriceRub?: number | null;
  estimatedRateUsed?: boolean;
  staleMaterialPriceDate?: string;
  materialPriceDate?: string;
  /** Fixed server-derived manufacturing warnings; no private rates/evidence. */
  manufacturingWarnings?: string[];
  smallFeaturesNeedReview?: boolean;
  additionalProcessingExcluded?: boolean;
  countersinkReviewScope?: "priced-count-only" | "not-priced";
  unpricedOperations?: ManufacturingOperation[];
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
    unpricedOperations?: ManufacturingOperation[];
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
  "laser-rate": "Для выбранных параметров стоимость уточнит специалист.",
  "material-price": "Стоимость выбранного материала уточнит специалист.",
  "material-price-stale": "Данные для оценки устарели. Актуальную стоимость уточнит специалист.",
  "operation-input": "Уточните параметры выбранных операций: количество гибов и отверстий, длину шва или стороны обработки.",
  "operation-rate": "Для выбранной обработки стоимость уточнит специалист.",
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
      const staleTime=signal?.staleMaterialPriceDate ? Date.parse(signal.staleMaterialPriceDate):NaN;
      const staleDate=Number.isFinite(staleTime)?new Date(staleTime).toISOString().slice(0,10):null;
      const status = signal?.status ?? "pending";
      // A stale amount must not survive a failed/unfinished calculation or review.
      const hasApprovedSalePrice = status === "ready" && Number.isFinite(approvedSalePrice)
        && (approvedSalePrice ?? 0) > 0;
      const estimatedSalePrice = signal?.estimatedSalePriceRub;
      const hasEstimate = status === "needs-review" && Number.isFinite(estimatedSalePrice) && (estimatedSalePrice ?? 0) > 0;
      const unpricedOperations = [...new Set((signal?.unpricedOperations ?? []).filter(operation => ["welding", "countersink", "bending", "assembly", "surface-preparation", "powder-coating", "packaging"].includes(operation)))];
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
            ? "Для итоговой цены специалисту нужно проверить параметры заказа."
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
        price: { ...price, ...(hasEstimate && unpricedOperations.length ? { unpricedOperations } : {}) },
        message: `${message} ${hasEstimate && staleDate ? "Данные для оценки устарели. Актуальную стоимость уточнит специалист. " : ""}${hasEstimate && unpricedOperations.length ? `Не включены в показанную стоимость: ${unpricedOperations.map(operation => OPERATION_LABELS[operation]).join(", ")}. Их стоимость уточнит специалист. ` : ""}${hasEstimate && signal?.countersinkReviewScope === "priced-count-only" ? "Зенковка учтена только в указанном количестве. Дополнительные зенковки требуют проверки и отдельной оценки. " : ""}${hasEstimate && signal?.countersinkReviewScope === "not-priced" ? "Зенковки распознаны не полностью и не включены в стоимость. Если они нужны, уточните количество и стоимость со специалистом. " : ""}${hasEstimate && signal?.additionalProcessingExcluded === true ? "Фаски и дополнительная обработка, не выбранная в заказе, не включены в стоимость. Уточните их со специалистом. " : ""}${hasEstimate && signal?.smallFeaturesNeedReview === true ? "Есть слишком маленькие отверстия или узкие перемычки: специалист проверит, нужно ли изменить геометрию. " : ""}${hasEstimate && signal?.manufacturingWarnings?.length ? "Параметры детали и состав выбранных работ требуют уточнения специалистом. Изготовление требует отдельного согласования. " : ""}${hasEstimate ? "Полная проверка возможности изготовления не завершена. " : hasApprovedSalePrice && signal?.aiReviewed !== true ? `${AI_REVIEW_UNAVAILABLE_NOTICE} ` : ""}${CALCULATION_DISCLAIMER_SHORT}`,

      };
    }),
  };
}
