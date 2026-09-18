import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/assistant/tts/route.ts", "utf8");
const synth = readFileSync("deploy/local-tts/synthesize.py", "utf8");
const installer = readFileSync("deploy/install-local-tts.sh", "utf8");
const deploy = readFileSync(".github/workflows/deploy-beget.yml", "utf8");
const speechkitCheck = readFileSync("scripts/check-speechkit-tts.mjs", "utf8");

test("assistant prefers premium Alexander SpeechKit and keeps local voices as fallback", () => {
  assert.match(route, /SPEECHKIT_VOICE = "alexander"/);
  assert.match(route, /SPEECHKIT_ROLE = "neutral"/);
  assert.match(route, /SPEECHKIT_SPEED = "0\.96"/);
  assert.match(route, /YANDEX_SPEECHKIT_API_KEY \|\| process\.env\.YANDEX_AI_API_KEY/);
  assert.match(route, /PRIMARY_TTS_MODEL = "ru_RU-denis-medium\.onnx"/);
  assert.match(route, /FALLBACK_TTS_MODEL = "ru_RU-dmitri-medium\.onnx"/);
  assert.match(synth, /ru_RU-denis-medium\.onnx/);
});

test("preferred Russian voice is checksum-pinned and provisioned before restart", () => {
  assert.match(installer, /ru_RU-denis-medium/);
  assert.match(installer, /15fab56e11a097858ee115545d0f697fc2a316c41a291a5362349fb870411b0a/);
  assert.match(deploy, /deploy\/install-local-tts\.sh" nodejs/);
});

test("synthesis profile stays calm and less variable than Piper defaults", () => {
  assert.match(synth, /length_scale=1\.06/);
  assert.match(synth, /noise_scale=0\.55/);
  assert.match(synth, /noise_w_scale=0\.70/);
});

test("production checks premium SpeechKit availability without exposing credentials", () => {
  assert.match(deploy, /check-speechkit-tts\.mjs/);
  assert.match(speechkitCheck, /alexander/);
  assert.match(speechkitCheck, /tts\/v3\/utteranceSynthesis/);
  assert.doesNotMatch(speechkitCheck, /console\.log\([^\n]*(API_KEY|apiKey)/);
});

test("deploy securely syncs the SpeechKit GitHub secret to Beget", () => {
  assert.match(deploy, /YANDEX_SPEECHKIT_API_KEY: \$\{\{ secrets\.YANDEX_SPEECHKIT_API_KEY \}\}/);
  assert.match(deploy, /name: Sync SpeechKit API key/);
  assert.match(deploy, /SpeechKit credential synchronized to protected production environment/);
  assert.match(deploy, /chmod 0600/);
  assert.doesNotMatch(deploy, /echo "\$YANDEX_SPEECHKIT_API_KEY"/);
  assert.doesNotMatch(deploy, /YANDEX_SPEECHKIT_API_KEY='\$YANDEX_SPEECHKIT_API_KEY'/);
});
