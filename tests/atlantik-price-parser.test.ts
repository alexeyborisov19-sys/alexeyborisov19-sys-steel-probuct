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

// The layout the supplier actually prints: three products side by side, which
// pdftotext flattens onto one text line. The section heading also lands at the
// end of such a line rather than on one of its own.
const columnarText = `
04 сентября 2099 года
Арматура А500/А500С Трубы профильные ТУ/ГОСТ (теор.вес) Лист оцинкованный
до 3 т от 3 т за п/м до 3 т от 3 т за п/м до 3 т от 3 т за лист
Ø 6 А500С 71 900 71 400 10,30 40х20х1,5 67 900 67 400 97,01 0,5х1250х2500 111 000 109 000 1 234,56
Ø 8 А500С 71 900 71 400 15,60 40х40х2 67 900 67 400 162,95 0,7х1250х2500 112 000 110 000 1 345,67
Ø 10 А500С 70 900 70 400 24,20 50х25х2 68 900 68 400 180,11 1х1250х2500 113 000 111 000 1 456,78
Ø 12 А500С 70 900 70 400 34,80 60х30х2 68 900 68 400 210,45 Лист холоднокатаный ГОСТ за лист
Ø 14 А500С 70 500 70 000 47,40 60х40х2 68 500 68 000 240,33 0,8х1250х2500 101 000 99 000 1 111,11
Ø 16 А500С 70 500 70 000 61,90 80х40х3 68 500 68 000 310,77 1,5х1250х2500 102 000 100 000 1 222,22
Ø 18 А500С 70 100 69 600 78,40 80х80х4 68 100 67 600 420,19 2х1250х2500 103 000 101 000 1 333,33
Ø 20 А500С 70 100 69 600 96,80 100х50х3 68 100 67 600 350,02 Лист горячекатаный ГОСТ за лист
Ø 22 А500С 69 900 69 400 117,20 100х100х4 67 900 67 400 520,64 1,5х1250х2500 91 000 89 000 2 222,22
Ø 25 А500С 69 900 69 400 151,30 120х120х5 67 900 67 400 680,91 2х1250х2500 92 000 90 000 3 333,33
Ø 28 А500С 69 500 69 000 189,80 140х140х5 67 500 67 000 790,15 3х1500х6000 93 000 91 000 4 444,44
Ø 32 А500С 69 500 69 000 247,90 150х150х6 67 500 67 000 990,37 4х1500х6000 94 000 92 000 5 555,55
Ø 36 А500С 69 100 68 600 313,90 160х160х6 67 100 66 600 1 090,22 5х1500х6000 95 000 93 000 6 666,66
Ø 40 А500С 69 100 68 600 387,60 180х180х6 67 100 66 600 1 250,88 6х1500х6000 96 000 94 000 7 777,77
`;

test("a sheet row is read where the supplier actually prints it — in the middle of the line", () => {
  // This is the whole failure: the row matcher was anchored to the start of the
  // line, and in a three-column price list the sheet column never starts there.
  // The refresh found no rows at all and reported hot=0, cold=0, zinc=0.
  const rows = parseAtlantikSheetPriceText(columnarText, options);

  const counts = { hot: 0, cold: 0, zinc: 0 } as Record<string, number>;
  for (const row of rows) counts[row.materialId] = (counts[row.materialId] ?? 0) + 1;

  assert.ok(counts.zinc >= 3, `zinc=${counts.zinc}`);
  assert.ok(counts.cold >= 3, `cold=${counts.cold}`);
  assert.ok(counts.hot >= 5, `hot=${counts.hot}`);

  const zinc = rows.find((row) => row.materialId === "zinc" && row.thicknessMm === 0.5);
  assert.equal(zinc?.rubPerTon, 111_000);
  assert.equal(zinc?.rubPerTonFrom3t, 109_000);
  assert.equal(zinc?.size, "0,5x1250x2500");

  const hot = rows.find((row) => row.materialId === "hot" && row.thicknessMm === 6);
  assert.equal(hot?.rubPerTon, 96_000);
  assert.equal(hot?.size, "6x1500x6000");
});

test("the profile column on the same line is never priced as sheet", () => {
  // 40х40х2 is a tube: three numbers and two prices, exactly the shape of a
  // sheet row. Reading it as one would quote a customer profile prices for
  // sheet metal. The sides decide: a sheet is cut from stock a metre and up.
  const rows = parseAtlantikSheetPriceText(columnarText, options);

  for (const row of rows) {
    const [, width, length] = (row.size ?? "").split("x").map(Number);
    assert.ok(width >= 500, `${row.size} was read as sheet`);
    assert.ok(length >= 500, `${row.size} was read as sheet`);
  }
  assert.equal(rows.some((row) => row.thicknessMm >= 40), false, "a profile side was read as a thickness");
  // The tube prices never reach any row.
  assert.equal(rows.some((row) => row.rubPerTon === 67_900 || row.rubPerTon === 68_500), false);
});

test("a heading printed at the end of a columnar line still opens its section", () => {
  const rows = parseAtlantikSheetPriceText(columnarText, options);
  // The three headings arrive mid-line; each one must still hand the rows that
  // follow it to the right material.
  assert.equal(rows.find((row) => row.thicknessMm === 0.8)?.materialId, "cold");
  assert.equal(rows.find((row) => row.thicknessMm === 3 && row.size === "3x1500x6000")?.materialId, "hot");
  assert.equal(rows.find((row) => row.thicknessMm === 0.7)?.materialId, "zinc");
});
