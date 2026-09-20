import type { EngineeringLeadState } from "@/lib/assistant/types";
import { classifyProduct } from "@/lib/quote-engine/classification";
import {
  materialLabelToId,
  nearestCassetteThickness,
  parseDimensionsMm,
  parsePieceCount,
  parseThicknessMm,
} from "@/lib/quote-engine/field-parsing";
import type { MetalCassetteThickness, MetalCassetteType } from "@/lib/metal-cassette-estimate";
import type { MaterialId } from "@/lib/instant-quote/pricing";

/**
 * §6/§7/§21 in one place: turn what the extractor already read out of the
 * customer's message into either a fully-typed, ready-to-price input, or an
 * exact list of what is still missing — never a guess. This function does no
 * I/O and calls no calculator; it only decides WHETHER a calculation can
 * start and WITH WHAT, so it is trivially unit-testable and never depends on
 * a rate book, a database, or AI being reachable (§26).
 */

export type MissingField = { code: string; question: string };

export type MetalPartsReadyInput = {
  materialId: MaterialId;
  thicknessMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

export type MetalCassetteReadyInput = {
  type: MetalCassetteType;
  thickness: MetalCassetteThickness;
  quantity: number;
  moduleWidthMm: number;
  moduleHeightMm: number;
};

export type QuoteEnginePlan =
  | { status: "ambiguous-product"; question: string }
  | { status: "needs-cad"; calculator: "metal-parts"; reason: string }
  | { status: "missing-fields"; calculator: "metal-parts" | "metal-cassettes"; missing: MissingField[] }
  | { status: "ready"; calculator: "metal-parts"; input: MetalPartsReadyInput }
  | { status: "ready"; calculator: "metal-cassettes"; input: MetalCassetteReadyInput };

/**
 * A signal `extractLeadState`'s own product-type classification can miss:
 * "гнутый кронштейн" contains neither "деталь"/"металл" (needed by its
 * "Гибка деталей" pattern) nor any cassette word, so it falls through to the
 * plain "Кронштейны" label and the bend goes unnoticed. This is deliberately
 * independent of product classification — it only asks "does the customer's
 * own wording say this part is bent", which the manual flat-rectangle path
 * (`manual-geometry.ts`) cannot price correctly regardless of what kind of
 * part it otherwise is.
 */
function mentionsBending(rawMessage: string): boolean {
  return /гнут[а-я]*|гиб[а-я]*|отбортов[а-я]*|загиб[а-я]*/iu.test(rawMessage);
}

/** Every digit run inside a raw field extractLeadState already claimed, e.g. "500×400" -> {500, 400}. */
function digitsAlreadyClaimedBy(raw: string | undefined | null): Set<number> {
  if (!raw) return new Set();
  return new Set([...raw.matchAll(/\d+/g)].map((match) => Number(match[0])));
}

/**
 * `extractLeadState`'s quantity field only recognises a number glued to an
 * explicit unit word (шт/штук/единиц/комплект...) — it does not recognise
 * the far more common Russian construction "100 кронштейнов", a bare count
 * of the product noun itself, exactly how the brief's own example is
 * phrased. This is a narrow, local fallback rather than a change to the
 * shared extractor (which the live chat assistant also depends on): tried
 * only when the structured field found nothing at all, and only for a short
 * number (1-5 digits, the plausible range for a piece count) directly
 * followed by whitespace and a Cyrillic word of at least three letters — long
 * enough to exclude "мм"/"см" so a thickness is never mistaken for a count.
 *
 * A dimension pair is the sharper risk: "500×400 оцинкованная" puts the
 * second dimension figure directly in front of a word too, so every digit
 * run already claimed by `state.dimensions` (or `state.thickness`) is
 * excluded before the first remaining match is accepted — not by comparing
 * converted millimetre values, which would miss a cm/m phrasing, but by the
 * same raw digits the customer actually typed.
 */
function impliedPieceCount(rawMessage: string, state: EngineeringLeadState): number | null {
  const claimed = new Set([
    ...digitsAlreadyClaimedBy(state.dimensions),
    ...digitsAlreadyClaimedBy(state.thickness),
  ]);
  for (const match of rawMessage.matchAll(/(?:^|[^\d])(\d{1,5})\s+[а-яё]{3,}/giu)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0 && !claimed.has(value)) return value;
  }
  return null;
}

function resolveQuantity(state: EngineeringLeadState, rawMessage: string): number | null {
  const explicit = parsePieceCount(state.quantity);
  if (explicit != null) return explicit;
  // Only fall back when the extractor found nothing whatsoever for quantity —
  // an explicit non-count unit ("20 м²") is a deliberate signal and must not
  // be overridden by grabbing an unrelated number elsewhere in the message.
  return state.quantity == null ? impliedPieceCount(rawMessage, state) : null;
}

function metalPartsPlan(state: EngineeringLeadState, rawMessage: string): QuoteEnginePlan {
  if (mentionsBending(rawMessage)) {
    return {
      status: "needs-cad",
      calculator: "metal-parts",
      reason: "Деталь с гибами: нужен чертёж (DXF) или 3D-модель (STEP) для точной развёртки, "
        + "либо расчёт передаётся технологу вручную.",
    };
  }

  const missing: MissingField[] = [];

  const materialId = materialLabelToId(state.material);
  if (materialId == null) {
    missing.push({
      code: "material",
      question: state.material === "Сталь"
        ? "Уточните, пожалуйста: сталь горячекатаная или холоднокатаная? У них разная цена."
        : "Какой материал: сталь (уточните горячекатаная/холоднокатаная), оцинкованная сталь, "
          + "нержавеющая сталь или алюминий?",
    });
  }

  const thicknessMm = parseThicknessMm(state.thickness);
  if (thicknessMm == null) {
    missing.push({ code: "thicknessMm", question: "Какая толщина металла, в мм?" });
  }

  const dimensions = parseDimensionsMm(state.dimensions);
  if (dimensions == null) {
    missing.push({ code: "dimensions", question: "Укажите габариты детали (ширина × высота), в мм." });
  }

  const quantity = resolveQuantity(state, rawMessage);
  if (quantity == null) {
    missing.push({ code: "quantity", question: "Какое количество деталей нужно, в штуках?" });
  }

  if (missing.length > 0) return { status: "missing-fields", calculator: "metal-parts", missing };

  return {
    status: "ready",
    calculator: "metal-parts",
    input: { materialId: materialId!, thicknessMm: thicknessMm!, widthMm: dimensions!.widthMm, heightMm: dimensions!.heightMm, quantity: quantity! },
  };
}

function metalCassettePlan(state: EngineeringLeadState, rawMessage: string): QuoteEnginePlan {
  const missing: MissingField[] = [];

  // Never in extractLeadState's field set at all — the customer's own words
  // do not distinguish these, and the two are priced on different rates
  // (getDefaultMetalCassetteRate), so this is always an explicit question,
  // not a default.
  const typeMatch = /закрыт[а-я]*/iu.test(rawMessage) ? "closed" : /открыт[а-я]*/iu.test(rawMessage) ? "open" : null;
  if (typeMatch == null) {
    missing.push({ code: "cassetteType", question: "Кассеты открытого или закрытого типа?" });
  }

  const thicknessMm = parseThicknessMm(state.thickness);
  const thickness = nearestCassetteThickness(thicknessMm);
  if (thickness == null) {
    missing.push({
      code: "thickness",
      question: thicknessMm == null
        ? "Какая толщина металла, в мм (0,65 / 0,7 / 1,0 или 1,2)?"
        : `Толщина ${thicknessMm} мм не входит в стандартный ряд кассет (0,65 / 0,7 / 1,0 / 1,2 мм) — уточните.`,
    });
  }

  const dimensions = parseDimensionsMm(state.dimensions);
  if (dimensions == null) {
    missing.push({ code: "dimensions", question: "Укажите размер одной кассеты (ширина × высота), в мм." });
  }

  const quantity = resolveQuantity(state, rawMessage);
  if (quantity == null) {
    missing.push({ code: "quantity", question: "Сколько кассет нужно, в штуках?" });
  }

  if (missing.length > 0) return { status: "missing-fields", calculator: "metal-cassettes", missing };

  return {
    status: "ready",
    calculator: "metal-cassettes",
    input: {
      type: typeMatch as MetalCassetteType,
      thickness: thickness!,
      quantity: quantity!,
      moduleWidthMm: dimensions!.widthMm,
      moduleHeightMm: dimensions!.heightMm,
    },
  };
}

/**
 * The single entry point §3/§7 describe: the customer never chooses a
 * calculator, this decides it from the same classification the free-text
 * extractor already produced, then tries to complete a ready-to-price input
 * for that one calculator only.
 */
export function planQuoteEngineCalculation(state: EngineeringLeadState, rawMessage: string): QuoteEnginePlan {
  const classification = classifyProduct(state);
  if (classification.status === "ambiguous") {
    return { status: "ambiguous-product", question: classification.question };
  }

  return classification.calculator === "metal-cassettes"
    ? metalCassettePlan(state, rawMessage)
    : metalPartsPlan(state, rawMessage);
}
