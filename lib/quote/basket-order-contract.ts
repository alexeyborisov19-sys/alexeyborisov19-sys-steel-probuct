import type { BasketBrief } from "./basket-brief";
import { MAX_BASKET_POSITIONS, parseBasketProject, serializeBasketProject } from "./basket-project";

/** Internal preparation only: no prices, commercial policy, HTTP or public DTO.
 * Revision references identify evidence; they do not authenticate or approve it.
 * A future server adapter must obtain reviewed evidence independently of a request.
 */
export type BasketProductionState = "incomplete" | "manualReview" | "ready";
export type BasketOrderComponentInput = {
  componentId: string;
  quantityPerBasket: number;
  templateId: string | null;
  templateRevision: string | null;
  materialId: string | null;
  materialRevision: string | null;
  thicknessMm: number | null;
  finishId: string | null;
  finishRevision: string | null;
};
export type BasketOrderPositionInput = {
  /** Caller-owned stable identity, never derived from the row index or geometry. */
  positionId: string;
  brief: BasketBrief;
  /** Explicit proposed BOM. Never inferred from three rectangular panel faces. */
  components?: BasketOrderComponentInput[];
};
export type BasketOrderInput = {
  schemaVersion: 1;
  orderId: string;
  /** Advance on every edit, including a change followed by undo. */
  orderRevision: number;
  positions: BasketOrderPositionInput[];
};
export type BasketOrderSnapshot = Omit<BasketOrderInput, "positions"> & {
  positions: (Omit<BasketOrderPositionInput, "components"> & { components: BasketOrderComponentInput[] })[];
  totalBasketQuantity: number;
  /** Canonical equality key, NOT a hash, signature or authorization credential. */
  fingerprint: string;
};
type ReviewedState = { state: BasketProductionState; reasons: string[] };
export type InternalBasketProductionEvidence = ReviewedState & {
  /** Exact sanitized snapshot reviewed by the internal producer. */
  orderFingerprint: string;
  revision: string;
  rateBookRevision: string | null;
  positions: (ReviewedState & {
    positionId: string;
    bomRevision: string | null;
    components: (ReviewedState & {
      componentId: string;
      flatPatternRevision: string | null;
      analysisRevision: string | null;
    })[];
  })[];
};
export type BasketOrderReviewReason = {
  code: string;
  state: Exclude<BasketProductionState, "ready">;
  positionId?: string;
  componentId?: string;
  detail?: string;
};
export type BasketAnalysisGroup = {
  manufacturingIdentity: string;
  /** Membership is for reuse of ONE component analysis, never quantity pricing. */
  members: { positionId: string; componentId: string; quantityPerBasket: number }[];
};
export type PreparedBasketOrder = {
  order: BasketOrderSnapshot;
  state: BasketProductionState;
  reasons: BasketOrderReviewReason[];
  analysisGroups: BasketAnalysisGroup[];
  /** Also changes when reviewed production or rate-book evidence changes. */
  fingerprint: string;
};
export type BasketQuoteRequest = {
  schemaVersion: 1;
  orderId: string;
  orderRevision: number;
  orderFingerprint: string;
  preparationFingerprint: string;
  /** Unique per attempt. Keep only the latest pending request; null cancels it. */
  requestId: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid basket order object");
  return value as Record<string, unknown>;
}
function token(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 128 || /[\u0000-\u001f\u007f]/.test(value)) throw Error("Invalid basket order identity or revision");
  return value;
}
const reference = (value: unknown): string | null => value === null ? null : token(value);
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 10000) throw Error("Basket quantity must be an integer from 1 to 10000");
  return value;
}
function rows(value: unknown): unknown[] {
  // Payload bound, not a manufacturing/BOM size capability claim.
  if (!Array.isArray(value) || value.length > MAX_BASKET_POSITIONS) throw Error("Invalid basket order list");
  return value;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw Error("Duplicate basket order identity");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function component(value: unknown): BasketOrderComponentInput {
  const raw = record(value);
  if (raw.thicknessMm !== null && (typeof raw.thicknessMm !== "number" || !Number.isFinite(raw.thicknessMm) || raw.thicknessMm <= 0)) throw Error("Invalid basket component thickness");
  return {
    componentId: token(raw.componentId), quantityPerBasket: count(raw.quantityPerBasket),
    templateId: reference(raw.templateId), templateRevision: reference(raw.templateRevision),
    materialId: reference(raw.materialId), materialRevision: reference(raw.materialRevision),
    thicknessMm: raw.thicknessMm as number | null,
    finishId: reference(raw.finishId), finishRevision: reference(raw.finishRevision),
  };
}

/** Whitelist the existing project fields; client price/ready/evidence claims vanish.
 * No IDs, material, thickness, templates or manufacturing defaults are invented.
 */
export function createBasketOrderSnapshot(input: unknown): BasketOrderSnapshot {
  const raw = record(input);
  if (raw.schemaVersion !== 1 || typeof raw.orderRevision !== "number" || !Number.isSafeInteger(raw.orderRevision) || raw.orderRevision < 0) throw Error("Invalid basket order schema or revision");
  const positions = rows(raw.positions).map(record);
  // Reuse the existing atomic validation, normalization and user-field whitelist.
  const briefs = parseBasketProject(serializeBasketProject(positions.map(position => position.brief as BasketBrief)));
  const snapshot = {
    schemaVersion: 1 as const, orderId: token(raw.orderId), orderRevision: raw.orderRevision,
    positions: positions.map((position, index) => {
      const components = rows(position.components === undefined ? [] : position.components).map(component);
      unique(components.map(part => part.componentId));
      return { positionId: token(position.positionId), brief: briefs[index], components };
    }),
    totalBasketQuantity: briefs.reduce((sum, brief) => sum + brief.quantity, 0),
  };
  unique(snapshot.positions.map(position => position.positionId));
  return freeze({ ...snapshot, fingerprint: canonical(snapshot) });
}

function reviewedState(raw: Record<string, unknown>): ReviewedState {
  if (!["incomplete", "manualReview", "ready"].includes(raw.state as string)) throw Error("Invalid production evidence state");
  const reasons = rows(raw.reasons).map(reason => {
    if (typeof reason !== "string" || !reason.trim() || reason.length > 500 || /[\u0000-\u001f\u007f]/.test(reason)) throw Error("Invalid production review reason");
    return reason;
  });
  return { state: raw.state as BasketProductionState, reasons };
}
function cleanEvidence(input: InternalBasketProductionEvidence, order: BasketOrderSnapshot): InternalBasketProductionEvidence {
  const raw = record(input);
  const positions = rows(raw.positions).map(value => {
    const row = record(value);
    const positionId = token(row.positionId);
    const position = order.positions.find(item => item.positionId === positionId);
    if (!position) throw Error("Production evidence references an unknown position");
    const components = rows(row.components).map(value => {
      const part = record(value);
      const componentId = token(part.componentId);
      if (!position.components.some(item => item.componentId === componentId)) throw Error("Production evidence references an unknown component");
      return { componentId, ...reviewedState(part), flatPatternRevision: reference(part.flatPatternRevision), analysisRevision: reference(part.analysisRevision) };
    });
    unique(components.map(part => part.componentId));
    return { positionId, ...reviewedState(row), bomRevision: reference(row.bomRevision), components };
  });
  unique(positions.map(position => position.positionId));
  return {
    orderFingerprint: order.fingerprint, revision: token(raw.revision), ...reviewedState(raw),
    rateBookRevision: reference(raw.rateBookRevision), positions,
  };
}

/** The second argument MUST come from an independently reviewed internal source,
 * never a browser body/project file. Matching identifiers are not authentication.
 * "ready" means evidence present for preparation, not a price or fabrication approval.
 */
export function prepareBasketOrder(input: BasketOrderSnapshot, internalEvidence?: InternalBasketProductionEvidence): PreparedBasketOrder {
  // Re-sanitize even a typed snapshot; never trust a supplied fingerprint.
  const order = createBasketOrderSnapshot(input);
  const reasons: BasketOrderReviewReason[] = [];
  const groups = new Map<string, BasketAnalysisGroup>();
  const add = (code: string, positionId?: string, componentId?: string, state: BasketOrderReviewReason["state"] = "incomplete", detail?: string) => {
    reasons.push({ code, state, ...(positionId ? { positionId } : {}), ...(componentId ? { componentId } : {}), ...(detail ? { detail } : {}) });
  };
  const applyState = (review: ReviewedState | undefined, positionId?: string, componentId?: string) => {
    if (!review) add("production-evidence-missing", positionId, componentId);
    else {
      if (review.state !== "ready") add(`production-evidence-${review.state}`, positionId, componentId, review.state);
      for (const detail of review.reasons) add("review-required", positionId, componentId, "manualReview", detail);
    }
  };
  const stale = internalEvidence !== undefined && internalEvidence.orderFingerprint !== order.fingerprint;
  const evidence = internalEvidence && !stale ? cleanEvidence(internalEvidence, order) : null;
  if (stale) add("production-evidence-stale");
  applyState(evidence ?? undefined);
  if (!evidence?.rateBookRevision) add("rates-revision-missing");
  for (const position of order.positions) {
    const positionEvidence = evidence?.positions.find(item => item.positionId === position.positionId);
    applyState(positionEvidence, position.positionId);
    if (!positionEvidence?.bomRevision) add("bom-revision-missing", position.positionId);
    if (!position.components.length) add("components-missing", position.positionId);
    if (!position.brief.design || position.brief.design.mount === "unknown") add("bracket-selection-missing", position.positionId);
    for (const part of position.components) {
      const start = reasons.length;
      const partEvidence = positionEvidence?.components.find(item => item.componentId === part.componentId);
      applyState(partEvidence, position.positionId, part.componentId);
      const required = [
        [part.templateId, "template-missing"], [part.templateRevision, "template-revision-missing"],
        [part.materialId, "material-missing"], [part.materialRevision, "material-revision-missing"],
        [part.thicknessMm, "thickness-missing"], [part.finishId, "finish-missing"], [part.finishRevision, "finish-revision-missing"],
        [partEvidence?.flatPatternRevision, "flat-pattern-missing"], [partEvidence?.analysisRevision, "component-analysis-missing"],
      ] as const;
      for (const [value, code] of required) if (value === null || value === undefined) add(code, position.positionId, part.componentId);
      if (reasons.length !== start) continue; // Unknown/flagged components cannot share a supposedly verified analysis.
      // Conservatively retain all design inputs, including patterns, wall/fit and
      // bracket mount/mass/facade/offset. Only commercial count and free-text notes
      // are excluded. This does not claim different fields are manufacturing-equivalent.
      const { width, height, depth, ral, screen, design, review } = position.brief;
      const serviceRequirements = review ? {
        serviceSide: review.serviceSide, accessMethod: review.accessMethod,
        requiredServiceMm: review.requiredServiceMm, availableServiceMm: review.availableServiceMm,
      } : null;
      const { templateId, templateRevision, materialId, materialRevision, thicknessMm, finishId, finishRevision } = part;
      const manufacturingIdentity = canonical({
        schemaVersion: 1, geometry: { width, height, depth, ral, screen, ...(design ? { design } : {}), serviceRequirements },
        templateId, templateRevision, materialId, materialRevision, thicknessMm, finishId, finishRevision,
        flatPatternRevision: partEvidence!.flatPatternRevision, analysisRevision: partEvidence!.analysisRevision,
      });
      const group = groups.get(manufacturingIdentity) ?? { manufacturingIdentity, members: [] };
      group.members.push({ positionId: position.positionId, componentId: part.componentId, quantityPerBasket: part.quantityPerBasket });
      groups.set(manufacturingIdentity, group);
    }
  }
  const state = reasons.some(reason => reason.state === "manualReview") ? "manualReview" : reasons.length ? "incomplete" : "ready";
  return freeze({ order, state, reasons, analysisGroups: [...groups.values()], fingerprint: canonical({ orderFingerprint: order.fingerprint, evidence }) });
}

export function createBasketQuoteRequest(prepared: PreparedBasketOrder, requestId: string): BasketQuoteRequest {
  if (prepared.state !== "ready") throw Error("Basket order needs production review before pricing");
  return freeze({
    schemaVersion: 1, orderId: prepared.order.orderId, orderRevision: prepared.order.orderRevision,
    orderFingerprint: prepared.order.fingerprint, preparationFingerprint: prepared.fingerprint, requestId: token(requestId),
  });
}

/** Freshness gate only, not a validator or producer of a monetary result.
 * Call with the current preparation and LATEST request, not a captured old cart.
 * A future consumer must clear displayed prices on edits/cancellation immediately.
 */
export function isCurrentBasketQuoteResponse(prepared: PreparedBasketOrder, latestRequest: BasketQuoteRequest | null, response: unknown): boolean {
  if (prepared.state !== "ready" || !latestRequest || !response || typeof response !== "object" || Array.isArray(response)) return false;
  const candidate = response as Record<string, unknown>;
  const expected = createBasketQuoteRequest(prepared, latestRequest.requestId);
  return (Object.keys(expected) as (keyof BasketQuoteRequest)[]).every(key => latestRequest[key] === expected[key] && candidate[key] === expected[key]);
}
