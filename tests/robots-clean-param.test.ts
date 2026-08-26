import assert from "node:assert/strict";
import test from "node:test";
import { GET as getRobots } from "@/app/robots.txt/route";

const trackingParameters = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "yclid",
  "fbclid",
  "msclkid",
  "gad_source",
  "gbraid",
  "wbraid",
  "_openstat",
  "_ym_status-check",
] as const;

test("robots.txt consolidates tracking-only URL variants with Clean-param", async () => {
  const response = getRobots();
  assert.equal(response.status, 200);

  const robots = await response.text();
  const cleanParam = robots.match(/^Clean-param:\s*(.+)$/im)?.[1]?.trim();

  assert.ok(cleanParam, "Clean-param directive is missing");
  const configured = new Set(cleanParam.split("&"));

  for (const parameter of trackingParameters) {
    assert.ok(configured.has(parameter), `${parameter}: tracking parameter must remain covered by Clean-param`);
  }

  assert.match(robots, /^Sitemap: https:\/\/www\.steelprodukt\.ru\/sitemap\.xml$/im);
  assert.match(robots, /^Sitemap: https:\/\/www\.steelprodukt\.ru\/sitemap-images\.xml$/im);
});
