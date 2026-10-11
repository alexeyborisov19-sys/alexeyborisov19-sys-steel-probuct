import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

function atLeast(actual: string, minimum: number[]) {
  assert.match(actual, /^\d+\.\d+\.\d+$/, "security floor must resolve to a stable release");
  const parts = actual.split(".").map(Number);
  return parts[0] > minimum[0] || (parts[0] === minimum[0] && (parts[1] > minimum[1] || (parts[1] === minimum[1] && parts[2] >= minimum[2])));
}

test("Next and its ESLint configuration retain the patched compatible 15.x line", () => {
  const next = lock.packages["node_modules/next"].version;
  assert.match(next, /^15\./);
  assert.ok(atLeast(next, [15, 5, 27]));
  assert.equal(lock.packages["node_modules/eslint-config-next"].version, next);
  assert.equal(manifest.overrides.next.postcss, "$postcss");
  assert.equal(manifest.overrides.next.sharp, "$sharp");
});

test("Tailwind 3 uses the patched selector parser through scoped overrides", () => {
  assert.match(lock.packages["node_modules/tailwindcss"].version, /^3\./);
  assert.equal(manifest.overrides.tailwindcss["postcss-selector-parser"], "7.1.6");
  assert.equal(manifest.overrides["postcss-nested"]["postcss-selector-parser"], "7.1.6");
  const parsers = Object.entries(lock.packages).filter(([path]) => path.endsWith("node_modules/postcss-selector-parser"));
  assert.ok(parsers.length > 0);
  for (const [path, value] of parsers) {
    assert.ok(atLeast((value as { version: string }).version, [7, 1, 6]), `${path} must not retain the vulnerable parser`);
  }
});
