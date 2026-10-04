import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.BASKET_AUDIT_BASE || "http://127.0.0.1:3157";
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/quote", (r) => r.abort());
    await page.route(/https:\/\/mc\.yandex\.(ru|com)\//, (r) => r.abort());
    await page.goto(
      base +
        "/products/korziny-dlya-konditsionerov?utm_source=basket-test&yclid=123456",
    );
    const decline = page.getByRole("button", {
      name: "Продолжить без аналитики",
      exact: true,
    });
    if (await decline.isVisible()) await decline.click();
    const root = page.locator("[data-basket-configurator]");
    await root
      .getByRole("button", { name: "2. Блок и крепление", exact: true })
      .click();
    await root.getByLabel("Масса блока, кг", { exact: true }).fill("52");
    await root
      .getByLabel("Толщина фасада от стены, мм", { exact: true })
      .fill("230");
    await root
      .getByLabel("Отступ от облицовки, мм", { exact: true })
      .fill("40");
    await root
      .getByRole("button", { name: "3. Перфорация", exact: true })
      .click();
    await root
      .getByRole("group", { name: "Передняя панель", exact: true })
      .getByLabel("Диаметр, мм", { exact: true })
      .fill("12");
    await root
      .getByRole("button", { name: "4. Результат", exact: true })
      .click();
    await expect(
      root.getByText("Стоимость — после проверки комплектации", {
        exact: true,
      }),
    ).toBeVisible();
    const link = root.getByRole("link", {
      name: "Передать параметры инженеру →",
      exact: true,
    });
    await expect(link).toHaveAttribute("href", /utm_source=basket-test/);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    const axe = await new AxeBuilder({ page })
      .include("[data-basket-configurator]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((x) => x.id),
      [],
    );
    await root.screenshot({ path: `/tmp/basket-wizard-${width}.png` });
    await link.click();
    await expect(page.locator('textarea[name="message"]')).toHaveValue(
      /230 мм/,
    );
    await expect(page.locator('textarea[name="message"]')).toHaveValue(/52 кг/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, result: "PASS" }));
    await context.close();
  }
} finally {
  await browser.close();
}
