import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { withAttribution } from "../lib/attribution-link";

test("CAD handoff retains campaign and calculation without copying unrelated input", () => {
  const result = new URL(withAttribution("/contacts?calc=calc-123&source=online-order#contact-form", "https://www.steelprodukt.ru/online-order?utm_campaign=laser&yclid=123&email=private"), "https://www.steelprodukt.ru");
  assert.equal(result.searchParams.get("utm_campaign"), "laser");
  assert.equal(result.searchParams.get("yclid"), "123");
  assert.equal(result.searchParams.get("calc"), "calc-123");
  assert.equal(result.searchParams.has("email"), false);
  assert.equal(result.hash, "#contact-form");
});
test("external destinations and explicit campaign values are preserved", () => {
  assert.equal(withAttribution("https://example.com/", "https://www.steelprodukt.ru/?yclid=123"), "https://example.com/");
  assert.equal(withAttribution("/contacts?utm_campaign=own", "https://www.steelprodukt.ru/?utm_campaign=incoming"), "/contacts?utm_campaign=own");
});

test("product detail links and shared breadcrumbs use the campaign-preserving component", async () => {
  for (const path of ["app/(public)/products/[slug]/page.tsx", "components/PageLayout.tsx"]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /import \{ AttributionLink as Link \} from/, `${path}: internal navigation must retain campaign parameters`);
    assert.doesNotMatch(source, /import Link from "next\/link"/);
  }
});
