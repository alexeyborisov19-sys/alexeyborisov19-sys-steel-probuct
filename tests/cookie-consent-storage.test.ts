import assert from "node:assert/strict";
import test from "node:test";
import { createCookieChoiceStore, observeCookieChoiceStorage, parseCookieChoice } from "../lib/cookie-consent-state";

const key = "steelprodukt-cookie-consent-v2";
const consentEvent = "steelprodukt-cookie-consent";
const choice = (analytics: boolean) => JSON.stringify({ version: 2, necessary: true, analytics, updatedAt: "2026-10-01T00:00:00.000Z" });

function fixture(initial: string | null = null) {
  let value = initial;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
  return { storage, set: (next: string | null) => { value = next; }, getStorage: () => storage };
}

function change(target: EventTarget, storageKey: string | null, storageArea?: unknown) {
  const event = new Event("storage");
  Object.defineProperties(event, { key: { value: storageKey }, storageArea: { value: storageArea } });
  target.dispatchEvent(event);
}

function watched(initial: string | null = null) {
  const data = fixture(initial);
  const target = new EventTarget();
  const store = createCookieChoiceStore(key);
  let revoked = 0;
  let synchronized = 0;
  target.addEventListener(consentEvent, () => { synchronized += 1; });
  const stop = observeCookieChoiceStorage({ target, key, consentEvent, getStorage: data.getStorage, store, onRevoked: () => { revoked += 1; } });
  return { ...data, target, store, stop, revoked: () => revoked, synchronized: () => synchronized };
}

test("only a complete current explicit choice is accepted", () => {
  assert.equal(parseCookieChoice(choice(true))?.analytics, true);
  assert.equal(parseCookieChoice(choice(false))?.analytics, false);
  for (const invalid of [null, "", "null", "[]", "true", "{bad", "{}", JSON.stringify({ version: 2, necessary: true, analytics: true }), JSON.stringify({ version: 1, necessary: true, analytics: true, updatedAt: "2026-10-01" }), JSON.stringify({ version: 2, necessary: true, analytics: "true", updatedAt: "2026-10-01" }), JSON.stringify({ version: 2, necessary: true, analytics: true, updatedAt: "invalid" })]) {
    assert.equal(parseCookieChoice(invalid), null);
  }
});

test("deleting a readable record never resurrects the previous in-memory grant", () => {
  const data = fixture();
  const store = createCookieChoiceStore(key);
  store.write(true, data.getStorage);
  data.set(null);
  assert.equal(store.read(data.getStorage), null);
  assert.equal(store.read(() => { throw new Error("blocked"); }), null);
});

test("corrupting a readable record invalidates a previous grant", () => {
  const data = fixture();
  const store = createCookieChoiceStore(key);
  store.write(true, data.getStorage);
  data.set("{broken");
  assert.equal(store.read(data.getStorage), null);
});

test("blocked reads and writes preserve only a deliberate current-document choice", () => {
  const store = createCookieChoiceStore(key);
  const blocked = () => { throw new Error("storage blocked"); };
  assert.equal(store.read(blocked), null);
  store.write(true, blocked);
  assert.equal(store.read(blocked)?.analytics, true);
  store.write(false, blocked);
  assert.equal(store.read(blocked)?.analytics, false);
  store.invalidate();
  assert.equal(store.read(blocked), null);
});

test("failed writes do not replace an explicit refusal with an older persisted grant", () => {
  const storage = { getItem: () => choice(true), setItem: () => { throw new Error("quota"); } };
  const store = createCookieChoiceStore(key);
  store.write(false, () => storage);
  assert.equal(store.read(() => storage)?.analytics, false);
});

test("failed writes with readable empty storage retain explicit current-document permission", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const store = createCookieChoiceStore(key);
  store.write(true, () => storage);
  assert.equal(store.read(() => storage)?.analytics, true);
});

test("a remote refusal synchronizes and reloads a previously consented tab", () => {
  const f = watched(choice(true));
  f.set(choice(false));
  change(f.target, key, f.storage);
  assert.equal(f.store.read(f.getStorage)?.analytics, false);
  assert.equal(f.synchronized(), 1);
  assert.equal(f.revoked(), 1);
  change(f.target, key, f.storage);
  assert.equal(f.revoked(), 1);
  f.stop();
});

test("remote deletion and localStorage.clear both revoke active permission", () => {
  for (const storageKey of [key, null]) {
    const f = watched(choice(true));
    f.set(null);
    change(f.target, storageKey, f.storage);
    assert.equal(f.store.read(f.getStorage), null);
    assert.equal(f.revoked(), 1);
    f.stop();
  }
});

test("a remote grant synchronizes without unnecessary reload", () => {
  const f = watched(choice(false));
  f.set(choice(true));
  change(f.target, key, f.storage);
  assert.equal(f.store.read(f.getStorage)?.analytics, true);
  assert.equal(f.synchronized(), 1);
  assert.equal(f.revoked(), 0);
  f.stop();
});

test("unrelated keys and sessionStorage events are ignored", () => {
  const f = watched(choice(true));
  f.set(choice(false));
  change(f.target, "another-key", f.storage);
  change(f.target, key, fixture().storage);
  assert.equal(f.synchronized(), 0);
  assert.equal(f.revoked(), 0);
  f.stop();
});

test("the latest stored choice wins over queued stale events", () => {
  const f = watched(choice(true));
  const event = new Event("storage");
  Object.defineProperties(event, { key: { value: key }, storageArea: { value: f.storage }, newValue: { value: choice(false) } });
  f.target.dispatchEvent(event);
  assert.equal(f.store.read(f.getStorage)?.analytics, true);
  assert.equal(f.revoked(), 0);
  f.stop();
});

test("same-tab changes update the baseline used for a later remote revocation", () => {
  const f = watched();
  f.store.write(true, f.getStorage);
  f.target.dispatchEvent(new Event(consentEvent));
  f.set(choice(false));
  change(f.target, key, f.storage);
  assert.equal(f.revoked(), 1);
  f.stop();
});

test("the observer removes both listeners on unmount", () => {
  const f = watched(choice(true));
  f.stop();
  f.set(choice(false));
  change(f.target, key, f.storage);
  assert.equal(f.synchronized(), 0);
  assert.equal(f.revoked(), 0);
});
