import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createAssistantQuoteHandler } from "../lib/server/quote-engine/assistant-quote-handler";
import { emptyLeadState } from "../lib/assistant/state";
import type { AssistantSession } from "../lib/assistant/types";
import type { AssistantSessionStore } from "../lib/assistant/session-store";
import type { handleNaturalLanguageQuote } from "../lib/server/quote-engine/handle-request";
import { rateLimitStore } from "../lib/security/rate-limit";

function fixtureSessionStore(): AssistantSessionStore {
  const sessions = new Map<string, AssistantSession>();
  return {
    create(ownerKey: string) {
      const session: AssistantSession = { id: randomUUID(), ownerKey, state: emptyLeadState(), history: [], createdAt: Date.now(), updatedAt: Date.now() };
      sessions.set(session.id, session);
      return session;
    },
    get(id: string, ownerKey: string) {
      const session = sessions.get(id);
      return session && session.ownerKey === ownerKey ? session : undefined;
    },
    save(session: AssistantSession) {
      sessions.set(session.id, session);
    },
    clear() {
      sessions.clear();
    },
  };
}

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://www.steelprodukt.ru/api/assistant/quote", {
    method: "POST",
    headers: {
      origin: "https://www.steelprodukt.ru",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** A scripted stand-in for the real pipeline — this file tests the route's own behaviour, not the calculation logic already covered elsewhere. */
function scriptedQuote(script: Array<Parameters<typeof handleNaturalLanguageQuote> extends never ? never : Awaited<ReturnType<typeof handleNaturalLanguageQuote>>>) {
  let call = 0;
  const calls: Array<{ message: string; state: unknown; options: unknown }> = [];
  const fn: typeof handleNaturalLanguageQuote = async (message, state, options) => {
    calls.push({ message, state, options });
    const result = script[Math.min(call, script.length - 1)];
    call += 1;
    return result;
  };
  return { fn, calls };
}

test("a cross-site request is rejected before any calculation runs", async () => {
  rateLimitStore.clear();
  const { fn, calls } = scriptedQuote([{ kind: "question", question: "Какой материал?", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  const response = await handler(request({ message: "", calculator: "metal-parts" }, { origin: "https://evil.example", "sec-fetch-site": "cross-site" }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("a missing or invalid calculator is rejected with a clear status, not passed through as ambiguous", async () => {
  rateLimitStore.clear();
  const { fn, calls } = scriptedQuote([{ kind: "question", question: "x", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  const response = await handler(request({ message: "привет" }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("a question response carries the question as text, and a fresh sessionId", async () => {
  rateLimitStore.clear();
  const { fn } = scriptedQuote([{ kind: "question", question: "Какое количество?", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  const response = await handler(request({ message: "кронштейн 500x400", calculator: "metal-parts" }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.kind, "question");
  assert.equal(payload.text, "Какое количество?");
  assert.ok(typeof payload.sessionId === "string" && payload.sessionId.length > 0);
});

test("a priced response carries the client message as text, and never the internal record", async () => {
  rateLimitStore.clear();
  const record = { version: "quote-engine-v1" as const, createdAt: new Date().toISOString(), calculator: "metal-parts" as const, technicalVerification: { ok: true, findings: [] }, costRubBatch: 12345, costVerification: { ok: true, findings: [] }, market: null, commercialPrice: null, commercialVerification: null, finalPriceRubBatch: 68000, finalPriceRubEach: 680, quantity: 100, warnings: [] };
  const { fn } = scriptedQuote([{ kind: "priced", clientMessage: "Стоимость изготовления: 680 ₽/шт.", record, state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  const response = await handler(request({ message: "100 шт", calculator: "metal-parts" }));
  const payload = await response.json();
  assert.equal(payload.kind, "priced");
  assert.equal(payload.text, "Стоимость изготовления: 680 ₽/шт.");
  // The confidential internal record must never appear in the client response at all.
  const raw = JSON.stringify(payload);
  assert.doesNotMatch(raw, /costRubBatch|12345|record/i);
});

test("session state carries forward across two calls with the same sessionId", async () => {
  rateLimitStore.clear();
  const stateAfterFirstTurn = { ...emptyLeadState(), material: "Оцинкованная сталь" };
  const { fn, calls } = scriptedQuote([
    { kind: "question", question: "Какая толщина?", state: stateAfterFirstTurn },
    { kind: "question", question: "Какие габариты?", state: stateAfterFirstTurn },
  ]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });

  const first = await handler(request({ message: "кронштейн, оцинковка", calculator: "metal-parts" }));
  const firstPayload = await first.json();

  const second = await handler(request({ message: "2 мм", calculator: "metal-parts", sessionId: firstPayload.sessionId }));
  const secondPayload = await second.json();

  assert.equal(secondPayload.sessionId, firstPayload.sessionId, "the same session id is reused, not a fresh one issued");
  assert.equal(calls.length, 2);
  // The second call must be handed exactly what the first call returned as
  // its state — including the material it had already recognised — the
  // route's whole job here is to persist and re-supply it, not to
  // reconstruct or reset it between turns.
  assert.equal((calls[1].state as ReturnType<typeof emptyLeadState>).material, "Оцинкованная сталь");
});

test("an unrecognised sessionId does not reuse another owner's state — a fresh session starts instead", async () => {
  rateLimitStore.clear();
  const { fn, calls } = scriptedQuote([{ kind: "question", question: "x", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  await handler(request({ message: "кронштейн", calculator: "metal-parts", sessionId: "not-a-real-session-id" }));
  assert.deepEqual(calls[0].state, emptyLeadState());
});

test("the calculatorOverride is always threaded through, exactly as chosen", async () => {
  rateLimitStore.clear();
  const { fn, calls } = scriptedQuote([{ kind: "question", question: "x", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });
  await handler(request({ message: "", calculator: "metal-cassettes" }));
  assert.equal((calls[0].options as { calculatorOverride?: string }).calculatorOverride, "metal-cassettes");
});

test("a client that sends too many messages in a minute is rate-limited, without ever reaching the calculation", async () => {
  rateLimitStore.clear();
  const { fn, calls } = scriptedQuote([{ kind: "question", question: "x", state: emptyLeadState() }]);
  const handler = createAssistantQuoteHandler({ sessionStore: fixtureSessionStore(), handleNaturalLanguageQuote: fn });

  // assistantRateRules allows 18 requests per minute per client key.
  for (let i = 0; i < 18; i += 1) {
    const response = await handler(request({ message: "x", calculator: "metal-parts" }, { "x-forwarded-for": "203.0.113.9" }));
    assert.equal(response.status, 200);
  }
  const limited = await handler(request({ message: "x", calculator: "metal-parts" }, { "x-forwarded-for": "203.0.113.9" }));
  assert.equal(limited.status, 429);
  assert.equal(calls.length, 18);
});
