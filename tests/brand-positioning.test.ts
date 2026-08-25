import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proofPath = new URL("../components/ManufacturingProofSection.tsx", import.meta.url);
const productPath = new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url);
const cassettePath = new URL("../app/(public)/products/metallokassety/page.tsx", import.meta.url);
const commercialPath = new URL("../components/CommercialProductLandingPage.tsx", import.meta.url);

test("product pages keep proof-backed manufacturing positioning", async () => {
  const [proof, product, cassettes, commercial] = await Promise.all([
    readFile(proofPath, "utf8"),
    readFile(productPath, "utf8"),
    readFile(cassettePath, "utf8"),
    readFile(commercialPath, "utf8"),
  ]);

  assert.match(proof, /Производство полного цикла/);
  assert.match(proof, /Инженерно-конструкторский центр/);
  assert.match(proof, /Собственная производственная база/);
  assert.match(proof, /От опытного образца до серии/);
  assert.match(proof, /productionEquipment\.pressBrakes/);
  assert.match(proof, /productionEquipment\.weldingStations/);
  assert.match(product, /<ManufacturingProofSection \/>/);
  assert.match(cassettes, /<ManufacturingProofSection \/>/);
  assert.match(commercial, /Почему «Сталь Продукт»/);
});
