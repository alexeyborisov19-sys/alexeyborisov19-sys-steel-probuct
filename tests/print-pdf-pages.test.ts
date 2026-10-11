import assert from 'node:assert/strict';
import test from 'node:test';
import { printablePdfPages } from '../scripts/assert-print-pdf.mjs';

test('PDF extraction rejects the six trailing blank pages seen in CAD output', () => {
  assert.throws(() => printablePdfPages('Two-row preliminary quote\f\f\f\f\f\f\f'), /Blank PDF page 2/);
});

test('PDF extraction preserves real pagination and rejects blank middle/only pages', () => {
  assert.deepEqual(printablePdfPages('First position\fSecond position\fFooter\f'), ['First position', 'Second position', 'Footer']);
  assert.deepEqual(printablePdfPages('Complete quote\f'), ['Complete quote']);
  assert.throws(() => printablePdfPages('First\f \n\fLast\f'), /Blank PDF page 2/);
  assert.throws(() => printablePdfPages('\f'), /Blank PDF page 1/);
});
