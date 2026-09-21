// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import { NextResponse } from "next/server";
import { assistantSessionStore, type AssistantSessionStore } from "@/lib/assistant/session-store";
import { handleNaturalLanguageQuote } from "@/lib/server/quote-engine/handle-request";
import { runSessionQuoteTurn } from "@/lib/server/quote-engine/session-turn";
import { clientKey } from "@/lib/security/client-ip";
import { assistantRateRules, consumeRules } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { safeSecurityLog } from "@/lib/security/safe-log";

/**
 * The explicit two-button entry point. The chosen calculator is persisted
 * in the same server session the free-text endpoint uses. The factory keeps
 * session and calculation dependencies injectable for regression tests.
 */
const MAX_JSON_BYTES = 4 * 1024;
const MAX_MESSAGE_LENGTH = 1400;
const ROUTE = "assistant-quote" as const;

type QuoteRequestBody = { message?: unknown; sessionId?: unknown; calculator?: unknown };
function isCalculator(value: unknown): value is "metal-parts" | "metal-cassettes" {
  return value === "metal-parts" || value === "metal-cassettes";
}
export type AssistantQuoteHandlerDependencies = {
  sessionStore: AssistantSessionStore;
  handleNaturalLanguageQuote: typeof handleNaturalLanguageQuote;
};
const defaultDependencies: AssistantQuoteHandlerDependencies = {
  sessionStore: assistantSessionStore, handleNaturalLanguageQuote,
};

export function createAssistantQuoteHandler(overrides: Partial<AssistantQuoteHandlerDependencies> = {}) {
  const deps: AssistantQuoteHandlerDependencies = { ...defaultDependencies, ...overrides };
  return async function POST(request: Request) {
    const ownerKey = clientKey(request);
    try {
      assertSameOriginRequest(request);
    } catch (error) {
      if (error instanceof CrossSiteRequestError) {
        safeSecurityLog(ROUTE, "cross_site_rejected", ownerKey);
        return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
      }
      throw error;
    }
    const limited = consumeRules(ownerKey, assistantRateRules);
    if (limited) {
      safeSecurityLog(ROUTE, "rate_limited", ownerKey);
      return NextResponse.json(
        { message: "Слишком много сообщений подряд. Повторите чуть позже." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      );
    }
    try {
      const body = await readJsonBody<QuoteRequestBody>(request, MAX_JSON_BYTES);
      const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE_LENGTH) : "";
      if (!isCalculator(body.calculator)) {
        return NextResponse.json({ message: "Не выбран тип изделия." }, { status: 400 });
      }
      const existing = typeof body.sessionId === "string" && /^[0-9a-f-]{36}$/i.test(body.sessionId)
        ? deps.sessionStore.get(body.sessionId, ownerKey) : undefined;
      const session = existing ?? deps.sessionStore.create(ownerKey);
      const reply = await runSessionQuoteTurn(session, message, body.calculator, deps.handleNaturalLanguageQuote);
      deps.sessionStore.save(session);
      safeSecurityLog(
        ROUTE,
        reply.kind === "priced" ? "calculated" : reply.kind === "blocked" ? "calculation_failed" : "clarification_requested",
        ownerKey,
      );
      // This explicitly client-safe object never includes the internal record.
      return NextResponse.json(reply);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ message: "Сообщение слишком длинное." }, { status: 413 });
      }
      safeSecurityLog(ROUTE, "internal_error", ownerKey);
      return NextResponse.json(
        { message: "Не удалось выполнить расчёт. Попробуйте ещё раз или передайте задачу инженеру." },
        { status: 500 },
      );
    }
  };
}
