import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isBinaryDxf } from "@/lib/instant-quote/dxf";
import { cadPreviewRateRules } from "@/lib/security/rate-limit";
import { uploadLimits } from "@/lib/security/uploads";

const routePath = new URL("../app/api/online-order/cad/analyze/route.ts", import.meta.url);

test("the preview endpoint carries the same protections as the calculation it precedes", async () => {
  const source = await readFile(routePath, "utf8");

  // Preview runs the same OpenCascade kernel as /calculate, so it cannot be a
  // cheaper way in: cross-site callers, floods and unchecked files are refused
  // at the same door.
  assert.match(source, /assertSameOriginRequest\(request\)/);
  assert.match(source, /consumeRules\(ownerKey, cadPreviewRateRules\)/);
  assert.match(source, /inspectUploads\(\[entry\], 1\)/);
});

test("preview no longer accepts a file the calculation would later refuse", async () => {
  const source = await readFile(routePath, "utf8");

  // The old route carried its own 25 MB guard, so a customer could preview a
  // model, configure it, and only then be told it was too large to price.
  assert.equal(source.includes("MAX_ALPHA_CAD_BYTES"), false);
  assert.equal(source.includes("25 * 1024 * 1024"), false);
  assert.equal(uploadLimits.maximumFileBytes, 7 * 1024 * 1024);
});

test("the preview rate limit fits a whole project without letting a script hold the kernel", () => {
  const perMinute = cadPreviewRateRules.find((rule) => rule.windowMs === 60_000);
  assert.ok(perMinute);
  assert.ok(perMinute.limit >= uploadLimits.maximumFiles, "a ten-file project must go through in one minute");
  assert.ok(perMinute.limit <= 60, "but not an unbounded stream of STEP parses");
});

test("a binary DXF is recognised rather than decoded into an empty drawing", () => {
  const binary = Buffer.concat([Buffer.from("AutoCAD Binary DXF\r\n", "latin1"), Buffer.from([0x1a, 0x00])]);
  assert.equal(isBinaryDxf(new Uint8Array(binary)), true);
  assert.equal(isBinaryDxf(new Uint8Array(Buffer.from("0\nSECTION\n2\nENTITIES\n", "utf8"))), false);
  assert.equal(isBinaryDxf(new Uint8Array(Buffer.from("Auto", "utf8"))), false);
  assert.equal(isBinaryDxf(new Uint8Array(0)), false);
});
