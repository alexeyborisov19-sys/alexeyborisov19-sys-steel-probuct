import type { MaterialId, MaterialMarketPrice } from "@/lib/instant-quote/pricing";

export type AtlantikPriceParseOptions = {
  sourceDate: string;
  fetchedAt: string;
  sourceLabel?: string;
};

const SECTION_BY_TITLE: Array<{ pattern: RegExp; materialId: MaterialId }> = [
  { pattern: /лист\s+оцинкованн/i, materialId: "zinc" },
  { pattern: /лист\s+холоднокатан/i, materialId: "cold" },
  { pattern: /лист\s+горячекатан/i, materialId: "hot" },
];

const RUSSIAN_MONTH = new Map([
  ["января", 1],
  ["февраля", 2],
  ["марта", 3],
  ["апреля", 4],
  ["мая", 5],
  ["июня", 6],
  ["июля", 7],
  ["августа", 8],
  ["сентября", 9],
  ["октября", 10],
  ["ноября", 11],
  ["декабря", 12],
]);

function normalizedLines(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

export function extractAtlantikPriceDocumentDate(text: string): string | null {
  const match = text.toLowerCase().match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})(?:\s+года)?\b/i,
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = RUSSIAN_MONTH.get(match[2].toLowerCase());
  const year = Number(match[3]);
  if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function decimal(value: string) {
  return Number(value.replace(",", "."));
}

function integerPrice(value: string) {
  return Number(value.replace(/\s+/g, ""));
}

function parseSheetRow(line: string) {
  // Black/galvanized sheet prices in Atlantik's extracted table are normally
  // formatted as `123 400` (or occasionally as an unspaced integer). Do not
  // use a greedy thousands pattern here: two adjacent price columns such as
  // `123 400 121 900` must remain two independent values.
  // Examples:
  // 2х1250х2500 123 400 121 900 6 123,45
  // 16x1500x6000 123 400 режем кратно 1 м
  const match = line.match(
    /^(\d+(?:[,.]\d+)?)\s*[xх×]\s*(\d+)\s*[xх×]\s*(\d+)\s+(\d{2,3}\s\d{3}|\d{4,6})(?:\s+(\d{2,3}\s\d{3}|\d{4,6}))?(?:\s|$)/i,
  );
  if (!match) return null;

  const thicknessMm = decimal(match[1]);
  const widthMm = Number(match[2]);
  const lengthMm = Number(match[3]);
  const rubPerTon = integerPrice(match[4]);
  const secondPrice = match[5] ? integerPrice(match[5]) : undefined;

  if (
    !Number.isFinite(thicknessMm) || thicknessMm <= 0 ||
    !Number.isFinite(widthMm) || widthMm <= 0 ||
    !Number.isFinite(lengthMm) || lengthMm <= 0 ||
    !Number.isFinite(rubPerTon) || rubPerTon <= 0
  ) return null;

  return {
    thicknessMm,
    size: `${String(thicknessMm).replace(".", ",")}x${widthMm}x${lengthMm}`,
    rubPerTon,
    rubPerTonFrom3t: secondPrice && secondPrice > 0 ? secondPrice : undefined,
  };
}

export type AtlantikSourceShape = {
  lineCount: number;
  /** Headings the parser recognised as starting a sheet section. */
  sectionHeadings: string[];
  /** Lines that name a sheet but match no section pattern — the likely break. */
  unrecognisedSheetHeadings: string[];
  sizeLikeLineCount: number;
  /** Size-like lines with every digit replaced by 9: layout without prices. */
  sampleShapes: string[];
  /**
   * Every line in order, digits replaced by 9, tagged H for a heading the
   * section patterns match and R for a line that carries a size. Counts alone
   * cannot show how the blocks interleave, and in a price list printed in
   * several columns side by side that is the whole question: one text line
   * holds a row from each column at once, so which material a size belongs to
   * is decided by the order of the lines, not by the line itself.
   */
  outline: string[];
};

const SIZE_LIKE = /\d+(?:[,.]\d+)?\s*[xх×]\s*\d+\s*[xх×]\s*\d+/i;

/**
 * Describes the shape of an extracted price document without disclosing any of
 * it. When the supplier changes the layout the refresh stops finding rows, and
 * the count of rows it did not find says nothing about why — whether no section
 * heading was recognised, or headings were found and the rows beneath them are
 * written differently. Digits are replaced by 9 in the samples, so the layout
 * is visible and the prices are not.
 */
export function describeAtlantikSourceShape(text: string): AtlantikSourceShape {
  const lines = normalizedLines(text);
  const sectionHeadings: string[] = [];
  const unrecognisedSheetHeadings: string[] = [];
  const sampleShapes: string[] = [];
  const outline: string[] = [];
  let sizeLikeLineCount = 0;

  lines.slice(0, 200).forEach((line, index) => {
    const heading = SECTION_BY_TITLE.some((candidate) => candidate.pattern.test(line));
    const tag = heading ? "H" : SIZE_LIKE.test(line) ? "R" : ".";
    outline.push(`${String(index).padStart(3, "0")} ${tag} ${line.replace(/\d/g, "9").slice(0, 140)}`);
  });

  for (const line of lines) {
    if (SECTION_BY_TITLE.some((candidate) => candidate.pattern.test(line))) {
      if (sectionHeadings.length < 12) sectionHeadings.push(line.slice(0, 120));
      continue;
    }
    if (/лист/i.test(line) && !SIZE_LIKE.test(line) && unrecognisedSheetHeadings.length < 12) {
      unrecognisedSheetHeadings.push(line.slice(0, 120));
    }
    if (SIZE_LIKE.test(line)) {
      sizeLikeLineCount += 1;
      if (sampleShapes.length < 8) sampleShapes.push(line.slice(0, 120).replace(/\d/g, "9"));
    }
  }

  return { lineCount: lines.length, sectionHeadings, unrecognisedSheetHeadings, sizeLikeLineCount, sampleShapes, outline };
}

/**
 * Parses only sheet-metal rows needed by Steel Product Online from text already
 * extracted from the official Atlantik price PDF. No network access happens in
 * this module, which keeps the parser deterministic and unit-testable.
 */
export function parseAtlantikSheetPriceText(
  text: string,
  options: AtlantikPriceParseOptions,
): MaterialMarketPrice[] {
  const source = options.sourceLabel?.trim() || "Атлантик Компани";
  let section: MaterialId | null = null;
  const rows: MaterialMarketPrice[] = [];

  for (const line of normalizedLines(text)) {
    const sectionMatch = SECTION_BY_TITLE.find((candidate) => candidate.pattern.test(line));
    if (sectionMatch) {
      section = sectionMatch.materialId;
      continue;
    }

    // Stop sheet parsing when the PDF moves to a clearly different product
    // family. Other sheet headings will set their own supported section above.
    if (/^(профлист|лента\s|лист\s+пвл|лист\s+рифлен|полоса\s|уголок\s|труба\s|сетка\s)/i.test(line)) {
      section = null;
      continue;
    }

    if (!section) continue;
    const parsed = parseSheetRow(line);
    if (!parsed) continue;

    rows.push({
      materialId: section,
      thicknessMm: parsed.thicknessMm,
      rubPerTon: parsed.rubPerTon,
      ...(parsed.rubPerTonFrom3t ? { rubPerTonFrom3t: parsed.rubPerTonFrom3t } : {}),
      source,
      sourceDate: options.sourceDate,
      fetchedAt: options.fetchedAt,
      size: parsed.size,
      exactThickness: true,
    });
  }

  // Exact duplicate rows can appear when PDF extraction repeats a table. Keep
  // one canonical row per material/thickness/size/price combination.
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [row.materialId, row.thicknessMm, row.size, row.rubPerTon, row.rubPerTonFrom3t ?? ""].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
