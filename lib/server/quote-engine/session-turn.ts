import type { AssistantSession } from "@/lib/assistant/types";
import { classifyProduct, type CalculatorId } from "@/lib/quote-engine/classification";
import { injectionSafeAnswer, isPromptInjection } from "@/lib/assistant/security";
import { handleNaturalLanguageQuote } from "@/lib/server/quote-engine/handle-request";
import { quoteAiReviewRequired } from "@/lib/server/quote-engine/review-policy";
import { captureSessionQuote } from "@/lib/server/quote-engine/quote-snapshot";
export { quoteAiReviewRequired } from "@/lib/server/quote-engine/review-policy";

export function isQuoteKnowledgeQuestion(message: string): boolean {
  return /(?:^|[.!?]\s*)(?:а\s+)?(?:что такое|чем отлича[а-яё]*|в ч[её]м разниц[а-яё]*|как (?:вы )?(?:работаете|связаться)|где (?:вы |ваше |находит[а-яё]*))/iu.test(message.trim());
}
export function shouldHandleQuoteTurn(session: AssistantSession, message: string): boolean {
  if (isPromptInjection(message) || isQuoteKnowledgeQuestion(message)) return false;
  if (session.quoteCalculator) return true;
  if (/рассчита[а-яё]*|расч[её]т|посчита[а-яё]*|сколько (?:будет )?сто[а-яё]*/iu.test(message)) return true;
  const product = /кассет|кронштейн|корпус|кожух|шкаф|детал|металлоиздел|панел|реш[её]тк|отлив|откос|парапет|корзин/iu;
  const intent = /(?:нуж[а-яё]*|хочу|заказ[а-яё]*|изготов[а-яё]*|цен[ауы]|стоимост)/iu;
  return intent.test(message) && (product.test(message) || Boolean(session.state.productType));
}

export type SessionQuoteReply = {
  sessionId: string;
  kind: "question" | "priced" | "blocked";
  text: string;
};

/** Both HTTP entry points share the same server-owned conversation and final checks. */
export async function runSessionQuoteTurn(
  session: AssistantSession,
  message: string,
  explicitCalculator?: CalculatorId,
  calculate: typeof handleNaturalLanguageQuote = handleNaturalLanguageQuote,
): Promise<SessionQuoteReply> {
  if (isPromptInjection(message)) return { sessionId: session.id, kind: "question", text: injectionSafeAnswer };
  const active = session.quoteCalculator;
  if (explicitCalculator && active && active !== "auto" && active !== explicitCalculator) {
    return {
      sessionId: session.id, kind: "question",
      text: "Для другого типа изделия начните новый расчёт, чтобы не смешивать параметры разных заказов.",
    };
  }
  const calculatorOverride = explicitCalculator ?? (active && active !== "auto" ? active : undefined);
  // A failed/incomplete new turn must not attach an old quote to a new order.
  delete session.quoteSnapshot;
  const result = await calculate(message, session.state, {
    calculatorOverride,
    finalization: { requireAiReview: quoteAiReviewRequired() },
  });
  const classification = classifyProduct(result.state);
  session.quoteCalculator = calculatorOverride ?? (classification.status === "classified" ? classification.calculator : "auto");
  session.state = result.state;
  session.quoteSnapshot = captureSessionQuote(result);
  session.lastAskedField = undefined;
  const text = result.kind === "question" ? result.question : result.clientMessage;
  const now = new Date().toISOString();
  if (message) session.history.push({ role: "user", content: message, createdAt: now });
  session.history.push({ role: "assistant", content: text, createdAt: now });
  session.history = session.history.slice(-24);
  return { sessionId: session.id, kind: result.kind, text };
}
