import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configPath = new URL("../next.config.ts", import.meta.url);

test("stable public image filenames are revalidated instead of cached immutable for a year", async () => {
  const config = await readFile(configPath, "utf8");

  assert.match(config, /source: "\/images\/:path\*"/);
  assert.match(config, /public, max-age=86400, stale-while-revalidate=604800/);
  assert.doesNotMatch(config, /source: "\/images\/web\/:path\*"[\s\S]{0,180}immutable/);
  assert.doesNotMatch(config, /max-age=31536000, immutable/);
});
