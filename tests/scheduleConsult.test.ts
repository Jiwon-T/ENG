import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {publishAppSchedule, saveAppSchedule} from '../api/_lib/appSchedule.js';
import {timetableSheet} from '../src/lib/timetableSheet.js';
import {consultName, todayConsults, todayLessons} from '../src/lib/teacherTodayLessons.js';

const a = '11111111-1111-4111-8111-111111111111';
const consult = {title: '신입생 상담', subject: '영어', students: [] as string[], date: '2026-10-22', start: '16:00', end: '16:30', kind: '상담', status: '예정', place: '학원', note: ''};

test('신입생 상담: a schedule with no student is saved and published; nothing goes to any student\u2019s schedule', async () => {
  const f = templateFirestore(), actor = {uid: 't', admin: false, academyId: 'main', scopes: [{studentKey: a, subject: '영어'}]};
  f.rows.set('academyCoreAuthority/main', {active: true}); f.rows.set('teacherWorkspaceAccess/t', {academyId: 'main', scopes: actor.scopes}); f.rows.set('appScheduleConfig/main', {places: ['학원']});
  const id = randomUUID();
  const saved = await saveAppSchedule(f.db, actor, {id, data: consult});
  assert.deepEqual([saved.record.data.students, saved.record.data.kind], [[], '상담']);
  const published = await publishAppSchedule(f.db, actor, id, saved.record.revision);
  assert.equal(published.stage, 'published');
  assert.equal([...f.rows.keys()].some(k => k.startsWith('studentSchedules/')), false, 'no student schedule rows');
});

test('상담 is not a lesson: off the weekly timetable sheet and the day\u2019s lessons to write, even with students picked', () => {
  const schedules = [{id: 's1', ownerUid: 't', data: {...consult, students: [a]}}, {id: 's2', ownerUid: 't', data: {...consult, kind: '보강', title: '보강', students: [a]}}];
  const data = {uid: 't', admin: true, students: [{studentKey: a, studentDisplayName: '김하늘 (평촌중2)'}], classes: [], schedules, scopes: [{studentKey: a, subject: '영어'}]};
  const day = timetableSheet(data, 'week', '2026-10-22', '지원').days.find(d => d.date === '2026-10-22')!;
  assert.equal(day.lesson.length, 2, 'only the 보강 (time line + names)');
  const today = todayLessons(data, '2026-10-22', schedules);
  assert.deepEqual(today.map(e => e.kind), ['보강']);
});

test('오늘 수업 › 상담 카드: the day’s 상담 (mine, with or without students; another teacher’s only when it names my students), still not a lesson to write', () => {
  const b = '22222222-2222-4222-8222-222222222222';
  const schedules = [
    {id: 'c1', ownerUid: 't', data: {...consult, start: '21:00', end: '22:00', title: '김동하 학생 상담'}},
    {id: 'c2', ownerUid: 't', data: {...consult, start: '16:00', end: '16:30', title: '학부모 상담', students: [a]}},
    {id: 'c3', ownerUid: 'other', data: {...consult, title: '남의 신입생 상담'}},
    {id: 'c4', ownerUid: 'other', data: {...consult, title: '내 학생 상담', students: [a, b]}},
    {id: 'c5', ownerUid: 't', data: {...consult, status: '취소', title: '취소된 상담'}},
    {id: 'c6', ownerUid: 't', data: {...consult, date: '2026-10-23', title: '내일 상담'}},
  ];
  const data = {uid: 't', admin: false, classes: [], scopes: [{studentKey: a, subject: '영어'}]};
  assert.deepEqual(todayConsults(data, '2026-10-22', schedules).map(c => [c.title, c.start, c.students, c.place]), [
    ['내 학생 상담', '16:00', [a], '학원'], ['학부모 상담', '16:00', [a], '학원'], ['김동하 학생 상담', '21:00', [], '학원'],
  ], 'time order; only students I teach are shown');
  assert.deepEqual(todayLessons(data, '2026-10-22', schedules), [], 'no 일지 to write for a 상담');
});

test('상담 카드 → 신입생 원서: the name from the title, none when it names nobody', () => {
  assert.deepEqual(['김동하 학생 상담', '김동하 상담', '박하늘 학부모 상담 (입학)', '신입생 상담', '상담', '중2 신입생 상담'].map(consultName), ['김동하', '김동하', '박하늘', '', '', '']);
});
