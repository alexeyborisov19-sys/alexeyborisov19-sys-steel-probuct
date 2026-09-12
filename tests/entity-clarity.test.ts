import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function publicSourceFiles(root: string): string[] {
  const allowedExtensions = /\.(?:ts|tsx|js|jsx|mjs|json|txt|md|xml)$/i;
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...publicSourceFiles(path));
    } else if (allowedExtensions.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

test("brand and legal operator are separate structured-data entities", () => {
  const entities = source("lib/entity-schema.ts");
  const references = source("data/entity-references.ts");
  const layout = source("app/(public)/layout.tsx");
  const schemas = source("lib/schema.ts");

  assert.match(entities, /"@type": "Brand"/);
  assert.match(entities, /`\$\{siteConfig\.url\}\/\#brand`/);
  assert.match(entities, /name: legalOperator\.name/);
  assert.match(entities, /alternateName: legalOperator\.shortName/);
  assert.match(entities, /brand: \{ "@id": `\$\{siteConfig\.url\}\/\#brand` \}/);
  assert.match(entities, /sameAs: legalOperatorSameAs/);
  assert.match(entities, /propertyID: "ИНН"/);
  assert.match(entities, /propertyID: "ОГРН"/);
  assert.match(references, /companies\.rbc\.ru\/id\/1156733014657-ooo-energoalyans/);
  assert.match(references, /spark-interfax\.ru\/smolenskaya-oblast-smolensk\/ooo-energoalyans-inn-6732110789-ogrn-1156733014657/);
  assert.match(layout, /brandEntitySchema\(\)/);
  assert.match(layout, /legalOperatorEntitySchema\(\)/);
  assert.doesNotMatch(layout, /organizationSchema\(\)/);

  const canonicalBrandReference = /brand: \{ "@id": `\$\{siteConfig\.url\}\/\#brand` \}/g;
  assert.equal((schemas.match(canonicalBrandReference) ?? []).length, 3);
  assert.doesNotMatch(schemas, /brand: \{ "@type": "Brand", name: siteConfig\.name \}/);
});

test("verified production facts page is sourced from manufacturing-facts and discoverable", () => {
  const page = source("app/(public)/company/facts/page.tsx");
  const entities = source("lib/entity-schema.ts");
  const compact = source("app/llms.txt/route.ts");
  const full = source("app/llms-full.txt/route.ts");
  const sitemap = source("app/sitemap.ts");
  const footer = source("components/Footer.tsx");

  for (const token of [
    "productionScale",
    "productionScaleSummary",
    "productionEquipment",
    "productionEquipmentSummary",
    "metalCassetteOutputSummary",
    "installationScopeSummary",
  ]) {
    assert.match(page, new RegExp(token));
  }

  assert.match(page, /бренд\/товарный знак, не юридическое лицо/);
  assert.match(page, /legalOperator\.inn/);
  assert.match(page, /legalOperator\.ogrn/);
  assert.match(page, /legalOperatorExternalReferences/);
  assert.match(page, /companyFactsAboutPageSchema\(\)/);
  assert.doesNotMatch(page, /60 000 м²\/год/);
  assert.doesNotMatch(page, /companies\.rbc\.ru/);
  assert.doesNotMatch(page, /spark-interfax\.ru/);

  assert.match(entities, /"@type": "AboutPage"/);
  assert.match(entities, /about: \[/);
  assert.match(entities, /mainEntity: \[/);
  assert.match(entities, /citation: legalOperatorExternalReferences\.map/);

  assert.match(compact, /\/company\/facts/);
  assert.match(full, /\/company\/facts/);
  assert.match(full, /legalOperatorExternalReferences/);
  assert.match(full, /Независимая идентификация юридического оператора/);
  assert.match(sitemap, /"\/company\/facts"/);
  assert.match(sitemap, /path === "\/company\/facts"/);
  assert.match(footer, /"Факты о производстве": "\/company\/facts"/);
});

test("public site sources never reference the unrelated laser67.ru domain", () => {
  const roots = ["app", "components", "data", "lib"];
  const matches = roots
    .flatMap(publicSourceFiles)
    .filter((path) => /laser67\.ru/i.test(source(path)));

  assert.deepEqual(matches, []);
});
