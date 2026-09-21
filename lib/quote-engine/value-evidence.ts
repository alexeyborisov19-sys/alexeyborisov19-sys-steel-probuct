import { quoteNumericEvidence } from "@/lib/quote-engine/conversation-input";
import { materialLabelToId, parseDimensionsMm, parsePieceCount, parseThicknessMm } from "@/lib/quote-engine/field-parsing";

export type EvidenceField = "material" | "thickness" | "dimensions" | "quantity" | "cassetteType";
const WORDS: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4,
  пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14,
  пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60,
  семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200,
  триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600,
  семьсот: 700, восемьсот: 800, девятьсот: 900,
  тысяча: 1000, тысячу: 1000, тысячи: 1000, тысяч: 1000,
  полста: 50, полтора: 1.5, полторы: 1.5,
};

/** Only grammatical decreasing number groups; "два три" is not five. */
function readWords(words: string[]): number | null {
  if (words.length === 1) return WORDS[words[0]] ?? null;
  let total = 0, group = 0, previousRank = 4, thousands = false;
  for (const word of words) {
    const value = WORDS[word];
    if (value == null || value === 0 || !Number.isInteger(value) || word === "полста") return null;
    if (value === 1000) {
      if (thousands) return null;
      total = (group || 1) * 1000;
      group = 0; previousRank = 4; thousands = true;
      continue;
    }
    const rank = value >= 100 ? 3 : value >= 20 ? 2 : 1;
    if (rank >= previousRank) return null;
    previousRank = rank; group += value;
  }
  return total + group;
}

/** Small deterministic vocabulary, not permission to invent an unfamiliar number. */
export function normalizeNumberEvidence(source: string): string {
  const lower = source.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const tokens = lower.match(/[а-я]+|[^а-я]+/gu) ?? [];
  const output: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(WORDS, tokens[index])) { output.push(tokens[index]); continue; }
    const words = [tokens[index]];
    const start = index;
    while (tokens[index + 1] === " " && Object.prototype.hasOwnProperty.call(WORDS, tokens[index + 2])) {
      words.push(tokens[index + 2]); index += 2;
    }
    const number = readWords(words);
    output.push(number == null ? tokens.slice(start, index + 1).join("") : String(number));
  }
  return output.join("")
    .replace(/миллиметр(?:а|ов|ы)?(?![а-я])/gu, "мм")
    .replace(/сантиметр(?:а|ов|ы)?(?![а-я])/gu, "см")
    .replace(/(?<![а-я])метр(?:а|ов|ы)?(?![а-я])/gu, "м")
    .replace(/(\d)\s+на\s+(?=\d)/gu, "$1×")
    .replace(/(?<=\d)\s*[хx*]\s*(?=\d)/gu, "×");
}

/** Rejects a fragment cut out of a larger number/word or a negated statement. */
export function hasLiteralEvidence(quote: string, message: string): boolean {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const needle = normalize(quote), haystack = normalize(message);
  if (!needle || needle.length > 2000 || haystack.length > 20_000) return false;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = haystack.slice(0, index), after = haystack.slice(index + needle.length);
    const cutLeft = /[\p{L}\p{N}]$/u.test(before) && /^[\p{L}\p{N}]/u.test(needle);
    const cutRight = /[\p{L}\p{N}]$/u.test(needle) && /^[\p{L}\p{N}]/u.test(after);
    const qualified = /(?:^|\s)(?:не|без|до|от|около|примерно|более|менее)\s*$/u.test(before);
    if (!cutLeft && !cutRight && !qualified) return true;
    index = haystack.indexOf(needle, index + 1);
  }
  return false;
}

/** A literal quotation alone does NOT prove the model's proposed value. */
export function valueMatchesEvidence(field: EvidenceField, value: string, quote: string): boolean {
  if (value.length > 300 || quote.length > 2000) return false;
  const source = normalizeNumberEvidence(quote);
  if (/(?:^|\s)(?:не|без|около|примерно|или|либо|до|от)(?:\s|$)/u.test(source)) return false;
  if (field === "cassetteType") {
    const open = /(?<![а-я])открыт[а-я]*/u.test(source);
    const closed = /(?<![а-я])закрыт[а-я]*/u.test(source);
    return open !== closed && value === (open ? "open" : "closed");
  }
  if (field === "material") {
    const candidates = [
      { id: "zinc", pattern: /оцинков[а-я]*/u },
      { id: "inox", pattern: /нержав[а-я]*|нерж(?:\.|\s|$)/u },
      { id: "alu", pattern: /алюмин[а-я]*/u },
      { id: "cold", pattern: /холоднокатан[а-я]*|(?:^|\s)х\s*\/\s*к(?:\s|$)/u },
      { id: "hot", pattern: /горячекатан[а-я]*|(?:^|\s)г\s*\/\s*к(?:\s|$)/u },
    ].filter((candidate) => candidate.pattern.test(source));
    return candidates.length === 1 && candidates[0].id === materialLabelToId(value);
  }
  if (field === "dimensions") {
    const dimensions = [...source.matchAll(/(?<![\d.,\-−])(\d{2,5}\s*×\s*\d{2,5})(?!\s*[×\d.,])\s*(мм|см|м)?/gu)];
    if (dimensions.length !== 1) return false;
    const actual = parseDimensionsMm(`${dimensions[0][1]}${dimensions[0][2] ?? ""}`);
    const proposed = parseDimensionsMm(value);
    return !!actual && !!proposed && actual.widthMm === proposed.widthMm && actual.heightMm === proposed.heightMm;
  }
  // A set is not one piece; its composition must be clarified separately.
  if (field === "quantity" && /комплект[а-я]*/u.test(source)) return false;
  const evidence = quoteNumericEvidence(source);
  return field === "thickness"
    ? evidence.thickness != null && parseThicknessMm(evidence.thickness) === parseThicknessMm(value)
    : evidence.quantity != null && parsePieceCount(evidence.quantity) === parsePieceCount(value);
}
