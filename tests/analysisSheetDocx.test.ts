import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DEFAULT_SHEET_OPTIONS, layoutSheet } from '../src/lib/analysisSheet.ts';
import { analysisSheetDocx } from '../src/lib/analysisSheetDocx.ts';
import { samplePassage } from '../src/lib/samples.ts';

/** The Word file's body XML for the sample passage as a 분석지 (the logo fetch fails in Node; the sheet is made without it). */
async function documentXml() {
  const blob = await analysisSheetDocx(layoutSheet(samplePassage(), DEFAULT_SHEET_OPTIONS), '채움학원 지원T');
  return (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
}

test('분석지 Word: every table tells Word its column widths (or Word gives every piece the same width and they wrap)', async () => {
  const xml = await documentXml();
  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  assert.ok(tables.length > 3);
  for (const t of tables.filter(t => !t.includes('<w:tbl>', 6))) { // the innermost tables (the rows of pieces)
    const grid = [...t.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
    const cells = [...t.matchAll(/<w:tcW w:type="dxa" w:w="(\d+)"\/>/g)].map(m => Number(m[1]));
    assert.deepEqual(grid, cells, 'grid = cell widths');
  }
});
test('분석지 Word: rows of pieces never touch (Word would join them into one table) and lines have the planned heights', async () => {
  const xml = await documentXml();
  assert.equal(/<\/w:tbl>\s*<w:tbl>/.test(xml), false, 'a paragraph between tables');
  assert.match(xml, /<w:spacing[^>]*w:lineRule="exact"/, 'exact line heights');
  assert.match(xml, /<w:tcMar><w:left w:type="dxa" w:w="0"\/><w:right w:type="dxa" w:w="0"\/><\/w:tcMar>/, 'the number cell has no inner margins');
});
