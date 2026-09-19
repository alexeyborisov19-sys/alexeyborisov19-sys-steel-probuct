import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { redactPersonalData } from "@/lib/assistant/security";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules, type RateLimitRule } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { safeSecurityLog } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 8 * 1024;
const MAX_TTS_CHARS = 1400;
const LOCAL_TTS_ROOT = "/var/lib/steelprodukt/tts";
const LOCAL_TTS_TIMEOUT_MS = 30_000;
const SPEECHKIT_TIMEOUT_MS = 18_000;
const SPEECHKIT_ENDPOINT = "https://tts.api.cloud.yandex.net:443/tts/v3/utteranceSynthesis";
const SPEECHKIT_VOICE = "alexander";
const SPEECHKIT_ROLE = "neutral";
const SPEECHKIT_SPEED = "0.96";
const PRIMARY_TTS_MODEL = "ru_RU-denis-medium.onnx";
const FALLBACK_TTS_MODEL = "ru_RU-dmitri-medium.onnx";
const ttsRateRules: RateLimitRule[] = [
  { id: "assistant-tts-minute", limit: 12, windowMs: 60_000 },
  { id: "assistant-tts-day", limit: 120, windowMs: 86_400_000 },
];

type TtsRequest = {
  text?: unknown;
};

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Слишком много запросов на озвучивание. Повторите позже." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

async function synthesizeWithSpeechKit(text: string) {
  const apiKey = process.env.YANDEX_SPEECHKIT_API_KEY || process.env.YANDEX_AI_API_KEY;
  if (!apiKey) return null;

  const safeText = redactPersonalData(text).replace(/\s+/g, " ").trim();
  if (!safeText) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SPEECHKIT_TIMEOUT_MS);

  try {
    const response = await fetch(SPEECHKIT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: safeText,
        hints: [
          { voice: SPEECHKIT_VOICE },
          { role: SPEECHKIT_ROLE },
          { speed: SPEECHKIT_SPEED },
        ],
        outputAudioSpec: {
          containerAudio: {
            containerAudioType: "WAV",
          },
        },
        loudnessNormalizationType: "LUFS",
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json() as {
      result?: {
        audioChunk?: {
          data?: string;
        };
      };
    };
    const encoded = payload.result?.audioChunk?.data;
    if (!encoded) return null;

    const audio = Buffer.from(encoded, "base64");
    return audio.length > 44 ? audio : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveTtsModel(root: string) {
  const configuredModel = process.env.STEELPRODUKT_TTS_MODEL;
  const candidates = configuredModel
    ? [configuredModel]
    : [path.join(root, PRIMARY_TTS_MODEL), path.join(root, FALLBACK_TTS_MODEL)];

  for (const model of candidates) {
    try {
      await Promise.all([
        access(model, fsConstants.R_OK),
        access(`${model}.json`, fsConstants.R_OK),
      ]);
      return model;
    } catch {
      // Try the previous production voice when the preferred model is unavailable.
    }
  }

  throw new Error("local-tts-model-unavailable");
}

async function synthesizeLocally(text: string) {
  const root = process.env.STEELPRODUKT_TTS_ROOT || LOCAL_TTS_ROOT;
  const pythonRoot = path.join(root, "python");
  const script = path.join(process.cwd(), "deploy", "local-tts", "synthesize.py");
  const outputPath = path.join(tmpdir(), `steelprodukt-tts-${randomUUID()}.wav`);
  const model = await resolveTtsModel(root);

  await Promise.all([
    access(pythonRoot, fsConstants.R_OK),
    access(script, fsConstants.R_OK),
  ]);

  try {
    await new Promise<void>((resolve, reject) => {
      const pythonPath = [pythonRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
      const child = spawn("python3", [script, outputPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: pythonPath,
          STEELPRODUKT_TTS_MODEL: model,
        },
        stdio: ["pipe", "ignore", "ignore"],
      });

      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error("local-tts-timeout"));
      }, LOCAL_TTS_TIMEOUT_MS);

      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });

      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`local-tts-exit-${code ?? "unknown"}`));
      });

      child.stdin.on("error", () => undefined);
      child.stdin.end(text, "utf8");
    });

    const audio = await readFile(outputPath);
    if (audio.length <= 44) throw new Error("local-tts-empty-audio");
    return audio;
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}

export async function POST(request: Request) {
  const ownerKey = clientKey(request);

  try {
    assertSameOriginRequest(request);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) {
      safeSecurityLog("assistant", "cross_site_rejected", ownerKey);
      return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
    }
    throw error;
  }

  const limited = consumeRules(ownerKey, ttsRateRules);
  if (limited) {
    safeSecurityLog("assistant", "rate_limited", ownerKey);
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  try {
    const body = await readJsonBody<TtsRequest>(request, MAX_JSON_BYTES);
    const text = typeof body.text === "string"
      ? body.text.replace(/\s+/g, " ").trim().slice(0, MAX_TTS_CHARS)
      : "";

    if (!text) {
      return NextResponse.json({ message: "Нет текста для озвучивания." }, { status: 400 });
    }

    const premiumAudio = await synthesizeWithSpeechKit(text);
    if (premiumAudio) {
      safeSecurityLog("assistant", "accepted", ownerKey, { code: "tts_speechkit_alexander" });
      return new Response(premiumAudio, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Length": String(premiumAudio.length),
          "X-TTS-Engine": "yandex-speechkit-v3",
          "X-TTS-Voice": SPEECHKIT_VOICE,
        },
      });
    }

    try {
      const audio = await synthesizeLocally(text);
      safeSecurityLog("assistant", "upstream_fallback", ownerKey, { code: "tts_local_piper_fallback" });
      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Length": String(audio.length),
          "X-TTS-Engine": "local-piper-fallback",
        },
      });
    } catch {
      safeSecurityLog("assistant", "configuration_error", ownerKey, { code: "tts_unavailable" });
      return NextResponse.json({ message: "Нейросетевая озвучка временно недоступна." }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ message: "Текст слишком большой." }, { status: 413 });
    }
    safeSecurityLog("assistant", "bad_request", ownerKey, { code: "tts_bad_request" });
    return NextResponse.json({ message: "Не удалось озвучить ответ." }, { status: 400 });
  }
}
