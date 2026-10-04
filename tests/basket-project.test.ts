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
