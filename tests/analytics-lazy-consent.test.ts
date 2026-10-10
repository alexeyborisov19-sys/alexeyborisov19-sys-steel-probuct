import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

const code = transformSync(readFileSync(resolve("components/ConsentGatedAnalytics.tsx"), "utf8").replace('import("./Analytics")', 'globalThis.__loadAnalytics()'), {
  loader: "tsx", format: "cjs", jsx: "automatic", supported: { "dynamic-import": false },
}).code;
const require = createRequire(import.meta.url);
const drain = () => new Promise(resolve => setImmediate(resolve));

function lazyPage() {
  let allowed = true;
  let selected: unknown = null;
  let cleanup = () => {};
  let deliver!: (value: unknown) => void;
  const importResult = new Promise(resolve => { deliver = resolve; });
  const window = Object.assign(new EventTarget(), { steelPendingGoals: ["old-goal"] as unknown[] });
  const compiledModule = { exports: {} as { ConsentGatedAnalytics(): unknown } };
  runInNewContext(code, { window, module: compiledModule, exports: compiledModule.exports, __loadAnalytics: () => importResult,
    require(name: string) {
      if (name === "react") return {
        useState: () => [null, (value: unknown) => { selected = typeof value === "function" ? value() : value; }],
        useEffect: (effect: () => () => void) => { cleanup = effect(); },
      };
      if (name === "./CookieConsent") return { consentEvent: "consent", hasAnalyticsConsent: () => allowed };
      if (name === "@/lib/analytics") return { discardPendingAnalyticsGoals: () => { window.steelPendingGoals = []; } };
      return require(name);
    },
  });
  compiledModule.exports.ConsentGatedAnalytics();
  return {
    window, selected: () => selected, deliver,
    refuse() { allowed = false; window.dispatchEvent(new Event("consent")); },
    grant() { allowed = true; window.dispatchEvent(new Event("consent")); },
    unmount() { cleanup(); },
  };
}

test("a late analytics module cannot mount after revocation", async () => {
  const page = lazyPage();
  await drain();
  page.refuse();
  page.deliver({ Analytics: () => null });
  await drain();
  assert.equal(page.selected(), null);
  assert.deepEqual(page.window.steelPendingGoals, []);
  page.unmount();
});

test("revocation cancels the previous import but a later explicit grant can mount", async () => {
  const page = lazyPage();
  await drain();
  page.refuse();
  page.grant();
  const component = () => null;
  page.deliver({ Analytics: component });
  await drain();
  assert.equal(page.selected(), component);
  assert.deepEqual(page.window.steelPendingGoals, []);
  page.unmount();
});

test("a late analytics module cannot mount after the gate unmounts", async () => {
  const page = lazyPage();
  await drain();
  page.unmount();
  page.deliver({ Analytics: () => null });
  await drain();
  assert.equal(page.selected(), null);
});
