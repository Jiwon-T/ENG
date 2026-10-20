import test from 'node:test';
import assert from 'node:assert/strict';
import { wordbookPrintDays, wordbookPrintPlan } from '../src/lib/wordbookPrint.ts';

// A book saved by DAY with uneven DAYs (3, 2 and 4 words), listed out of day order as Firestore may return them.
const words = [
  {w: 'a1', day: 1, order: 0}, {w: 'a2', day: 1, order: 1}, {w: 'b1', day: 2, order: 3}, {w: 'a3', day: 1, order: 2},
  {w: 'b2', day: 2, order: 4}, {w: 'c1', day: 3, order: 5}, {w: 'c2', day: 3, order: 6}, {w: 'c3', day: 3, order: 7}, {w: 'c4', day: 3, order: 8},
];
const dayOf = (w: any) => w.day;

test('단어장 출력: as registered — each DAY keeps its own size, in day order, numbered within the DAY', () => {
  assert.deepEqual(wordbookPrintDays(words, 'registered', 40, dayOf), [{day: 1, count: 3}, {day: 2, count: 2}, {day: 3, count: 4}]);
  const plan = wordbookPrintPlan(words, 'registered', {startDay: 2, endDay: 3, unitSize: 40}, dayOf);
  assert.deepEqual(plan.words.map(x => x.w), ['b1', 'b2', 'c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(plan.numbers, ['Day 2 - 1', 'Day 2 - 2', 'Day 3 - 1', 'Day 3 - 2', 'Day 3 - 3', 'Day 3 - 4']);
  assert.deepEqual(plan.days, [2, 3]);
  const all = wordbookPrintPlan(words, 'registered', {startDay: 1, endDay: 3, unitSize: 40}, dayOf);
  assert.deepEqual(all.words.map(x => x.w).slice(0, 3), ['a1', 'a2', 'a3'], 'a DAY\'s words in their saved order');
});

test('단어장 출력: a set saved by UNIT writes "UNIT 03 - 1"', () => {
  const plan = wordbookPrintPlan(words, 'registered', {startDay: 3, endDay: 3, unitSize: 40}, dayOf, d => `UNIT ${String(d).padStart(2, '0')}`);
  assert.deepEqual(plan.numbers, ['UNIT 03 - 1', 'UNIT 03 - 2', 'UNIT 03 - 3', 'UNIT 03 - 4']);
});

test('단어장 출력: every N words — the range picks by that same cut (not the saved DAY)', () => {
  assert.deepEqual(wordbookPrintDays(words, 'count', 4, dayOf), [{day: 1, count: 4}, {day: 2, count: 4}, {day: 3, count: 1}]);
  const plan = wordbookPrintPlan(words, 'count', {startDay: 2, endDay: 2, unitSize: 4}, dayOf);
  assert.deepEqual(plan.words.map(x => x.w), ['b2', 'c1', 'c2', 'c3'], 'words 5–8 in list order');
  assert.deepEqual(plan.numbers, ['Day 2 - 1', 'Day 2 - 2', 'Day 2 - 3', 'Day 2 - 4']);
  assert.deepEqual(wordbookPrintPlan(words, 'count', {startDay: 1, endDay: 1, unitSize: 0}, dayOf).words.length, 1, 'a size below 1 counts as 1');
});
