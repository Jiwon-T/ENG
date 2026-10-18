import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DEFAULT_SHEET_OPTIONS, layoutSheet, packRows, sheetAvailability, textWidth } from '../src/lib/analysisSheet.ts';
import { analysisSheetDocx } from '../src/lib/analysisSheetDocx.ts';
import { samplePassage } from '../src/lib/samples.ts';
import { chunkHints } from '../src/lib/passageTools.ts';

const order = (layout: ReturnType<typeof layoutSheet>) => layout.pages.flatMap(p => p.columns.flat().map(l => l.index));
/** The sample passage made long: its 8 sentences three times (24), with every part. */
function longPassage() {
  const p: any = samplePassage(), times = 3;
  p.sentences = Array.from({ length: times }, () => p.sentences).flat();
  p.hints = p.sentences.map(chunkHints);
  p.parts.reading.sentences = Array.from({ length: times }, () => p.parts.reading.sentences).flat();
  p.parts.grammar.sentences = Array.from({ length: times }, () => p.parts.grammar.sentences).flat();
  p.parts.structure.roles = Array.from({ length: times }, () => p.parts.structure.roles).flat();
  return p;
}

test('분석지 layout: the sample fits one landscape page, pieces with their own Korean, 요점 정리 on the right', () => {
  const layout = layoutSheet(samplePassage(), DEFAULT_SHEET_OPTIONS);
  assert.equal(layout.pages.length, 1);
  assert.deepEqual(order(layout), [0, 1, 2, 3, 4, 5, 6, 7]);
  const first = layout.pages[0].columns[0][0];
  assert.deepEqual(first.rows.flat().map(c => c.ko), ['많은 사람들은 믿는다', '재능이 ~이라고', '우리가 가지고 태어나는 것']);
  assert.equal(layout.pages[0].columns[0][1].rows[0][0].runs[0].kind, '역접', 'However is marked');
  assert.ok(layout.panel && layout.panel.mainIdea && layout.panel.summary && layout.panel.title && layout.panel.words.length > 0);
  assert.deepEqual(layout.panel!.structure.find(e => e.key), { role: '결론', nums: '7', key: true });
  assert.equal(layout.panel!.structure.find(e => e.role === '근거')!.nums, '4 · 6');
  assert.ok(layout.pages[0].columns[0][7].essay, '서술형 sentence');
});

test('분석지 layout: a long passage goes on by sentence length, page 1 next to the panel, then two columns; every sentence once, in order', () => {
  const p = longPassage();
  for (const orientation of ['landscape', 'portrait'] as const) {
    const layout = layoutSheet(p, { ...DEFAULT_SHEET_OPTIONS, orientation });
    assert.ok(layout.pages.length >= 2, orientation);
    assert.deepEqual(order(layout), p.sentences.map((_: string, i: number) => i));
    assert.equal(layout.pages[0].columns.length, 1);
    assert.ok(layout.pages.slice(1).every(pg => pg.columns.length <= 2 && !pg.first));
  }
  // with less on each sentence (no Korean pieces, no notes) more sentences fit a page
  const lean = layoutSheet(p, { ...DEFAULT_SHEET_OPTIONS, meaning: false, grammar: false });
  assert.ok(lean.pages[0].columns[0].length > layoutSheet(p, DEFAULT_SHEET_OPTIONS).pages[0].columns[0].length);
});

test('해석 연습: write lines instead of Korean, no 요지·요약·제목, words and structure kept', () => {
  const layout = layoutSheet(samplePassage(), { ...DEFAULT_SHEET_OPTIONS, kind: 'practice' });
  const lines = layout.pages.flatMap(pg => pg.columns.flat());
  assert.ok(lines.every(l => l.write >= 1 && l.rows.flat().every(c => !c.ko) && !l.notes.length && !l.full));
  assert.equal(layout.meaning, false);
  assert.ok(layout.panel && !layout.panel.mainIdea && !layout.panel.summary && !layout.panel.title && layout.panel.words.length && layout.panel.structure.length);
  assert.equal(layout.topic, '', 'no 주제 line either');
});

test('분석지: parts not made yet are left out (no Korean, no panel without summary/words)', () => {
  const p: any = samplePassage();
  delete p.parts.reading; delete p.parts.summary; delete p.parts.structure; delete p.parts.words;
  assert.deepEqual(sheetAvailability(p), { meaning: false, full: false, grammar: true, summary: false, words: false });
  const layout = layoutSheet(p, DEFAULT_SHEET_OPTIONS);
  assert.equal(layout.panel, null);
  assert.equal(layout.pages[0].columns.length, 2, 'no panel: page 1 in two columns');
  assert.deepEqual(layout.pages[0].columns.flat()[0].rows.flat().map(c => c.runs.map(r => r.text).join(' ')), chunkHints(p.sentences[0]));
});

test('분석지 measuring: Korean is wider than English per letter; rows never overflow except a single long piece', () => {
  assert.ok(textWidth('가나다라', 9) > textWidth('abcd', 9));
  const rows = packRows([{ runs: [], ko: '', width: 30 }, { runs: [], ko: '', width: 40 }, { runs: [], ko: '', width: 50 }, { runs: [], ko: '', width: 200 }], 100);
  assert.deepEqual(rows.map(r => r.map(c => c.width)), [[30, 40], [50], [200]]);
});

test('분석지 Word: the same pages, with the pieces and their Korean, the panel, name and date', async () => {
  const layout = layoutSheet(samplePassage(), DEFAULT_SHEET_OPTIONS);
  const xml = await (await JSZip.loadAsync(await (await analysisSheetDocx(layout, '채움학원 지원T')).arrayBuffer())).file('word/document.xml')!.async('string');
  for (const text of ['지문 분석지', '이름', '많은 사람들은 믿는다', 'Many people believe', '글의 구조', '핵심 어휘', '서술형']) assert.ok(xml.includes(text), text);
  assert.ok(xml.includes('w:orient="landscape"'));
  const long = layoutSheet(longPassage(), DEFAULT_SHEET_OPTIONS), longXml = await (await JSZip.loadAsync(await (await analysisSheetDocx(long)).arrayBuffer())).file('word/document.xml')!.async('string');
  assert.equal((longXml.match(/<w:sectPr/g) || []).length, long.pages.length, 'one Word section (page) per laid-out page');
  const practice = await (await JSZip.loadAsync(await (await analysisSheetDocx(layoutSheet(samplePassage(), { ...DEFAULT_SHEET_OPTIONS, kind: 'practice' }))).arrayBuffer())).file('word/document.xml')!.async('string');
  assert.ok(practice.includes('해석 연습') && !practice.includes('많은 사람들은 믿는다'));
});
