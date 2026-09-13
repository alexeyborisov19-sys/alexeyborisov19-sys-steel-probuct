import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CANONICAL_YANDEX_COUNTER_ID,
  createResettableOnce,
  sanitizeAnalyticsParams,
  trackLeadEvent,
  yandexCounterIds,
} from "@/lib/analytics";

type GoalCall = [number, string, string, Record<string, unknown>];

function withAnalyticsWindow(callback: (calls: GoalCall[]) => void) {
  const previousWindow = globalThis.window;
  const previousCounterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  const calls: GoalCall[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ym: (...args: GoalCall) => calls.push(args),
    },
  });
  process.env.NEXT_PUBLIC_YM_COUNTER_ID = String(CANONICAL_YANDEX_COUNTER_ID);
  try {
    callback(calls);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: Window }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    if (previousCounterId === undefined) delete process.env.NEXT_PUBLIC_YM_COUNTER_ID;
    else process.env.NEXT_PUBLIC_YM_COUNTER_ID = previousCounterId;
  }
}

test("sends every quote funnel goal to the canonical analytics counter", () => {
  withAnalyticsWindow((calls) => {
    trackLeadEvent("quote_form_started", { form_location: "contacts" });
    trackLeadEvent("quote_file_attached", { files_added: 1 });
    trackLeadEvent("quote_request_submit", { has_files: true });
    trackLeadEvent("quote_request_success", { files_count: 1 });
    trackLeadEvent("quote_request_error", { error_code: "UPLOAD_REJECTED" });

    const goalsInOrder = [...new Set(calls.map((call) => call[2]))];
    assert.deepEqual(goalsInOrder, [
      "ym-open-leadform",
      "quote_form_started",
      "quote_file_attached",
      "quote_request_submit",
      "ym-submit-leadform",
      "quote_request_success",
      "quote_request_error",
    ]);
    assert.ok(calls.every((call) => call[1] === "reachGoal"));

    for (const goal of goalsInOrder) {
      assert.deepEqual(
        calls.filter((call) => call[2] === goal).map((call) => call[0]),
        [CANONICAL_YANDEX_COUNTER_ID],
        `goal ${goal} must reach the canonical analytics counter exactly once`,
      );
    }
  });
});

test("legacy or unknown Metrica counters fail closed", () => {
  const previousCounterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  try {
    for (const legacyId of ["111263638", "112129777", "999999999", ""]) {
      process.env.NEXT_PUBLIC_YM_COUNTER_ID = legacyId;
      assert.deepEqual(yandexCounterIds(), [], `counter ${legacyId || "<empty>"} must be rejected`);
    }
    process.env.NEXT_PUBLIC_YM_COUNTER_ID = String(CANONICAL_YANDEX_COUNTER_ID);
    assert.deepEqual(yandexCounterIds(), [CANONICAL_YANDEX_COUNTER_ID]);
  } finally {
    if (previousCounterId === undefined) delete process.env.NEXT_PUBLIC_YM_COUNTER_ID;
    else process.env.NEXT_PUBLIC_YM_COUNTER_ID = previousCounterId;
  }
});

test("the form-start goal fires once per form completion cycle", () => {
  let count = 0;
  const once = createResettableOnce(() => { count += 1; });
  once.fire();
  once.fire();
  assert.equal(count, 1);
  once.reset();
  once.fire();
  assert.equal(count, 2);
});

test("removes personal data and message content from analytics parameters", () => {
  const personalValues = [
    "Алексей",
    "person@example.ru",
    "+7 999 111-22-33",
    "Секретный чертёж",
    "ООО Заказчик",
    "drawing.pdf",
  ];
  const safe = sanitizeAnalyticsParams({
    name: personalValues[0],
    email: personalValues[1],
    phone: personalValues[2],
    message_content: personalValues[3],
    company: personalValues[4],
    file_name: personalValues[5],
    form_location: "contacts",
    files_count: 2,
    error_code: "UPLOAD_REJECTED",
  });
  const serialized = JSON.stringify(safe);
  assert.deepEqual(safe, {
    form_location: "contacts",
    files_count: 2,
    error_code: "UPLOAD_REJECTED",
  });
  assert.ok(personalValues.every((value) => !serialized.includes(value)));
});

test("never passes personal data to the Yandex goal callback", () => {
  withAnalyticsWindow((calls) => {
    trackLeadEvent("quote_request_error", {
      name: "Алексей",
      email: "person@example.ru",
      phone: "+7 999 111-22-33",
      message: "Содержимое заявки",
      error_code: "NETWORK_ERROR",
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][3], { error_code: "NETWORK_ERROR" });
  });
});

test("Metrika host is absent from pre-consent client source", () => {
  const source = readFileSync(resolve("components/Analytics.tsx"), "utf8");
  assert.equal(source.includes("mc.yandex.ru"), false);
  assert.equal(source.includes("mc.yandex.com"), false);
  assert.match(source, /if \(!analyticsAllowed\) return null/);
  assert.match(source, /\['mc','yandex','ru'\]\.join\('\.'\)/);
});
