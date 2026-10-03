import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.LANDING_AUDIT_BASE || "http://127.0.0.1:3156";
const output =
  process.env.LANDING_AUDIT_OUTPUT || "/tmp/steel-commercial-landings";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
});
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Never send a test enquiry or analytics hit to production.
    await page.route("**/api/quote", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "SP-20261003-TEST",
          message: "Тест перехвачен.",
        }),
      }),
    );
    await page.route(/https:\/\/mc\.yandex\.(ru|com)\//, (r) => r.abort());
    for (const path of [
      "/products/korziny-dlya-konditsionerov",
      "/solutions/custom",
    ]) {
      const response = await page.goto(
        base + path + "?utm_source=landing-audit&yclid=123456",
        { waitUntil: "networkidle" },
      );
      assert.equal(response.status(), 200);
      await expect(page.locator("h1")).toHaveCount(1);
      assert.equal(
        await page.locator("link[rel=canonical]").getAttribute("href"),
        "https://www.steelprodukt.ru" + path,
      );
      const decline = page.getByRole("button", {
        name: "Продолжить без аналитики",
        exact: true,
      });
      if (await decline.isVisible()) await decline.click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `${width} ${path}: overflow`);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const broken = await page
        .locator("main img")
        .evaluateAll((imgs) =>
          imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src),
        );
      assert.deepEqual(broken, []);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const violations = axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      }));
      const shot = `${output}/${path.includes("korziny") ? "baskets" : "custom"}-${width}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      results.push({
        path,
        width,
        status: response.status(),
        overflow,
        broken,
        errors: [...errors],
        violations,
      });
      if (path.includes("korziny")) {
        await page
          .getByRole("button", { name: "1200 × 900 × 600", exact: true })
          .click();
        await expect(page.locator("#basket-width")).toHaveValue("1200");
        await page.locator("#basket-width").fill("");
        await expect(
          page.getByRole("button", { name: "Уточните параметры" }),
        ).toBeDisabled();
        await page.locator("#basket-width").fill("1100");
        await page.locator("#basket-quantity").fill("12");
        await page
          .getByRole("button", {
            name: "RAL 9003, Сигнальный белый",
            exact: true,
          })
          .click();
        await page.locator("#basket-screen").selectOption("slots");
        const promise = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Скачать задание · TXT ↓", exact: true })
          .click();
        const download = await promise;
        const txt = await readFile(await download.path(), "utf8");
        assert.match(txt, /1100 × 900 × 600 мм/);
        assert.match(txt, /12 шт/);
        assert.match(txt, /RAL 9003/);
        await page
          .getByRole("link", {
            name: "Передать параметры инженеру →",
            exact: true,
          })
          .click();
        await page.waitForURL("**/contacts?**");
        assert.equal(
          new URL(page.url()).searchParams.get("utm_source"),
          "landing-audit",
        );
        assert.equal(new URL(page.url()).searchParams.get("yclid"), "123456");
        await expect(page.locator("textarea[name=message]")).toHaveValue(
          /1100 × 900 × 600 мм/,
        );
        await expect(
          page.locator("input[name=personalDataConsent]"),
        ).not.toBeChecked();
        await expect(
          page.locator("input[name=marketingConsent]"),
        ).not.toBeChecked();
      } else {
        const url = new URL(
          await page
            .getByRole("link", { name: "Открыть калькулятор →", exact: true })
            .getAttribute("href"),
          base,
        );
        assert.equal(url.pathname, "/online-order");
        assert.equal(url.searchParams.get("yclid"), "123456");
      }
    }
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  assert.equal(results.flatMap((r) => r.errors).length, 0, "browser errors");
  assert.equal(
    results.flatMap((r) => r.violations).length,
    0,
    "axe violations — inspect results.json",
  );
  console.log(
    "PASS: 8 responsive pages, images, schema canonicals, basket validation/download/handoff, attribution and untouched consent. No live leads sent.",
  );
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
