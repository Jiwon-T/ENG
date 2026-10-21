import test from 'node:test';
import assert from 'node:assert/strict';
import {claimStudyRewards, couponExtras, initialPetState, lessonRewardParts, pendingStudyRewards, type CouponRow} from '../api/_lib/pet.js';
import {testDaysOf} from '../api/_lib/testDays.js';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const row = (date: string, x: Partial<CouponRow> = {}): CouponRow => ({date: `${date}T14:00:00+09:00`, attendance: '', homework: '', test: '', testPaper: true, attitude: '', subject: '영어', ...x});

test('누적 테스트 날: the class test line on its weekday, a one-off 테스트 일정 naming the student, less a 휴강', () => {
  const classes = [
    {students: [A, B], slots: [{weekday: 3, start: '16:00', end: '17:20', kind: 'test'}, {weekday: 1, start: '16:00', end: '17:20', kind: 'lesson'}]},
    {students: [A], status: '중단', slots: [{weekday: 5, start: '16:00', end: '17:00', kind: 'test'}]},           // 중단: none
  ];
  const schedules = [
    {data: {date: '2026-10-14', kind: '휴강', students: [A], start: '15:00', end: '18:00'}},                        // A's Wednesday off
    {data: {date: '2026-10-17', kind: '테스트', students: [A]}},
  ];
  assert.deepEqual([...testDaysOf(A, classes, schedules, '2026-10-01', '2026-10-21')], ['2026-10-07', '2026-10-17', '2026-10-21']);
  assert.deepEqual([...testDaysOf(B, classes, schedules, '2026-10-01', '2026-10-21')], ['2026-10-07', '2026-10-14', '2026-10-21']);
});

test('누적 테스트 출석 보너스: +50P on top of 출석, 지각 80% (40P), none for a 결석 — not tripled in the coupon count', () => {
  const pts = (attendance: string) => lessonRewardParts({attendance, homework: '', test: '', testPaper: true, attitude: '', testDay: true}).map(p => [p.label, p.points]);
  assert.deepEqual(pts('출석'), [['출석', 30], ['누적 테스트 출석', 50]]);
  assert.deepEqual(pts('지각'), [['지각', 15], ['누적 테스트 출석', 40]]);
  assert.deepEqual(pts('결석'), []);
  const e = couponExtras([row('2026-10-07', {attendance: '출석', test: '상', testDay: true})], '2026-10-22')['2026-10'];
  assert.equal(e.lesson, 2 * 30, 'only the 시험 상 part is tripled');
});

test('누적 테스트 출석 보너스 the old way (lessons before 10/21): one line a test day, from October only', () => {
  const s = initialPetState(Date.parse('2026-10-21T03:00:00Z'));
  const reports = [
    {id: 'a', date: '2026-10-07T16:00:00+09:00', attendance: '지각', testDay: true},
    {id: 'b', date: '2026-09-30T16:00:00+09:00', attendance: '출석', testDay: true},     // before October: 출석 only
  ];
  const pending = pendingStudyRewards(s, reports, Date.parse('2026-10-21T03:00:00Z'));
  assert.deepEqual(pending.map(p => p.kind).sort(), ['attendance', 'attendance', 'testDay']);
  claimStudyRewards(s, pending);
  assert.ok((s.ledger || []).some(x => x.label === '누적 테스트 출석' && x.points === 40 && x.day === '2026-10-07'));
  assert.equal(pendingStudyRewards(s, reports, Date.parse('2026-10-21T03:00:00Z')).length, 0, 'paid once');
});

test('누적 테스트 개근상: 4+ test days all attended → 1000P less 30% a 지각; a 결석 (or a day with no 일지) → none', () => {
  const month = (att: string[]) => couponExtras(att.map((a, i) => row(`2026-10-${String(7 * i + 1).padStart(2, '0')}`, {attendance: a, testDay: true})), '2026-11-02')['2026-10'];
  assert.deepEqual(month(['출석', '출석', '출석', '출석']).testPerfects, [{month: '2026-10', days: 4, lates: 0, base: 1000, final: true}]);
  assert.equal(month(['출석', '지각', '출석', '지각']).testPerfects?.[0].base, 400);
  assert.equal(month(['출석', '출석', '출석', '결석']).testPerfects, undefined);
  assert.equal(month(['출석', '출석', '출석']).testPerfects, undefined, 'fewer than 4 test days');
  assert.equal(month(['출석', '출석', '출석', '출석']).perfect, 1000, 'counted in the coupon count');
  // apart from the lesson 개근: test days with no class time are not lessons
  assert.equal(month(['출석', '출석', '출석', '출석']).perfects, undefined);
  const now = couponExtras([row('2026-10-07', {attendance: '출석', testDay: true}), row('2026-10-14', {attendance: '결석', testDay: true})], '2026-10-21')['2026-10'];
  assert.deepEqual(now.testNow, {days: 2, absences: 1, lates: 0});
});
