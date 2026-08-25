import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("solutions and industries expose proof-backed manufacturing positioning", async () => {
  const [solution, industry] = await Promise.all([read("components/SolutionDetailPage.tsx"), read("app/(public)/industries/[slug]/page.tsx")]);
  assert.match(solution, /ManufacturingProofSection/);
  assert.match(industry, /ManufacturingProofSection/);
});

test("metal cassette collection does not promise a price calculator", async () => {
  const source = await read("app/(public)/products/metallokassety/page.tsx");
  assert.doesNotMatch(source, /Калькулятор стоимости/);
  assert.doesNotMatch(source, /Калькулятор даёт ориентир/);
  assert.match(source, /ориентировочное количество кассет/);
});

test("homepage scenarios use direct industry routes and honest image descriptions", async () => {
  const source = await read("app/(public)/page.tsx");
  for (const route of ["/industries/zhilye-kompleksy", "/industries/biznes-centry", "/industries/torgovye-centry", "/industries/proizvodstvennye-predpriyatiya", "/industries/inzhenernaya-infrastruktura"]) assert.ok(source.includes(route));
  assert.doesNotMatch(source, /объект с металлоизделиями/);
  assert.match(source, /типовой сценарий применения металлоизделий/);
});

test("footer sends sector links directly to sector landing pages", async () => {
  const source = await read("components/Footer.tsx");
  assert.match(source, /industries\/zhilye-kompleksy/);
  assert.match(source, /industries\/proizvodstvennye-predpriyatiya/);
  assert.match(source, /industries\/inzhenernaya-infrastruktura/);
});

test("company positioning stays anchored to verified in-house operations", async () => {
  const source = await read("app/(public)/company/page.tsx");
  assert.doesNotMatch(source, /Не передаём критичные операции подрядчикам/);
  assert.match(source, /Основные операции производственного маршрута выполняем на собственной площадке/);
  assert.match(source, /productionEquipment\.weldingStations/);
  assert.match(source, /productionEquipment\.powderCoatingBooths/);
});
