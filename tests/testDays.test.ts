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

test('일정 외 테스트: a 수업 없는 일지 with a 테스트 평가, off the timetable’s test day, gets half the bonus (one a day); 개근상 counts only the timetable’s days', async () => {
  // paid once per lesson, whatever its date: one settled on 반영 and locked since (10/22) and one before 10/21 alike
  const NOW = Date.parse('2026-11-05T03:00:00Z'), s = initialPetState(NOW);
  s.lessonPaid = {late: {p: 30, x: 30, d: '2026-10-22'}};
  const half = [{id: 'late', date: '2026-10-22T16:00:00+09:00', attendance: '출석', testDayHalf: true}, {id: 'old', date: '2026-10-15T16:00:00+09:00', attendance: '지각', testDayHalf: true},
    {id: 'gone', date: '2026-10-16T16:00:00+09:00', attendance: '결석', testDayHalf: true}];
  const due = pendingStudyRewards(s, half, NOW).filter(p => p.kind === 'testDayHalf');
  assert.deepEqual(due.map(p => [p.id, p.grade || '']), [['late', ''], ['old', '지각']], 'a 결석: none');
  claimStudyRewards(s, due);
  assert.deepEqual((s.ledger || []).filter(x => x.label === '테스트 출석 (일정 외)').map(x => [x.day, x.points]).sort(), [['2026-10-15', 20], ['2026-10-22', 25]]);
  assert.equal(pendingStudyRewards(s, half, NOW).filter(p => p.kind === 'testDayHalf').length, 0, 'paid once');
  assert.deepEqual(lessonRewardParts({attendance: '출석', homework: '', test: '', testPaper: true, attitude: '', testDayHalf: true}).map(p => p.label), ['출석'], 'not in the 반영 settlement (no double)');
  const {registrationFirestore} = await import('./helpers/registrationFirestore.js');
  const {lessonRows} = await import('../api/_lib/lessonRewardRows.js');
  const f = registrationFirestore();
  f.rows.set('teacherClasses/c1', {academyId: 'main', students: [A], slots: [{weekday: 3, start: '16:00', end: '17:20', kind: 'test'}]}); // Wednesdays
  const report = (id: string, date: string, x: any) => f.rows.set(`lessonReports/${id}`, {internalStudentId: 'int-a', reportIdentity: id, lessonDateStart: `${date}T16:00:00+09:00`, lessonTime: '', selfStudyTime: '16:00 ~ 17:00', attendance: '출석', attitude: '', homework: '', test: '', ...x});
  report('wed', '2026-10-21', {test: '상'});                                   // the timetable's test day
  report('fri', '2026-10-23', {test: '중상'});                                 // taken on another day
  report('fri2', '2026-10-23', {test: '상', reportIdentity: 'fri2'});          // the same day again: one a day
  report('sat', '2026-10-24', {});                                             // 자습 only, no 테스트 평가
  report('mon', '2026-10-26', {test: '상', lessonTime: '16:00 ~ 17:20'});      // a lesson
  report('tue', '2026-10-27', {test: '상', attendance: '결석'});
  const rows = await lessonRows(f.db, 'int-a', null, null, A);
  const {lessonReportId} = await import('../api/_lib/reportAudienceDTO.js');
  const mark = (id: string) => { const r: any = rows.find(x => x.id === lessonReportId({reportIdentity: id} as any)); return r.testDay ? 'full' : r.testDayHalf ? 'half' : ''; };
  assert.deepEqual(['wed', 'fri', 'fri2', 'sat', 'mon', 'tue'].map(mark), ['full', 'half', '', '', '', '']);
  // 개근상: the timetable's days only — 10/21 and 10/28 (no 일지: 결석); the Friday test is not one of them
  assert.deepEqual(couponExtras(rows.map(r => ({...r, subject: '영어'})) as any, '2026-10-30')['2026-10'].testNow, {days: 2, absences: 1, lates: 0});
});
