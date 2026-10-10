import assert from "node:assert/strict";
import test from "node:test";
import { createCookieChoiceStore, observeCookieChoiceStorage } from "../lib/cookie-consent-state";
import { createMetrikaLifecycle, type MetrikaCommand } from "../lib/analytics-runtime-control";

const key = "steelprodukt-cookie-consent-v2";
const record = (analytics: boolean) => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: "2026-10-10T12:00:00.000Z" });
const blocked = () => { throw new Error("Storage blocked"); };

function fixture(initial: string | null = null) {
  let value = initial;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = null; } };
  const store = createCookieChoiceStore(key);
  const target = new EventTarget();
  const stop = observeCookieChoiceStorage({ target, key, consentEvent: "consent", getStorage: () => storage });
  function change(storageKey: string | null = key, storageArea: unknown = storage, newValue: string | null = record(true)) {
    const event = new Event("storage");
    Object.defineProperties(event, { key: { value: storageKey }, storageArea: { value: storageArea }, newValue: { value: newValue } });
    target.dispatchEvent(event);
  }
  return { storage, store, target, stop, change, set: (next: string | null) => { value = next; } };
}

for (const operation of ["refuse", "remove", "clear"] as const) {
  test(`a second tab's ${operation} destroys the active counter and clears pending work`, () => {
    const f = fixture(record(true));
    const calls: unknown[][] = [];
    const runtime = { ym: ((...args: unknown[]) => calls.push(args)) as MetrikaCommand, steelPendingGoals: ["old"] };
    const lifecycle = createMetrikaLifecycle([112542227], {});
    lifecycle.start(runtime, true);
    f.target.addEventListener("consent", () => { if (f.store.read(() => f.storage)?.analytics !== true) lifecycle.stop(runtime); });
    f.set(operation === "refuse" ? record(false) : null);
    f.change(operation === "clear" ? null : key);
    assert.deepEqual(calls, [[112542227, "init", {}], [112542227, "destruct"]]);
    assert.deepEqual(runtime.steelPendingGoals, []);
    f.stop();
  });
}

test("a failed refusal never reloads into a stale persistent grant or accepts a stale event", () => {
  const f = fixture(record(true));
  f.storage.setItem = blocked;
  f.storage.removeItem = blocked;
  assert.equal(f.store.write(false, () => f.storage), false);
  f.change();
  assert.equal(f.store.read(() => f.storage)?.analytics, false);
  assert.equal(f.store.canReloadAfterRevocation(() => f.storage), false);
  assert.equal(f.storage.getItem(), record(true));
  f.stop();
});

test("a failed grant stays disabled even when stale persisted permission is readable", () => {
  const f = fixture(record(true));
  f.storage.setItem = blocked;
  assert.equal(f.store.write(true, () => f.storage), false);
  assert.equal(f.store.read(() => f.storage), null);
  f.change();
  assert.equal(f.store.read(() => f.storage), null);
  f.stop();
});

test("quota failure can remove an older grant but never triggers a failed-write reload", () => {
  const f = fixture(record(true));
  f.storage.setItem = blocked;
  assert.equal(f.store.write(false, () => f.storage), false);
  assert.equal(f.storage.getItem(), null);
  assert.equal(f.store.read(() => f.storage)?.analytics, false);
  assert.equal(f.store.canReloadAfterRevocation(() => f.storage), false);
  f.stop();
});

test("successful explicit regrant replaces the failed-write refusal", () => {
  const f = fixture(record(true));
  const setItem = f.storage.setItem;
  f.storage.setItem = blocked;
  f.store.write(false, () => f.storage);
  f.storage.setItem = setItem;
  assert.equal(f.store.write(true, () => f.storage), true);
  assert.equal(f.store.read(() => f.storage)?.analytics, true);
  f.stop();
});

test("a cached persistent grant is not reused when reads become unavailable", () => {
  const f = fixture(record(true));
  assert.equal(f.store.read(() => f.storage)?.analytics, true);
  f.storage.getItem = blocked;
  assert.equal(f.store.read(() => f.storage), null);
  assert.equal(f.store.canReloadAfterRevocation(() => f.storage), false);
  f.stop();
});

test("unrelated keys, sessionStorage and events after cleanup do not trigger consent changes", () => {
  const f = fixture(record(true));
  let events = 0;
  f.target.addEventListener("consent", () => { events += 1; });
  f.change("another-key");
  f.change(key, {});
  f.stop();
  f.change(null);
  assert.equal(events, 0);
});

test("storage synchronization reads the current value rather than a queued stale newValue", () => {
  const f = fixture(record(false));
  f.change(key, f.storage, record(true));
  assert.equal(f.store.read(() => f.storage)?.analytics, false);
  f.set(record(true));
  f.change(key, f.storage, record(false));
  assert.equal(f.store.read(() => f.storage)?.analytics, true);
  f.stop();
});

for (const [name, updatedAt] of [
  ["missing", undefined], ["null", null], ["numeric", 0], ["empty", ""], ["invalid", "not-a-date"],
] as const) {
  test(`a ${name} consent timestamp cannot authorize analytics`, () => {
    const f = fixture(JSON.stringify({ version: 2, necessary: true, analytics: true, updatedAt }));
    assert.equal(f.store.read(() => f.storage), null);
    f.stop();
  });
}

test("a valid historical consent timestamp stays valid without an invented expiry", () => {
  const f = fixture(JSON.stringify({ version: 2, necessary: true, analytics: true, updatedAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(f.store.read(() => f.storage)?.analytics, true);
  f.stop();
});
