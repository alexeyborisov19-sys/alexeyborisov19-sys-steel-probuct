import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const companyVideoPath = new URL("../components/CompanyVideo.tsx", import.meta.url);

test("company video dialog traps focus, locks background scroll and restores the opening trigger", async () => {
  const source = await readFile(companyVideoPath, "utf8");

  assert.match(source, /lastTriggerRef = useRef<HTMLButtonElement \| null>/);
  assert.match(source, /closeButtonRef = useRef<HTMLButtonElement \| null>/);
  assert.match(source, /modalVideoRef = useRef<HTMLVideoElement \| null>/);
  assert.match(source, /openVideo\(event\.currentTarget\)/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /lastTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /event\.shiftKey && active === first/);
  assert.match(source, /!event\.shiftKey && active === last/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /ref=\{closeButtonRef\}/);
  assert.match(source, /ref=\{modalVideoRef\} tabIndex=\{0\}/);
});
