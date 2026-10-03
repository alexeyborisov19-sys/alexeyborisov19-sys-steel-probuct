import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.RESOURCE_AUDIT_BASE || "http://127.0.0.1:3156";
const out =
  process.env.RESOURCE_AUDIT_OUTPUT || "/tmp/steel-customer-resources";
const paths = [
  "/customers",
  "/customers/requirements",
  "/customers/materials",
  "/customers/order-and-delivery",
];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/https:\/\/mc\.yandex\.(ru|com)\//, (r) => r.abort());
    for (const path of paths) {
      const response = await page.goto(
        base + path + "?utm_source=resource-audit&yclid=123456",
        { waitUntil: "networkidle" },
      );
      assert.equal(response.status(), 200, path);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.locator("link[rel=canonical]").getAttribute("href"),
        "https://www.steelprodukt.ru" + path,
      );
      const decline = page.getByRole("button", {
        name: "Продолжить без аналитики",
        exact: true,
      });
      if (await decline.isVisible()) await decline.click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        path + " overflow",
      );
      await page.locator('main img').evaluateAll(async imgs => { await Promise.all(imgs.map(i => i.decode().catch(()=>{}))); });
      assert.deepEqual(await page.locator('main img').evaluateAll(imgs => imgs.filter(i=>!i.naturalWidth).map(i=>i.src)),[]);
      const schemas=await page.locator('script[type="application/ld+json"]').allTextContents();
      assert.ok(schemas.some(s=>s.includes(path==='/customers'?'ItemList':'FAQPage')));
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        path,
      );
      const hrefs = await page
        .locator("main a[href]")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      for (const href of [...new Set(hrefs)])
        if (
          href.startsWith("/") &&
          !href.includes("#") &&
          !href.includes("?")
        ) {
          const r = await context.request.get(base + href);
          assert.equal(r.status(), 200, href);
        }
      await page.screenshot({
        path: out + "/" + path.replaceAll("/", "_") + "-" + width + ".png",
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      results.push({ path, width, status: 200, axeViolations: 0 });
    }
    await page.goto(base + "/customers?utm_source=resource-audit&yclid=123456");
    await page
      .locator('main a[href*="/customers/requirements"]')
      .first()
      .click();
    assert.equal(
      new URL(page.url()).searchParams.get("utm_source"),
      "resource-audit",
    );
    const download = await context.request.get(
      base + "/documents/zadanie-na-izgotovlenie.txt",
    );
    assert.equal(download.status(), 200);
    assert.ok((await download.text()).length > 100);
    assert.equal(
      (
        await context.request.get(base + "/customers/not-a-real-guide")
      ).status(),
      404,
    );
    await context.close();
  }
  await writeFile(out + "/results.json", JSON.stringify(results, null, 2));
  console.log(
    "PASS:8 responsive resource pages, links, metadata, axe, attribution, download and404.",
  );
} finally {
  await browser.close();
}
