import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const companyVideoPath = new URL("../components/CompanyVideo.tsx", import.meta.url);

test("company video dialog moves focus inside and restores the opening trigger", async () => {
  const source = await readFile(companyVideoPath, "utf8");

  assert.match(source, /lastTriggerRef = useRef<HTMLButtonElement \| null>/);
  assert.match(source, /closeButtonRef = useRef<HTMLButtonElement \| null>/);
  assert.match(source, /openVideo\(event\.currentTarget\)/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /lastTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /ref=\{closeButtonRef\}/);
});
