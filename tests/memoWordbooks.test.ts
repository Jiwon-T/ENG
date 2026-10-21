import test from 'node:test';
import assert from 'node:assert/strict';
import {dayRange, memoPicks} from '../src/lib/memoWordbooks.js';

const books = [{id: 'a', title: '능률VOCA 수능 필수'}, {id: 'b', title: '수능 2000'}, {id: 'c', title: '수특라 단어'}, {id: 'd', title: '수특라 영어독해'}];

test('바로 출력 칩: DAYs read the way teachers write them', () => {
  assert.deepEqual([dayRange('능률voca day30 31'), dayRange('Day 1-2'), dayRange('day 32,33'), dayRange('day 5'), dayRange('숙제 검사')], [{start: 30, end: 31}, {start: 1, end: 2}, {start: 32, end: 33}, {start: 5, end: 5}, null]);
});

test('바로 출력 칩: a line with DAYs names its book (short names, spaces left out); "단어:" alone asks for one; other notes stay quiet', () => {
  assert.deepEqual(memoPicks('능률voca day30 31', books).picks, [{books: [books[0]], start: 30, end: 31}]);
  assert.deepEqual(memoPicks('수능2000 day 32 33', books).picks[0].books.map(b => b.id), ['b']);
  assert.deepEqual(memoPicks('수특라 day 3', books).picks[0].books.map(b => b.id), ['c', 'd'], 'two books: the chip asks which');
  assert.deepEqual(memoPicks('서술형 숙제 해야함', books), {picks: [], ask: null}, 'no DAYs, no 단어: → no chip');
  assert.deepEqual(memoPicks('단어:', books), {picks: [], ask: {books: [], start: null, end: null}});
  assert.deepEqual(memoPicks('단어 : 능률 day 4', books).picks, [{books: [books[0]], start: 4, end: 4}]);
});
