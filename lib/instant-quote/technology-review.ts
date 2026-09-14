import type { ManufacturingOrderDraft } from "@/lib/instant-quote/order-draft";

export type TechnologyReviewStatus = "pending" | "approved" | "changes-required" | "rejected";

export type TechnologyReview = {
  id: string;
  orderDraftId: string;
  status: TechnologyReviewStatus;
  createdAt: string;
  updatedAt: string;
  reviewerRef: string | null;
  note: string | null;
};

export function createTechnologyReview(order: ManufacturingOrderDraft, now = new Date()): TechnologyReview {
  const iso = now.toISOString();
  return {
    id: `tech-review-${order.id}-${now.getTime()}`,
    orderDraftId: order.id,
    status: "pending",
    createdAt: iso,
    updatedAt: iso,
    reviewerRef: null,
    note: null,
  };
}

export function decideTechnologyReview(
  review: TechnologyReview,
  decision: Exclude<TechnologyReviewStatus, "pending">,
  reviewerRef: string,
  note: string | null = null,
  now = new Date(),
): TechnologyReview {
  const reviewer = reviewerRef.trim();
  if (!reviewer) throw new Error("Technology review decision requires reviewer reference.");
  return {
    ...review,
    status: decision,
    reviewerRef: reviewer,
    note: note?.trim() || null,
    updatedAt: now.toISOString(),
  };
}

export function canReleaseOrderToProduction(order: ManufacturingOrderDraft, review: TechnologyReview) {
  return order.productionRelease === "blocked"
    && review.orderDraftId === order.id
    && review.status === "approved"
    && Boolean(review.reviewerRef);
}
