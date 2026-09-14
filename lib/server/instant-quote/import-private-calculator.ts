import "server-only";

import type { FactualRate, LaserFactualRate } from "@/lib/instant-quote/factual-calculation";
import type { MaterialId } from "@/lib/instant-quote/pricing";
import type { PrivateCalculationBasis } from "@/lib/server/instant-quote/private-calculation-basis";

const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const PUBLIC_STEEL_MATERIALS: MaterialId[] = ["hot", "cold", "zinc"];

type ImportResult = {
  basis: PrivateCalculationBasis;
  warnings: string[];
};

function blockBetween(source: string, start: string, end: string, label: string) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`Private calculator import: ${label} start not found`);
  const to = source.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`Private calculator import: ${label} end not found`);
  return source.slice(from + start.length, to);
}

function numberValue(source: string, key: string, label = key) {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\b`));
  const value = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Private calculator import: invalid ${label}`);
  return value;
}

function positiveNumberValue(source: string, key: string, label = key) {
  const value = numberValue(source, key, label);
  if (!(value > 0)) throw new Error(`Private calculator import: ${label} must be positive`);
  return value;
}

function booleanValue(source: string, key: string, label = key) {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`));
  if (!match) throw new Error(`Private calculator import: invalid ${label}`);
  return match[1] === "true";
}

function rateSource(now: Date): FactualRate["source"] {
  return {
    id: "owner-calculator-import",
    label: "Утверждённые заводские ставки владельца",
    confirmedAt: now.toISOString(),
    note: "Импортировано на сервере из предоставленного владельцем внутреннего калькулятора; значения не публикуются клиенту.",
  };
}

function parseSteelLaserRows(factoryBlock: string, now: Date): LaserFactualRate[] {
  const steelBlock = blockBetween(factoryBlock, "steel: [", "],\n    inox:", "steel cutting table");
  const rows: Array<{ thicknessMm: number; c1: number; c2: number; c3: number; pierce: number }> = [];
  const rowPattern = /\{\s*t:\s*(\d+(?:\.\d+)?),\s*c1:\s*(\d+(?:\.\d+)?),\s*c2:\s*(\d+(?:\.\d+)?),\s*c3:\s*(\d+(?:\.\d+)?),\s*p:\s*(\d+(?:\.\d+)?)\s*\}/g;
  for (const match of steelBlock.matchAll(rowPattern)) {
    const [thicknessMm, c1, c2, c3, pierce] = match.slice(1).map(Number);
    if (![thicknessMm, c1, c2, c3, pierce].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error("Private calculator import: invalid steel laser row");
    }
    rows.push({ thicknessMm, c1, c2, c3, pierce });
  }
  if (rows.length < 10) throw new Error("Private calculator import: steel laser table is incomplete");
  if (new Set(rows.map((row) => row.thicknessMm)).size !== rows.length) {
    throw new Error("Private calculator import: duplicate steel laser thickness");
  }

  const source = rateSource(now);
  return PUBLIC_STEEL_MATERIALS.flatMap((materialId) => rows.map((row) => ({
    materialId,
    thicknessMm: row.thicknessMm,
    rateRub: row.c1,
    from100mRubPerM: row.c2,
    from500mRubPerM: row.c3,
    pierceRubEach: row.pierce,
    source,
  })));
}

function simpleRate(rateRub: number, now: Date): FactualRate {
  return { rateRub, source: rateSource(now) };
}

/**
 * Parses only the narrowly defined factory constants from the owner's offline
 * metalworking calculator. The uploaded JavaScript is never evaluated.
 * Supplier-price seed rows are deliberately ignored: the server refreshes the
 * official Atlantik feed after the private basis is initialized.
 */
export function importPrivateCalculatorHtml(html: string, now = new Date()): ImportResult {
  if (!html || Buffer.byteLength(html, "utf8") > MAX_IMPORT_BYTES) {
    throw new Error("Private calculator import: file size is invalid");
  }
  if (!/<title>\s*Калькулятор металлообработки\s*<\/title>/i.test(html)) {
    throw new Error("Private calculator import: unexpected document");
  }

  const factoryBlock = blockBetween(html, "var FACTORY = {", "\nvar COEFS =", "FACTORY block");
  const opsBlock = blockBetween(factoryBlock, "ops: {", "\n  },\n  cut:", "factory operations");
  const source = rateSource(now);

  const basis: PrivateCalculationBasis = {
    version: `owner-calculator-${now.toISOString()}`,
    rateBook: {
      laserRubPerM: parseSteelLaserRows(factoryBlock, now),
      bendRubEach: simpleRate(positiveNumberValue(opsBlock, "bend", "bend rate"), now),
      // The source calculator defines welding in ₽/unit, while the factual
      // engine requires ₽/m of confirmed weld. Do not silently reinterpret it.
      weldRubPerM: null,
      powderRubPerM2: simpleRate(positiveNumberValue(opsBlock, "paint", "powder rate"), now),
      assemblyRubPerHour: simpleRate(positiveNumberValue(opsBlock, "assemblyHour", "assembly rate"), now),
      surfacePreparationRubPerM2: simpleRate(positiveNumberValue(opsBlock, "shot", "surface preparation rate"), now),
      packagingRubEach: simpleRate(positiveNumberValue(opsBlock, "pack", "packaging rate"), now),
    },
    materialPriceSnapshots: [],
    commercialPricing: {
      materialMultiplier: positiveNumberValue(factoryBlock, "metalK", "material multiplier"),
      drawPct: numberValue(factoryBlock, "drawPct", "drawing percentage"),
      finalPct: numberValue(factoryBlock, "finalPct", "commercial markup percentage"),
      fixedAddRubEach: numberValue(factoryBlock, "fixedAdd", "fixed addition"),
      fixedAddEnabled: booleanValue(factoryBlock, "fixedOn", "fixed addition enabled"),
      roundStepRub: positiveNumberValue(factoryBlock, "roundStep", "rounding step"),
    },
  };

  // Ensure a source object was constructed during parsing; keep this explicit
  // so future refactors do not accidentally remove provenance from rate rows.
  if (!source.id) throw new Error("Private calculator import: rate provenance missing");

  return {
    basis,
    warnings: [
      "Закупочные цены из локального seed не импортированы: после записи basis используется свежий официальный прайс поставщика.",
      "Ставка сварки не импортирована: исходный калькулятор задаёт ₽/ед., а производственный контур требует подтверждённый ₽/м.",
    ],
  };
}
