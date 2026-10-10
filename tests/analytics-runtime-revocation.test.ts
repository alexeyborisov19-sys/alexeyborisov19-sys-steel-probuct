import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

const code = transformSync(readFileSync(resolve("components/Analytics.tsx"), "utf8"), {
  loader: "tsx", format: "cjs", jsx: "automatic",
}).code;
const require = createRequire(import.meta.url);

type ScriptElement = { props: { onReady(): void; children: string } };

function runtimePage() {
  let allowed = true;
  let flushed = 0;
  let insertedTags = 0;
  const effects: (() => void | (() => void))[] = [];
  const cleanups: (() => void)[] = [];
  const calls: unknown[][] = [];
  type QueueCommand = ((...args: unknown[]) => void) & { a?: unknown[][] };
  const window = Object.assign(new EventTarget(), {
    location: { pathname: "/contacts" },
    steelPendingGoals: ["old-goal"] as unknown[],
    ym: undefined as QueueCommand | undefined,
    dataLayer: [] as unknown[],
  });
  const document = {
    scripts: [], addEventListener() {}, removeEventListener() {},
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore() { insertedTags += 1; } } }],
  };
  const compiledModule = { exports: {} as { Analytics(): { props: { children: ScriptElement } } } };
  const sandbox = { get ym() { return window.ym; }, window, document, module: compiledModule, exports: compiledModule.exports, process: { env: {} }, queueMicrotask,
    require(name: string) {
      if (name === "react") return {
        useCallback: (callback: unknown) => callback,
        useState: () => [true, () => {}], useRef: (initial: unknown) => ({ current: initial }),
        useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      };
      if (name === "next/navigation") return { usePathname: () => "/contacts" };
      if (name === "next/script") return { default: "script" };
      if (name === "./CookieConsent") return { consentEvent: "consent", hasAnalyticsConsent: () => allowed };
      if (name === "@/lib/analytics") return { yandexCounterIds: () => [112542227], flushPendingAnalyticsGoals: () => { flushed += 1; }, trackLeadEvent() {} };
      if (name.startsWith("@/")) return require(resolve(`${name.slice(2)}.ts`));
      return require(name);
    },
  };
  runInNewContext(code, sandbox);
  const rendered = compiledModule.exports.Analytics();
  for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  const script = rendered.props.children;
  let inserted = false;
  function ready() {
    // Match Next: onReady first, synchronous inline insertion next, then microtasks.
    script.props.onReady();
    if (!inserted) runInNewContext(script.props.children, sandbox);
    inserted = true;
  }
  return {
    window, ready, calls, flushed: () => flushed, tags: () => insertedTags,
    refuse() { allowed = false; window.dispatchEvent(new Event("consent")); },
    grant() { allowed = true; window.dispatchEvent(new Event("consent")); },
    unmount() { for (const cleanup of cleanups) cleanup(); },
    queue: () => Array.from(window.ym?.a ?? [], command => Array.from(command)),
    deliverVendor() {
      const queued = window.ym?.a ?? [];
      window.ym = (...args: unknown[]) => { calls.push(args); };
      for (const command of queued) window.ym(...command);
    },
  };
}

test("revocation removes pending init and goals before a delayed vendor executes", async () => {
  const page = runtimePage();
  page.ready();
  await Promise.resolve();
  assert.equal(page.queue().filter(call => call[1] === "init").length, 1);
  page.window.ym?.(112542227, "reachGoal", "old-goal");
  page.refuse();
  assert.deepEqual(page.queue(), [[112542227, "destruct"]]);
  assert.deepEqual(page.window.steelPendingGoals, []);
  page.deliverVendor();
  assert.deepEqual(page.calls, [[112542227, "destruct"]]);
  page.unmount();
});

test("an already loaded runtime is destroyed once and regrant initializes once", async () => {
  const page = runtimePage();
  page.ready();
  await Promise.resolve();
  page.deliverVendor();
  page.refuse();
  page.refuse();
  assert.equal(page.calls.filter(call => call[1] === "destruct").length, 1);
  page.grant();
  page.ready();
  page.ready();
  await Promise.resolve();
  assert.equal(page.calls.filter(call => call[1] === "init").length, 2);
  page.unmount();
});

test("a ready microtask cannot initialize after revocation or unmount", async () => {
  for (const interrupt of ["refuse", "unmount"] as const) {
    const page = runtimePage();
    page.ready();
    page[interrupt]();
    await Promise.resolve();
    assert.equal(page.queue().filter(call => call[1] === "init").length, 0, interrupt);
    assert.equal(page.flushed(), 0, interrupt);
    page.unmount();
  }
});

test("revocation clears ecommerce records before the next runtime initialization", async () => {
  const page = runtimePage();
  page.ready();
  await Promise.resolve();
  const records = page.window.dataLayer;
  records.push({ ecommerce: { detail: { products: [{ id: "before-revocation" }] } } });
  page.refuse();
  assert.equal(page.window.dataLayer, records);
  assert.deepEqual(records, []);
  page.unmount();
});

test("a rapid regrant restarts the existing runtime even before Script remounts", async () => {
  const page = runtimePage();
  page.ready();
  await Promise.resolve();
  page.deliverVendor();
  page.refuse();
  page.grant();
  await Promise.resolve();
  assert.equal(page.calls.filter(call => call[1] === "init").length, 2);
  page.unmount();
});


test("revoking before the readiness microtask prevents even the vendor tag request", async () => {
  const page = runtimePage();
  page.ready();
  page.refuse();
  await Promise.resolve();
  assert.equal(page.tags(), 0);
  page.unmount();
});

for (const phase of ["without-consent", "revoked", "unknown"]) {
test(`the mocked browser audit fails on a vendor attempt in ${phase} instead of silently aborting it`, async () => {
  const source = readFileSync(resolve("scripts/audit-consent-revocation.mjs"), "utf8");
  const routeBody = source.match(/await context\.route\('\*\*\/\*', async route => \{([\s\S]+?)\n  \}\);/)?.[1];
  assert.ok(routeBody);
  const finishBody = source.match(/async function finish\(f\) \{([\s\S]+?)\n?\}/)?.[1];
  assert.ok(finishBody);
  const forbiddenAnalyticsAttempts: unknown[] = [];
  const transport = { vendorTagAttempts: 0, fulfilledVendorMocks: 0, blockedExternalAttempts: 0, blockedVendorAttempts: 0, blockedMutationAttempts: 0, vendorAttemptsByConsentPhase: {} as Record<string, number>, forbiddenAnalyticsAttempts };
  const audit: { empty?: unknown[]; handle?: (route: unknown) => Promise<void>; finish?: (fixture: unknown) => Promise<void> } = {};
  runInNewContext(`audit.handle = async route => {${routeBody}}; audit.finish = async f => {${finishBody}}; audit.empty = [];`, {
    audit, assert, URL, origin: "http://127.0.0.1:3000", vendorStub: "mock vendor", tags: 0,
    delayed: false, released: Promise.resolve(), transport, forbiddenAnalyticsAttempts,
  });
  let aborted = false;
  await audit.handle!({
    request: () => ({ url: () => "https://mc.yandex.ru/watch/112542227", method: () => "POST", frame: () => ({ evaluate: async () => phase }) }),
    abort: async () => { aborted = true; },
    continue: async () => { throw new Error("Forbidden request forwarded"); },
    fulfill: async () => { throw new Error("Collector must not be mocked as a loader"); },
  });
  assert.equal(aborted, true);
  assert.equal(transport.blockedExternalAttempts, 1);
  assert.equal(transport.blockedVendorAttempts, 1);
  assert.equal(transport.blockedMutationAttempts, 1);
  assert.equal(transport.fulfilledVendorMocks, 0);
  await assert.rejects(audit.finish!({ errors: audit.empty, forbiddenAnalyticsAttempts, context: { close: async () => {} } }), /forbidden analytics transport/i);
  let fulfilled = 0;
  await audit.handle!({
    request: () => ({ url: () => "https://mc.yandex.ru/metrika/tag.js?id=112542227", method: () => "GET", frame: () => ({ evaluate: async () => "permitted" }) }),
    fulfill: async () => { fulfilled += 1; },
    abort: async () => { throw new Error("Permitted mock loader unexpectedly blocked"); },
    continue: async () => { throw new Error("Vendor request escaped the mock"); },
  });
  assert.equal(fulfilled, 1);
  assert.equal(transport.vendorTagAttempts, 1);
  assert.equal(transport.fulfilledVendorMocks, 1);
  assert.equal(transport.blockedVendorAttempts, 1);
});

}


test("the audit phase oracle never treats a known failed grant as permission", () => {
  const source = readFileSync(resolve("scripts/audit-consent-revocation.mjs"), "utf8");
  const body = source.match(/document\.addEventListener\('click', event => \{([\s\S]+?)\n    \}, \{ capture: true \}\);/)?.[1];
  assert.ok(body);
  class ButtonTarget {
    constructor(readonly label: string) {}
    closest() { return { textContent: this.label }; }
  }
  const window = { __auditGrantPersistenceBlocked: true, __consentAuditPhase: "revoked" };
  const audit: { click?: (event: unknown) => void } = {};
  runInNewContext(`let explicitRefusal = true; audit.click = event => {${body}};`, { window, audit, Element: ButtonTarget });
  audit.click!({ target: new ButtonTarget("Разрешить аналитику") });
  assert.equal(window.__consentAuditPhase, "without-consent");
  window.__auditGrantPersistenceBlocked = false;
  audit.click!({ target: new ButtonTarget("Разрешить аналитику") });
  assert.equal(window.__consentAuditPhase, "permitted");
  audit.click!({ target: new ButtonTarget("Продолжить без аналитики") });
  assert.equal(window.__consentAuditPhase, "revoked");
});
