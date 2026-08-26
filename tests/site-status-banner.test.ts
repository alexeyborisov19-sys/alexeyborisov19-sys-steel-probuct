import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);

const bannerText = "Сайт работает в тестовом режиме до завершения согласования документов.";

test("public pages show the temporary document-approval status banner", async () => {
  const source = await readFile(publicLayoutPath, "utf8");

  assert.match(source, new RegExp(bannerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /role="status"/);
  assert.ok(
    source.indexOf(bannerText) < source.indexOf("{children}"),
    "status banner must render before public page content",
  );
});
