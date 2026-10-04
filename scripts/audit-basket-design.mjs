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
    await root.getByText("Как выглядит корзина на фасаде", {exact:true}).click();
    await expect(root.getByRole("img",{name:"Пример оформления перфорированной корзины на фасаде",exact:true})).toBeVisible();
    await root.getByText("Как выглядит корзина на фасаде", {exact:true}).click();
    for (const [code, basketWidth] of [[7,900],[9,900],[12,1000],[18,1200],[24,1200],[36,1300]]) {
      await root.getByLabel("Класс кондиционера", {exact:true}).selectOption(String(code));
      await root.getByRole("button", {name:"Подставить размер корзины",exact:true}).click();
      await expect(root.getByLabel("Ширина, мм",{exact:true})).toHaveValue(String(basketWidth));
    }
    const keyboard = async (field, text) => {
      await field.click();
      await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await field.press("Backspace");
      await expect(field).toHaveValue("");
      await field.pressSequentially(text);
      await expect(field).toHaveValue(text);
      await field.press("Tab");
    };
    await keyboard(root.getByLabel("Ширина, мм", {exact:true}), "1180");
    await expect(root.getByLabel("Ширина, мм", {exact:true})).toHaveAttribute("inputmode", "numeric");
    await root
      .getByRole("button", { name: "2. Блок и крепление", exact: true })
      .click();
    await keyboard(root.getByLabel("Масса блока, кг", { exact: true }), "52,5");
    await expect(root.getByLabel("Масса блока, кг", { exact: true })).toHaveValue("52.5");
    await expect(root.getByLabel("Масса блока, кг", {exact:true})).toHaveAttribute("inputmode", "decimal");
    await root
      .getByLabel("Толщина фасада от стены, мм", { exact: true })
      .fill("230");
    await root
      .getByLabel("Отступ от облицовки, мм", { exact: true })
      .fill("40");
    await root.getByText("Точный подбор: установка целиком и зазоры", {exact:true}).click();
    for (const [label,value] of [["Ширина всей установки, мм","800"],["Высота всей установки, мм","500"],["Глубина всей установки, мм","300"],["Зазор слева, мм","50"],["Зазор справа, мм","100"],["Зазор сверху, мм","50"],["Зазор снизу, мм","0"],["Зазор спереди, мм","200"],["Зазор сзади, мм","30"]]) {
      await keyboard(root.getByLabel(label,{exact:true}),value);
    }
    await root
      .getByRole("button", { name: "3. Перфорация", exact: true })
      .click();
    await root
      .getByRole("group", { name: "Передняя панель", exact: true })
      .getByLabel("Диаметр, мм", { exact: true })
      .fill("12");
    const diameter = root.getByRole("group", {name:"Передняя панель",exact:true}).getByLabel("Диаметр, мм",{exact:true});
    await keyboard(diameter, "12,5");
    await expect(diameter).toHaveValue("12.5");
    await root
      .getByRole("button", { name: "4. Результат", exact: true })
      .click();
    await expect(
      root.getByText("Стоимость — после проверки комплектации", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(root.getByText("950 × 550 × 530 мм",{exact:true})).toBeVisible();
    await root.getByText("Сравнить трудоёмкость перфорации",{exact:true}).click();
    await expect(root.getByText("Шаг +5 мм",{exact:true})).toBeVisible();
    await root.getByRole("button", {name:"Добавить в спецификацию", exact:true}).click();
    await root.getByRole("button", {name:"Копировать позицию 1", exact:true}).click();
    await expect(root.getByText(/Позиций: 2/)).toBeVisible();
    await root.getByRole("button", {name:"Изменить позицию 2", exact:true}).click();
    await root.getByLabel("Количество, шт.", {exact:true}).fill("7");
    await root.getByRole("button", {name:"Сохранить позицию 2", exact:true}).click();
    const downloaded = page.waitForEvent("download");
    await root.getByRole("button", {name:"Сохранить файл", exact:true}).click();
    const file = await downloaded;
    await root.getByLabel("Файл спецификации корзин", {exact:true}).setInputFiles(await file.path());
    await expect(root.getByText(/Позиций: 4/)).toBeVisible();
    await root.getByLabel("Файл спецификации корзин", {exact:true}).setInputFiles({name:"broken.json",mimeType:"application/json",buffer:Buffer.from("{}")});
    await expect(root.getByText(/Позиций: 4/)).toBeVisible();
    await root.getByRole("button", {name:"Удалить позицию 4", exact:true}).click();
    await expect(root.getByText(/Позиций: 3/)).toBeVisible();
    await root.getByRole("button", {name:"4. Результат", exact:true}).click();
    await root.getByText("Что проверяет инженер",{exact:true}).click();
    await expect(root.getByRole("img",{name:"Инженерно-конструкторский центр Сталь Продукт",exact:true})).toBeVisible();
    await expect.poll(()=>root.locator("img").evaluateAll(images=>images.every(img=>img.complete && img.naturalWidth>0))).toBe(true);
    await expect(root.getByRole("region", {name:"Цена базовой корзины"})).toContainText("Цена меняется в зависимости от количества");
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
    await expect(page.locator('textarea[name="message"]')).toHaveValue(/52.5 кг/);
    await expect(page.locator('textarea[name="message"]')).toHaveValue(/950 × 550 × 530/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, result: "PASS" }));
    await context.close();
  }
} finally {
  await browser.close();
}
