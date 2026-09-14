import type { ManufacturingOperation } from "@/lib/instant-quote/domain";
import type { ProvisionalQuoteSnapshot } from "@/lib/instant-quote/quote-snapshot";

export type CartPricingState = "priced" | "needs-reprice" | "review-required";

export type ManufacturingCartLine = {
  partId: string;
  fileName: string;
  materialId: string | null;
  thicknessMm: number | null;
  quantity: number;
  operations: ManufacturingOperation[];
  quotedUnitRub: number | null;
  quotedTotalRub: number | null;
  pricingState: CartPricingState;
};

export type ManufacturingCart = {
  id: string;
  projectId: string;
  quoteSnapshotId: string;
  createdAt: string;
  updatedAt: string;
  currency: "RUB";
  status: "draft" | "review-required" | "ready-for-checkout";
  lines: ManufacturingCartLine[];
  quotedTotalRub: number;
};

function deriveCartStatus(lines: ManufacturingCartLine[]): ManufacturingCart["status"] {
  if (!lines.length) return "draft";
  if (lines.some((line) => line.pricingState === "review-required" || line.pricingState === "needs-reprice")) return "review-required";
  return "ready-for-checkout";
}

function deriveQuotedTotal(lines: ManufacturingCartLine[]) {
  return lines.reduce((sum, line) => sum + (line.pricingState === "priced" ? line.quotedTotalRub ?? 0 : 0), 0);
}

export function createCartFromQuote(
  quote: ProvisionalQuoteSnapshot,
  now = new Date(),
): ManufacturingCart {
  const iso = now.toISOString();
  const lines = quote.lines.map<ManufacturingCartLine>((line) => ({
    partId: line.partId,
    fileName: line.fileName,
    materialId: line.configuration.materialId,
    thicknessMm: line.configuration.thicknessMm,
    quantity: line.configuration.quantity,
    operations: [...line.configuration.operations],
    quotedUnitRub: line.price?.unitRub ?? null,
    quotedTotalRub: line.price?.totalRub ?? null,
    pricingState: line.status === "calculated" && line.price && line.priceSource && !line.priceSource.stale
      ? "priced"
      : "review-required",
  }));

  return {
    id: `cart-${quote.projectId}-${now.getTime()}`,
    projectId: quote.projectId,
    quoteSnapshotId: quote.id,
    createdAt: iso,
    updatedAt: iso,
    currency: "RUB",
    status: deriveCartStatus(lines),
    lines,
    quotedTotalRub: deriveQuotedTotal(lines),
  };
}

export function setCartLineQuantity(
  cart: ManufacturingCart,
  partId: string,
  quantity: number,
  now = new Date(),
): ManufacturingCart {
  const safeQuantity = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
  const lines = cart.lines.map((line) => line.partId === partId
    ? {
        ...line,
        quantity: safeQuantity,
        pricingState: safeQuantity === line.quantity ? line.pricingState : "needs-reprice" as const,
        quotedUnitRub: safeQuantity === line.quantity ? line.quotedUnitRub : null,
        quotedTotalRub: safeQuantity === line.quantity ? line.quotedTotalRub : null,
      }
    : line);

  return {
    ...cart,
    updatedAt: now.toISOString(),
    lines,
    status: deriveCartStatus(lines),
    quotedTotalRub: deriveQuotedTotal(lines),
  };
}

export function setCartLineOperations(
  cart: ManufacturingCart,
  partId: string,
  operations: ManufacturingOperation[],
  now = new Date(),
): ManufacturingCart {
  const normalized = [...new Set(operations)];
  const lines = cart.lines.map((line) => {
    if (line.partId !== partId) return line;
    const same = normalized.length === line.operations.length && normalized.every((operation) => line.operations.includes(operation));
    if (same) return line;
    return {
      ...line,
      operations: normalized,
      pricingState: "needs-reprice" as const,
      quotedUnitRub: null,
      quotedTotalRub: null,
    };
  });

  return {
    ...cart,
    updatedAt: now.toISOString(),
    lines,
    status: deriveCartStatus(lines),
    quotedTotalRub: deriveQuotedTotal(lines),
  };
}
