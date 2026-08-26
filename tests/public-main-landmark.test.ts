import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicMainSources = [
  new URL("../components/PageLayout.tsx", import.meta.url),
  new URL("../app/(public)/page.tsx", import.meta.url),
  new URL("../app/(public)/articles/page.tsx", import.meta.url),
  new URL("../app/(public)/articles/[slug]/page.tsx", import.meta.url),
  new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url),
];

test("every public page shell renders the skip-link target in server HTML", async () => {
  const sources = await Promise.all(publicMainSources.map((path) => readFile(path, "utf8")));

  for (const source of sources) {
    assert.match(source, /<main\s+id="main-content"\s+tabIndex=\{-1\}/);
  }
});

test("the SEO crawler preserves query parameters for optimized image requests", async () => {
  const auditSource = await readFile(new URL("../scripts/audit-seo.mjs", import.meta.url), "utf8");

  assert.match(auditSource, /imagePaths\.add\(src\)/);
  assert.doesNotMatch(auditSource, /imagePaths\.add\(src\.split\(\"\?\"\)\[0\]\)/);
});
