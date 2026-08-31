import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const productsPath = new URL("../data/products.ts", import.meta.url);
const industrySeoPath = new URL("../data/industry-seo.ts", import.meta.url);

test("product catalog does not turn project-dependent conditions into universal guarantees", async () => {
  const products = await readFile(productsPath, "utf8");

  for (const forbidden of [
    "Класс КМ0 (НГ — негорючие материалы)",
    "без ограничений по минусовым температурам",
    "исключает риск ржавых подтёков",
    "герметичного, аккуратного примыкания",
    "Точное и герметичное примыкание",
  ]) {
    assert.ok(!products.includes(forbidden), `unqualified product claim must stay removed: ${forbidden}`);
  }

  assert.match(products, /Пожарные требования[\s\S]*По проектной документации и подтверждающим документам применяемой фасадной системы/);
  assert.match(products, /Условия и температурные ограничения — по проекту и требованиям применяемой фасадной системы/);
  assert.match(products, /защита узла от коррозионных подтёков зависит от конструкции, покрытия и качества монтажа/);
});

test("industry pages defer safety and strength requirements to project documentation", async () => {
  const industry = await readFile(industrySeoPath, "utf8");

  for (const forbidden of [
    "безопасный доступ к инженерным системам",
    "безопасные зоны доступа",
    "безопасный доступ к узлам",
    "Прорабатываем прочность, кромки, крепления",
  ]) {
    assert.ok(!industry.includes(forbidden), `unqualified industry claim must stay removed: ${forbidden}`);
  }

  assert.match(industry, /сервисный доступ к инженерным системам по требованиям проекта/);
  assert.match(industry, /зоны сервисного доступа по проектной документации/);
  assert.match(industry, /требования по безопасности из проектной документации/);
  assert.match(industry, /геометрию, кромки, крепления и возможность локальной замены элементов по требованиям проектной документации/);
});

test("the projects hub states its work boundary alongside the capability facts", async () => {
  // The page now carries production capability figures, which is exactly the
  // context where a reader infers more than is offered: that the supplier also
  // installs, and that a part carries the performance of the assembly. Both
  // limits have to travel with the figures, on the same page.
  const projects = await readFile(new URL("../app/(public)/projects/page.tsx", import.meta.url), "utf8");

  assert.match(projects, /Монтаж на объекте не выполняем/);
  assert.match(projects, /определяет проектная документация объекта, а не отдельное изделие/);

  // The figures themselves come from the confirmed-facts module rather than
  // being retyped here, so a corrected machine count cannot leave a stale
  // number on this page.
  assert.match(projects, /from "@\/data\/manufacturing-facts"/);
  for (const bound of ["productionEquipment", "laserCuttingCapabilities", "productionLeadTimeSummary", "customerMaterialSummary"]) {
    assert.ok(projects.includes(bound), `projects page should read ${bound} from the confirmed facts`);
  }
  assert.doesNotMatch(projects, /7–14 дней|1500 × 3000|0,5–40 мм/);
});

test("the qualifications a reader needs are rendered, not merely present in the data", async () => {
  // The fire and montage rows exist because unqualified versions of those claims
  // had to be withdrawn. Asserting them in data/products.ts alone proved only
  // that the sentences were written: the cassette landing rendered
  // metalCassetteSpecs.slice(0, 4), which cut exactly those two rows, so the
  // page passed the guard while showing thickness and colour and no limits.
  const [data, landing, detail] = await Promise.all([
    readFile(new URL("../data/products.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/(public)/products/metallokassety/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  const specs = data.slice(data.indexOf("export const metalCassetteSpecs"));
  const labels = (specs.slice(0, specs.indexOf("];")).match(/label: "([^"]+)"/g) ?? []).length;
  assert.ok(labels >= 6, `expected the full spec list, found ${labels} rows`);
  assert.ok(specs.includes("Пожарные требования") && specs.includes("Монтаж"));

  // Neither page may show a prefix of the list.
  assert.match(landing, /metalCassetteSpecs\.map\(/);
  assert.doesNotMatch(landing, /metalCassetteSpecs\.slice\(/);
  assert.match(detail, /product\.specs\.map\(/);
  assert.doesNotMatch(detail, /product\.specs\.slice\(/);
});
