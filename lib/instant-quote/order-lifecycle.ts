import type { ManufacturingOrderDraft } from "@/lib/instant-quote/order-draft";
import type { TechnologyReview } from "@/lib/instant-quote/technology-review";
import { canReleaseOrderToProduction } from "@/lib/instant-quote/technology-review";

export type ManufacturingOrderStatus =
  | "awaiting-technology-review"
  | "changes-required"
  | "rejected"
  | "approved-for-production"
  | "released-to-production"
  | "in-production"
  | "quality-control"
  | "packing"
  | "ready-to-ship"
  | "shipped"
  | "completed"
  | "cancelled";

export type ManufacturingOrderEventType =
  | "order-created"
  | "technology-approved"
  | "technology-changes-required"
  | "technology-rejected"
  | "released-to-production"
  | "production-started"
  | "quality-control-started"
  | "packing-started"
  | "ready-to-ship"
  | "shipped"
  | "completed"
  | "cancelled";

export type ManufacturingOrderEvent = {
  id: string;
  type: ManufacturingOrderEventType;
  at: string;
  actorRef: string;
  note: string | null;
};

export type ManufacturingOrder = {
  id: string;
  projectId: string;
  orderDraftId: string;
  quoteSnapshotId: string;
  pricingFormulaVersion: string;
  createdAt: string;
  updatedAt: string;
  currency: "RUB";
  totalRub: number;
  lines: ManufacturingOrderDraft["lines"];
  status: ManufacturingOrderStatus;
  technologyReviewId: string;
  events: ManufacturingOrderEvent[];
};

export class InvalidOrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderTransitionError";
  }
}

function eventId(orderId: string, type: ManufacturingOrderEventType, at: Date) {
  return `${orderId}:${type}:${at.getTime()}`;
}

function event(
  orderId: string,
  type: ManufacturingOrderEventType,
  actorRef: string,
  now: Date,
  note: string | null = null,
): ManufacturingOrderEvent {
  const actor = actorRef.trim();
  if (!actor) throw new InvalidOrderTransitionError("Order event requires actor reference.");
  return {
    id: eventId(orderId, type, now),
    type,
    at: now.toISOString(),
    actorRef: actor,
    note: note?.trim() || null,
  };
}

export function createManufacturingOrderFromReview(
  draft: ManufacturingOrderDraft,
  review: TechnologyReview,
  actorRef: string,
  now = new Date(),
): ManufacturingOrder {
  if (review.orderDraftId !== draft.id) {
    throw new InvalidOrderTransitionError("Technology review does not belong to this order draft.");
  }
  if (review.status === "pending") {
    throw new InvalidOrderTransitionError("Technology review is still pending.");
  }

  const id = `order-${draft.projectId}-${now.getTime()}`;
  let status: ManufacturingOrderStatus;
  let eventType: ManufacturingOrderEventType;
  if (review.status === "approved") {
    if (!canReleaseOrderToProduction(draft, review)) {
      throw new InvalidOrderTransitionError("Approved technology review is incomplete or cannot authorize the order.");
    }
    status = "approved-for-production";
    eventType = "technology-approved";
  } else if (review.status === "changes-required") {
    status = "changes-required";
    eventType = "technology-changes-required";
  } else {
    status = "rejected";
    eventType = "technology-rejected";
  }

  const createdAt = now.toISOString();
  return {
    id,
    projectId: draft.projectId,
    orderDraftId: draft.id,
    quoteSnapshotId: draft.quoteSnapshotId,
    pricingFormulaVersion: draft.pricingFormulaVersion,
    createdAt,
    updatedAt: createdAt,
    currency: draft.currency,
    totalRub: draft.totalRub,
    lines: draft.lines.map((line) => ({ ...line, operations: [...line.operations] })),
    status,
    technologyReviewId: review.id,
    events: [
      event(id, "order-created", actorRef, now, "Order created from immutable checkout draft."),
      event(id, eventType, review.reviewerRef ?? actorRef, now, review.note),
    ],
  };
}

const ALLOWED_TRANSITIONS: Record<ManufacturingOrderStatus, Partial<Record<ManufacturingOrderEventType, ManufacturingOrderStatus>>> = {
  "awaiting-technology-review": {},
  "changes-required": { cancelled: "cancelled" },
  rejected: {},
  "approved-for-production": {
    "released-to-production": "released-to-production",
    cancelled: "cancelled",
  },
  "released-to-production": {
    "production-started": "in-production",
    cancelled: "cancelled",
  },
  "in-production": {
    "quality-control-started": "quality-control",
    cancelled: "cancelled",
  },
  "quality-control": {
    "packing-started": "packing",
    cancelled: "cancelled",
  },
  packing: {
    "ready-to-ship": "ready-to-ship",
    cancelled: "cancelled",
  },
  "ready-to-ship": {
    shipped: "shipped",
    cancelled: "cancelled",
  },
  shipped: {
    completed: "completed",
  },
  completed: {},
  cancelled: {},
};

export function transitionManufacturingOrder(
  order: ManufacturingOrder,
  type: ManufacturingOrderEventType,
  actorRef: string,
  note: string | null = null,
  now = new Date(),
): ManufacturingOrder {
  const next = ALLOWED_TRANSITIONS[order.status][type];
  if (!next) {
    throw new InvalidOrderTransitionError(`Order status ${order.status} cannot accept event ${type}.`);
  }
  const nextEvent = event(order.id, type, actorRef, now, note);
  return {
    ...order,
    status: next,
    updatedAt: now.toISOString(),
    events: [...order.events, nextEvent],
  };
}

export function releaseManufacturingOrder(
  order: ManufacturingOrder,
  actorRef: string,
  note: string | null = null,
  now = new Date(),
) {
  return transitionManufacturingOrder(order, "released-to-production", actorRef, note, now);
}

export function customerFacingOrderStage(status: ManufacturingOrderStatus) {
  switch (status) {
    case "approved-for-production":
    case "released-to-production":
      return "Подготовка производства";
    case "in-production":
      return "В производстве";
    case "quality-control":
      return "Контроль качества";
    case "packing":
      return "Комплектация и упаковка";
    case "ready-to-ship":
      return "Готово к отгрузке";
    case "shipped":
      return "Отгружено";
    case "completed":
      return "Выполнено";
    case "changes-required":
      return "Нужны изменения";
    case "rejected":
      return "Не принято технологом";
    case "cancelled":
      return "Отменено";
    default:
      return "Технологическая проверка";
  }
}
