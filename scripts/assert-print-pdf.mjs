import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function printablePdfPages(extracted) {
  // Poppler ends every page, including an empty last page, with one form feed.
  const pages = extracted.replace(/\f$/, '').split('\f');
  for (const [index, content] of pages.entries()) {
    assert.ok(content.trim().length > 0, `Blank PDF page ${index + 1}`);
  }
  return pages;
}

/** Inspect real PDF pages, not just the DOM or the PDF signature. */
export function assertPrintablePdf(path) {
  const extracted = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  const pages = printablePdfPages(extracted);
  for (let index = 0; index < pages.length; index++) {
    const ppm = execFileSync('pdftoppm', ['-f', String(index + 1), '-singlefile', '-scale-to', '100', path]);
    const header = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(ppm.toString('ascii', 0, 64));
    assert.ok(header, 'Expected RGB PDF raster');
    assert.ok([...ppm.subarray(header[0].length, header[0].length + 3)].every(channel => channel >= 250), `Dark paper margin on page ${index + 1}`);
  }
  return { pages, text: extracted.replace(/\s+/g, ' ') };
}
