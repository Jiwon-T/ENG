import test from 'node:test';
import assert from 'node:assert/strict';
import {enrol} from './helpers/enrolled.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {claimStudyRewards, initialPetState, pendingStudyRewards, rollDay} from '../api/_lib/pet.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z'), NOV3 = Date.parse('2026-11-03T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111';
const fresh = (now = OCT22) => { const s = initialPetState(now); s.points = 0; s.earned = {month: '2026-10', points: 0}; return s; };

test('숙제 칩 (before 10/21): a chip that grades no earlier 과제 pays as that lesson\u2019s own 숙제; a chip that graded a 과제 pays once, through it', () => {
  const s = fresh();
  const rows = [
    {id: 'l1', date: '2026-09-15', attendance: '', homework: '상'},                                   // no 과제 before it: its own 숙제
    {id: 'l2', date: '2026-09-17', attendance: '', homework: '미확인', homeworkGrade: '최상', gradedAt: '2026-09-19', gradedBy: 'l3'}, // 과제 graded by l3
    {id: 'l3', date: '2026-09-19', attendance: '', homework: '최상'},                                 // used for l2: not again
    {id: 'l4', date: '2026-09-22', attendance: '', homework: '중하'},                                 // below 중: nothing
  ];
  const pending = pendingStudyRewards(s, rows, OCT22);
  assert.deepEqual(pending.map(p => [p.id, p.kind, p.grade]), [['l1', 'homework', '상'], ['l2', 'assignment', '최상']]);
  assert.equal(claimStudyRewards(s, pending).points, 30 + 40);
  assert.deepEqual(pendingStudyRewards(s, rows, OCT22), [], 'once');
});

test('첫 시즌 보충: a September reward marked paid with no line in the 내역 is paid again — only since the 내역 began, only in October', () => {
  const ledgerFrom = (s: any) => { s.ledger = [{day: '2026-09-20', kind: 'class', label: '시험(종이) 상', points: 30}]; return s; };
  const rows = [{id: 'a', date: '2026-09-25', attendance: '출석'}, {id: 'b', date: '2026-09-15', attendance: '출석'}, {id: 'c', date: '2026-09-20', attendance: '', test: '상', testPaper: true}];
  const s = ledgerFrom(fresh()); s.rewarded = {a: ['attendance'], b: ['attendance'], c: ['test']};
  assert.deepEqual(pendingStudyRewards(s, rows, OCT22).map(p => [p.id, p.kind]), [['a', 'attendance']], 'b is before the 내역 began; c has its line');
  claimStudyRewards(s, pendingStudyRewards(s, rows, OCT22));
  assert.deepEqual(pendingStudyRewards(s, rows, OCT22), [], 'the line is there now: once');
  const late = ledgerFrom(fresh()); late.rewarded = {a: ['attendance']}; late.ledger!.push({day: '2026-10-05', kind: 'class', label: '지난 수업 보상', points: 65});
  assert.deepEqual(pendingStudyRewards(late, rows, OCT22).filter(p => p.id === 'a'), [], 'a 지난 수업 보상 line hides the days: left alone');
  const nov = ledgerFrom(fresh()); nov.rewarded = {a: ['attendance']};
  assert.deepEqual(pendingStudyRewards(rollDay(nov, NOV3), rows, NOV3).filter(p => p.id === 'a'), [], 'November: no more');
});

test('숙제 칩: a student without the app gets a September 숙제 chip with no 과제 before it in October\u2019s count', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'}); enrol(f, A);
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '학생', sourceMode: 'firestore'});
  f.rows.set('lessonReports/a1', {internalStudentId: 'int-a', reportIdentity: 'a1', lessonDateStart: '2026-09-28T14:00:00+09:00', attendance: '', attitude: '', homework: '최상', test: ''});
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  assert.equal(out.students[0].earned, 40 * 3, 'lesson points ×3 for the coupon');
});
