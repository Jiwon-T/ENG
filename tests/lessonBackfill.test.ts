import test from 'node:test';
import assert from 'node:assert/strict';
import {enrol} from './helpers/enrolled.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111';

test('계산 전용 수업 기록: counted with the lessons for 지난 수업 보상 and 개근, never a report', async () => {
  const {listPetPoints} = await import('../api/_lib/petCoupon.js');
  const {lessonRows} = await import('../api/_lib/lessonRewardRows.js');
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  f.rows.set(`academyStudentMemberships/${A}`, {academyId: 'main'}); enrol(f, A);
  f.rows.set(`notionStudentMappings/${hashStudentKey(A)}`, {studentKey: A, notionStudentPageId: A, internalStudentId: 'int-a', studentDisplayName: '학생', sourceMode: 'firestore'});
  const back = (id: string, date: string, attendance: string) => f.rows.set(`lessonBackfill/${id}`, {internalStudentId: 'int-a', date: `${date}T16:20:00+09:00`, lessonTime: '4:20-5:40', attendance, source: 'notion-2026-09'});
  ['01', '02', '03', '04', '05', '08', '09'].forEach((d, i) => back(`b${i}`, `2026-09-${d}`, i === 1 ? '지각' : '출석'));
  back('b9', '2026-09-10', '결석');
  f.rows.set('lessonReports/r1', {internalStudentId: 'int-a', reportIdentity: 'r1', lessonDateStart: '2026-09-22T16:20:00+09:00', lessonTime: '4:20-5:40', attendance: '출석', attitude: '', homework: '', test: ''});
  const rows = await lessonRows(f.db, 'int-a', null);
  assert.equal(rows.length, 9, 'the 일지 and the 계산 전용 records together');
  const out: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  assert.equal(out.students[0].earned, 30 * 6 + 15 + 30, '출석 (지각 half), a 결석 nothing — and 9월 개근 broken by the 결석');
  f.rows.delete('lessonBackfill/b9');
  const perfect: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  assert.equal(perfect.students[0].earned, 30 * 6 + 15 + 30 + 700 + 500, '8 sessions, one 지각: 개근 1,000 less 30% + 성실 500');
  assert.equal([...f.rows.keys()].some(k => k.startsWith('lessonReports/') && k !== 'lessonReports/r1'), false, 'no report made');
  // a 태도 given from the 수업 내용 counts like the chip, with that day's 자습
  f.rows.set('lessonBackfill/b0', {...f.rows.get('lessonBackfill/b0'), attitude: '상', studied: true});
  const praised: any = await listPetPoints(f.db, {admin: true, academyId: 'main'}, OCT22);
  assert.ok(praised.students[0].earned > perfect.students[0].earned, 'the praised 태도 adds to the count');
});
