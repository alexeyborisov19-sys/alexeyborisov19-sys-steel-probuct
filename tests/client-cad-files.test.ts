import assert from "node:assert/strict";
import test from "node:test";
import { selectCadFiles } from "@/lib/instant-quote/client-cad-files";

const mb = 1024 * 1024;
const file = (name: string, size = 100) => ({ name, size });

test("invalid files do not consume a remaining project position", () => {
  const result = selectCadFiles([file("notes.txt"), file("empty.dxf", 0), file("part.STEP")], Array(9).fill({ fileSizeBytes: 100 }));
  assert.deepEqual(result.accepted, [file("part.STEP")]);
  assert.equal(result.errors.length, 2);
});

test("overlarge CAD is refused before uploading and does not block a valid next file", () => {
  const result = selectCadFiles([file("large.step", 7 * mb + 1), file("plate.dxf")], []);
  assert.deepEqual(result.accepted, [file("plate.dxf")]);
  assert.match(result.errors[0], /7 МБ/);
});

test("the combined project fits the calculation and contact attachment budget", () => {
  const result = selectCadFiles([file("fits.dxf", 3 * mb), file("overflow.dxf", 1)], [{ fileSizeBytes: 7 * mb }]);
  assert.deepEqual(result.accepted, [file("fits.dxf", 3 * mb)]);
  assert.match(result.errors[0], /10 МБ/);
});

test("eleventh position is refused without removing accepted positions", () => {
  const result = selectCadFiles([file("tenth.dwg"), file("eleventh.dxf")], Array(9).fill({ fileSizeBytes: 1 }));
  assert.deepEqual(result.accepted, [file("tenth.dwg")]);
  assert.match(result.errors[0], /10 позиций/);
});
