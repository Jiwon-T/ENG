import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {teacherScheduleSchema} from '../api/_lib/teacherWorkspacePolicy.js';
import {saveStudentRegistration} from '../api/_lib/teacherStudentRegistration.js';
import {consultTies, createConsultSchedule, linkConsultRegistration, readConsultSchedule} from '../api/_lib/consultLinks.js';
import {todayConsults} from '../src/lib/teacherTodayLessons.js';

const base = {title: '김동하 학생 상담', subject: '영어', students: [] as string[], date: '2026-10-22', start: '21:00', end: '22:00', kind: '상담', status: '예정', place: '용죽', note: ''};
const sid = '11111111-1111-4111-8111-111111111111', key = '22222222-2222-4222-8222-222222222222';
const t1 = {uid: 't1', admin: false, principal: false, academyId: 'main'};

test('상담 일정의 신입생: kept by name (once each) on a 상담; another kind drops them', () => {
  assert.deepEqual((teacherScheduleSchema.parse({...base, prospects: [{name: '김동하'}, {name: ' 김동하 '}, {name: '박하늘'}]}) as any).prospects, [{name: '김동하'}, {name: '박하늘'}]);
  assert.equal('prospects' in teacherScheduleSchema.parse({...base, kind: '보강', prospects: [{name: '김동하'}]}), false);
  assert.equal('prospects' in teacherScheduleSchema.parse(base), false, 'nothing added when none');
});

test('원서 ↔ 일정: tied at the 원서 first save; read back as 작성 중, then as the registered student; others refused', async () => {
  const f = registrationFirestore();
  f.rows.set(`teacherSchedules/${sid}`, {ownerUid: 't1', academyId: 'main', revision: 3, data: {...base, prospects: [{name: '김동하'}]}});
  const reg = await saveStudentRegistration(f.db, t1, {name: '김동하', enrollments: [{subject: '영어', status: '등록', startDate: '2026-10-22'}]}, '33333333-3333-4333-8333-333333333333');
  await assert.rejects(linkConsultRegistration(f.db, {...t1, uid: 't2'}, {scheduleId: sid, name: '김동하', registrationId: reg.id}), /FORBIDDEN/, 'not my 일정');
  await assert.rejects(linkConsultRegistration(f.db, t1, {scheduleId: sid, name: '박하늘', registrationId: reg.id}), /INVALID_INPUT/, 'a name the 일정 does not have');
  await linkConsultRegistration(f.db, t1, {scheduleId: sid, name: '김동하', registrationId: reg.id});
  const row = f.rows.get(`teacherSchedules/${sid}`);
  assert.deepEqual([row.consultLinks, row.revision], [{'김동하': reg.id}, 3], 'beside the data: the revision does not move');
  const rec = {id: sid, ...row};
  assert.deepEqual(await consultTies(f.db, t1, [rec]), {[sid]: {'김동하': {registrationId: reg.id, studentKey: null, title: '김동하'}}});
  assert.deepEqual(await consultTies(f.db, {...t1, uid: 't2'}, [rec]), {}, 'a 원서 out of reach is left out');
  // the card: 원서 이어 쓰기, then (registered, and I teach them) the student
  const data = {uid: 't1', admin: false, scopes: [{studentKey: key, subject: '영어'}]};
  let ties: any = await consultTies(f.db, t1, [rec]);
  assert.deepEqual(todayConsults(data, '2026-10-22', [rec], [], ties)[0].prospects, [{name: '김동하', registrationId: reg.id, studentKey: null}]);
  f.rows.set(`teacherStudentRegistrations/${reg.id}`, {...f.rows.get(`teacherStudentRegistrations/${reg.id}`), studentKey: key, syncStatus: 'synced'});
  ties = await consultTies(f.db, t1, [rec]);
  const card = todayConsults(data, '2026-10-22', [rec], [], ties)[0];
  assert.deepEqual([card.students, card.prospects], [[key], []]);
});

test('상담 일정으로 남기기: a 원서 written without a 일정 gets a 상담 일정 today from now (an hour, its campus), tied both ways; once', async () => {
  const f = registrationFirestore();
  f.rows.set('appScheduleConfig/main', {places: ['학원', '용죽']});
  const reg = await saveStudentRegistration(f.db, t1, {name: '김동하', campuses: ['용죽'], enrollments: [{subject: '영어', status: '등록', startDate: '2026-10-22'}]}, '44444444-4444-4444-8444-444444444444');
  assert.deepEqual(await readConsultSchedule(f.db, t1, reg.id), {schedule: null});
  const at = Date.parse('2026-10-22T12:07:00Z'); // 21:07 in Seoul
  const made: any = await createConsultSchedule(f.db, t1, reg.id, at);
  assert.deepEqual([made.created, made.schedule.title, made.schedule.date, made.schedule.start, made.schedule.end], [true, '김동하 상담', '2026-10-22', '21:00', '22:00']);
  const s = f.rows.get(`teacherSchedules/${made.schedule.id}`);
  assert.deepEqual([s.data.kind, s.data.students, s.data.place, s.data.prospects, s.consultLinks, s.stage], ['상담', [], '용죽', [{name: '김동하'}], {'김동하': reg.id}, 'draft']);
  const again: any = await createConsultSchedule(f.db, t1, reg.id, at);
  assert.deepEqual([again.created, again.schedule.id], [false, made.schedule.id], 'not a second one');
  await assert.rejects(createConsultSchedule(f.db, {...t1, uid: 't2'}, reg.id, at), /FORBIDDEN/);
});
