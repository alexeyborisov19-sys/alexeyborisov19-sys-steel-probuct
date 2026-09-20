import assert from "node:assert/strict";
import test from "node:test";
import {
  materialLabelToId,
  nearestCassetteThickness,
  parseDimensionsMm,
  parsePieceCount,
  parseThicknessMm,
} from "../lib/quote-engine/field-parsing";
import { emptyLeadState, extractLeadState } from "../lib/assistant/state";

function stateFor(message: string) {
  return extractLeadState(emptyLeadState(), message);
}

test("dimensions parse end-to-end from the real extractor, plain millimetres", () => {
  const state = stateFor("Нужны 300 кассет 600×1200 из оцинкованной стали 1,2 мм");
  const parsed = parseDimensionsMm(state.dimensions);
  assert.deepEqual(parsed, { widthMm: 600, heightMm: 1200 });
});

test("dimensions in centimetres and metres convert to millimetres", () => {
  assert.deepEqual(parseDimensionsMm("60×120 см"), { widthMm: 600, heightMm: 1200 });
  assert.deepEqual(parseDimensionsMm("60×120"), { widthMm: 60, heightMm: 120 }, "no unit defaults to mm, not a guess");
});

test("a three-number dimension string still reads only width and height", () => {
  // extractLeadState's own dimensions regex requires 2-5 digits for every
  // group, including the optional third one — a single-digit trailing value
  // like "×2" is never captured as part of the match at all, so this is the
  // smallest three-group input the real extractor can actually produce.
  assert.deepEqual(parseDimensionsMm("600×1200×20"), { widthMm: 600, heightMm: 1200 });
});

test("unparsable or missing dimensions return null, never a fabricated size", () => {
  assert.equal(parseDimensionsMm(undefined), null);
  assert.equal(parseDimensionsMm("большие"), null);
});

test("thickness parses end-to-end from the real extractor", () => {
  const state = stateFor("Толщина 1,2 мм, оцинковка");
  assert.equal(parseThicknessMm(state.thickness), 1.2);
});

test("a piece count is read only from a piece-counting unit", () => {
  assert.equal(parsePieceCount(stateFor("Нужно 300 шт").quantity), 300);
  assert.equal(parsePieceCount(stateFor("Нужно 5 комплектов").quantity), 5);
});

test("an area or length quantity is never misread as a piece count", () => {
  // "20 м²" describes area, not a headcount — treating it as 20 pieces would
  // be exactly the invented number the brief forbids.
  const areaState = stateFor("Нужно 20 м² кассет");
  assert.equal(areaState.quantity, "20 м²");
  assert.equal(parsePieceCount(areaState.quantity), null);

  const lengthState = stateFor("Нужно 15 пог м отлива");
  assert.equal(parsePieceCount(lengthState.quantity), null);
});

test("cassette thickness snaps within tolerance and refuses anything far off", () => {
  assert.equal(nearestCassetteThickness(1.2), "1.2");
  assert.equal(nearestCassetteThickness(0.68), "0.7");
  assert.equal(nearestCassetteThickness(3), null, "3 mm is not a stocked cassette thickness");
  assert.equal(nearestCassetteThickness(null), null);
});

test("material label maps only where the customer's words are unambiguous", () => {
  assert.equal(materialLabelToId("Оцинкованная сталь"), "zinc");
  assert.equal(materialLabelToId("Нержавеющая сталь"), "inox");
  assert.equal(materialLabelToId("Алюминий"), "alu");
  // Plain "Сталь" doesn't say hot- or cold-rolled, and the two have different
  // prices — must ask, never guess between them.
  assert.equal(materialLabelToId("Сталь"), null);
  assert.equal(materialLabelToId(undefined), null);
});

test("informal spoken material names are read as the same material, not left unrecognised", () => {
  const zincCasual = stateFor("нужен кронштейн, оцинковка 2 мм");
  assert.equal(zincCasual.material, "Оцинкованная сталь");
  assert.equal(materialLabelToId(zincCasual.material), "zinc");

  const inoxCasual = stateFor("нужен кронштейн, нержавейка 2 мм");
  assert.equal(inoxCasual.material, "Нержавеющая сталь");
  assert.equal(materialLabelToId(inoxCasual.material), "inox");
});
