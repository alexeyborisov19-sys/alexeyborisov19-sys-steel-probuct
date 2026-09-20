import assert from "node:assert/strict";
import test from "node:test";
import { emptyLeadState, extractLeadState } from "../lib/assistant/state";

/**
 * Every field extractLeadState recognises is meant to survive across turns
 * — each call starts from `current` and only overwrites what the new
 * message actually mentions. A field resolved by a fallback that reads the
 * raw message directly, instead of being written into the returned state,
 * silently breaks that guarantee: it works on the turn it was said and is
 * forgotten the moment a later turn's message doesn't repeat it. This file
 * exists because that exact bug shipped once already (an implied piece
 * count and a cassette open/closed type were both derived from the raw
 * message inside the quote engine's own planner, not from state) and was
 * only caught by a multi-turn integration test one layer up.
 */

test("an implied piece count ('100 кронштейнов') survives into a later turn about a different field", () => {
  const first = extractLeadState(emptyLeadState(), "Нужно 100 кронштейнов, оцинковка");
  assert.equal(first.quantity, "100 шт");

  const second = extractLeadState(first, "толщина 2 мм");
  assert.equal(second.quantity, "100 шт", "the quantity from turn one must not be lost on turn two");
});

test("a cassette type stated in one turn survives into a later turn about a different field", () => {
  const first = extractLeadState(emptyLeadState(), "300 кассет открытого типа 600×1200");
  assert.equal(first.cassetteType, "open");

  const second = extractLeadState(first, "оцинковка 1,2 мм");
  assert.equal(second.cassetteType, "open", "the cassette type from turn one must not be lost on turn two");
});

test("a closed cassette type is likewise remembered across turns", () => {
  const first = extractLeadState(emptyLeadState(), "нужны кассеты закрытого типа");
  const second = extractLeadState(first, "600×1200, оцинковка 1,2 мм, 300 шт");
  assert.equal(second.cassetteType, "closed");
});

test("an explicit unit quantity still takes the exact form it always has", () => {
  const state = extractLeadState(emptyLeadState(), "нужно 50 штук");
  assert.equal(state.quantity, "50 штук"); // the explicit-unit branch is untouched: whitespace collapsed, wording kept as typed
});

test("an area or length quantity is still never misread as a piece count", () => {
  const state = extractLeadState(emptyLeadState(), "нужно 20 м² кассет");
  assert.equal(state.quantity, "20 м²");
});

test("digits already claimed by dimensions or thickness are still excluded from the implied count", () => {
  const state = extractLeadState(emptyLeadState(), "Нужен кронштейн 500×400 оцинкованная сталь 2 мм");
  assert.equal(state.quantity, undefined, "no piece count was actually stated in this message");
});

test("a customer who names the rolled steel is not asked which rolling they meant", () => {
  assert.equal(extractLeadState(emptyLeadState(), "нужна сталь г/к 2 мм").material, "Сталь г/к");
  assert.equal(extractLeadState(emptyLeadState(), "лист х/к 1,5 мм").material, "Сталь х/к");
  assert.equal(extractLeadState(emptyLeadState(), "горячекатаная сталь").material, "Сталь г/к");
  assert.equal(extractLeadState(emptyLeadState(), "холоднокатаный лист").material, "Сталь х/к");
});

test("the generic steel answer still asks which rolling, because it genuinely is ambiguous", () => {
  assert.equal(extractLeadState(emptyLeadState(), "чёрная сталь 3 мм").material, "Сталь");
});

test("a unit that merely contains the same letters is never read as rolled steel", () => {
  // "мг/кг" contains "г/к" — a bare substring match would have taken it.
  assert.equal(extractLeadState(emptyLeadState(), "покрытие 200 мг/кг").material, undefined);
});

test("«чёрная» through ё reads the same as «черная» — customers write both", () => {
  assert.equal(extractLeadState(emptyLeadState(), "черная сталь 3 мм").material, "Сталь");
});
