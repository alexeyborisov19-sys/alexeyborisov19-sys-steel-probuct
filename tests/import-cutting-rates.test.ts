import assert from "node:assert/strict";
import test from "node:test";
import { cellMap } from "../scripts/import-cutting-rates.mjs";

/**
 * Guards the one failure mode that matters for a converter of money data:
 * losing a value silently. Excel writes an empty cell self-closing, and a
 * reader that does not treat that as its own case swallows the next real
 * cell — which is exactly how a whole column of cutting rates disappeared
 * with no error at all the first time this ran.
 */

test("a self-closing empty cell does not swallow the cell after it", () => {
  const xml = '<row r="2">'
    + '<c r="H2" s="10"/>'
    + '<c r="I2" s="61" t="s"><v>0</v></c>'
    + '<c r="J2"><v>62.8</v></c>'
    + "</row>";
  const cells = cellMap(xml, ["Конструкционная сталь"]);
  assert.equal(cells.I2, "Конструкционная сталь", "the cell after a self-closing one must survive");
  assert.equal(cells.J2, "62.8");
});

test("several self-closing cells in a row still lose nothing", () => {
  const xml = '<c r="J2" s="61"/><c r="K2" s="61"/><c r="L2" s="61"/><c r="M2"><v>1.4</v></c>';
  const cells = cellMap(xml, []);
  assert.equal(cells.M2, "1.4");
  assert.equal(cells.J2, undefined, "an empty cell carries no value, and that is not the same as losing one");
});

test("shared-string cells resolve through the string table, numbers stay literal", () => {
  const xml = '<c r="A1" t="s"><v>1</v></c><c r="B1"><v>66.9</v></c>';
  const cells = cellMap(xml, ["первая", "вторая"]);
  assert.equal(cells.A1, "вторая");
  assert.equal(cells.B1, "66.9");
});

test("a formula cell is read by its cached value, not its formula text", () => {
  const xml = '<c r="B18"><f>B17/A17*A18</f><v>912.12</v></c>';
  const cells = cellMap(xml, []);
  assert.equal(cells.B18, "912.12");
});
