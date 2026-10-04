import "server-only";
import { basketConfiguredPrice, validBasketEstimateInput, type BasketEstimateRates } from "@/lib/quote/basket-volume-price";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules } from "@/lib/security/rate-limit";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/request-body";
import { loadPrivateBasketRates } from "./basket-estimate";

type Dependencies = {
  loadRates: () => Promise<BasketEstimateRates>;
  key: (request: Request) => string;
  limit: typeof consumeRules;
};
const defaults: Dependencies = { loadRates: loadPrivateBasketRates, key: clientKey, limit: consumeRules };
function response(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}
function publicPrice(price: NonNullable<ReturnType<typeof basketConfiguredPrice>>) {
  return { unit: price.unit, total: price.total, basis: price.basis };
}

export async function handleBasketEstimate(request: Request, overrides: Partial<Dependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  try {
    assertSameOriginRequest(request);
    const limited = dependencies.limit(dependencies.key(request), [
      { id: "basket-estimate-minute", limit: 60, windowMs: 60_000 },
      { id: "basket-estimate-day", limit: 1000, windowMs: 86_400_000 },
    ]);
    if (limited) return response({ price: null, reason: "Слишком много расчётов. Повторите немного позже." }, 429,
      { "Retry-After": String(limited.retryAfterSeconds) });
    let input: unknown;
    try { input = await readJsonBody<unknown>(request, 16_384); }
    catch (error) {
      if (error instanceof PayloadTooLargeError) throw error;
      return response({ price: null, reason: "Проверьте данные расчёта." }, 400);
    }
    if (!validBasketEstimateInput(input)) return response({ price: null, reason: "Проверьте размеры, количество и параметры корзины." }, 400);
    // The owner's approved configuration is valid without a supplier lookup.
    const approved = basketConfiguredPrice(input);
    if (approved) return response({ price: publicPrice(approved) });
    if ([input.design.front.pattern, input.design.side.pattern].some((pattern) => pattern === "custom" || pattern === "lamella")) {
      return response({ price: null, reason: "Стоимость этого рисунка уточнит инженер по конструкции панелей." });
    }
    // Browser-provided rates, coefficients and totals are deliberately ignored.
    const rates = await dependencies.loadRates();
    const price = basketConfiguredPrice(input, rates);
    return price
      ? response({ price: publicPrice(price) })
      : response({ price: null, reason: "Для выбранных размеров и исполнения требуется расчёт инженера." });
  } catch (error) {
    if (error instanceof CrossSiteRequestError) return response({ price: null, reason: "Запрос отклонён." }, 403);
    if (error instanceof PayloadTooLargeError) return response({ price: null, reason: "Превышен размер запроса." }, 413);
    // Never leak private file paths, supplier prices, operation rates or stack traces.
    return response({ price: null, reason: "Расчёт временно недоступен. Попробуйте ещё раз." }, 503);
  }
}
