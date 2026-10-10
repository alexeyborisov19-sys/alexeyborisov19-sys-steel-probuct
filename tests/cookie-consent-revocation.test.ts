import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";

// Exercise the real component's read/write seam without starting a browser.
// Only expose its existing private wrapper; storage is the external boundary.
const code = buildSync({
  stdin: {
    contents: `${readFileSync(resolve("components/CookieConsent.tsx"), "utf8")}\nexport { saveChoice };`,
    resolveDir: resolve("components"), loader: "tsx",
  },
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
}).outputFiles[0].text;

const key = "steelprodukt-cookie-consent-v2";
const saved = (analytics: boolean) => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: "2026-10-10T12:00:00.000Z" });

function consentHarness(initial: string | null = null) {
  let value = initial;
  let blockWrite = false;
  let blockRead = false;
  const window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem() { if (blockRead) throw new Error("Denied read"); return value; },
      setItem(_key: string, next: string) { if (blockWrite) throw new Error("Denied write"); value = next; },
      removeItem() { value = null; },
    },
  });
  const compiledModule = { exports: {} as { hasAnalyticsConsent(): boolean; saveChoice(analytics: boolean): void } };
  runInNewContext(code, { window, module: compiledModule, exports: compiledModule.exports, require: createRequire(import.meta.url), Event });
  return { ...compiledModule.exports, window, setStored(next: string | null) { value = next; }, blockWrite() { blockWrite = true; }, blockRead() { blockRead = true; }, key };
}

test("a current-document refusal overrides an older grant when storage rejects the write", () => {
  const page = consentHarness(saved(true));
  page.blockWrite();
  page.saveChoice(false);
  assert.equal(page.hasAnalyticsConsent(), false);
});

test("removing a successfully saved grant cannot resurrect its transient permission", () => {
  const page = consentHarness();
  page.saveChoice(true);
  assert.equal(page.hasAnalyticsConsent(), true);
  page.setStored(null);
  assert.equal(page.hasAnalyticsConsent(), false);
});

test("malformed replacement and denied reads cannot revive a cached persisted grant", () => {
  const page = consentHarness();
  page.saveChoice(true);
  page.setStored("{invalid");
  assert.equal(page.hasAnalyticsConsent(), false);
  page.blockRead();
  assert.equal(page.hasAnalyticsConsent(), false);
});

test("blocked storage fails closed for a grant but preserves a current-document refusal", () => {
  const page = consentHarness();
  page.blockWrite();
  page.blockRead();
  page.saveChoice(true);
  assert.equal(page.hasAnalyticsConsent(), false);
  page.saveChoice(false);
  assert.equal(page.hasAnalyticsConsent(), false);
});

test("an invalid persisted timestamp cannot leave the inline consent notice hidden", () => {
  const effects: (() => unknown)[] = [];
  const removed: string[] = [];
  const page = Object.assign(new EventTarget(), { localStorage: { getItem: () => JSON.stringify({ version: 2, necessary: true, analytics: true, updatedAt: "invalid" }) } });
  const compiledModule = { exports: {} as { CookieConsent(options: { inline: boolean }): unknown } };
  const require = createRequire(import.meta.url);
  runInNewContext(code, {
    window: page, Event, module: compiledModule, exports: compiledModule.exports,
    document: { getElementById: () => ({ removeAttribute: (name: string) => removed.push(name) }), documentElement: { style: { removeProperty() {} } } },
    require(name: string) {
      if (name === "react") return {
        useState: (initial: unknown) => [initial, () => {}], useRef: () => ({ current: null }),
        useEffect: (effect: () => unknown) => effects.push(effect),
      };
      if (name === "next/navigation") return { usePathname: () => "/calculator-metallokassety" };
      return require(name);
    },
  });
  compiledModule.exports.CookieConsent({ inline: true });
  for (const effect of effects) effect();
  assert.ok(removed.includes("data-cookie-stored"));
});
