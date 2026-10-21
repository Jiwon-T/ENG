import test from 'node:test';
import assert from 'node:assert/strict';
import {couponEarnedIn, earnPoints, initialPetState, monthEarned, takePoints} from '../api/_lib/pet.js';
import {PRIOR_LABEL, priorOf, takePrior} from '../api/_lib/priorPoints.js';

const OCT21 = Date.parse('2026-10-21T05:00:00Z');

test('이전 포인트 회수: October counts only the 내역 (Oct points and 9월 수업) — what was held before is taken from the count in full and from the points held, once', () => {
  const s = initialPetState(OCT21); s.points = 5000; s.earned = {month: '2026-10', points: 5000}; // held when counting began
  takePoints(s, 3000, 'etc', '예전 포인트 조정 (하루 300P)', '2026-10-15'); // the 300P 조정 already cut 3,000
  earnPoints(s, 90, 'class', '지난 수업 보상', '2026-09-25'); earnPoints(s, 120, 'study', '앱 공부', '2026-10-20');
  assert.equal(monthEarned(s), 2000 + 90 + 120);
  assert.equal(priorOf(s), 2000, 'held before the 내역, after the 조정');
  s.points -= 1500; // spent in the shop (earnPoints only counts; the points held are 500 now)
  assert.deepEqual(takePrior(s, OCT21), {prior: 2000, held: 500});
  assert.deepEqual([monthEarned(s), s.points], [210, 0], 'the count keeps the 내역 only; held 500 − 2,000 stops at 0');
  assert.equal(s.ledger!.some(x => x.label === PRIOR_LABEL), false, 'no 내역 line');
  assert.equal(takePrior(s, OCT21), null, 'once');
});

test('이전 포인트 회수: never below 0 held; a state that never wrote its count is read before the points change', () => {
  const s = initialPetState(OCT21); s.points = 800;
  assert.deepEqual(takePrior(s, OCT21), {prior: 800, held: 800});
  assert.deepEqual([couponEarnedIn(s, '2026-10'), s.points], [0, 0]);
});
