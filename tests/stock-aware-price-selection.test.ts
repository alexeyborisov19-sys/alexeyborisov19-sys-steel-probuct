import assert from "node:assert/strict";
import test from "node:test";
import { selectBestStoredPriceForStock, type StoredPriceSnapshot } from "../lib/instant-quote/material-price-feed";

const now = new Date("2099-01-01T12:00:00.000Z");

function snapshot(rows: StoredPriceSnapshot["rows"]): StoredPriceSnapshot[] {
  return [{
    sourceId: "synthetic-stock-source",
    fetchedAt: "2099-01-01T11:00:00.000Z",
    sourceDate: "2099-01-01",
    status: "ok",
    rows,
  }];
}

const base = {
  materialId: "hot" as const,
  thicknessMm: 2,
  source: "fixture",
  sourceDate: "2099-01-01",
  fetchedAt: "2099-01-01T11:00:00.000Z",
  exactThickness: true,
};

test("rejects a sheet price when the required blank does not fit that stock format", () => {
  const result = selectBestStoredPriceForStock(snapshot([
    { ...base, size: "2x1250x2500", rubPerTon: 100_000 },
    { ...base, size: "2x1500x3000", rubPerTon: 110_000 },
  ]), "hot", 2, { widthMm: 1400, heightMm: 2700 }, now);

  assert.equal(result.price?.size, "2x1500x3000");
  assert.equal(result.price?.rubPerTon, 110_000);
});

test("allows rotating the blank ninety degrees inside supplier stock", () => {
  const result = selectBestStoredPriceForStock(snapshot([
    { ...base, size: "2x1250x2500", rubPerTon: 100_000 },
    { ...base, size: "2x1500x3000", rubPerTon: 110_000 },
  ]), "hot", 2, { widthMm: 2400, heightMm: 1200 }, now);

  assert.equal(result.price?.size, "2x1250x2500");
});

test("uses a validated generic private price only when no explicit fitting stock row exists", () => {
  const result = selectBestStoredPriceForStock(snapshot([
    { ...base, size: "2x1250x2500", rubPerTon: 100_000 },
    { ...base, rubPerTon: 120_000 },
  ]), "hot", 2, { widthMm: 1400, heightMm: 2700 }, now);

  assert.equal(result.price?.size, undefined);
  assert.equal(result.price?.rubPerTon, 120_000);
});

test("returns no price when every explicit stock format is too small", () => {
  const result = selectBestStoredPriceForStock(snapshot([
    { ...base, size: "2x1000x2000", rubPerTon: 95_000 },
    { ...base, size: "2x1250x2500", rubPerTon: 100_000 },
  ]), "hot", 2, { widthMm: 1400, heightMm: 2700 }, now);

  assert.equal(result.price, null);
  assert.equal(result.sourceId, null);
});
