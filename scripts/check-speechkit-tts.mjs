#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const envPath = process.argv[2];
if (!envPath) process.exit(2);

const raw = await readFile(envPath, "utf8");
const env = new Map();
for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env.set(match[1], value);
}

const apiKey = env.get("YANDEX_SPEECHKIT_API_KEY") || env.get("YANDEX_AI_API_KEY");
if (!apiKey) {
  console.log("SpeechKit premium voice unavailable: no server credential; local fallback remains active.");
  process.exit(0);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch("https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis", {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "Проверка русского голоса. Инженерные решения из листового металла.",
      hints: [{ voice: "alexander" }, { role: "neutral" }, { speed: "0.96" }],
      outputAudioSpec: { containerAudio: { containerAudioType: "WAV" } },
      loudnessNormalizationType: "LUFS",
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    console.log(`SpeechKit premium voice unavailable: API status ${response.status}; local fallback remains active.`);
    process.exit(0);
  }

  const payload = await response.json();
  const encoded = payload?.result?.audioChunk?.data;
  const bytes = encoded ? Buffer.from(encoded, "base64").length : 0;
  if (bytes <= 44) {
    console.log("SpeechKit premium voice unavailable: empty audio; local fallback remains active.");
    process.exit(0);
  }

  console.log("SpeechKit premium voice ready: alexander / neutral / speed 0.96.");
} catch {
  console.log("SpeechKit premium voice unavailable: request failed; local fallback remains active.");
} finally {
  clearTimeout(timeout);
}
