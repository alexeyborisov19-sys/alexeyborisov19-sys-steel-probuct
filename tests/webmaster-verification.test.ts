import assert from "node:assert/strict";
import test from "node:test";
import { metadata } from "@/app/(public)/layout";
import { siteConfig } from "@/lib/site";

function tokens(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null) return [];
  return [String(value)];
}

test("public metadata keeps the canonical origin and webmaster verification tokens", () => {
  assert.equal(metadata.metadataBase?.toString(), "https://www.steelprodukt.ru/");

  const verification = metadata.verification;
  assert.ok(verification, "webmaster verification metadata must be present");

  const google = tokens(verification.google);
  const yandex = tokens(verification.yandex);

  assert.deepEqual(google, tokens(siteConfig.verification.google));
  assert.deepEqual(yandex, tokens(siteConfig.verification.yandex));
  assert.ok(google.length > 0, "Google verification token must be present");
  assert.ok(yandex.length > 0, "Yandex verification token must be present");
  assert.ok([...google, ...yandex].every((token) => token.trim().length > 0));
});
