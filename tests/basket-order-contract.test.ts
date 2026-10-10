import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultBasketDesign } from "../lib/quote/basket-design";
import { defaultBasketReview } from "../lib/quote/basket-review";
import { basketAppearancePatterns } from "../data/basket-appearance-patterns";
import { parseBasketProject, serializeBasketProject } from "../lib/quote/basket-project";
import {
  createBasketOrderSnapshot,
  prepareBasketOrder,
  createBasketQuoteRequest,
  isCurrentBasketQuoteResponse,
  type BasketOrderInput,
  type BasketOrderSnapshot,
  type InternalBasketProductionEvidence,
} from "../lib/quote/basket-order-contract";

// Synthetic fixtures exercise the contract, not approved manufacturing data or rates.
function input(): BasketOrderInput {
  return {
    schemaVersion: 1,
    orderId: "synthetic-order",
    orderRevision: 1,
    positions: [{
      positionId: "position-a",
      brief: {
        width: 1000, height: 700, depth: 550, quantity: 3, ral: "7024", screen: "round",
        design: { ...defaultBasketDesign(), mount: "existing" }, review: { ...defaultBasketReview(), mark: "КР-01" },
      },
      components: [{
        componentId: "component-a", quantityPerBasket: 1,
        templateId: "synthetic-panel", templateRevision: "template-v1",
        materialId: "synthetic-steel", materialRevision: "material-v1", thicknessMm: 1,
        finishId: "synthetic-finish", finishRevision: "finish-v1",
      }],
    }],
  };
}
function evidence(order: BasketOrderSnapshot): InternalBasketProductionEvidence {
  return {
    orderFingerprint: order.fingerprint, revision: "review-v1", state: "ready", reasons: [],
    rateBookRevision: "synthetic-rate-book-v1",
    positions: order.positions.map(position => ({
      positionId: position.positionId, state: "ready", reasons: [], bomRevision: "synthetic-bom-v1",
      components: position.components.map(component => ({
        componentId: component.componentId, state: "ready", reasons: [],
        flatPatternRevision: "synthetic-flat-v1", analysisRevision: "synthetic-analysis-v1",
      })),
    })),
  };
}
function ready(value = input()) {
  const order = createBasketOrderSnapshot(value);
  return prepareBasketOrder(order, evidence(order));
}

test("order snapshot preserves 100 annotated project positions and stable identities", () => {
  const value = input();
  value.positions = Array.from({ length: 100 }, (_, index) => ({
    ...input().positions[0], positionId: `position-${index}`, brief: {
      ...input().positions[0].brief, quantity: index === 99 ? 10000 : index + 1,
      review: { ...defaultBasketReview(), mark: "М".repeat(80), equipment: "Б".repeat(160), clearanceSource: "И".repeat(240), facadeNotes: "Ф".repeat(500) },
    },
  }));
  const order = createBasketOrderSnapshot(value);
  const briefs = order.positions.map(position => position.brief);
  assert.deepEqual(parseBasketProject(serializeBasketProject(briefs)), briefs);
  assert.deepEqual(briefs, value.positions.map(position => position.brief));
  assert.deepEqual(order.positions.map(position => position.positionId), value.positions.map(position => position.positionId));
  assert.equal(order.schemaVersion, 1);
  assert.equal(order.positions[0].components[0].templateRevision, "template-v1");
  assert.ok(Object.isFrozen(order.positions[0].brief.design!.front));
  value.positions[0].brief.design!.front.pitch = 55;
  assert.equal(order.positions[0].brief.design!.front.pitch, 20);
});

test("order limits reject invalid quantities, revisions, duplicate IDs and excessive positions atomically", () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, -Infinity, 10001, "3", null]) {
    const value = input();
    Object.assign(value.positions[0].brief, { quantity });
    assert.throws(() => createBasketOrderSnapshot(value));
  }
  for (const count of [0, 101]) {
    const value = input();
    value.positions = Array.from({ length: count }, (_, i) => ({ ...input().positions[0], positionId: `p-${i}` }));
    assert.throws(() => createBasketOrderSnapshot(value));
  }
  for (const revision of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createBasketOrderSnapshot({ ...input(), orderRevision: revision }));
  }
  assert.throws(() => createBasketOrderSnapshot({ ...input(), schemaVersion: 2 }));
  const duplicate = input();
  duplicate.positions.push(input().positions[0]);
  assert.throws(() => createBasketOrderSnapshot(duplicate));
  const componentDuplicate = input();
  componentDuplicate.positions[0].components!.push(input().positions[0].components![0]);
  assert.throws(() => createBasketOrderSnapshot(componentDuplicate));
  for (const quantity of [0, -1, 1.5, Infinity, 10001]) {
    const value = input();
    value.positions[0].components![0].quantityPerBasket = quantity;
    assert.throws(() => createBasketOrderSnapshot(value));
  }
});

test("canonical identities ignore property order and unknown browser prices or approvals", () => {
  const value = input();
  const original = createBasketOrderSnapshot(value);
  const reversed = Object.fromEntries(Object.entries(value).reverse());
  assert.equal(createBasketOrderSnapshot(reversed).fingerprint, original.fingerprint);
  const injected = structuredClone(value);
  Object.assign(injected, { price: 1, state: "ready", production: evidence(original) });
  Object.assign(injected.positions[0], { price: 1, approved: true, state: "ready" });
  Object.assign(injected.positions[0].brief, { price: 1, customer: "private" });
  Object.assign(injected.positions[0].brief.review!, { approved: true });
  Object.assign(injected.positions[0].components![0], { price: 1, state: "ready" });
  const clean = createBasketOrderSnapshot(injected);
  assert.deepEqual(clean, original);
  const prepared = prepareBasketOrder(clean);
  assert.equal(prepared.state, "incomplete");
  assert.ok(prepared.reasons.some(reason => reason.code === "production-evidence-missing"));
  assert.equal("price" in prepared, false);
  assert.equal("total" in prepared, false);
  assert.equal(prepared.analysisGroups.length, 0);
});

test("mixed cart and duplicate rows retain commercial quantities; only identical analyses are grouped", () => {
  const value = input();
  const duplicate = input().positions[0];
  duplicate.positionId = "position-b";
  duplicate.brief.quantity = 9;
  duplicate.brief.review!.mark = "КР-02";
  const different = input().positions[0];
  different.positionId = "position-c";
  different.brief.width = 1200;
  value.positions.push(duplicate, different);
  const prepared = ready(value);
  assert.equal(prepared.state, "ready");
  assert.deepEqual(prepared.order.positions.map(position => [position.positionId, position.brief.quantity]), [["position-a", 3], ["position-b", 9], ["position-c", 3]]);
  assert.equal(prepared.analysisGroups.length, 2);
  assert.deepEqual(prepared.analysisGroups[0].members, [
    { positionId: "position-a", componentId: "component-a", quantityPerBasket: 1 },
    { positionId: "position-b", componentId: "component-a", quantityPerBasket: 1 },
  ]);
  assert.equal("quantity" in prepared.analysisGroups[0], false);
  assert.equal("discount" in prepared, false);
});

test("quantity increases and decreases change the order but keep one-part manufacturing identity", () => {
  const initial = ready();
  for (const quantity of [1, 2, 10000]) {
    const value = input();
    value.positions[0].brief.quantity = quantity;
    const changed = ready(value);
    assert.notEqual(changed.order.fingerprint, initial.order.fingerprint);
    assert.equal(changed.analysisGroups[0].manufacturingIdentity, initial.analysisGroups[0].manufacturingIdentity);
    assert.equal(changed.order.positions[0].brief.quantity, quantity);
  }
});

test("one mixed cart keeps different component materials and thicknesses in separate analysis groups", () => {
  const value = input();
  value.positions = Array.from({ length: 3 }, (_, index) => ({ ...input().positions[0], positionId: `position-${index}` }));
  value.positions[1].components![0].materialId = "another-synthetic-material";
  value.positions[2].components![0].thicknessMm = 3;
  const prepared = ready(value);
  assert.equal(prepared.order.positions.length, 3);
  assert.equal(prepared.analysisGroups.length, 3);
  assert.ok(prepared.analysisGroups.every(group => group.members.length === 1));
});

test("totalBasketQuantity counts finished baskets across rows without applying a commercial policy", () => {
  for (const quantity of [10, 11]) {
    const value = input(); value.positions[0].brief.quantity = quantity;
    value.positions[0].components![0].quantityPerBasket = 7;
    assert.equal(createBasketOrderSnapshot(value).totalBasketQuantity, quantity);
  }
  const mixed = input(); mixed.positions[0].brief.quantity = 2;
  const second = input().positions[0]; second.positionId = "position-b"; second.brief.quantity = 9;
  mixed.positions.push(second);
  assert.equal(createBasketOrderSnapshot(mixed).totalBasketQuantity, 11);
  const maximum = input();
  maximum.positions = Array.from({ length: 100 }, (_, i) => ({ ...input().positions[0], positionId: `p-${i}`, brief: { ...input().positions[0].brief, quantity: 10000 } }));
  assert.equal(createBasketOrderSnapshot(maximum).totalBasketQuantity, 1000000);
});

test("analysis identity separates template, geometry, pattern, material, thickness, finish and bracket inputs", () => {
  const original = ready().analysisGroups[0].manufacturingIdentity;
  const changes: ((value: BasketOrderInput) => void)[] = [
    value => { value.positions[0].components![0].templateId = "other-template"; },
    value => { value.positions[0].components![0].templateRevision = "template-v2"; },
    value => { value.positions[0].brief.depth = 650; },
    value => { value.positions[0].brief.design!.front.pitch = 25; },
    value => { value.positions[0].brief.design!.side.pattern = "solid"; },
    value => { value.positions[0].components![0].materialId = "other-material"; },
    value => { value.positions[0].components![0].materialRevision = "material-v2"; },
    value => { value.positions[0].components![0].thicknessMm = 1.5; },
    value => { value.positions[0].components![0].finishId = "other-finish"; },
    value => { value.positions[0].components![0].finishRevision = "finish-v2"; },
    value => { value.positions[0].brief.ral = "9005"; },
    value => { value.positions[0].brief.design!.mount = "bearing"; },
    value => { value.positions[0].brief.design!.mass = 80; },
    value => { value.positions[0].brief.design!.facade = 150; },
    value => { value.positions[0].brief.design!.offset = 100; },
    value => { value.positions[0].brief.review!.serviceSide = "right"; },
    value => { value.positions[0].brief.review!.accessMethod = "remove-side"; },
  ];
  for (const change of changes) {
    const value = input(); change(value);
    assert.notEqual(ready(value).analysisGroups[0].manufacturingIdentity, original);
  }
  const order = createBasketOrderSnapshot(input());
  const updated = evidence(order);
  updated.positions[0].components[0].flatPatternRevision = "flat-v2";
  assert.notEqual(prepareBasketOrder(order, updated).analysisGroups[0].manufacturingIdentity, original);
});

test("every appearance choice survives the project whitelist and has a distinct manufacturing identity", () => {
  const identities = new Set<string>();
  for (const appearance of Object.keys(basketAppearancePatterns) as (keyof typeof basketAppearancePatterns)[]) {
    const value = input(); value.positions[0].brief.design!.appearance = appearance;
    const prepared = ready(value);
    assert.equal(prepared.order.positions[0].brief.design!.appearance, appearance);
    identities.add(prepared.analysisGroups[0].manufacturingIdentity);
  }
  assert.equal(identities.size, Object.keys(basketAppearancePatterns).length);
});

test("missing flats, material revisions, templates, thickness, finish, BOM and rates explicitly block readiness", () => {
  const value = input();
  const component = value.positions[0].components![0];
  component.materialRevision = null;
  component.templateRevision = null;
  component.thicknessMm = null;
  component.finishRevision = null;
  const order = createBasketOrderSnapshot(value);
  const reviewed = evidence(order);
  reviewed.rateBookRevision = null;
  reviewed.positions[0].bomRevision = null;
  reviewed.positions[0].components[0].flatPatternRevision = null;
  reviewed.positions[0].components[0].analysisRevision = null;
  const prepared = prepareBasketOrder(order, reviewed);
  assert.equal(prepared.state, "incomplete");
  for (const code of ["material-revision-missing", "template-revision-missing", "thickness-missing", "finish-revision-missing", "bom-revision-missing", "flat-pattern-missing", "component-analysis-missing", "rates-revision-missing"]) {
    assert.ok(prepared.reasons.some(reason => reason.code === code), code);
  }
  assert.equal(prepared.analysisGroups.length, 0);
  const noComponents = input(); delete noComponents.positions[0].components;
  const missing = prepareBasketOrder(createBasketOrderSnapshot(noComponents));
  assert.ok(missing.reasons.some(reason => reason.code === "components-missing"));
});

test("unknown bracket selection remains explicit even if an internal producer says ready", () => {
  const value = input(); value.positions[0].brief.design!.mount = "unknown";
  const prepared = ready(value);
  assert.equal(prepared.state, "incomplete");
  assert.ok(prepared.reasons.some(reason => reason.code === "bracket-selection-missing"));
});

test("explicit incomplete and manual-review evidence cannot be promoted to ready", () => {
  const order = createBasketOrderSnapshot(input());
  for (const state of ["incomplete", "manualReview"] as const) {
    const reviewed = evidence(order); reviewed.positions[0].components[0].state = state;
    const prepared = prepareBasketOrder(order, reviewed);
    assert.equal(prepared.state, state);
    assert.ok(prepared.reasons.length > 0);
  }
  const reviewed = evidence(order);
  reviewed.positions[0].reasons = ["Engineer must confirm the support connection."];
  const prepared = prepareBasketOrder(order, reviewed);
  assert.equal(prepared.state, "manualReview");
  assert.ok(prepared.reasons.some(reason => reason.code === "review-required" && reason.detail === reviewed.positions[0].reasons[0]));
});

test("evidence must match the exact order and complete row/component membership", () => {
  const order = createBasketOrderSnapshot(input());
  const stale = evidence(order);
  const value = input(); value.positions[0].brief.quantity += 1;
  const prepared = prepareBasketOrder(createBasketOrderSnapshot(value), stale);
  assert.equal(prepared.state, "incomplete");
  assert.ok(prepared.reasons.some(reason => reason.code === "production-evidence-stale"));
  for (const field of ["positionId", "componentId"] as const) {
    const wrong = evidence(order);
    if (field === "positionId") wrong.positions[0].positionId = "removed-position";
    else wrong.positions[0].components[0].componentId = "removed-component";
    assert.throws(() => prepareBasketOrder(order, wrong));
  }
});

test("missing or duplicate evidence membership and malformed state cannot silently approve a row", () => {
  const order = createBasketOrderSnapshot(input());
  for (const remove of [
    (reviewed: InternalBasketProductionEvidence) => { reviewed.positions = []; },
    (reviewed: InternalBasketProductionEvidence) => { reviewed.positions[0].components = []; },
  ]) {
    const reviewed = evidence(order); remove(reviewed);
    assert.equal(prepareBasketOrder(order, reviewed).state, "incomplete");
  }
  for (const corrupt of [
    (reviewed: InternalBasketProductionEvidence) => { reviewed.positions.push(reviewed.positions[0]); },
    (reviewed: InternalBasketProductionEvidence) => { reviewed.positions[0].components.push(reviewed.positions[0].components[0]); },
    (reviewed: InternalBasketProductionEvidence) => { Object.assign(reviewed, { state: "approved" }); },
    (reviewed: InternalBasketProductionEvidence) => { reviewed.reasons = ["bad\u0000reason"]; },
  ]) {
    const reviewed = evidence(order); corrupt(reviewed);
    assert.throws(() => prepareBasketOrder(order, reviewed));
  }
  const claimed = { ...order, fingerprint: "browser-forged-fingerprint" };
  const reviewed = evidence(claimed);
  const prepared = prepareBasketOrder(claimed, reviewed);
  assert.equal(prepared.order.fingerprint, order.fingerprint);
  assert.equal(prepared.state, "incomplete");
});

test("latest-request acceptance rejects stale, out-of-order, removed, reordered and reverted carts", () => {
  const value = input();
  value.positions.push({ ...input().positions[0], positionId: "position-b" });
  const initial = ready(value);
  const older = createBasketQuoteRequest(initial, "request-1");
  const latest = createBasketQuoteRequest(initial, "request-2");
  assert.equal(isCurrentBasketQuoteResponse(initial, latest, latest), true);
  assert.equal(isCurrentBasketQuoteResponse(initial, latest, older), false);
  assert.equal(isCurrentBasketQuoteResponse(initial, null, latest), false);
  for (const change of [
    (v: BasketOrderInput) => { v.positions[0].brief.quantity += 1; },
    (v: BasketOrderInput) => { v.positions[0].brief.quantity -= 1; },
    (v: BasketOrderInput) => { v.positions[0].brief.height += 1; },
    (v: BasketOrderInput) => { v.positions.pop(); },
    (v: BasketOrderInput) => { v.positions.reverse(); },
    (v: BasketOrderInput) => { v.orderRevision += 2; },
  ]) {
    const changed = structuredClone(value); change(changed);
    assert.equal(isCurrentBasketQuoteResponse(ready(changed), latest, latest), false);
  }
  for (const bad of [null, {}, { ...latest, schemaVersion: 2 }, { ...latest, orderRevision: NaN }, { ...latest, requestId: "other" }]) {
    assert.equal(isCurrentBasketQuoteResponse(initial, latest, bad), false);
  }
});

test("production/rate revision changes and readiness loss invalidate otherwise matching quote responses", () => {
  const initial = ready();
  const request = createBasketQuoteRequest(initial, "request-1");
  for (const field of ["revision", "rateBookRevision"] as const) {
    const updated = evidence(initial.order); updated[field] = "synthetic-v2";
    const next = prepareBasketOrder(initial.order, updated);
    assert.equal(next.order.fingerprint, initial.order.fingerprint);
    assert.equal(isCurrentBasketQuoteResponse(next, request, request), false);
  }
  const incomplete = prepareBasketOrder(initial.order);
  assert.equal(isCurrentBasketQuoteResponse(incomplete, request, request), false);
  assert.throws(() => createBasketQuoteRequest(incomplete, "request-2"));
});
