import { NextResponse } from "next/server";
import { reviewCassetteAreaCalculation } from "@/lib/server/quote-engine/cassette-area-review";
import { clientKey } from "@/lib/security/client-ip";
import { consumeRules } from "@/lib/security/rate-limit";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/request-body";
import { assertSameOriginRequest, CrossSiteRequestError } from "@/lib/security/same-origin";
import { CALCULATION_DISCLAIMER } from "@/lib/instant-quote/client-labels";
import {
  estimateMetalCassettes, estimateMetalCassettesByQuantity, metalCassetteThicknesses,
  type MetalCassetteEstimateInput, type MetalCassetteThickness, type MetalCassetteType,
} from "@/lib/metal-cassette-estimate";

function isType(value: unknown): value is MetalCassetteType { return value === "open" || value === "closed"; }
function isThickness(value: unknown): value is MetalCassetteThickness {
  return typeof value === "string" && metalCassetteThicknesses.includes(value as MetalCassetteThickness);
}
function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value.replace(",", "."));
  return Number.NaN;
}
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function invalid(message: string) {
  return NextResponse.json({ error: message, disclaimer: CALCULATION_DISCLAIMER }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    assertSameOriginRequest(request);
    raw = await readJsonBody<unknown>(request, 16_384);
  } catch (error) {
    if (error instanceof CrossSiteRequestError) return NextResponse.json({ error: "Запрос отклонён." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    if (error instanceof PayloadTooLargeError) return NextResponse.json({ error: "Превышен размер запроса." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    return invalid("Некорректные данные расчёта.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("Некорректные данные расчёта.");
  const payload = raw as Record<string, unknown>;
  const mode = payload.mode === "wall" ? "wall" : payload.mode === "area" ? "area" : payload.mode === "quantity" ? "quantity" : null;
  if (!mode || !isType(payload.type) || !isThickness(payload.thickness)) return invalid("Проверьте режим, тип кассеты и толщину.");

  if (mode === "quantity") {
    const quantity = asNumber(payload.quantity);
    const moduleWidthMm = asNumber(payload.moduleWidthMm);
    const moduleHeightMm = asNumber(payload.moduleHeightMm);
    // These are software estimation limits, not manufacturing limits.
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100_000
      || !positive(moduleWidthMm) || moduleWidthMm > 10_000
      || !positive(moduleHeightMm) || moduleHeightMm > 10_000) {
      return invalid("Для расчёта укажите 1–100 000 кассет и размеры лицевой части до 10 000 мм. Более крупный заказ передайте инженеру.");
    }
    if (payload.review === true) return invalid("Дополнительную инженерную проверку выполнит специалист после обращения.");
    const ownSize = { type: payload.type, thickness: payload.thickness, quantity, moduleWidthMm, moduleHeightMm };
    // This public mode uses the approved base rate only. A forged client
    // pricePerM2 must not become a quotation or affect the response.
    const estimate = estimateMetalCassettesByQuantity(ownSize);
    if (!positive(estimate.netAreaM2) || !positive(estimate.approximateTotalRub)
      || !Number.isSafeInteger(estimate.quantity) || !Number.isSafeInteger(estimate.approximateTotalRub)) {
      return invalid("Для этого количества или размера невозможно рассчитать ориентир. Передайте параметры инженеру.");
    }
    return NextResponse.json({
      netAreaM2: estimate.netAreaM2,
      quantity: estimate.quantity,
      approximateTotalRub: Math.max(baseline.approximateTotalRub, estimate.approximateTotalRub),
      disclaimer: CALCULATION_DISCLAIMER,
      marketVerified: false,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const input: MetalCassetteEstimateInput = { mode, type: payload.type, thickness: payload.thickness };
  if (mode === "area") {
    input.areaM2 = asNumber(payload.areaM2);
    if (!positive(input.areaM2) || input.areaM2 > 1_000_000) return invalid("Укажите площадь фасада от 0 до 1 000 000 м².");
  } else {
    input.wallWidthMm = asNumber(payload.wallWidthMm);
    input.wallHeightMm = asNumber(payload.wallHeightMm);
    input.openingsM2 = payload.openingsM2 == null ? 0 : asNumber(payload.openingsM2);
    if (!positive(input.wallWidthMm) || input.wallWidthMm > 1_000_000
      || !positive(input.wallHeightMm) || input.wallHeightMm > 1_000_000
      || !Number.isFinite(input.openingsM2) || input.openingsM2 < 0) return invalid("Проверьте размеры стены и площадь проёмов.");
    if (input.openingsM2 >= (input.wallWidthMm * input.wallHeightMm) / 1_000_000) {
      return invalid("Площадь проёмов должна быть меньше площади стены.");
    }
  }
  // The minimum is recomputed on the server from the published tariff. Browser
  // prices, guessed market means and developer-tools edits cannot reduce it.
  const baseline = estimateMetalCassettes(input);
  const customPrice = asNumber(payload.pricePerM2);
  if (positive(customPrice) && customPrice < 1_000_000) input.pricePerM2 = Math.max(baseline.defaultRateRubM2, customPrice);
  const estimate = estimateMetalCassettes(input);
  if (!positive(estimate.netAreaM2) || !positive(estimate.approximateTotalRub)
    || !Number.isSafeInteger(estimate.quantity) || estimate.quantity <= 0) {
    return invalid("Для этих параметров нельзя сформировать ориентировочную стоимость. Проверьте площадь и проёмы.");
  }
  if (payload.review === true) {
    const limited = consumeRules(clientKey(request), [
      { id: "cassette-review-minute", limit: 6, windowMs: 60_000 },
      { id: "cassette-review-day", limit: 100, windowMs: 86_400_000 },
    ]);
    if (limited) return NextResponse.json({ error: "Слишком много проверок. Повторите позже.", disclaimer: CALCULATION_DISCLAIMER },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limited.retryAfterSeconds) } });
    try {
      const checked = await reviewCassetteAreaCalculation(input);
      return NextResponse.json({ ...checked.publicResult, disclaimer: CALCULATION_DISCLAIMER }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Проверка временно недоступна. Передайте параметры инженеру.", disclaimer: CALCULATION_DISCLAIMER },
        { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json({
    netAreaM2: estimate.netAreaM2,
    quantity: estimate.quantity,
    approximateTotalRub: Math.max(baseline.approximateTotalRub, estimate.approximateTotalRub),
    disclaimer: CALCULATION_DISCLAIMER,
    marketVerified: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
