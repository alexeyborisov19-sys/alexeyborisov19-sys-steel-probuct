import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modePath = new URL("../data/site-mode.ts", import.meta.url);
const headerPath = new URL("../components/Header.tsx", import.meta.url);
const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);

const bannerText = "Сайт работает в тестовом режиме до завершения согласования документов.";

test("public header shows the temporary document-approval test-mode banner", async () => {
  const [mode, header, layout] = await Promise.all([
    readFile(modePath, "utf8"),
    readFile(headerPath, "utf8"),
    readFile(publicLayoutPath, "utf8"),
  ]);

  assert.match(mode, /isTest:\s*true/);
  assert.match(mode, new RegExp(bannerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(header, /siteMode\.isTest/);
  assert.match(header, /siteMode\.label/);
  assert.match(header, /role="status"/);
  assert.match(header, /bg-steel-orange/);
  assert.doesNotMatch(layout, new RegExp(bannerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
