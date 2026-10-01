import assert from "node:assert/strict";
import test from "node:test";
import { createCookieChoiceStore, observeCookieChoiceStorage } from "../lib/cookie-consent-state";
import { createMetrikaLifecycle, type MetrikaCommand } from "../lib/analytics-runtime-control";

const key = "steelprodukt-cookie-consent-v2";
const record = (analytics: boolean) => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: "2026-10-01T00:00:00.000Z" });
const blocked = () => { throw new Error("Storage blocked"); };

test("a cached persisted grant is not a permission after reads become blocked", () => {
  const store = createCookieChoiceStore(key);
  const storage = { getItem: () => record(true), setItem: () => {} };
  assert.equal(store.read(() => storage)?.analytics, true);
  assert.equal(store.read(blocked), null);
  assert.equal(store.canReloadAfterRevocation(blocked), false);
});

test("a failed refusal write with an old grant forbids automatic reload", () => {
  const store = createCookieChoiceStore(key);
  const storage = { getItem: () => record(true), setItem: blocked, removeItem: blocked };
  store.write(false, () => storage);
  assert.equal(store.read(() => storage)?.analytics, false);
  assert.equal(store.canReloadAfterRevocation(() => storage), false);
});

test("quota failure removes the old grant when removal is permitted", () => {
  let saved: string | null = record(true);
  const store = createCookieChoiceStore(key);
  const storage = { getItem: () => saved, setItem: blocked, removeItem: (storageKey: string) => { assert.equal(storageKey, key); saved = null; } };
  store.write(false, () => storage);
  assert.equal(saved, null);
  assert.equal(store.read(() => storage)?.analytics, false);
  assert.equal(store.canReloadAfterRevocation(() => storage), true);
  assert.equal(createCookieChoiceStore(key).read(() => storage), null);
});

test("a stale storage event cannot replace an unpersisted explicit refusal", () => {
  const store = createCookieChoiceStore(key);
  const storage = { getItem: () => record(true), setItem: blocked };
  const target = new EventTarget();
  const stop = observeCookieChoiceStorage({ target, key, consentEvent: "consent", getStorage: () => storage, store, onRevoked: () => {} });
  store.write(false, () => storage);
  target.dispatchEvent(new Event("consent"));
  const event = new Event("storage");
  Object.defineProperties(event, { key: { value: key }, storageArea: { value: storage } });
  target.dispatchEvent(event);
  assert.equal(store.read(() => storage)?.analytics, false);
  stop();
});

test("Metrika lifecycle initializes once, stops, and initializes after a new permission", () => {
  const calls: unknown[][] = [];
  const runtime = { ym: ((...args: unknown[]) => calls.push(args)) as MetrikaCommand, steelPendingGoals: ["old-goal"] };
  const options = { webvisor: true, ssr: true };
  const lifecycle = createMetrikaLifecycle([112542227], options);
  assert.equal(lifecycle.start(runtime, false), false);
  assert.deepEqual(calls, []);
  assert.equal(lifecycle.start(runtime, true), true);
  assert.equal(lifecycle.start(runtime, true), true);
  lifecycle.stop(runtime);
  lifecycle.stop(runtime);
  assert.deepEqual(runtime.steelPendingGoals, []);
  assert.equal(lifecycle.start(runtime, true), true);
  assert.deepEqual(calls, [[112542227, "init", options], [112542227, "destruct"], [112542227, "init", options]]);
});

test("revocation drops queued init and goals before a late vendor download", () => {
  const queue: unknown[] = [];
  const ym = ((...args: unknown[]) => queue.push(args)) as MetrikaCommand;
  ym.a = queue;
  const runtime = { ym, steelPendingGoals: ["old-goal"] };
  const lifecycle = createMetrikaLifecycle([112542227], { webvisor: true });
  lifecycle.start(runtime, true);
  queue.push([112542227, "reachGoal", "quote_request_success"]);
  lifecycle.stop(runtime);
  assert.deepEqual(queue, [[112542227, "destruct"]]);
  assert.deepEqual(runtime.steelPendingGoals, []);
});

test("missing or failing optional vendor runtime does not break consent handling", () => {
  const lifecycle = createMetrikaLifecycle([112542227], {});
  assert.equal(lifecycle.start({}, true), false);
  const runtime = { ym: blocked as MetrikaCommand };
  assert.equal(lifecycle.start(runtime, true), false);
  assert.doesNotThrow(() => lifecycle.stop(runtime));
});
