import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(public)/products/metallokassety/bim/page.tsx", import.meta.url), "utf8");

test("BIM configurator has a named level-two section before its level-three controls", () => {
  assert.match(page, /<section aria-labelledby="bim-config-title"/);
  const heading = page.indexOf('<h2 id="bim-config-title"');
  const configurator = page.indexOf("<CassetteBimConfigurator");
  assert.ok(heading >= 0 && configurator > heading);
});

test("BIM calculation and engineer actions retain same-origin campaign attribution", () => {
  for (const href of ["/contacts#contact-form", "/products/metallokassety#calculator-metallokasset"]) {
    const linkStart = page.indexOf(`<AttributionLink className="underline underline-offset-4" href="${href}"`);
    assert.ok(linkStart >= 0, `Missing attribution-aware action: ${href}`);
  }
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});
