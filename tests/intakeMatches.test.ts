import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {saveStudentRegistration, listStudentRegistrations, readStudentRegistration} from '../api/_lib/teacherStudentRegistration.js';
import {findIntakeMatches, findRegisteredMatches, joinStudentRegistration} from '../api/_lib/intakeMatches.js';

const base = {uid: 't1', admin: false, principal: false, academyId: 'academy-a'};
const t1 = base, t2 = {...base, uid: 't2'}, principal = {...base, uid: 'p', principal: true};
const input = {name: '김동하', school: '용죽고', grade: '고1', guardianPhone: '010-0000-1234', enrollments: [{subject: '영어', status: '등록', startDate: '2026-10-22'}]};

test('같은 학생 원서: the same name with a phone in common, or with the same school and grade; phones never shown', async () => {
  const f = registrationFirestore();
  f.rows.set('users/t1', {name: '이지원', alias: '이지원T'});
  const first = await saveStudentRegistration(f.db, t1, input, '11111111-1111-4111-8111-111111111111');
  await saveStudentRegistration(f.db, t1, {...input, name: '김동하', guardianPhone: '010-0000-9999', school: '다른고'}, '22222222-2222-4222-8222-222222222222');
  const byPhone = await findIntakeMatches(f.db, t2, {name: '김 동하', guardianPhone: '01000001234'});
  assert.deepEqual(byPhone.map(m => [m.id, m.by, m.writer, m.mine]), [[first.id, 'phone', '이지원T', false]]);
  assert.equal(JSON.stringify(byPhone).includes('1234'), false, 'no phone in the match');
  assert.deepEqual((await findIntakeMatches(f.db, t2, {name: '김동하', school: '용죽고등학교', grade: '고1'})).map(m => m.by), ['school']);
  assert.deepEqual(await findIntakeMatches(f.db, t2, {name: '김동하'}), [], 'a name alone is not enough');
  assert.deepEqual(await findIntakeMatches(f.db, t1, {name: '김동하', guardianPhone: '01000001234', exceptId: first.id}), [], 'not the 원서 being written');
  assert.deepEqual(await findIntakeMatches(f.db, {...t2, academyId: 'academy-b'}, {name: '김동하', guardianPhone: '01000001234'}), [], 'another academy');
});

test('같이 쓰기: the second teacher joins, then reads, edits and lists that 원서; the co-writers stay after a save', async () => {
  const f = registrationFirestore();
  const first = await saveStudentRegistration(f.db, t1, input, '11111111-1111-4111-8111-111111111111');
  await assert.rejects(readStudentRegistration(f.db, t2, first.id), /FORBIDDEN/, 'not before joining');
  const joined: any = await joinStudentRegistration(f.db, t2, first.id);
  assert.equal(joined.record.id, first.id);
  assert.equal((await readStudentRegistration(f.db, t2, first.id)).data.name, '김동하');
  assert.deepEqual((await listStudentRegistrations(f.db, t2)).map(r => r.id), [first.id]);
  const saved = await saveStudentRegistration(f.db, t2, {...input, studentPhone: '010-0000-2222'}, '11111111-1111-4111-8111-111111111111', first.revision, '33333333-3333-4333-8333-333333333333');
  assert.equal(saved.revision, 2);
  const row = [...f.rows.values()].find((r: any) => r.requestId === '11111111-1111-4111-8111-111111111111') as any;
  assert.deepEqual([row.ownerUid, row.coWriters], ['t1', ['t2']]);
  await joinStudentRegistration(f.db, t2, first.id);
  assert.deepEqual(([...f.rows.values()].find((r: any) => r.requestId === '11111111-1111-4111-8111-111111111111') as any).coWriters, ['t2'], 'joining twice adds once');
  await assert.rejects(joinStudentRegistration(f.db, {...t2, academyId: 'academy-b'}, first.id), /FORBIDDEN/);
  assert.equal((await joinStudentRegistration(f.db, principal, first.id) as any).record.id, first.id, '원장님 opens it without joining');
});

test('등록 확정 전: a student already on the list with the same name and a phone, or the same 이름 (학교학년), is shown; others not', async () => {
  const f = registrationFirestore();
  const r = await saveStudentRegistration(f.db, t1, input, '11111111-1111-4111-8111-111111111111');
  const student = (key: string, title: string, guardian: string | null, extra: any = {}) => f.rows.set(`academyDirectorySources/${key}`, {academyId: 'academy-a', kind: 'students', studentKey: key, issue: null,
    fields: {archived: false, properties: {'학생': {title: [{text: {content: title}}]}, '보호자연락처': {phone_number: guardian}, '등록상태': {select: {name: '등록'}}, '강의명': {multi_select: [{name: '영어'}]}}, ...extra}});
  student('s-phone', '김동하 (다른중3)', '010-0000-1234');
  student('s-school', '김동하 (용죽고1)', null);
  student('s-other', '김동하 (다른고2)', '010-0000-7777');
  student('s-gone', '김동하 (용죽고1)', '010-0000-1234', {archived: true});
  f.rows.set('academyDirectorySources/s-gone', {...f.rows.get('academyDirectorySources/s-gone'), fields: {...f.rows.get('academyDirectorySources/s-gone').fields, archived: true}});
  const found = await findRegisteredMatches(f.db, t1, r.id);
  assert.deepEqual(found.map(m => [m.studentKey, m.by, m.status, m.subjects]).sort(), [['s-phone', 'phone', '등록', ['영어']], ['s-school', 'school', '등록', ['영어']]]);
  assert.equal(JSON.stringify(found).includes('1234'), false, 'no phone in the match');
  await assert.rejects(findRegisteredMatches(f.db, t2, r.id), /FORBIDDEN/, 'only who may open the 원서');
  // 시범 수업 then 등록 확정: the 원서's own 시범 student continues, never a match against itself
  const doc = f.rows.get(`teacherStudentRegistrations/${r.id}`); f.rows.set(`teacherStudentRegistrations/${r.id}`, {...doc, trialStudentKey: 's-phone'});
  assert.deepEqual((await findRegisteredMatches(f.db, t1, r.id)).map(m => m.studentKey), ['s-school']);
});
