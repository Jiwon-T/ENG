import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DEFAULT_SHEET_OPTIONS, layoutSheet, packRows, sheetAvailability, sheetWidths, splitPiece, textWidth } from '../src/lib/analysisSheet.ts';
import { DOCX_BODY, TWIPS_PER_MM } from '../src/lib/printFrame.ts';
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

test('분석지 widths fit Word as well as print: no row (even of one piece) wider than the Word text area (nothing squeezed or re-wrapped)', () => {
  for (const orientation of ['landscape', 'portrait'] as const) {
    const w = sheetWidths(orientation);
    assert.ok(w.body * TWIPS_PER_MM <= DOCX_BODY[orientation], `${orientation}: layout body within Word's margins`);
    assert.ok(w.body <= (orientation === 'landscape' ? 269 : 182), `${orientation}: and within the printed frame`);
    for (const kind of ['analysis', 'practice'] as const) {
      const layout = layoutSheet(longPassage(), { ...DEFAULT_SHEET_OPTIONS, orientation, kind });
      for (const page of layout.pages) {
        const width = page.first && layout.panel ? w.first : w.column;
        for (const line of page.columns.flat()) for (const row of line.rows)
          assert.ok(row.reduce((n, c) => n + c.width, 0) <= width - 5, `${orientation} ${kind}: sentence ${line.index + 1} row fits`);
      }
    }
  }
});

test('분석지: a piece wider than its row is cut into parts that fit (no / inside it), English and Korean kept whole and in order', async () => {
  const p: any = samplePassage();
  const longEn = 'that musicians who practiced for ten thousand hours in quiet rooms every single day without any rest performed far better than those who did not';
  const longKo = '조용한 방에서 매일 하루도 쉬지 않고 만 시간 동안 연습한 음악가들이 그렇게 하지 않은 사람들보다 훨씬 더 잘 연주했다는 것을 보여 주는 아주 긴 해석';
  p.sentences[1] = `However, research shows ${longEn}.`; p.hints[1] = chunkHints(p.sentences[1]);
  p.parts.reading.sentences[1] = { chunks: [{ en: 'However, research shows', ko: '하지만 연구는 보여 준다' }, { en: `${longEn}.`, ko: longKo }], ko: '' };
  for (const orientation of ['landscape', 'portrait'] as const) {
    const w = sheetWidths(orientation), layout = layoutSheet(p, { ...DEFAULT_SHEET_OPTIONS, orientation });
    const line = layout.pages.flatMap(pg => pg.columns.flat()).find(l => l.index === 1)!, pieces = line.rows.flat();
    assert.ok(pieces.length > 2, `${orientation}: the long piece was cut`);
    for (const row of line.rows) assert.ok(row.reduce((n, c) => n + c.width, 0) <= w.first - 5, `${orientation}: every row fits`);
    assert.equal(pieces.slice(1).map(c => c.runs.map(r => r.text).join(' ')).join(' '), `${longEn}.`, 'the English comes back whole');
    assert.equal(pieces.slice(1).map(c => c.ko).join(' '), longKo, 'the Korean comes back whole');
    assert.deepEqual(pieces.map(c => Boolean(c.slash)), [true, ...pieces.slice(1).map(() => false)], 'a / after the first piece only');
  }
  // a Korean much longer than its English is cut too
  const parts = splitPiece({ runs: [{ text: 'a b c d e f' }], ko: longKo, width: 300 }, 60);
  assert.ok(parts.length > 1 && parts.every(c => c.width <= 60) && parts.map(c => c.ko).join(' ') === longKo);
  const xml = await (await JSZip.loadAsync(await (await analysisSheetDocx(layoutSheet(p, DEFAULT_SHEET_OPTIONS))).arrayBuffer())).file('word/document.xml')!.async('string');
  assert.ok(xml.includes('quiet rooms') && xml.includes('만 시간 동안'));
});

test('분석지: a short English piece with a very long Korean is cut by the Korean (parts may carry only Korean), every part fits', () => {
  const longKo = '조용한 방에서 매일 하루도 쉬지 않고 만 시간 동안 연습한 음악가들이 그렇게 하지 않은 사람들보다 훨씬 더 잘 연주했다는 것을 보여 주는 아주아주 긴 해석이에요';
  for (const en of ['Indeed,', 'In short, they won.']) {
    const parts = splitPiece({ runs: [{ text: en, kind: '결론' }], ko: longKo, width: 300 }, 45);
    assert.ok(parts.length > en.split(' ').length, `${en}: more parts than English words`);
    assert.ok(parts.every(c => c.width <= 45), `${en}: every part fits`);
    assert.equal(parts.map(c => c.ko).filter(Boolean).join(' '), longKo, `${en}: the Korean comes back whole`);
    assert.equal(parts.flatMap(c => c.runs.map(r => r.text)).join(' '), en, `${en}: the English comes back whole`);
    assert.ok(parts.flatMap(c => c.runs).every(r => r.kind === '결론'), 'the linking-word mark stays');
  }
  // in a real layout: sentence 2 is 'Indeed,' with that long translation
  const p: any = samplePassage();
  p.sentences[1] = 'Indeed, research shows that practice matters more than we think.'; p.hints[1] = chunkHints(p.sentences[1]);
  p.parts.reading.sentences[1] = { chunks: [{ en: 'Indeed,', ko: longKo + ' ' + longKo }, { en: 'research shows that practice matters more than we think.', ko: '연구는 보여 준다' }], ko: '' };
  for (const orientation of ['landscape', 'portrait'] as const) {
    const w = sheetWidths(orientation), line = layoutSheet(p, { ...DEFAULT_SHEET_OPTIONS, orientation }).pages.flatMap(pg => pg.columns.flat()).find(l => l.index === 1)!;
    for (const row of line.rows) assert.ok(row.reduce((n, c) => n + c.width, 0) <= w.first - 5, `${orientation}: every row fits`);
    const pieces = line.rows.flat(), cut = pieces.slice(0, -1);
    assert.ok(cut.some(c => !c.runs.length && c.ko), `${orientation}: some parts carry only Korean`);
    assert.deepEqual(pieces.map(c => Boolean(c.slash)), [...cut.map((_, k) => k === cut.length - 1), false], `${orientation}: one / after the cut piece`);
  }
});

test('분석지 핵심 어휘: a long meaning that wraps in the panel counts as two lines, so fewer words go in (nothing runs over)', () => {
  const mk = (long: boolean) => { const p: any = samplePassage(); p.parts.summary.summary.ko = p.parts.summary.summary.ko.repeat(5);
    p.parts.words.known = Array.from({ length: 16 }, (_, i) => ({ word: `word${i}`, meaning: long ? '아주 길게 늘어난 뜻풀이가 여러 줄로 넘어가는 경우를 보려고 일부러 길게 썼어요' : '뜻', seen: 'x' })); return p; };
  for (const orientation of ['landscape', 'portrait'] as const) {
    const long = layoutSheet(mk(true), { ...DEFAULT_SHEET_OPTIONS, orientation }).panel!.words.length, short = layoutSheet(mk(false), { ...DEFAULT_SHEET_OPTIONS, orientation }).panel!.words.length;
    assert.equal(short, 16, `${orientation}: short meanings all fit`);
    assert.ok(long > 0 && long < short, `${orientation}: long meanings, fewer words (${long})`);
  }
});
