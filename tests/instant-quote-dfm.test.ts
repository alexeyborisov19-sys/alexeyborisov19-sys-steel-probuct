import assert from "node:assert/strict";
import test from "node:test";
import { runVerifiedLaserDfm } from "@/lib/instant-quote/dfm";

test("DFM passes confirmed black-steel laser envelope", () => {
  const result = runVerifiedLaserDfm({ width: 1000, height: 500, units: "мм" }, 1.5);
  assert.equal(result.some((item) => item.code === "table" && item.severity === "pass"), true);
  assert.equal(result.some((item) => item.code === "thickness" && item.severity === "pass"), true);
});

test("DFM blocks geometry larger than confirmed 1500 x 3000 table", () => {
  const result = runVerifiedLaserDfm({ width: 3100, height: 1000, units: "мм" }, 1.5);
  assert.equal(result.some((item) => item.code === "table" && item.severity === "error"), true);
});

test("DFM requests manual confirmation when DXF units are absent", () => {
  const result = runVerifiedLaserDfm({ width: 1000, height: 500, units: "не указаны" }, 1.5);
  assert.equal(result.some((item) => item.code === "units-review" && item.severity === "manual"), true);
});
