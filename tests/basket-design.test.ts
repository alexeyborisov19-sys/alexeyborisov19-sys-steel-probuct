import { test } from "node:test";
import assert from "node:assert/strict";
import {
  panelCutting,
  bracketSelection,
  defaultBasketDesign,
  validBasketDesign,
} from "../lib/quote/basket-design";
import { basketBriefHref, basketBriefSummary } from "../lib/quote/basket-brief";
test("rectangular perforation counts complete holes, edge margins and contour lengths", () => {
  const r = panelCutting(100, 100, {
    pattern: "round",
    diameter: 10,
    slotLength: 20,
    pitch: 20,
    margin: 10,
  });
  assert.equal(r.holes, 16);
  assert.ok(
    Math.abs(r.cutLengthM - (0.4 + (16 * Math.PI * 10) / 1000)) < 1e-12,
  );
  assert.equal(
    panelCutting(100, 100, {
      pattern: "round",
      diameter: 90,
      slotLength: 90,
      pitch: 100,
      margin: 10,
    }).holes,
    0,
  );
});
test("slot perimeter and removed area use rounded ends; custom and lamella do not pretend to be calculated", () => {
  const r = panelCutting(100, 100, {
    pattern: "slots",
    diameter: 10,
    slotLength: 30,
    pitch: 40,
    margin: 10,
  });
  assert.equal(r.holes, 4);
  assert.equal(r.cutLengthM, 0.4 + (4 * (40 + Math.PI * 10)) / 1000);
  assert.equal(
    panelCutting(100, 100, {
      pattern: "custom",
      diameter: 10,
      slotLength: 30,
      pitch: 40,
      margin: 10,
    }).known,
    false,
  );
});
test("longer projection never invents an approved bracket thickness", () => {
  assert.equal(
    bracketSelection({ ...defaultBasketDesign(), facade: 300, offset: 50 })
      .thicknessMm,
    null,
  );
  assert.equal(
    bracketSelection({ ...defaultBasketDesign(), mount: "existing" }).required,
    false,
  );
});
test("invalid and unbounded geometry is rejected", () => {
  for (const patch of [
    { facade: -1 },
    { mass: Infinity },
    {
      front: {
        pattern: "round",
        diameter: 10,
        slotLength: 20,
        pitch: 5,
        margin: 10,
      },
    },
  ])
    assert.equal(
      validBasketDesign({ ...defaultBasketDesign(), ...patch }),
      false,
    );
  assert.throws(() => panelCutting(1e10, 100, defaultBasketDesign().front));
});
test("all chosen design details survive engineer and downloadable brief handoff", () => {
  const design = {
    ...defaultBasketDesign(),
    facade: 230,
    offset: 40,
    mass: 52,
  };
  const u = new URL(
    basketBriefHref({
      width: 1000,
      height: 700,
      depth: 550,
      quantity: 3,
      ral: "7024",
      screen: "round",
      design,
    }),
    "https://example.com",
  );
  const s = basketBriefSummary(u.searchParams)!;
  assert.match(s, /230 мм/);
  assert.match(s, /52 кг/);
  assert.match(s, /40 мм/);
  assert.match(s, /Толщина кронштейнов: требуется/);
  u.searchParams.set("basketDesign", '{"facade":-5}');
  assert.equal(basketBriefSummary(u.searchParams), null);
});

test('unknown facade dimensions are not silently recorded as zero', () => {
 const design=defaultBasketDesign();
 const u=new URL(basketBriefHref({width:1000,height:700,depth:550,quantity:1,ral:'7024',screen:'round',design}),'https://example.com');
 assert.match(basketBriefSummary(u.searchParams)!,/Фасад от несущей стены: неизвестно/);
 assert.equal(bracketSelection(design).facadeOffsetMm,null);
});
