import "server-only";
import { createHash } from "node:crypto";
import { PRODUCT_CALCULATION_NOTICE } from "@/lib/product-calculation-notice";
import { createBasketOrderSnapshot, prepareBasketOrder, type BasketOrderSnapshot } from "@/lib/quote/basket-order-contract";
import { MAX_BASKET_PROJECT_BYTES } from "@/lib/quote/basket-project";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules } from "@/lib/security/rate-limit";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/request-body";

type Dependencies = { key: (request: Request) => string; limit: typeof consumeRules };
const defaults: Dependencies = { key: clientKey, limit: consumeRules };

/** Public projection contains no customer notes, manufacturing identities,
 * private source references, tariffs or purported CAD results.
 */
export type BasketOrderQuoteResponse = {
  ok: true;
  schemaVersion: 1;
  requestId: string;
  orderId: string;
  orderRevision: number;
  /** SHA-256 of the sanitized order's canonical equality key. */
  orderFingerprint: string;
  totalBasketQuantity: number;
  state: "incomplete";
  price: null;
  reasons: string[];
  positions: { positionId: string; quantity: number; state: "incomplete"; price: null; reasons: string[] }[];
  notice: string;
};

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
function failure(code: string, message: string, status: number, headers?: Record<string, string>) {
  return response({ ok: false, price: null, code, message, notice: PRODUCT_CALCULATION_NOTICE }, status, headers);
}

/** Current source catalogue does not establish a verified complete basket BOM.
 * This route is an eligibility boundary, not an executed CAD or pricing pipeline.
 * Only a future server-owned source registry may supply reviewed evidence; never
 * forward browser evidence, ready flags, rates or component claims to that seam.
 */
export async function handleBasketOrderQuote(request: Request, overrides: Partial<Dependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  try {
    assertSameOriginRequest(request);
    const limited = dependencies.limit(dependencies.key(request), [
      { id: "basket-order-quote-minute", limit: 60, windowMs: 60_000 },
      { id: "basket-order-quote-day", limit: 1000, windowMs: 86_400_000 },
    ]);
    if (limited) return failure("rate-limited", "Слишком много запросов. Повторите немного позже.", 429, { "Retry-After": String(limited.retryAfterSeconds) });

    let order: BasketOrderSnapshot;
    let requestId: string;
    try {
      const input = await readJsonBody<unknown>(request, MAX_BASKET_PROJECT_BYTES);
      order = createBasketOrderSnapshot(input);
      const candidate = (input as Record<string, unknown>).requestId;
      if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 128 || /[\u0000-\u001f\u007f]/.test(candidate)) throw Error("Invalid request identity");
      requestId = candidate;
    } catch (error) {
      if (error instanceof PayloadTooLargeError) throw error;
      return failure("invalid-order", "Проверьте позиции, размеры и количество корзин.", 400);
    }

    // No reviewed server source is available. Intentionally pass no evidence.
    const prepared = prepareBasketOrder(order);
    const body: BasketOrderQuoteResponse = {
      ok: true, schemaVersion: 1, requestId, orderId: order.orderId, orderRevision: order.orderRevision,
      orderFingerprint: createHash("sha256").update(order.fingerprint).digest("hex"),
      totalBasketQuantity: order.totalBasketQuantity,
      state: "incomplete", price: null,
      reasons: [...new Set(["production-source-unavailable", ...prepared.reasons.filter(reason => !reason.positionId).map(reason => reason.code)])],
      positions: order.positions.map(position => ({
        positionId: position.positionId, quantity: position.brief.quantity, state: "incomplete", price: null,
        reasons: [...new Set(prepared.reasons.filter(reason => reason.positionId === position.positionId).map(reason => reason.code))],
      })),
      notice: PRODUCT_CALCULATION_NOTICE,
    };
    return response(body);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) return failure("cross-origin", "Запрос отклонён.", 403);
    if (error instanceof PayloadTooLargeError) return failure("payload-too-large", "Превышен размер запроса.", 413);
    return failure("unavailable", "Проверка заказа временно недоступна. Попробуйте ещё раз.", 503);
  }
}
