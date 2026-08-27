import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headerPath = new URL("../components/Header.tsx", import.meta.url);
const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);

const bannerText = "Сайт работает в тестовом режиме до завершения согласования документов.";

test("public site does not render the temporary document-approval test-mode banner", async () => {
  const [header, layout] = await Promise.all([
    readFile(headerPath, "utf8"),
    readFile(publicLayoutPath, "utf8"),
  ]);

  const escapedBannerText = new RegExp(bannerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  assert.doesNotMatch(header, /siteMode/);
  assert.doesNotMatch(header, /data-site-status="test-mode"/);
  assert.doesNotMatch(header, escapedBannerText);
  assert.doesNotMatch(layout, escapedBannerText);
});
