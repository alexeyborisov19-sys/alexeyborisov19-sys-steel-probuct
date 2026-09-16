import assert from "node:assert/strict";
import test from "node:test";
import {
  describeAtlantikSourceShape,
  extractAtlantikPriceDocumentDate,
  parseAtlantikSheetPriceText,
} from "../lib/instant-quote/atlantik-price-parser";

const options = {
  sourceDate: "2099-02-03",
  fetchedAt: "2099-02-03T10:00:00.000Z",
};

const syntheticText = `
04 сентября 2099 года
Цена для юр.лиц до 3 т от 3 т
Лист оцинкованный
0,5х1000х2000 111 000 109 000 999,00
1х1250х2500 112 000 110 000 1 111,00
Профлист С21
0,5х1051х2000 9 999,00
Лист холоднокатаный ГОСТ
0,8x1250x2500 101 000 99 000 1 234,00
2х1250х2500 102 000 100 000 2 345,00
Лента упак.
0,7х19Н 77 000 76 000
Лист горячекатаный ГОСТ
1,5х1250х2500 91 000 89 000 2 222,00
2×1250×2500 92 000 90 000 3 333,00
16х1500х6000 93 000 режем кратно 1 м
Лист ПВЛ
406-1000х3300 88 000 87 000 4 444,00
Лист горячекатаный ГОСТ
2×1250×2500 92 000 90 000 3 333,00
`;

test("extracts the source date printed inside the Atlantik price document", () => {
  assert.equal(extractAtlantikPriceDocumentDate(syntheticText), "2099-09-04");
  assert.equal(extractAtlantikPriceDocumentDate("31 февраля 2099 года"), null);
  assert.equal(extractAtlantikPriceDocumentDate("Прайс без даты"), null);
});

test("parses only supported Atlantik sheet sections", () => {
  const rows = parseAtlantikSheetPriceText(syntheticText, options);
  assert.equal(rows.length, 7);
  assert.deepEqual(new Set(rows.map((row) => row.materialId)), new Set(["zinc", "cold", "hot"]));
  assert.equal(rows.some((row) => row.size?.includes("1051")), false);
  assert.equal(rows.some((row) => row.size?.includes("19")), false);
});

test("normalizes decimal thickness, separators and wholesale tiers", () => {
  const rows = parseAtlantikSheetPriceText(syntheticText, options);
  const zinc = rows.find((row) => row.materialId === "zinc" && row.thicknessMm === 0.5);
  const hot = rows.find((row) => row.materialId === "hot" && row.thicknessMm === 2);
  const thick = rows.find((row) => row.materialId === "hot" && row.thicknessMm === 16);

  assert.equal(zinc?.rubPerTon, 111_000);
  assert.equal(zinc?.rubPerTonFrom3t, 109_000);
  assert.equal(zinc?.size, "0,5x1000x2000");
  assert.equal(hot?.rubPerTon, 92_000);
  assert.equal(hot?.rubPerTonFrom3t, 90_000);
  assert.equal(thick?.rubPerTon, 93_000);
  assert.equal(thick?.rubPerTonFrom3t, undefined);
});

test("deduplicates repeated extracted PDF tables and stamps source metadata", () => {
  const rows = parseAtlantikSheetPriceText(syntheticText, options);
  const repeated = rows.filter((row) => row.materialId === "hot" && row.thicknessMm === 2 && row.size === "2x1250x2500");
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].source, "Атлантик Компани");
  assert.equal(repeated[0].sourceDate, options.sourceDate);
  assert.equal(repeated[0].fetchedAt, options.fetchedAt);
  assert.equal(repeated[0].exactThickness, true);
});

test("describes the document's layout so a failed refresh can be diagnosed", () => {
  const shape = describeAtlantikSourceShape(syntheticText);

  assert.equal(shape.sectionHeadings.length, 4);
  assert.ok(shape.sectionHeadings.some((heading) => /горячекатаный/i.test(heading)), shape.sectionHeadings.join(" | "));
  assert.ok(shape.sizeLikeLineCount >= 7, String(shape.sizeLikeLineCount));
  assert.equal(shape.lineCount > 0, true);
});

test("the description carries the layout and none of the prices", () => {
  const shape = describeAtlantikSourceShape(syntheticText);
  const samples = shape.sampleShapes.join("\n");

  // Every digit is replaced, so the separators, column order and spacing are
  // readable and the supplier's prices are not in the log.
  assert.equal(/\d/.test(samples.replace(/9/g, "")), false, samples);
  assert.equal(samples.includes("111 000"), false, samples);
  assert.ok(samples.includes("9,9х9999х9999") || samples.includes("9х9999х9999"), samples);
});

test("a heading the section patterns miss is reported, because that is the usual break", () => {
  // The refresh finds no rows when a heading stops matching: the section never
  // opens and every row beneath it is skipped. Naming the heading turns that
  // from a count of zero into a one-line fix.
  // replaceAll, not replace: the fixture repeats the heading the way an
  // extracted PDF repeats a table across pages.
  const renamed = syntheticText.replaceAll("Лист горячекатаный ГОСТ", "Листы горячего проката ГОСТ");
  const shape = describeAtlantikSourceShape(renamed);

  assert.ok(
    shape.unrecognisedSheetHeadings.some((heading) => /горячего проката/i.test(heading)),
    shape.unrecognisedSheetHeadings.join(" | "),
  );
  assert.equal(shape.sectionHeadings.some((heading) => /горячекатан/i.test(heading)), false);
  // The rows are still there — they are simply no longer attributed.
  assert.ok(shape.sizeLikeLineCount >= 7, String(shape.sizeLikeLineCount));
});
