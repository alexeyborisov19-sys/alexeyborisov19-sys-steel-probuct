import assert from "node:assert/strict";
import test from "node:test";
import { buildCompactConversation } from "../lib/server/quote-engine/compact-conversation";
import { completeWithConfiguredModel } from "../lib/server/quote-engine/model-completion";
import { buildKnowledgeFallback, steelProductAssistantSystemPrompt } from "../data/assistant-knowledge";
import { getAssistantPageContext, pageSpecificKnowledgeAnswer, steelProduktBrandKnowledge } from "../data/assistant-page-context";
import { emptyLeadState, validateStructuredResult } from "../lib/assistant/state";
import { redactPersonalData } from "../lib/assistant/security";

const state = () => ({ ...emptyLeadState(), material: "Оцинкованная сталь", thickness: "1.2 мм", dimensions: "545×545 мм", quantity: "100 шт" });
function context(question: string, pathname: string) {
  const page = getAssistantPageContext(pathname);
  return buildCompactConversation(question, state(), [
    pageSpecificKnowledgeAnswer(question, pathname) ?? buildKnowledgeFallback(question), page.knowledge, steelProduktBrandKnowledge,
  ]);
}

for (const [question, pathname] of [
  ["Чем отличаются открытые и закрытые кассеты?", "/products/metallokassety"],
  ["Какие данные нужны для корпуса?", "/solutions/industry"],
  ["Как подготовить DXF?", "/online-order"],
  ["Что нужно указать для окраски?", "/production/poroshkovaya-okraska"],
  ["Расскажите о Сталь Продукт", "/company"],
]) {
  test(`real page knowledge fits local input limits: ${pathname}`, () => {
    const input = context(question, pathname);
    assert.ok(input);
    const data = redactPersonalData(JSON.stringify(input.data));
    assert.ok(input.system.length + data.length <= 6000);
    assert.ok(Buffer.byteLength(input.system + data, "utf8") <= 18_000);
    assert.equal(input.data.userMessage, question);
    assert.deepEqual(input.data.verifiedState, state());
    assert.match(input.system, /ДОВЕРЕННАЯ СПРАВКА/);
  });
}

test("the full catalogue is too large but the local conversation no longer submits it", () => {
  assert.ok(steelProductAssistantSystemPrompt.length > 6000);
  assert.ok(context("Как подготовить DXF?", "/online-order"));
});

test("oversized knowledge blocks are skipped whole, never sliced into misleading statements", () => {
  const small = "Точный расчёт подтверждается после проверки проекта инженером.";
  const input = buildCompactConversation("Вопрос", state(), ["UNUSABLE".repeat(1000), small]);
  assert.ok(input); assert.ok(input.system.endsWith(small)); assert.doesNotMatch(input.system, /UNUSABLE/);
});

test("a maximum-length user message and all agreed parameters survive unchanged", () => {
  const question = "я".repeat(1400), before = state();
  const input = buildCompactConversation(question, before, [steelProduktBrandKnowledge]);
  assert.ok(input); assert.equal(input.data.userMessage, question); assert.deepEqual(input.data.verifiedState, before);
  input.data.verifiedState.quantity = "1 шт";
  assert.equal(before.quantity, "100 шт");
});

test("the duplicate current message is removed from optional history and prior messages stay ordered", () => {
  const history = [
    { role: "user" as const, content: "Прошлый вопрос", createdAt: "fixture" },
    { role: "assistant" as const, content: "Прошлый ответ", createdAt: "fixture" },
    { role: "user" as const, content: "Текущий вопрос", createdAt: "fixture" },
  ];
  const input = buildCompactConversation("Текущий вопрос", state(), ["Справка."], history);
  assert.ok(input); assert.deepEqual(input.data.conversation.map((item) => item.content), ["Прошлый вопрос", "Прошлый ответ"]);
  assert.equal(history.length, 3);
});

test("oversized recent history is omitted rather than truncating a message or inventing a summary", () => {
  const input = buildCompactConversation("Вопрос", state(), ["Справка."], [
    { role: "user", content: "До", createdAt: "fixture" },
    { role: "assistant", content: "LONG".repeat(2000), createdAt: "fixture" },
  ]);
  assert.ok(input); assert.deepEqual(input.data.conversation, []);
});

test("an oversized agreed state or absent knowledge does not produce a partial model request", () => {
  assert.equal(buildCompactConversation("Вопрос", { ...state(), purpose: "я".repeat(6000) }, ["Справка"]), null);
  assert.equal(buildCompactConversation("Вопрос", state(), [" "]), null);
  assert.equal(buildCompactConversation("я".repeat(1401), state(), ["Справка"]), null);
});

test("real compact conversation reaches the local adapter with no paid permission and validates its response", async () => {
  const input = context("Как подготовить DXF?", "/online-order");
  assert.ok(input);
  const digest = "a".repeat(64);
  const urls: string[] = [];
  const answer = { answer: "Для проверки нужен чертёж и параметры изделия.", extractedFields: {}, missingFields: [], nextQuestion: "", readyForLead: false, safetyFlags: [] };
  const result = await completeWithConfiguredModel(input.system, input.data, 650, {
    STEEL_PRODUCT_LOCAL_AI_ENABLED: "true", STEEL_PRODUCT_LOCAL_AI_OFFLINE_VERIFIED: "true",
    STEEL_PRODUCT_LOCAL_AI_MODEL: "fixture:small", STEEL_PRODUCT_LOCAL_AI_DIGEST: digest,
    STEEL_PRODUCT_PAID_SERVICES_ALLOWED: "false",
  }, async (url, init) => {
    urls.push(String(url)); assert.equal(new Headers(init?.headers).has("authorization"), false);
    if (urls.length === 1) return Response.json({ models: [{ name: "fixture:small", digest, size: 20_000_000, details: { format: "gguf" } }] });
    return Response.json({ done: true, done_reason: "stop", response: JSON.stringify(answer) });
  });
  assert.ok(result); assert.equal(validateStructuredResult(JSON.parse(result))?.answer, answer.answer);
  assert.deepEqual(urls, ["http://127.0.0.1:11434/api/tags", "http://127.0.0.1:11434/api/generate"]);
});
