import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sitePath = new URL("../lib/site.ts", import.meta.url);
const contactsPath = new URL("../app/(public)/contacts/page.tsx", import.meta.url);
const conversionPath = new URL("../components/ConversionActions.tsx", import.meta.url);
const footerPath = new URL("../components/Footer.tsx", import.meta.url);
const quoteFormPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);

test("public contact surfaces use the centralized site configuration", async () => {
  const [site, contacts, conversion, footer, quoteForm] = await Promise.all([
    readFile(sitePath, "utf8"),
    readFile(contactsPath, "utf8"),
    readFile(conversionPath, "utf8"),
    readFile(footerPath, "utf8"),
    readFile(quoteFormPath, "utf8"),
  ]);

  assert.match(site, /email: "info@steelprodukt\.ru"/);
  assert.match(site, /telephone: "\+79107803723"/);
  assert.match(site, /telephoneDisplay: "\+7 910 780 37 23"/);
  assert.match(site, /hostDisplay: siteHostDisplay/);
  assert.match(site, /productionAddress:/);
  assert.match(site, /line1: "г\. Смоленск, Рославльское шоссе"/);
  assert.match(site, /line2: "7-й км, стр\. 3"/);

  assert.match(contacts, /import \{ siteConfig \} from "@\/lib\/site"/);
  assert.match(contacts, /href=\{`tel:\$\{siteConfig\.telephone\}`\}/);
  assert.match(contacts, /siteConfig\.telephoneDisplay/);
  assert.match(contacts, /href=\{`mailto:\$\{siteConfig\.email\}`\}/);
  assert.match(contacts, /siteConfig\.hostDisplay/);
  assert.match(contacts, /siteConfig\.productionAddress\.line1/);
  assert.match(contacts, /siteConfig\.productionAddress\.line2/);
  assert.doesNotMatch(contacts, /tel:\+79107803723/);
  assert.doesNotMatch(contacts, /mailto:info@steelprodukt\.ru/);
  assert.doesNotMatch(contacts, />\+7 910 780 37 23</);
  assert.doesNotMatch(contacts, /7-й км, стр\. 3/);

  assert.match(conversion, /import \{ siteConfig \} from "@\/lib\/site"/);
  assert.match(conversion, /`mailto:\$\{siteConfig\.email\}\?subject=/);
  assert.match(conversion, /label: siteConfig\.email/);
  assert.doesNotMatch(conversion, /mailto:info@steelprodukt\.ru/);

  assert.match(footer, /import \{ siteConfig \} from "@\/lib\/site"/);
  assert.match(footer, /siteConfig\.telephoneDisplay/);
  assert.match(footer, /siteConfig\.email/);
  assert.match(footer, /siteConfig\.hostDisplay/);
  assert.match(footer, /siteConfig\.productionAddress\.line1/);
  assert.match(footer, /siteConfig\.productionAddress\.line2/);
  assert.match(footer, /legalOperator\.legalAddress/);
  assert.doesNotMatch(footer, /tel:\+79107803723/);
  assert.doesNotMatch(footer, /mailto:info@steelprodukt\.ru/);

  assert.match(quoteForm, /import \{ siteConfig \} from "@\/lib\/site"/);
  assert.match(quoteForm, /href=\{`mailto:\$\{siteConfig\.email\}`\}/);
  assert.doesNotMatch(quoteForm, /mailto:info@steelprodukt\.ru/);
});
