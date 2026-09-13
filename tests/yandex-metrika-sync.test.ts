import assert from "node:assert/strict";
import test from "node:test";
import { yandexGoalByEvent } from "@/lib/analytics";
import {
  collectDesiredTargets,
  DESIRED_METRIKA_COUNTER_FLAGS,
  METRIKA_GOAL_METADATA,
  normalizeYandexOAuthToken,
} from "@/scripts/sync-yandex-metrika";

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

test("Metrika counter sync disables advanced first-party contact-data matching", () => {
  assert.deepEqual(DESIRED_METRIKA_COUNTER_FLAGS, {
    collect_first_party_data: false,
  });
});

test("site emits the primary Direct optimization goal on successful quote requests", () => {
  assert.ok(yandexGoalByEvent.quote_request_success.includes("quote_request_success"));
  assert.ok(yandexGoalByEvent.quote_request_success.includes("ym-submit-leadform"));
});

test("OAuth token normalization accepts safe copied formats", () => {
  const token = "05dd3dd84ff948fdae2bc4fb91f13e22bb1f289ceef0037";

  assert.equal(normalizeYandexOAuthToken(token), token);
  assert.equal(normalizeYandexOAuthToken(`OAuth ${token}`), token);
  assert.equal(normalizeYandexOAuthToken(`access_token=${token}&expires_in=31536000`), token);
  assert.equal(
    normalizeYandexOAuthToken(
      `https://oauth.yandex.ru/verification_code#access_token=${token}&expires_in=31536000`,
    ),
    token,
  );
  assert.equal(normalizeYandexOAuthToken(`"${token}"`), token);
});

test("OAuth token normalization rejects empty or unrelated URLs", () => {
  assert.throws(() => normalizeYandexOAuthToken("   "), /empty/);
  assert.throws(
    () => normalizeYandexOAuthToken("https://oauth.yandex.ru/verification_code"),
    /no access_token/,
  );
});
