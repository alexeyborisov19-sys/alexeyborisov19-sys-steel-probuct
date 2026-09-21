import type { EngineeringLeadState } from "@/lib/assistant/types";
import { classifyProduct, type CalculatorId } from "@/lib/quote-engine/classification";
import { hasBendingRequirement } from "@/lib/quote-engine/conversation-input";
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
  return hasBendingRequirement(rawMessage);
}

function metalPartsPlan(state: EngineeringLeadState, rawMessage: string): QuoteEnginePlan {
  if (state.quoteRequiresCad || mentionsBending(rawMessage)) {
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

  // Reads state.quantity, which extractLeadState now normalises even from
  // a bare count of the product itself ("100 кронштейнов") — that fallback
  // used to live here, keyed off rawMessage alone, and lost the answer the
  // moment a later turn's rawMessage no longer contained it. Reading through
  // state instead means it survives exactly like every other field.
  const quantity = parsePieceCount(state.quantity);
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

function metalCassettePlan(state: EngineeringLeadState): QuoteEnginePlan {
  const missing: MissingField[] = [];

  // Never in extractLeadState's field set at all — the customer's own words
  // do not distinguish these, and the two are priced on different rates
  // (getDefaultMetalCassetteRate), so this is always an explicit question,
  // not a default.
  // Reads state.cassetteType, set by extractLeadState from the same words
  // ("открытого"/"закрытого типа") checked directly against rawMessage here
  // before — which meant the answer was forgotten the instant a later turn's
  // message no longer repeated it. state persists it like every other field.
  const typeMatch = state.cassetteType ?? null;
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

  const quantity = parsePieceCount(state.quantity);
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
 * The single entry point §3/§7 describe. `calculatorOverride` is the
 * customer's own explicit choice — a click on one of exactly two buttons
 * before anything is typed — rather than a guess drawn from their wording.
 * When given, `classifyProduct`'s text-pattern classification (and its
 * "ambiguous, please clarify" branch) is not consulted at all: there is
 * nothing to classify and nothing to get wrong, because the choice was
 * never inferred in the first place. Only when no override is given does
 * this fall back to reading the calculator from the same classification
 * the free-text extractor already produced.
 */
export function planQuoteEngineCalculation(
  state: EngineeringLeadState,
  rawMessage: string,
  calculatorOverride?: CalculatorId,
): QuoteEnginePlan {
  let calculator: CalculatorId;
  if (calculatorOverride) {
    calculator = calculatorOverride;
  } else {
    const classification = classifyProduct(state);
    if (classification.status === "ambiguous") {
      return { status: "ambiguous-product", question: classification.question };
    }
    calculator = classification.calculator;
  }

  return calculator === "metal-cassettes"
    ? metalCassettePlan(state)
    : metalPartsPlan(state, rawMessage);
}
