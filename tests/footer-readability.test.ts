import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const footerPath = new URL("../components/Footer.tsx", import.meta.url);

test("footer keeps contacts and legal information readable", async () => {
  const source = await readFile(footerPath, "utf8");

  assert.doesNotMatch(source, /text-\[(?:10|11)px\]/, "footer must not use text below 12 px");
  assert.match(source, /<a className="[^"]*text-lg[^"]*" href="tel:/, "phone number must remain prominent");
  assert.match(source, /<a className="[^"]*text-base[^"]*" href="mailto:/, "email must remain readable");
  assert.match(source, /Правовые документы/);
  assert.match(source, /text-xs text-white\/60/, "footer navigation must keep readable contrast");
});
