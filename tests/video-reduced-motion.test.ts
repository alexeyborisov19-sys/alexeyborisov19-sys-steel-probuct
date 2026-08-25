import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const companyVideoPath = new URL("../components/CompanyVideo.tsx", import.meta.url);
const productionVideoPath = new URL("../components/ProductionVideo.tsx", import.meta.url);

function videoTag(source: string, marker: string) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing video marker: ${marker}`);
  const end = source.indexOf(">", start);
  assert.ok(end > start, `unterminated video tag: ${marker}`);
  return source.slice(start, end + 1);
}

test("automatic video previews respect reduced motion and page visibility", async () => {
  const [company, production] = await Promise.all([
    readFile(companyVideoPath, "utf8"),
    readFile(productionVideoPath, "utf8"),
  ]);

  const companyPreview = videoTag(company, "<video ref={previewVideoRef}");
  assert.match(company, /prefers-reduced-motion: reduce/);
  assert.match(company, /document\.visibilityState !== "visible"/);
  assert.match(company, /motionQuery\.matches/);
  assert.match(companyPreview, /preload="metadata"/);
  assert.ok(!companyPreview.includes("autoPlay"), "company preview must not use unconditional autoplay");

  const productionPreview = videoTag(production, "<video\n          ref={videoRef}");
  assert.match(production, /prefers-reduced-motion: reduce/);
  assert.match(production, /document\.visibilityState !== "visible"/);
  assert.match(production, /manualPlaybackRef/);
  assert.match(production, /onClick=\{\(\) => void startVideo\(true\)\}/);
  assert.match(productionPreview, /preload="metadata"/);
  assert.ok(!productionPreview.includes("autoPlay"), "production preview must not use unconditional autoplay");
  assert.ok(!production.includes('preload="auto"'), "production video must not eagerly preload the full clip");
});
