// No `import "server-only"` here: it is not a dependency of this project — only
// the Next build aliases it — so it breaks every test importing this module.

import { NextResponse } from "next/server";
import { assistantSessionStore, type AssistantSessionStore } from "@/lib/assistant/session-store";
import { handleNaturalLanguageQuote } from "@/lib/server/quote-engine/handle-request";
import { clientKey } from "@/lib/security/client-ip";
import { assistantRateRules, consumeRules } from "@/lib/security/rate-limit";
import { PayloadTooLargeError, readJsonBody } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { safeSecurityLog } from "@/lib/security/safe-log";

/**
 * The two-button entry point: the customer has already picked "обычное
 * металлоизделие" or "фасадная металлокассета" before typing anything, so
 * `calculator` here is never inferred from `message` — it is threaded
 * straight through to `planQuoteEngineCalculation`'s override, which skips
 * text classification entirely.
 *
 * A factory, like `createQuoteHandler` (`lib/quote/handler.ts`), so tests
 * can inject a fixture session store and fixture calculation dependencies
 * instead of the real private calculation basis on disk.
 */

const MAX_JSON_BYTES = 4 * 1024;
const MAX_MESSAGE_LENGTH = 1400;
const ROUTE = "assistant-quote" as const;

type QuoteRequestBody = {
  message?: unknown;
  sessionId?: unknown;
  calculator?: unknown;
};

function isCalculator(value: unknown): value is "metal-parts" | "metal-cassettes" {
  return value === "metal-parts" || value === "metal-cassettes";
}

export type AssistantQuoteHandlerDependencies = {
  sessionStore: AssistantSessionStore;
  handleNaturalLanguageQuote: typeof handleNaturalLanguageQuote;
};

const defaultDependencies: AssistantQuoteHandlerDependencies = {
  sessionStore: assistantSessionStore,
  handleNaturalLanguageQuote,
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
        ? deps.sessionStore.get(body.sessionId, ownerKey)
        : undefined;
      const session = existing ?? deps.sessionStore.create(ownerKey);

      const result = await deps.handleNaturalLanguageQuote(message, session.state, {
        calculatorOverride: body.calculator,
      });

      session.state = result.state;
      deps.sessionStore.save(session);
      safeSecurityLog(
        ROUTE,
        result.kind === "priced" ? "calculated" : result.kind === "blocked" ? "calculation_failed" : "clarification_requested",
        ownerKey,
      );

      return NextResponse.json({
        sessionId: session.id,
        kind: result.kind,
        // Never `result.record`: that is the internal trace (§23) — cost
        // lines, rates, market data — and this response is the client-safe
        // boundary the same way `createClientCalculationView` already is
        // for the CAD flow.
        text: result.kind === "question" ? result.question : result.clientMessage,
      });
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
