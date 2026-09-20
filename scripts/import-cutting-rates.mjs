#!/usr/bin/env node
/**
 * Converts the production cutting-rate sheet ("Стоимость резки") into the
 * `laserRubPerM` block of the private calculation basis.
 *
 * Why this exists: the engine already implements the shop's own pricing
 * (rate by material and thickness, stepping down at 100 m and 500 m of total
 * contour, plus a per-pierce charge). What it cannot do is invent the numbers
 * — without an approved rate for a material and thickness the quote is
 * blocked rather than guessed, which is why a request can end in a question
 * instead of a price. This reads those numbers from the sheet they are
 * maintained in, so nobody retypes ~60 money rows by hand.
 *
 * The output goes to stdout and is never written into the repository: the
 * basis file is confidential and lives outside it by design.
 *
 *   node scripts/import-cutting-rates.mjs Расчет.xlsx --steel hot > rates.json
 *
 * `--steel` is required because the sheet keeps one "Конструкционная сталь"
 * table while the site prices hot- and cold-rolled separately; which one these
 * rates apply to is a decision for whoever maintains them, not for this script.
 */

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Minimal zip reader: enough to pull named entries out of a .xlsx. */
function readZipEntries(buffer) {
  const eocd = (() => {
    for (let i = buffer.length - 22; i >= 0; i -= 1) {
      if (buffer.readUInt32LE(i) === 0x06054b50) return i;
    }
    return -1;
  })();
  if (eocd < 0) fail("Не похоже на .xlsx: не найден конец zip-архива.");

  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let index = 0; index < total; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 0 ? raw : inflateRawSync(raw));

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function textOf(xml, tagPattern) {
  return [...xml.matchAll(tagPattern)].map((match) => match[1]);
}

/** Shared strings are stored once and referenced by index from every cell. */
function sharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    textOf(match[1], /<t[^>]*>([\s\S]*?)<\/t>/g).join("")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
}

/** Locates the worksheet part backing a sheet name, via the workbook relationships. */
function worksheetByName(entries, wanted) {
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheet = [...workbook.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g)]
    .find((match) => match[1] === wanted);
  if (!sheet) fail(`В книге нет листа «${wanted}». Листы: ${[...workbook.matchAll(/name="([^"]*)"/g)].map((m) => m[1]).join(", ")}`);

  const target = [...rels.matchAll(/<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g)]
    .find((match) => match[1] === sheet[2])?.[2];
  if (!target) fail(`Не найдена связь для листа «${wanted}».`);

  const path = `xl/${target.replace(/^\/?xl\//, "").replace(/^\.\//, "")}`;
  const part = entries.get(path);
  if (!part) fail(`Лист «${wanted}» указывает на ${path}, которого нет в архиве.`);
  return part.toString("utf8");
}

/** Cells as { A1: value }, with shared strings resolved and formulas ignored. */
export function cellMap(sheetXml, strings) {
  const cells = {};
  // Empty cells are written self-closing (`<c r="H2" s="10"/>`). They must be
  // matched as their own alternative, or the body of the next real cell is
  // swallowed whole and an entire column silently disappears.
  for (const match of sheetXml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, ref, attributes, body] = match;
    if (body == null) continue;
    const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (value == null) continue;
    cells[ref] = / t="s"/.test(attributes) ? strings[Number(value)] ?? "" : value;
  }
  return cells;
}

/** The sheet's own last-modified date — a real, checkable provenance, not an invented one. */
function documentModifiedAt(entries) {
  const core = entries.get("docProps/core.xml")?.toString("utf8") ?? "";
  const modified = /<dcterms:modified[^>]*>([^<]+)<\/dcterms:modified>/.exec(core)?.[1];
  if (!modified || !Number.isFinite(Date.parse(modified))) {
    fail("В файле нет даты изменения (docProps/core.xml) — без неё нечем подтвердить, на когда действуют ставки.");
  }
  return modified;
}

const MATERIAL_BY_SHEET_NAME = new Map([
  ["Дюраль/Алюминий", ["alu"]],
  ["Медь", ["copper"]],
  ["Нержавеющая сталь", ["inox"]],
  ["Латунь", ["brass"]],
]);

function number(raw) {
  if (raw == null || raw === "") return null;
  const value = Number(String(raw).replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function main() {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) fail("Использование: node scripts/import-cutting-rates.mjs <файл.xlsx> --steel hot|cold [--sheet «Стоимость резки»]");

  const steelIndex = rest.indexOf("--steel");
  const steel = steelIndex >= 0 ? rest[steelIndex + 1] : null;
  if (steel !== "hot" && steel !== "cold" && steel !== "both") {
    fail("Укажите --steel hot, cold или both: в листе одна таблица «Конструкционная сталь», а сайт считает г/к и х/к раздельно.");
  }
  const noteIndex = rest.indexOf("--note");
  const sheetIndex = rest.indexOf("--sheet");
  const sheetName = sheetIndex >= 0 ? rest[sheetIndex + 1] : "Стоимость резки";

  const entries = readZipEntries(readFileSync(file));
  const strings = sharedStrings(entries);
  const source = {
    id: "production-cutting-sheet",
    label: `Производственный лист «${sheetName}»`,
    confirmedAt: documentModifiedAt(entries),
    note: noteIndex >= 0 ? rest[noteIndex + 1] : `Импортировано из ${file.split("/").pop()}`,
  };
  const cells = cellMap(worksheetByName(entries, sheetName), strings);

  const materials = new Map(MATERIAL_BY_SHEET_NAME);
  // "both" emits the same table under both ids: laser cutting is priced by
  // material family and thickness, and the sheet keeps one table for
  // structural steel without splitting it by rolling.
  materials.set("Конструкционная сталь", steel === "both" ? ["hot", "cold"] : [steel]);

  // Each material's block is a label in column I, then a header row, then the
  // thickness rows — read until the thickness column stops being a number.
  const rows = [];
  const skipped = [];
  for (let row = 1; row <= 400; row += 1) {
    const label = String(cells[`I${row}`] ?? "").trim();
    const materialIds = materials.get(label);
    if (!materialIds) continue;

    for (let cursor = row + 2; cursor <= 400; cursor += 1) {
      const thicknessMm = number(cells[`I${cursor}`]);
      if (thicknessMm == null) break;

      const rateRub = number(cells[`J${cursor}`]);
      const from100mRubPerM = number(cells[`K${cursor}`]);
      const from500mRubPerM = number(cells[`L${cursor}`]);
      const pierceRubEach = number(cells[`M${cursor}`]);

      if (rateRub == null) {
        skipped.push(`${label} ${thicknessMm} мм — нет базовой ставки`);
        continue;
      }
      for (const materialId of materialIds) rows.push({
        materialId,
        thicknessMm,
        rateRub,
        ...(from100mRubPerM == null ? {} : { from100mRubPerM }),
        ...(from500mRubPerM == null ? {} : { from500mRubPerM }),
        ...(pierceRubEach == null ? {} : { pierceRubEach }),
        source,
      });
    }
  }

  if (rows.length === 0) fail(`На листе «${sheetName}» не найдено ни одной таблицы ставок в колонках I–M.`);

  const seen = new Set();
  for (const row of rows) {
    const key = `${row.materialId}@${row.thicknessMm}`;
    if (seen.has(key)) fail(`Дубль ставки: ${key}. Уберите повтор в листе — иначе неясно, какая цена верна.`);
    seen.add(key);
  }

  for (const note of skipped) process.stderr.write(`пропущено: ${note}\n`);
  process.stderr.write(`Готово: ${rows.length} ставок, материалы: ${[...new Set(rows.map((r) => r.materialId))].join(", ")}\n`);
  process.stderr.write(`Источник ставок: ${source.label}, дата изменения файла ${source.confirmedAt.slice(0, 10)}.\n`);
  process.stderr.write("Гибка, сварка и покраска не импортируются: в листе они посчитаны по-разному в разных строках.\n");

  // Only the cutting table is emitted. Bending, welding and painting are left
  // null on purpose: the sheet prices bending two different ways in its own
  // rows (mass × 5 on some, a flat 60 per bend on others), and picking one
  // would be choosing a number rather than reading it.
  const basis = {
    version: `production-cutting-sheet ${source.confirmedAt.slice(0, 10)}`,
    rateBook: { laserRubPerM: rows, bendRubEach: null, weldRubPerM: null, powderRubPerM2: null },
    materialPriceSnapshots: [],
  };
  process.stdout.write(`${JSON.stringify(rest.includes("--basis") ? basis : { laserRubPerM: rows }, null, 2)}\n`);
}

// Only when run directly: importing this file (the parsing guard in
// tests/import-cutting-rates.test.ts) must not execute the converter.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
