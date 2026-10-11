import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

function inspect(value: unknown) {
  const html = `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import { inspectStructuredData } from './scripts/lib/structured-data-audit.mjs'; console.log(JSON.stringify(inspectStructuredData(${JSON.stringify(html)})));`], { encoding: "utf8" }));
}

test("honest Product is retained as an eligibility limitation, not an indexing error", () => {
  const result = inspect({ "@type": "Product", name: "Аквилон" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.eligibilityLimitations.length, 1);
  assert.equal(result.eligibilityLimitations[0].code, "PRODUCT_COMMERCE_MISSING");
});

test("a Product eligibility limitation cannot hide missing name or empty commerce", () => {
  assert.ok(inspect({ "@type": "Product" }).errors.some((x: { code: string }) => x.code === "PRODUCT_NAME_MISSING"));
  assert.ok(inspect({ "@type": "Product", name: "Item", offers: {} }).errors.some((x: { code: string }) => x.code === "PRODUCT_COMMERCE_EMPTY"));
});

test("Video required metadata errors remain critical, including impossible calendar dates", () => {
  const video = { "@type": "VideoObject", name: "Film", thumbnailUrl: "https://example.com/poster.png", uploadDate: "2026-07-21T08:17:40Z" };
  assert.deepEqual(inspect(video).errors, []);
  for (const date of [undefined, "yesterday", "2026-02-30T08:17:40Z"]) {
    assert.ok(inspect({ ...video, uploadDate: date }).errors.some((x: { code: string }) => x.code === "VIDEO_UPLOAD_DATE_INVALID"));
  }
  assert.ok(inspect({ ...video, thumbnailUrl: "" }).errors.some((x: { code: string }) => x.code === "VIDEO_THUMBNAIL_INVALID"));
});

test("graph, array type and malformed JSON are covered without claiming Google eligibility", () => {
  assert.equal(inspect({ "@graph": [{ "@type": ["Product", "Thing"], name: "Item" }] }).eligibilityLimitations.length, 1);
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", "import { inspectStructuredData } from './scripts/lib/structured-data-audit.mjs'; console.log(JSON.stringify(inspectStructuredData('<script type=\"application/ld+json\">{bad}</script>')));"], { encoding: "utf8" }));
  assert.equal(result.errors[0].code, "INVALID_JSON_LD");
  assert.equal(inspect({ "@type": "Product", name: "Item", review: { "@type": "Review", name: "A real review" } }).validationScope, "bounded-server-jsonld-check-not-google-eligibility");
});

test("SEO audit wires critical schema errors and separate limitations into its output", () => {
  const source = readFileSync("scripts/audit-seo.mjs", "utf8");
  assert.match(source, /inspectStructuredData\(html\)/);
  assert.match(source, /schemaErrors\.length/);
  assert.match(source, /eligibilityLimitations\.length/);
  assert.match(source, /errors\.length\s*\|\|\s*schemaErrors\.length/);
});
