import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasAnalyticsConsent } from "../components/CookieConsent";

function withStorage(read: () => string | null, callback: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: read } },
  });
  try {
    callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

const storedChoice = (analytics: boolean) => JSON.stringify({
  version: 2,
  necessary: true,
  analytics,
  updatedAt: "2026-09-21T00:00:00.000Z",
});

test("analytics requires the visitor's valid explicit choice", async (t) => {
  await t.test("no stored choice does not authorize analytics", () => {
    withStorage(() => null, () => assert.equal(hasAnalyticsConsent(), false));
  });
  await t.test("explicit permission authorizes analytics", () => {
    withStorage(() => storedChoice(true), () => assert.equal(hasAnalyticsConsent(), true));
  });
  await t.test("explicit refusal does not authorize analytics", () => {
    withStorage(() => storedChoice(false), () => assert.equal(hasAnalyticsConsent(), false));
  });
  await t.test("malformed storage fails closed", () => {
    withStorage(() => "{invalid", () => assert.equal(hasAnalyticsConsent(), false));
  });
  await t.test("unavailable storage fails closed", () => {
    withStorage(() => { throw new Error("Storage unavailable"); }, () => {
      assert.equal(hasAnalyticsConsent(), false);
    });
  });
  await t.test("old schema does not count as current consent", () => {
    withStorage(() => JSON.stringify({ version: 1, necessary: true, analytics: true }), () => {
      assert.equal(hasAnalyticsConsent(), false);
    });
  });
  await t.test("a string is not a boolean permission", () => {
    withStorage(() => JSON.stringify({ version: 2, necessary: true, analytics: "true" }), () => {
      assert.equal(hasAnalyticsConsent(), false);
    });
  });
  await t.test("incomplete storage does not authorize analytics", () => {
    withStorage(() => JSON.stringify({ version: 2, analytics: true }), () => {
      assert.equal(hasAnalyticsConsent(), false);
    });
  });
});

test("Metrika uses the counter-specific loader behind the consent gate", () => {
  const source = readFileSync(new URL("../components/Analytics.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("https://mc.yandex.ru/metrika/tag.js?id=${counterIds[0]}"));
  assert.ok(source.includes("if (!analyticsAllowed) return null;"));
  assert.ok(source.includes("{counterIds.length ? <Script"));
  assert.doesNotMatch(source, /<noscript|rel=["']preconnect/);
});


test("public legal copy matches explicit opt-in and Webvisor hides sensitive surfaces", () => {
  const cookies = readFileSync(new URL("../app/(public)/legal/cookies/page.tsx", import.meta.url), "utf8");
  const privacy = readFileSync(new URL("../app/(public)/legal/privacy/page.tsx", import.meta.url), "utf8");
  const quote = readFileSync(new URL("../components/QuoteRequestForm.tsx", import.meta.url), "utf8");
  const assistant = readFileSync(new URL("../components/EngineeringAssistant.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(cookies, /Аналитика включена по умолчанию/);
  assert.match(cookies, /До выбора пользователя аналитика выключена/);
  assert.match(privacy, /Только после отдельного явного разрешения пользователя/);
  assert.match(quote, /ym-hide-content/);
  assert.match(assistant, /ym-hide-content/);
});
