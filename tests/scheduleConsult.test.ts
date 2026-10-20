import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {publishAppSchedule, saveAppSchedule} from '../api/_lib/appSchedule.js';
import {timetableSheet} from '../src/lib/timetableSheet.js';
import {todayLessons} from '../src/lib/teacherTodayLessons.js';

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
