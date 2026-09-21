import { NextResponse } from "next/server";
import { CALCULATION_DISCLAIMER } from "@/lib/instant-quote/client-labels";
import {
  estimateMetalCassettes, metalCassetteThicknesses,
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
  try { raw = await request.json(); }
  catch { return invalid("Некорректные данные расчёта."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("Некорректные данные расчёта.");
  const payload = raw as Record<string, unknown>;
  const mode = payload.mode === "wall" ? "wall" : payload.mode === "area" ? "area" : null;
  if (!mode || !isType(payload.type) || !isThickness(payload.thickness)) return invalid("Проверьте режим, тип кассеты и толщину.");
  const input: MetalCassetteEstimateInput = { mode, type: payload.type, thickness: payload.thickness };
  if (mode === "area") {
    input.areaM2 = asNumber(payload.areaM2);
    if (!positive(input.areaM2)) return invalid("Укажите положительную площадь фасада.");
  } else {
    input.wallWidthMm = asNumber(payload.wallWidthMm);
    input.wallHeightMm = asNumber(payload.wallHeightMm);
    input.openingsM2 = payload.openingsM2 == null ? 0 : asNumber(payload.openingsM2);
    if (!positive(input.wallWidthMm) || !positive(input.wallHeightMm)
      || !Number.isFinite(input.openingsM2) || input.openingsM2 < 0) return invalid("Проверьте размеры стены и площадь проёмов.");
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
  return NextResponse.json({
    netAreaM2: estimate.netAreaM2,
    quantity: estimate.quantity,
    defaultRateRubM2: estimate.defaultRateRubM2,
    approximateRateRubM2: estimate.approximateRateRubM2,
    approximateTotalRub: Math.max(baseline.approximateTotalRub, estimate.approximateTotalRub),
    disclaimer: CALCULATION_DISCLAIMER,
    marketVerified: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
