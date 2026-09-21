import type { AssistantSession } from "@/lib/assistant/types";
import { classifyProduct, type CalculatorId } from "@/lib/quote-engine/classification";
import { injectionSafeAnswer, isPromptInjection } from "@/lib/assistant/security";
import { handleNaturalLanguageQuote } from "@/lib/server/quote-engine/handle-request";

export function isQuoteKnowledgeQuestion(message: string): boolean {
  return /(?:^|[.!?]\s*)(?:а\s+)?(?:что такое|чем отлича[а-яё]*|в ч[её]м разниц[а-яё]*|как (?:вы )?(?:работаете|связаться)|где (?:вы |ваше |находит[а-яё]*))/iu.test(message.trim());
}

/** Enter calculations for an actual pricing/order request, not every mention of metal. */
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

/**
 * Both HTTP entry points use one server-owned conversation. A browser reset
 * of its calculator UI cannot erase the calculation context. Only the safe
 * answer is returned and added to history, never costs, policy or scenarios.
 */
export async function runSessionQuoteTurn(
  session: AssistantSession,
  message: string,
  explicitCalculator?: CalculatorId,
  calculate: typeof handleNaturalLanguageQuote = handleNaturalLanguageQuote,
): Promise<SessionQuoteReply> {
  if (isPromptInjection(message)) {
    return { sessionId: session.id, kind: "question", text: injectionSafeAnswer };
  }
  const active = session.quoteCalculator;
  if (explicitCalculator && active && active !== "auto" && active !== explicitCalculator) {
    return {
      sessionId: session.id, kind: "question",
      text: "Для другого типа изделия начните новый расчёт, чтобы не смешивать параметры разных заказов.",
    };
  }
  const calculatorOverride = explicitCalculator ?? (active && active !== "auto" ? active : undefined);
  const result = await calculate(message, session.state, { calculatorOverride });
  const classification = classifyProduct(result.state);
  session.quoteCalculator = calculatorOverride
    ?? (classification.status === "classified" ? classification.calculator : "auto");
  session.state = result.state;
  // The quote planner owns its question sequence, not the general lead form.
  session.lastAskedField = undefined;
  const text = result.kind === "question" ? result.question : result.clientMessage;
  const now = new Date().toISOString();
  if (message) session.history.push({ role: "user", content: message, createdAt: now });
  session.history.push({ role: "assistant", content: text, createdAt: now });
  session.history = session.history.slice(-24);
  return { sessionId: session.id, kind: result.kind, text };
}
