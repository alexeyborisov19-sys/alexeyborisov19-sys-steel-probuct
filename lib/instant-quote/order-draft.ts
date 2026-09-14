import type { ManufacturingCart } from "@/lib/instant-quote/cart";
import type { ProvisionalQuoteSnapshot } from "@/lib/instant-quote/quote-snapshot";

export class OrderDraftNotReadyError extends Error {
  constructor(message = "Cart is not ready for checkout.") {
    super(message);
    this.name = "OrderDraftNotReadyError";
  }
}

export type ManufacturingOrderDraftLine = {
  partId: string;
  fileName: string;
  materialId: string | null;
  thicknessMm: number | null;
  quantity: number;
  operations: string[];
  unitRub: number;
  totalRub: number;
};

export type ManufacturingOrderDraft = {
  id: string;
  status: "draft";
  projectId: string;
  cartId: string;
  quoteSnapshotId: string;
  pricingFormulaVersion: string;
  createdAt: string;
  currency: "RUB";
  totalRub: number;
  lines: ManufacturingOrderDraftLine[];
  productionRelease: "blocked";
};

export function createOrderDraft(
  cart: ManufacturingCart,
  quote: ProvisionalQuoteSnapshot,
  now = new Date(),
): ManufacturingOrderDraft {
  if (cart.quoteSnapshotId !== quote.id) {
    throw new OrderDraftNotReadyError("Cart and quote snapshot do not match.");
  }
  if (cart.status !== "ready-for-checkout" || !quote.automaticOrderReady) {
    throw new OrderDraftNotReadyError();
  }
  if (cart.lines.some((line) => line.pricingState !== "priced" || line.quotedUnitRub == null || line.quotedTotalRub == null)) {
    throw new OrderDraftNotReadyError("One or more cart lines require repricing.");
  }

  const lines = cart.lines.map<ManufacturingOrderDraftLine>((line) => ({
    partId: line.partId,
    fileName: line.fileName,
    materialId: line.materialId,
    thicknessMm: line.thicknessMm,
    quantity: line.quantity,
    operations: [...line.operations],
    unitRub: line.quotedUnitRub!,
    totalRub: line.quotedTotalRub!,
  }));

  return {
    id: `order-draft-${cart.projectId}-${now.getTime()}`,
    status: "draft",
    projectId: cart.projectId,
    cartId: cart.id,
    quoteSnapshotId: quote.id,
    pricingFormulaVersion: quote.pricingFormulaVersion,
    createdAt: now.toISOString(),
    currency: "RUB",
    totalRub: lines.reduce((sum, line) => sum + line.totalRub, 0),
    lines,
    // Explicitly blocked: checkout/order creation is not the same as releasing work to production.
    productionRelease: "blocked",
  };
}
