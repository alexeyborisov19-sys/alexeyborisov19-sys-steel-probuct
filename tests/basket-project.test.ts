import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBasketProject,
  serializeBasketProject,
} from "../lib/quote/basket-project";
import { defaultBasketDesign } from "../lib/quote/basket-design";
const item = {
  width: 1000,
  height: 700,
  depth: 550,
  quantity: 3,
  ral: "7024",
  screen: "round",
  design: defaultBasketDesign(),
};
test("basket specification preserves independent patterns and multiple positions", () => {
  const copy = {
    ...item,
    quantity: 8,
    width: 1200,
    design: { ...defaultBasketDesign(), facade: 300 },
  };
  assert.deepEqual(parseBasketProject(serializeBasketProject([item, copy])), [
    item,
    copy,
  ]);
});
test("rejects broken, foreign, oversized and invalid projects atomically", () => {
  for (const v of [
    "{}",
    "{",
    "null",
    JSON.stringify({ version: 1, kind: "other", items: [item] }),
    serializeBasketProject([item]).replace("1000", "-1"),
    " ".repeat(200001),
  ])
    assert.throws(() => parseBasketProject(v));
  assert.throws(() =>
    serializeBasketProject(Array.from({ length: 101 }, () => item)),
  );
});
test("unknown fields do not propagate through loaded specification", () => {
  const raw = JSON.parse(serializeBasketProject([item]));
  raw.items[0].price = 1;
  raw.items[0].customer = "private";
  const loaded = parseBasketProject(JSON.stringify(raw));
  assert.equal("price" in loaded[0], false);
  assert.equal("customer" in loaded[0], false);
});

test("approximate capacity class survives save without replacing exact block dimensions", () => {
  const design = defaultBasketDesign();
  design.capacityClass = 18;
  const item = {width:1200,height:900,depth:600,quantity:1,ral:"7024",screen:"round",design};
  const [loaded] = parseBasketProject(serializeBasketProject([item]));
  assert.equal(loaded.design?.capacityClass,18);
  assert.equal(loaded.design?.blockWidth,0);
  assert.throws(()=>serializeBasketProject([{...item,design:{...design,capacityClass:999}}]));
});

test("wide-slot specifications survive save/import and normalize legacy short names", () => {
  const design = defaultBasketDesign();
  design.front.pattern = "wide-slots";
  design.side.pattern = "wide-slots";
  const current = { ...item, screen: "wide-slots", design };
  assert.deepEqual(parseBasketProject(serializeBasketProject([current])), [current]);
  const legacy = { kind: "steel-basket-specification", version: 1, items: [{ ...current, screen: "custom" }] };
  const [loaded] = parseBasketProject(JSON.stringify(legacy));
  assert.equal(loaded.screen, "wide-slots");
  assert.equal(loaded.design?.front.pattern, "wide-slots");
  assert.equal(loaded.design?.side.pattern, "wide-slots");
});

const customerReview = {
  version: 1 as const,
  mark: "КР-01 / северный фасад",
  equipment: "Модель из паспорта заказчика",
  clearanceSource: "Паспорт, раздел установки, страница 12",
  facadeNotes: "Основание и узлы крепления уточнить по проекту",
  serviceSide: "right" as const,
  accessMethod: "remove-side" as const,
  requiredServiceMm: 450,
  availableServiceMm: 500,
};

test("version 2 preserves customer review without changing geometry or prices", () => {
  const reviewed = { ...item, review: customerReview };
  const text = serializeBasketProject([reviewed, item]);
  assert.equal(JSON.parse(text).version, 2);
  assert.deepEqual(parseBasketProject(text), [reviewed, item]);
  assert.equal(text.includes('"price"'), false);
});

test("original version 1 remains readable without fabricated equipment or service data", () => {
  const text = JSON.stringify({ kind: "steel-basket-specification", version: 1, items: [item] });
  assert.deepEqual(parseBasketProject(text), [item]);
  assert.equal("review" in parseBasketProject(text)[0], false);
});

test("rejects unsupported review and project versions and malformed review atomically", () => {
  for (const patch of [
    { version: 7 }, { mark: "x".repeat(81) }, { equipment: 123 },
    { serviceSide: "rear" }, { accessMethod: "certified" },
    { requiredServiceMm: -1 }, { availableServiceMm: 10001 },
    { clearanceSource: "secret\u0000text" },
  ]) {
    assert.throws(() => parseBasketProject(JSON.stringify({
      kind: "steel-basket-specification", version: 2,
      items: [item, { ...item, review: { ...customerReview, ...patch } }],
    })));
  }
  for (const version of [0, 3, "2", null]) assert.throws(() => parseBasketProject(JSON.stringify({
    kind: "steel-basket-specification", version, items: [item],
  })));
});

test("v2 customer text remains data and unknown review fields are removed", () => {
  const review = { ...customerReview, mark: '<img src=x onerror=alert(1)>', price: 1, approved: true };
  const [loaded] = parseBasketProject(JSON.stringify({ kind: "steel-basket-specification", version: 2, items: [{ ...item, review }] }));
  assert.equal(loaded.review?.mark, review.mark);
  assert.equal("approved" in loaded.review!, false);
  assert.equal("price" in loaded.review!, false);
});

test("100 fully annotated positions fit their v2 byte budget and round-trip", () => {
  const review = { ...customerReview, mark: "М".repeat(80), equipment: "Б".repeat(160), clearanceSource: "И".repeat(240), facadeNotes: "Ф".repeat(500) };
  const positions = Array.from({ length: 100 }, (_, index) => ({ ...item, quantity: index + 1, review }));
  const text = serializeBasketProject(positions);
  assert.ok(new TextEncoder().encode(text).length < 512000);
  assert.deepEqual(parseBasketProject(text), positions);
});

test("byte limit is enforced before JSON parsing, including multibyte content", () => {
  assert.throws(() => parseBasketProject('я'.repeat(256001)), /512 КБ/);
  const legacy = JSON.stringify({ kind: "steel-basket-specification", version: 1, items: [item], unused: "я".repeat(100001) });
  assert.throws(() => parseBasketProject(legacy), /200 КБ/);
});
