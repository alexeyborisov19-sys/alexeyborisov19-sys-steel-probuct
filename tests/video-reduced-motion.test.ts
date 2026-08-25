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

test("automatic video previews respect reduced motion, page visibility and viewport visibility", async () => {
  const [company, production] = await Promise.all([
    readFile(companyVideoPath, "utf8"),
    readFile(productionVideoPath, "utf8"),
  ]);

  const companyPreview = videoTag(company, "<video ref={previewVideoRef}");
  assert.match(company, /prefers-reduced-motion: reduce/);
  assert.match(company, /document\.visibilityState !== "visible"/);
  assert.match(company, /previewInViewportRef/);
  assert.match(company, /new IntersectionObserver/);
  assert.match(company, /entry\.isIntersecting/);
  assert.match(company, /threshold: 0\.15/);
  assert.match(companyPreview, /preload="none"/);
  assert.ok(!companyPreview.includes("autoPlay"), "company preview must not use unconditional autoplay");

  const productionPreview = videoTag(production, "<video\n          ref={videoRef}".replace("\\n", "\n"));
  assert.match(production, /prefers-reduced-motion: reduce/);
  assert.match(production, /document\.visibilityState !== "visible"/);
  assert.match(production, /inViewportRef/);
  assert.match(production, /new IntersectionObserver/);
  assert.match(production, /entry\.isIntersecting/);
  assert.match(production, /threshold: 0\.15/);
  assert.match(production, /manualPlaybackRef/);
  assert.match(production, /onClick=\{\(\) => void startVideo\(true\)\}/);
  assert.match(productionPreview, /preload="none"/);
  assert.ok(!productionPreview.includes("autoPlay"), "production preview must not use unconditional autoplay");
  assert.ok(!production.includes('preload="auto"'), "production video must not eagerly preload the full clip");
});
