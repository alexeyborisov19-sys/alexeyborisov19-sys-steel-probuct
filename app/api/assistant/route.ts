import { NextResponse } from "next/server";
import {
  assistantSuggestions,
  buildKnowledgeFallback,
  steelProductAssistantSystemPrompt,
  type AssistantMessage,
} from "@/data/assistant-knowledge";

export const runtime = "nodejs";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1400;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 24;

const requestWindows = new Map<string, { startedAt: number; count: number }>();

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function sanitizeMessages(value: unknown): AssistantMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is AssistantMessage =>
      Boolean(message)
      && typeof message === "object"
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string",
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => message.content);
}

function redactPersonalData(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail передан в защищённую форму]")
    .replace(/(?:\+?7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g, "[телефон передан в защищённую форму]");
}

async function answerWithYandex(messages: AssistantMessage[]) {
  const apiKey = process.env.YANDEX_AI_API_KEY;
  const folderId = process.env.YANDEX_AI_FOLDER_ID;
  if (!apiKey || !folderId) return null;

  const endpoint = process.env.YANDEX_AI_ENDPOINT
    || "https://ai.api.cloud.yandex.net/foundationModels/v1/completion";
  const modelUri = process.env.YANDEX_AI_MODEL_URI
    || `gpt://${folderId}/yandexgpt/latest`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        "Content-Type": "application/json",
        "x-folder-id": folderId,
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: {
          stream: false,
          temperature: 0.18,
          maxTokens: "520",
        },
        messages: [
          { role: "system", text: steelProductAssistantSystemPrompt },
          ...messages.map((message) => ({
            role: message.role,
            text: redactPersonalData(message.content),
          })),
        ],
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Yandex AI returned ${response.status}`);
    }

    const payload = await response.json() as {
      result?: { alternatives?: Array<{ message?: { text?: string } }> };
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.result?.alternatives?.[0]?.message?.text?.trim()
      || payload.choices?.[0]?.message?.content?.trim()
      || null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  if (isRateLimited(requestIp(request))) {
    return NextResponse.json(
      { message: "Слишком много сообщений. Повторите через минуту." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json() as { messages?: unknown };
    const messages = sanitizeMessages(body.messages);
    const latestQuestion = [...messages].reverse().find((message) => message.role === "user")?.content;
    if (!latestQuestion) {
      return NextResponse.json({ message: "Напишите вопрос или опишите изделие." }, { status: 400 });
    }

    let answer: string | null = null;
    let mode: "ai" | "knowledge" = "knowledge";
    try {
      answer = await answerWithYandex(messages);
      if (answer) mode = "ai";
    } catch (error) {
      console.error("Engineering assistant AI fallback", error);
    }

    answer ||= buildKnowledgeFallback(latestQuestion);
    return NextResponse.json({
      answer,
      mode,
      suggestions: assistantSuggestions(latestQuestion),
    });
  } catch {
    return NextResponse.json({ message: "Не удалось обработать вопрос. Повторите отправку." }, { status: 400 });
  }
}
