import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Paragraph } from 'docx';
import { DEFAULT_FOOTER, frameDocx, partTitle, printFooter, sentencePages, setPrintFooter, sentenceMark } from '../src/lib/printFrame.ts';

const xmlText = (xml: string) => xml.replace(/<[^>]+>/g, '');

test('출력 틀: a long passage keeps 8 sentences a page and goes on with (2); one page has no number', () => {
  const pages = sentencePages(Array.from({ length: 12 }, (_, i) => `s${i + 1}`));
  assert.deepEqual(pages.map(p => [p.part, p.of, p.first, p.sentences.length]), [[1, 2, 0, 8], [2, 2, 8, 4]]);
  assert.deepEqual([partTitle('인간의 손', 1, 2), partTitle('인간의 손', 2, 2), partTitle('짧은 글', 1, 1)], ['인간의 손 (1)', '인간의 손 (2)', '짧은 글']);
  assert.equal(sentencePages(['a', 'b']).length, 1);
  assert.deepEqual([sentenceMark(0), sentenceMark(8)], ['❶', '❾'], 'the numbers go on across pages');
});

test('출력 틀: the footer is 채움학원 지원T unless changed; the old 워크북 footer moves over once; empty = back to the default', () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  try {
    assert.equal(printFooter(), DEFAULT_FOOTER);
    store.set('workbook-footer', '고덕 캠퍼스 박T');
    assert.equal(printFooter(), '고덕 캠퍼스 박T', 'the 워크북 footer set before');
    assert.equal(store.get('print-footer'), '고덕 캠퍼스 박T');
    assert.equal(setPrintFooter('이충 김T'), '이충 김T');
    assert.equal(printFooter(), '이충 김T');
    assert.equal(setPrintFooter('  '), DEFAULT_FOOTER);
    assert.equal(printFooter(), DEFAULT_FOOTER);
  } finally { delete (globalThis as any).localStorage; }
});

test('출력 틀 (Word): the app name and title at the top, the footer and page number at the bottom; landscape when asked', async () => {
  const blob = await frameDocx({ title: '31번 분석', subtitle: '수능특강', orientation: 'landscape', footer: '채움학원 지원T' }, [[new Paragraph('첫 쪽')], [new Paragraph('둘째 쪽')]]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer()), file = (re: RegExp) => zip.file(Object.keys(zip.files).find(f => re.test(f))!)!.async('string');
  const [header, footer, body] = await Promise.all([file(/^word\/header\d*\.xml$/), file(/^word\/footer\d*\.xml$/), file(/^word\/document\.xml$/)]);
  assert.ok(xmlText(header).includes('지원T English') && xmlText(header).includes('31번 분석 · 수능특강'));
  assert.ok(xmlText(footer).includes('채움학원 지원T') && /PAGE/.test(footer), 'the footer and the page number');
  assert.match(body, /w:orient="landscape"/);
  assert.equal((body.match(/<w:sectPr/g) || []).length, 2, 'each group on its own page');
});
