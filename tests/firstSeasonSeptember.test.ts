import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {earnPoints, earnedIn, initialPetState, monthEarned, rollDay, takePoints} from '../api/_lib/pet.js';
import {countsForMonth} from '../src/lib/petCatalog.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z'), NOV3 = Date.parse('2026-11-03T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111';

test('첫 시즌: a September lesson\u2019s points count for October (the 내역 keeps the lesson\u2019s day)', () => {
  const s = initialPetState(OCT22); s.points = 0; s.earned = {month: '2026-10', points: 0};
  earnPoints(s, 30, 'class', '출석', '2026-09-25');
  assert.deepEqual([monthEarned(s), s.earnedBy, s.ledger!.at(-1)!.day], [30, {'2026-10': 30}, '2026-09-25']);
  assert.deepEqual([countsForMonth('2026-09-25', '2026-10'), countsForMonth('2026-08-30', '2026-10'), countsForMonth('2026-10-02', '2026-11'), countsForMonth('2026-11-02', '2026-11')], [true, false, false, true], 'only September joins October (not August)');
});

test('첫 시즌: what was saved for September is counted in October, and moved into October on the next write (never twice)', () => {
  const s = initialPetState(OCT22); s.points = 600; s.earnedBy = {'2026-09': 500, '2026-10': 100}; s.earned = {month: '2026-10', points: 100};
  assert.equal(monthEarned(s), 600);
  earnPoints(s, 30, 'class', '출석', '2026-10-21');
  assert.deepEqual([monthEarned(s), s.earnedBy], [630, {'2026-10': 630}]);
  assert.equal(takePoints(s, 30, 'class', '출석 취소', '2026-09-26'), 30);
  assert.deepEqual([monthEarned(s), s.earnedBy], [600, {'2026-10': 600}], 'a lowered September 평가 comes off October');
  // November: October (with September in it) is last month; a lesson counts for its own month again
  const n = rollDay(s, NOV3); earnPoints(n, 30, 'class', '출석', '2026-10-30');
  assert.deepEqual([earnedIn(n, '2026-10'), monthEarned(n)], [630, 0]);
  // a September bucket never moved (no write in October) still counts for October in November
  const old = initialPetState(OCT22); old.earnedBy = {'2026-09': 200}; old.earned = {month: '2026-09', points: 200};
  assert.equal(earnedIn(rollDay(old, NOV3), '2026-10'), 200);
});

test('첫 시즌: a student without the app gets a late-September lesson in October\u2019s count too', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'});
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '학생', sourceMode: 'firestore'});
  // within the last 30 days, so not a 지난 수업 보상: before, it counted for September
  f.rows.set('lessonReports/a1', {internalStudentId: 'int-a', reportIdentity: 'a1', lessonDateStart: '2026-09-28T14:00:00+09:00', attendance: '출석', attitude: '', homework: '', test: ''});
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  assert.equal(out.students[0].earned, 30, '출석 alone: ×1');
  assert.equal(out.students[0].ledger.some((x: any) => x.day === '2026-09-28'), true, 'shown in October\u2019s 내역');
});
