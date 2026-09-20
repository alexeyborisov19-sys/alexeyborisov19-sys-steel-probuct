import type { MetalCassetteThickness } from "@/lib/metal-cassette-estimate";
import { metalCassetteThicknesses } from "@/lib/metal-cassette-estimate";
import type { MaterialId } from "@/lib/instant-quote/pricing";

/**
 * Turns the free-text fields `extractLeadState` already pulled out of a
 * customer's message into the strictly-typed numbers and enums the two
 * calculators require. Never guesses a value the text does not support:
 * every function here returns `null` on anything it cannot parse with
 * confidence, so the caller asks instead of substituting a default.
 */

const UNIT_TO_MM: Record<string, number> = { мм: 1, см: 10, м: 1000 };

/**
 * `extractLeadState`'s dimensions regex normalises separators to "×" but
 * leaves the digits and any trailing unit exactly as typed — "600×1200",
 * "60×120 см", "600×1200×2 мм". Only the first two numbers are read as
 * width/height; a third is a depth or thickness figure this function does
 * not interpret (thickness has its own field and its own parser).
 */
export function parseDimensionsMm(dimensions: string | undefined | null): { widthMm: number; heightMm: number } | null {
  if (!dimensions) return null;
  const match = dimensions.match(/^(\d{2,5})\s*×\s*(\d{2,5})(?:\s*×\s*\d{2,5})?\s*(мм|см|м)?$/u);
  if (!match) return null;

  const unit = UNIT_TO_MM[match[3] ?? "мм"];
  const widthMm = Number(match[1]) * unit;
  const heightMm = Number(match[2]) * unit;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) return null;
  return { widthMm, heightMm };
}

/**
 * `extractLeadState`'s thickness regex always normalises to "<число> мм" —
 * this only ever undoes that one, known format.
 */
export function parseThicknessMm(thickness: string | undefined | null): number | null {
  if (!thickness) return null;
  const match = thickness.match(/^(\d+(?:\.\d+)?)\s*мм$/u);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * A piece count, not an area or a length. `extractLeadState`'s quantity regex
 * also matches "20 м²" and "15 пог м" — those describe area or length, not a
 * headcount, and treating them as one would be exactly the invented number
 * the brief forbids. Only a unit that actually counts discrete pieces
 * (штук/единиц/комплектов) is read here; anything else returns null so the
 * caller asks for a piece count explicitly instead of misreading a quantity
 * given in the wrong unit.
 */
export function parsePieceCount(quantity: string | undefined | null): number | null {
  if (!quantity) return null;
  const match = quantity.match(/^(\d[\d\s]*)\s*(шт(?:ук)?|единиц|комплект[а-я]*)$/iu);
  if (!match) return null;
  const value = Number(match[1].replace(/\s+/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/**
 * Snaps a measured thickness onto the four thicknesses the cassette
 * calculator actually stocks rates for. Mirrors the CAD calculator's own
 * "nearest stocked thickness" pattern: a thickness nobody stocks cannot be
 * quoted, only guessed at, so anything outside a tight tolerance returns
 * null rather than silently rounding to a distant option.
 */
export function nearestCassetteThickness(thicknessMm: number | null): MetalCassetteThickness | null {
  if (thicknessMm == null) return null;
  let best: MetalCassetteThickness | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const option of metalCassetteThicknesses) {
    const distance = Math.abs(Number(option) - thicknessMm);
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }
  return best != null && bestDistance <= 0.05 ? best : null;
}

/**
 * Maps the free-text material label `extractLeadState` produces onto
 * calculator #1's material id. Plain "Сталь" (no г/к or х/к named) is
 * deliberately left unmapped: the customer's own words did not say which,
 * and hot- and cold-rolled steel do not share a price, so guessing either
 * one would be pricing a material the customer never specified.
 */
export function materialLabelToId(material: string | undefined | null): MaterialId | null {
  switch (material) {
    case "Оцинкованная сталь": return "zinc";
    case "Нержавеющая сталь": return "inox";
    case "Алюминий": return "alu";
    default: return null;
  }
}
