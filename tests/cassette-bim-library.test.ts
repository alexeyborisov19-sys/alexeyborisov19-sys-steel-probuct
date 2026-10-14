import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const models = readJson("data/bim/cassette-library.json") as Array<{id: string; name: string; bboxMm: number[]; thicknessMm: number}>;
const release = readJson("data/bim/cassette-library-release.json") as {destination: string; modelCount: number; manifestSha256: string};
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

test("cassette library contains the 15 fixed source models", () => {
  assert.equal(models.length, 15);
  assert.equal(new Set(models.map(model => model.id)).size, 15);
  assert.equal(models.filter(model => model.id.startsWith("SP-CAS-")).length, 9);
  assert.equal(models.filter(model => model.id.startsWith("SP-TRIM-")).length, 6);
  for (const model of models) {
    assert.match(model.id, /^SP-(CAS|TRIM)-\d{2}$/);
    assert.equal(model.bboxMm.length, 3);
    assert.ok(model.bboxMm.every(value => Number.isFinite(value) && value > 0));
    assert.ok(Number.isFinite(model.thicknessMm) && model.thicknessMm > 0);
  }
});

test("publication requires every approved library asset, not only page links", () => {
  const dir = path.join(root, release.destination);
  const manifest = path.join(dir, "SHA256SUMS.txt");
  assert.ok(existsSync(manifest), "Upload and import the approved library ZIP before merging this release");
  const bytes = readFileSync(manifest);
  assert.equal(sha256(bytes), release.manifestSha256);
  const records = bytes.toString("utf8").trim().split("\n");
  assert.equal(records.length, 54);
  for (const record of records) {
    const [expected, file] = record.split("  ");
    assert.ok(file && !file.startsWith("/") && !file.split("/").includes(".."));
    assert.equal(sha256(readFileSync(path.join(dir, file))), expected, file);
  }
  for (const model of models) {
    assert.ok(existsSync(path.join(dir, "IFC4_coordination", `${model.id}.ifc`)));
    assert.ok(existsSync(path.join(dir, "IFC4_exact_geometry", `${model.id}.ifc`)));
    assert.ok(existsSync(path.join(dir, "preview", `${model.id}.json`)));
  }
});
