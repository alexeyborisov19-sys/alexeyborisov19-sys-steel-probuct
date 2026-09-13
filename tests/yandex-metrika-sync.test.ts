import assert from "node:assert/strict";
import test from "node:test";
import { yandexGoalByEvent } from "@/lib/analytics";
import { collectDesiredTargets, METRIKA_GOAL_METADATA } from "@/scripts/sync-yandex-metrika";

test("Metrika sync metadata covers every reachGoal target exactly once", () => {
  const siteTargets = [...new Set(Object.values(yandexGoalByEvent).flat())].sort();
  const syncTargets = collectDesiredTargets();
  const metadataTargets = Object.keys(METRIKA_GOAL_METADATA).sort();

  assert.deepEqual(syncTargets, siteTargets);
  assert.deepEqual(metadataTargets, siteTargets);
});

test("Metrika goal display names are unique and key conversions are favorites", () => {
  const names = Object.values(METRIKA_GOAL_METADATA).map((goal) => goal.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(METRIKA_GOAL_METADATA.quote_request_success.favorite, true);
  assert.equal(METRIKA_GOAL_METADATA.assistant_lead_success.favorite, true);
  assert.equal(METRIKA_GOAL_METADATA["ym-submit-leadform"].favorite, true);
});

test("site emits the primary Direct optimization goal on successful quote requests", () => {
  assert.ok(yandexGoalByEvent.quote_request_success.includes("quote_request_success"));
  assert.ok(yandexGoalByEvent.quote_request_success.includes("ym-submit-leadform"));
});
