import { test } from "node:test";
import assert from "node:assert/strict";
import { basketBriefSummary, basketBriefHref } from "../lib/quote/basket-brief";
import { defaultBasketDesign } from "../lib/quote/basket-design";
const input = {
  width: 1000,
  height: 700,
  depth: 550,
  quantity: 12,
  ral: "7024",
  screen: "round",
};
test("basket dimensions survive handoff in width-height-depth order", () => {
  const url = new URL(basketBriefHref(input), "https://www.steelprodukt.ru");
  const summary = basketBriefSummary(url.searchParams);
  assert.match(summary ?? "", /1000 × 700 × 550 мм/);
  assert.match(summary ?? "", /12 шт/);
  assert.match(summary ?? "", /RAL 7024/);
  assert.match(summary ?? "", /Круглая перфорация/);
  assert.match(summary ?? "", /подтвердить/);
  assert.equal(url.hash, "#contact-form");
});
test("invalid dimensions and untrusted finish cannot become a manufacturing brief", () => {
  for (const patch of [
    { width: 0 },
    { height: -1 },
    { depth: NaN },
    { quantity: 1.5 },
    { width: Infinity },
    { width: 10001 },
  ])
    assert.throws(() => basketBriefHref({ ...input, ...patch }));
  const url = new URL(basketBriefHref(input), "https://www.steelprodukt.ru");
  url.searchParams.set("basketRal", "<script>alert(1)</script>");
  assert.equal(basketBriefSummary(url.searchParams), null);
  url.searchParams.set("basketRal", "7024");
  url.searchParams.set("basketScreen", "unknown");
  assert.equal(basketBriefSummary(url.searchParams), null);
});
test("unrelated form handoffs are ignored", () =>
  assert.equal(
    basketBriefSummary(new URLSearchParams("source=online-order")),
    null,
  ));

test("wide slots retain their name in the contact query and TXT brief", () => {
  const design = defaultBasketDesign();
  design.front.pattern = "wide-slots";
  design.side.pattern = "wide-slots";
  const url = new URL(basketBriefHref({ ...input, screen: "wide-slots", design }), "https://www.steelprodukt.ru");
  assert.equal(url.searchParams.get("basketScreen"), "wide-slots");
  assert.equal(url.pathname, "/contacts");
  assert.equal(url.hash, "#contact-form");
  const summary = basketBriefSummary(url.searchParams) ?? "";
  assert.match(summary, /Экран: 10 длинных прорезей\./);
  assert.match(summary, /Передняя панель: 10 длинных продолговатых прорезей/);
  assert.doesNotMatch(summary, /Рисунок по проекту/);
  // Older saved links used "custom" for every non-round/short-slot pattern.
  url.searchParams.set("basketScreen", "custom");
  assert.match(basketBriefSummary(url.searchParams) ?? "", /Экран: 10 длинных прорезей\./);
  const normalized = new URL(basketBriefHref({ ...input, screen: "custom", design }), "https://www.steelprodukt.ru");
  assert.equal(normalized.searchParams.get("basketScreen"), "wide-slots");
});

test("lamella and solid panels also keep distinct short descriptions", () => {
  for (const [screen, label] of [["lamella", "Ламели"], ["solid", "Без перфорации"]]) {
    const url = new URL(basketBriefHref({ ...input, screen }), "https://www.steelprodukt.ru");
    assert.ok(basketBriefSummary(url.searchParams)?.includes(`Экран: ${label}.`));
  }
});
