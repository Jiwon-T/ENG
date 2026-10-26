import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange, daySheets, memoPicks} from '../src/lib/memoWordbooks.js';

const books = [{id: 'a', title: '능률VOCA 수능 필수'}, {id: 'b', title: '수능 2000'}, {id: 'c', title: '수특라 단어'}, {id: 'd', title: '수특라 영어독해'}];

test('바로 출력 칩: DAYs read the way teachers write them', () => {
  assert.deepEqual([dayRange('능률voca day30 31'), dayRange('Day 1-2'), dayRange('day 32,33'), dayRange('day 5'), dayRange('숙제 검사')], [{start: 30, end: 31}, {start: 1, end: 2}, {start: 32, end: 33}, {start: 5, end: 5}, null]);
});

test('바로 출력 칩: a line with DAYs names its book (short names, spaces left out); "단어:" alone asks for one; other notes stay quiet', () => {
  assert.deepEqual(memoPicks('능률voca day30 31', books).picks, [{books: [books[0]], start: 30, end: 31}]);
  assert.deepEqual(memoPicks('수능2000 day 32 33', books).picks[0].books.map(b => b.id), ['b']);
  assert.deepEqual(memoPicks('수특라 day 3', books).picks[0].books.map(b => b.id), ['c', 'd'], 'two books: the chip asks which');
  assert.deepEqual(memoPicks('서술형 숙제 해야함', books), {picks: [], ask: null, grammarAsk: null}, 'no DAYs, no 단어: → no chip');
  assert.deepEqual(memoPicks('단어:', books), {picks: [], ask: {books: [], start: null, end: null}, grammarAsk: null});
  assert.deepEqual(memoPicks('단어 : 능률 day 4', books).picks, [{books: [books[0]], start: 4, end: 4}]);
});

test('바로 출력 칩: every DAY of a list ("1,2,3,4" = "1~4"), sheets written apart, and a count after the DAYs left out', () => {
  assert.deepEqual([dayRange('Day 1,2,3,4 차례'), dayRange('day 1~4'), dayRange('Day 1, 2, 3, 4'), dayRange('day 1-2 3개 틀림')], [{start: 1, end: 4}, {start: 1, end: 4}, {start: 1, end: 4}, {start: 1, end: 2}]);
  assert.deepEqual(dayRange('Day 1~2, 3~4'), {start: 1, end: 4, groups: [{start: 1, end: 2}, {start: 3, end: 4}]});
  assert.deepEqual(dayRange('day 1,2 3,4'), {start: 1, end: 4, groups: [{start: 1, end: 2}, {start: 3, end: 4}]});
  assert.deepEqual(memoPicks('단어 : 능률 Day 1,2,3,4 차례', books).picks, [{books: [books[0]], start: 1, end: 4}], 'the screenshot case: 1~4, not 1~2');
});

test('나눠서: the memo\'s own sheets, else two DAYs a sheet; one sheet or no DAYs gives none to split', () => {
  assert.deepEqual(daySheets({start: 1, end: 4}), [{start: 1, end: 2}, {start: 3, end: 4}]);
  assert.deepEqual(daySheets({start: 1, end: 5}), [{start: 1, end: 2}, {start: 3, end: 4}, {start: 5, end: 5}]);
  assert.deepEqual(daySheets({start: 1, end: 6, groups: [{start: 1, end: 3}, {start: 4, end: 6}]}), [{start: 1, end: 3}, {start: 4, end: 6}]);
  assert.deepEqual(daySheets({start: 1, end: 2}), [{start: 1, end: 1}, {start: 2, end: 2}], 'just two DAYs: one DAY a sheet');
  assert.deepEqual([daySheets({start: 5, end: 5}).length, daySheets({start: null, end: null}).length], [1, 0]);
});

test('바로 출력 칩: "단어:" and DAYs find 단어장 and 내신 대비 단어장 alike; "문법:" only 문법 세트 (marked grammar)', () => {
  const sets = [{id: 'w', title: '능률VOCA 수능 필수', category: 'word' as const}, {id: 'e', title: '비전고2 1학기 중간', category: 'exam' as const}, {id: 'g', title: '3단 변화 동사', category: 'grammar' as const}, {id: 'g2', title: '비전 문법 정리', category: 'grammar' as const}];
  assert.deepEqual(memoPicks('단어: 비전고2 day 1~3', sets).picks, [{books: [sets[1]], start: 1, end: 3}], '내신 대비 단어장 like a 단어장');
  assert.deepEqual(memoPicks('비전고2 day 2', sets).picks.map(p => p.books.map(b => b.id)), [['e']], 'a line with DAYs: not 문법 세트');
  assert.deepEqual(memoPicks('문법: 3단 변화 day 2', sets).picks, [{books: [sets[2]], start: 2, end: 2, kind: 'grammar'}]);
  assert.deepEqual(memoPicks('문법: 능률voca', sets), {picks: [], ask: null, grammarAsk: {books: [], start: null, end: null, kind: 'grammar'}}, 'a 단어장 name after 문법: is not found');
  assert.deepEqual(memoPicks(['단어: day 3', '문법:'].join(String.fromCharCode(10)), sets).grammarAsk?.kind, 'grammar');
});

test('바로 출력 칩: one line naming several books, each with its DAYs, gives a chip for each', () => {
  const sets = [{id: 's', title: '수능 2000', category: 'word' as const}, {id: 'm', title: '중등 실력 단어', category: 'word' as const}, {id: 'd', title: '동삭중3 2학기 기말', category: 'exam' as const}];
  assert.deepEqual(memoPicks('단어: 수능2000 Day 1~2, 중등 실력 Day 1~2, 동삭중3 Day1~2', sets).picks.map(p => [p.books.map(b => b.id), p.start, p.end]), [[['s'], 1, 2], [['m'], 1, 2], [['d'], 1, 2]]);
  assert.deepEqual(memoPicks('수능2000 day 3 중등 실력 day 4~5', sets).picks.map(p => [p.books[0].id, p.start, p.end]), [['s', 3, 3], ['m', 4, 5]], 'without 단어: too');
  assert.deepEqual(memoPicks('단어: 수능2000 Day 1~2, 3~4', sets).picks, [{books: [sets[0]], start: 1, end: 4, groups: [{start: 1, end: 2}, {start: 3, end: 4}]}], 'one book written apart stays one chip');
  assert.deepEqual(memoPicks(['수능2000 day 1', '수능2000 day 5'].join(String.fromCharCode(10)), sets).picks.map(p => p.start), [1, 5], 'the same book on other DAYs: its own chip');
});
