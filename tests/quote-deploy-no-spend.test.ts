import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import test from "node:test";

/** Execute the actual deployment script; replace its entire network transport. */
function probe(configuration: string) {
  const directory = mkdtempSync(join(tmpdir(), "quote-no-spend-"));
  try {
    const environmentPath = join(directory, "fixture.env");
    const transportPath = join(directory, "fixture-transport.mjs");
    writeFileSync(environmentPath, configuration);
    writeFileSync(transportPath, `
      import assert from "node:assert/strict";
      globalThis.fetch = async (url, options) => {
        console.log("FIXTURE_PROVIDER_CALL");
        assert.equal(url, "https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis");
        assert.equal(options.method, "POST");
        assert.equal(options.redirect, "error");
        assert.equal(new Headers(options.headers).get("authorization"), "Api-Key fixture-not-a-real-key");
        return Response.json({ result: { audioChunk: { data: Buffer.alloc(45).toString("base64") } } });
      };
    `);
    const result = spawnSync(process.execPath, [
      "--import", pathToFileURL(transportPath).href,
      resolve("scripts/check-speechkit-tts.mjs"), environmentPath,
    ], {
      encoding: "utf8", timeout: 8000,
      // A runner's setting must not override a denied/missing host-file setting.
      env: { ...process.env, STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "true" },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture-not-a-real-key/);
    return result.stdout;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

for (const [label, flag] of [
  ["missing", ""],
  ["empty", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED="],
  ["false", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED=false"],
  ["uppercase", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED=TRUE"],
  ["number", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED=1"],
  ["yes", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED=yes"],
  ["quoted false", 'STEEL_PRODUCT_PAID_SERVICES_ALLOWED="false"'],
  ["last setting denies", "STEEL_PRODUCT_PAID_SERVICES_ALLOWED=true\nSTEEL_PRODUCT_PAID_SERVICES_ALLOWED=false"],
]) {
  test(`deployment never invokes SpeechKit when spending permission is ${label}`, () => {
    const output = probe(`${flag}\nYANDEX_SPEECHKIT_API_KEY=fixture-not-a-real-key\nYANDEX_AI_API_KEY=fixture-not-a-real-key\n`);
    assert.match(output, /paid check skipped/);
    assert.doesNotMatch(output, /FIXTURE_PROVIDER_CALL/);
  });
}

test("an explicitly authorized deployment probe uses only the substituted transport", () => {
  const output = probe("STEEL_PRODUCT_PAID_SERVICES_ALLOWED=true\nYANDEX_SPEECHKIT_API_KEY=fixture-not-a-real-key\n");
  assert.equal(output.split("FIXTURE_PROVIDER_CALL").length - 1, 1);
  assert.match(output, /premium voice ready/);
});

test("a quoted explicit authorization follows the existing dotenv parser", () => {
  const output = probe('STEEL_PRODUCT_PAID_SERVICES_ALLOWED="true"\nYANDEX_AI_API_KEY=fixture-not-a-real-key\n');
  assert.equal(output.split("FIXTURE_PROVIDER_CALL").length - 1, 1);
  assert.match(output, /premium voice ready/);
});

test("authorization without a credential does not make a provider request", () => {
  const output = probe("STEEL_PRODUCT_PAID_SERVICES_ALLOWED=true\n");
  assert.match(output, /no server credential/);
  assert.doesNotMatch(output, /FIXTURE_PROVIDER_CALL/);
});
