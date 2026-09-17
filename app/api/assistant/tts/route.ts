import { NextResponse } from "next/server";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules, type RateLimitRule } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { safeSecurityLog } from "@/lib/security/safe-log";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 8 * 1024;
const MAX_TTS_CHARS = 1400;
const ttsRateRules: RateLimitRule[] = [
  { id: "assistant-tts-minute", limit: 12, windowMs: 60_000 },
  { id: "assistant-tts-day", limit: 120, windowMs: 86_400_000 },
];

type TtsRequest = {
  text?: unknown;
};

type SpeechKitEnvelope = {
  result?: { audioChunk?: { data?: string } };
  audioChunk?: { data?: string };
};

function collectAudio(raw: string) {
  const chunks: Buffer[] = [];
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates = trimmed.split(/\r?\n/).filter(Boolean);
  for (const candidate of candidates) {
    try {
      const payload = JSON.parse(candidate) as SpeechKitEnvelope;
      const encoded = payload.result?.audioChunk?.data ?? payload.audioChunk?.data;
      if (encoded) chunks.push(Buffer.from(encoded, "base64"));
    } catch {
      // SpeechKit REST v3 may stream newline-delimited JSON chunks. Ignore
      // non-JSON transport fragments and fail only if no audio was collected.
    }
  }

  return chunks.length ? Buffer.concat(chunks) : null;
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "Слишком много запросов на озвучивание. Повторите позже." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
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

    const apiKey = process.env.YANDEX_TTS_API_KEY || process.env.YANDEX_AI_API_KEY;
    const iamToken = process.env.YANDEX_TTS_IAM_TOKEN;
    const folderId = process.env.YANDEX_TTS_FOLDER_ID || process.env.YANDEX_AI_FOLDER_ID;

    if (!apiKey && !iamToken) {
      safeSecurityLog("assistant", "not_configured", ownerKey);
      return NextResponse.json({ message: "Нейросетевая озвучка временно недоступна." }, { status: 503 });
    }

    const endpoint = process.env.YANDEX_TTS_ENDPOINT
      || "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis";
    const headers: Record<string, string> = {
      Authorization: apiKey ? `Api-Key ${apiKey}` : `Bearer ${iamToken}`,
      "Content-Type": "application/json",
    };
    if (!apiKey && folderId) headers["x-folder-id"] = folderId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          unsafeMode: true,
          hints: [
            { voice: process.env.YANDEX_TTS_VOICE || "alexander" },
            { role: process.env.YANDEX_TTS_ROLE || "neutral" },
            { speed: process.env.YANDEX_TTS_SPEED || "0.96" },
          ],
          outputAudioSpec: {
            containerAudio: { containerAudioType: "MP3" },
          },
          loudnessNormalizationType: "LUFS",
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!upstream.ok) {
        safeSecurityLog("assistant", `upstream_${upstream.status}`, ownerKey);
        return NextResponse.json({ message: "Нейросетевая озвучка временно недоступна." }, { status: 503 });
      }

      const audio = collectAudio(await upstream.text());
      if (!audio?.length) {
        safeSecurityLog("assistant", "empty_audio", ownerKey);
        return NextResponse.json({ message: "Нейросетевая озвучка временно недоступна." }, { status: 503 });
      }

      safeSecurityLog("assistant", "accepted", ownerKey);
      return new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Length": String(audio.length),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ message: "Текст слишком большой." }, { status: 413 });
    }
    safeSecurityLog("assistant", "bad_request", ownerKey);
    return NextResponse.json({ message: "Не удалось озвучить ответ." }, { status: 400 });
  }
}
