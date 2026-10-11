import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('basket specification supplies saved positions to a print-only document', async () => {
  const source = await readFile('components/commercial/BasketSpecification.tsx', 'utf8');
  assert.match(source, /<BasketPrintout items=\{items\} editing=\{editing\}/);
});

test('basket print uses the same complete brief and preliminary notice without calculating prices', async () => {
  const source = await readFile('components/commercial/BasketPrintout.tsx', 'utf8');
  assert.match(source, /basketBriefText\(item\)/);
  assert.match(source, /PRODUCT_CALCULATION_NOTICE/);
  assert.match(source, /quote-print-root basket-print-root/);
  assert.doesNotMatch(source, /fetch\(|dangerouslySetInnerHTML|window\.print|<button/);
});

test('basket print explicitly uses light paper without changing screen color scheme', async () => {
  const css = await readFile('app/globals.css', 'utf8');
  assert.match(css, /@media print\s*\{\s*html:has\(body > \.quote-print-root\) \{ color-scheme: light !important; \}/);
});
