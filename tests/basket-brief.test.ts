import { test } from "node:test";
import assert from "node:assert/strict";
import { basketBriefSummary, basketBriefHref } from "../lib/quote/basket-brief";
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
