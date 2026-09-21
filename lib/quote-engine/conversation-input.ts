/** Numeric evidence for the quote dialog. No model, rates or network here. */
export type QuoteNumericEvidence = {
  // undefined = not mentioned (keep prior value); null = invalid/ambiguous (ask).
  thickness: string | null | undefined;
  quantity: string | null | undefined;
};

export function normalizeQuoteAnswer(message: string, askedField?: string): string {
  const answer = message.trim();
  if ((askedField === "thickness" || askedField === "thicknessMm")
    && /^\d+(?:[.,]\d+)?$/.test(answer)) {
    return `толщина ${answer.replace(",", ".")} мм`;
  }
  if (askedField === "quantity" && /^\d+(?:[ \u00a0]\d{3})*$/.test(answer)) {
    return `${answer} шт`;
  }
  return message;
}

function positiveNumber(raw: string): number | null {
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function uniqueValue(values: string[]): string | null | undefined {
  return values.length === 0 ? undefined : new Set(values).size === 1 ? values[0] : null;
}

/**
 * A dimension's trailing millimetres are NOT evidence of sheet thickness.
 * Quantity must have a piece/area unit or name an actual product; delivery
 * dates, RAL codes and e.g. "10 дней" must not become a piece count.
 */
export function quoteNumericEvidence(message: string): QuoteNumericEvidence {
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();
  const withoutDimensions = normalized.replace(
    /(?<![\d.,])\d+(?:[.,]\d+)?\s*[×xх*]\s*\d+(?:[.,]\d+)?(?:\s*[×xх*]\s*\d+(?:[.,]\d+)?)?\s*(?:мм|см|м)?/giu,
    " ",
  );
  const namedThickness = [...withoutDimensions.matchAll(
    /толщин[\p{L}-]*\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*мм(?![\p{L}])/giu,
  )];
  const withoutLinearSizes = withoutDimensions.replace(
    /(?:ширин[\p{L}-]*|высот[\p{L}-]*|длин[\p{L}-]*|глубин[\p{L}-]*|диаметр[\p{L}-]*)\s*[:=]?\s*\d+(?:[.,]\d+)?\s*мм/giu,
    " ",
  );
  const measures = namedThickness.length ? namedThickness : [...withoutLinearSizes.matchAll(
    /(?<![\d.,\-−])(\d+(?:[.,]\d+)?)\s*мм(?![\p{L}])/giu,
  )];
  const thicknessValues = measures.map((entry) => {
    const value = positiveNumber(entry[1]);
    return value == null ? null : `${value} мм`;
  });
  let thickness = thicknessValues.some((value) => value == null)
    ? null : uniqueValue(thicknessValues as string[]);
  if (!namedThickness.length && /толщин[\p{L}-]*\s*[:=]?\s*[-−]?\d/iu.test(withoutDimensions)) {
    // A named but invalid/missing-unit correction must not retain the old value.
    thickness = null;
  }

  const counts: string[] = [];
  let invalidCount = false;
  const countPattern = /(?<![\d.,\-−])(\d+(?: \d{3})*)\s*(шт(?:ук)?|штук[аи]?|единиц[аы]?|комплект[\p{L}-]*|м²|м2|пог\.?\s*м)(?![\p{L}\d])/giu;
  for (const entry of withoutDimensions.matchAll(countPattern)) {
    const value = positiveNumber(entry[1]);
    const prefix = withoutDimensions.slice(0, entry.index);
    if (value == null || !Number.isSafeInteger(value) || /(?:^|\s)(?:до|от|около|примерно)\s*$/iu.test(prefix)) {
      invalidCount = true;
      continue;
    }
    const unit = entry[2];
    counts.push(/^(?:м²|м2|пог)/u.test(unit) ? `${value} ${unit}` : `${value} шт`);
  }
  // Reject a decimal/negative explicit count rather than keeping an earlier count.
  if (/(?:[-−]\d+(?:[.,]\d+)?|\d+[.,]\d+)\s*(?:шт|штук|единиц|комплект)/iu.test(withoutDimensions)) {
    invalidCount = true;
  }
  if (!counts.length && !invalidCount) {
    const productCount = /(?<![\d.,\-−])(\d+(?: \d{3})*)\s+(?:(?:фасадн[\p{L}-]*|металлическ[\p{L}-]*)\s+)?(?:металлокассет[\p{L}-]*|кассет[\p{L}-]*|кронштейн[\p{L}-]*|детал[\p{L}-]*|издели[\p{L}-]*|панел[\p{L}-]*|реш[её]тк[\p{L}-]*|корпус[\p{L}-]*|шкаф[\p{L}-]*|кожух[\p{L}-]*|корзин[\p{L}-]*|экран[\p{L}-]*|отлив[\p{L}-]*|откос[\p{L}-]*|парапет[\p{L}-]*)(?![\p{L}])/giu;
    for (const entry of withoutDimensions.matchAll(productCount)) {
      const value = positiveNumber(entry[1]);
      const prefix = withoutDimensions.slice(0, entry.index);
      if (value == null || !Number.isSafeInteger(value) || /(?:^|\s)(?:до|от|около|примерно)\s*$/iu.test(prefix)) {
        invalidCount = true;
      } else {
        counts.push(`${value} шт`);
      }
    }
  }
  return { thickness, quantity: invalidCount ? null : uniqueValue(counts) };
}

/** A positive bending requirement survives later turns; negated mentions do not set it. */
export function hasBendingRequirement(message: string): boolean {
  const withoutNegations = message.toLowerCase()
    .replace(/без\s+(?:гиб[а-яё]*|загиб[а-яё]*|отбортов[а-яё]*)/giu, " ")
    .replace(/(?:гиб[а-яё]*|загиб[а-яё]*|отбортов[а-яё]*)\s+не\s+(?:нуж[а-яё]*|требу[а-яё]*)/giu, " ");
  return /гнут[а-яё]*|гиб[а-яё]*|отбортов[а-яё]*|загиб[а-яё]*/iu.test(withoutNegations);
}
