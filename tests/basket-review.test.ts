import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultBasketDesign } from "../lib/quote/basket-design";
import { emptyBasketFit } from "../lib/quote/basket-fit";
import { basketBriefHref, basketBriefText, validBasketBrief } from "../lib/quote/basket-brief";
import { basketReview, basketClearanceGeometry, defaultBasketReview, validBasketReview } from "../lib/quote/basket-review";

const fit = { width: 800, height: 500, depth: 300, left: 50, right: 100, top: 50, bottom: 0, front: 200, rear: 30 };
const item = { width: 950, height: 550, depth: 530, quantity: 3, ral: "7024", screen: "round", design: { ...defaultBasketDesign(), sizing: "block" as const, fit } };

test("clearance geometry positions unit by all six customer offsets without adding facade twice", () => {
  const geometry = basketClearanceGeometry({ ...item, design: { ...item.design, wallKind: "ventilated", facade: 250 } });
  assert.deepEqual(geometry?.envelope, { width: 950, height: 550, depth: 530 });
  assert.deepEqual(geometry?.unit, { width: 800, height: 500, depth: 300, x: 50, y: 50, z: 30 });
  assert.equal(geometry?.wallToBlockRearMm, 280);
  assert.equal(geometry?.axes.find(x => x.key === "depth")?.differenceMm, 0);
});

test("unknown or invalid offsets cannot draw plausible completed geometry", () => {
  for (const rear of [null, NaN, Infinity, -1]) assert.equal(basketClearanceGeometry({ ...item, design: { ...item.design, fit: { ...fit, rear } } }), null);
  assert.equal(basketClearanceGeometry({ ...item, design: { ...item.design, fit: emptyBasketFit() } }), null);
});

test("manual outer envelope equal to required space remains a geometry conflict", () => {
  const manual = { ...item, design: { ...item.design, sizing: "basket" as const } };
  const result = basketReview(manual);
  assert.equal(result.find(x => x.id === "geometry")?.state, "conflict");
  const larger = basketReview({ ...manual, width: 1000, height: 600, depth: 600 });
  assert.equal(larger.find(x => x.id === "geometry")?.state, "review");
  assert.equal(basketReview(item).find(x => x.id === "geometry")?.state, "supplied");
});

test("fractional clearance envelope rounds up only its quoting size", () => {
  const geometry = basketClearanceGeometry({ ...item, width: 951, design: { ...item.design, fit: { ...fit, width: 800.2 } } });
  assert.equal(geometry?.envelope.width, 950.2);
  assert.ok(Math.abs(geometry!.axes[0].differenceMm - .8) < 1e-8);
});

test("service reach is separate from ventilation gaps and does not certify access", () => {
  const review = { ...defaultBasketReview(), serviceSide: "right" as const, accessMethod: "remove-side" as const, requiredServiceMm: 400, availableServiceMm: 399 };
  assert.equal(basketReview({ ...item, review }).find(x => x.id === "service-space")?.state, "conflict");
  assert.equal(basketReview({ ...item, review: { ...review, availableServiceMm: 400 } }).find(x => x.id === "service-space")?.state, "supplied");
  assert.equal(basketReview({ ...item, review: { ...review, availableServiceMm: null } }).find(x => x.id === "service-space")?.state, "missing");
  assert.equal(basketClearanceGeometry({ ...item, review })?.envelope.depth, 530);
  assert.ok(basketReview({ ...item, review }).some(x => x.id === "engineering" && x.state === "review"));
});

test("unknown identity and mass remain explicit checklist items", () => {
  const result = basketReview(item);
  assert.equal(result.find(x => x.id === "equipment")?.state, "missing");
  assert.equal(result.find(x => x.id === "mass")?.state, "missing");
  assert.equal(result.find(x => x.id === "clearance-source")?.state, "missing");
  assert.equal(result.find(x => x.id === "service-access")?.state, "missing");
});

test("customer review validates finite ranges, text limits and known enum versions", () => {
  assert.equal(validBasketReview(defaultBasketReview()), true);
  for (const patch of [{ availableServiceMm: NaN }, { requiredServiceMm: Infinity }, { mark: null }, { serviceSide: "rear" }, { version: 2 }]) {
    assert.equal(validBasketReview({ ...defaultBasketReview(), ...patch }), false);
    assert.equal(validBasketBrief({ ...item, review: { ...defaultBasketReview(), ...patch } } as typeof item), false);
  }
});

test("local TXT retains customer review while contact URL excludes new free text", () => {
  const review = { ...defaultBasketReview(), mark: "КР-01", equipment: "Customer model", clearanceSource: "Паспорт 12", facadeNotes: "Примечание заказчика", serviceSide: "right" as const, accessMethod: "remove-side" as const, requiredServiceMm: 400, availableServiceMm: 500 };
  const text = basketBriefText({ ...item, review });
  assert.match(text, /КР-01/);
  assert.match(text, /Customer model/);
  assert.match(text, /400 мм/);
  assert.match(text, /Примечание заказчика/);
  assert.match(text, /не подтверждены производителем/i);
  assert.doesNotMatch(basketBriefHref({ ...item, review }), /Customer|КР-01|review|Примечание/);
});

test("review rejects stale calculated envelope and unknown rear distance", () => {
  assert.equal(basketReview({ ...item, width: 999 }).find(x => x.id === "geometry")?.state, "conflict");
  const result = basketReview({ ...item, design: { ...item.design, wallKind: "wall", facade: 0, fit: { ...fit, rear: null } } });
  assert.equal(result.find(x => x.id === "facade")?.state, "missing");
});

test("mass outside supported input bounds is still missing review data", () => {
  for (const mass of [0, -1, 2001, NaN]) assert.equal(basketReview({ ...item, design: { ...item.design, mass } }).find(x => x.id === "mass")?.state, "missing");
});
