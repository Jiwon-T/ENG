import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';

const NOW = Date.parse('2026-10-21T05:00:00Z');
const actor = (uid: string, more: any = {}) => ({uid, name: uid, role: 'student', staff: false, admin: false, ...more});

test('문제 신고: the set\'s owner or a student it was given to reports a question (once a person a question); the admin lists the open ones with the share reported and closes them', async () => {
  const {reportQuestion, listQuestionReports, closeQuestionReport} = await import('../api/_lib/questionReports.js');
  const f = registrationFirestore();
  const questions = [{type: 'blank', label: '빈칸 추론', prompt: '빈칸에 알맞은 것은?'}, {type: 'order', label: '순서 배열', prompt: '순서는?'}];
  f.rows.set('questionSets/s1', {id: 's1', uid: 't1', title: '9모 20번', questions});
  f.rows.set('questionAssignments/g1', {id: 'g1', setId: 's1', teacherUid: 't1', title: '9모 20번', questions, uids: ['kid']});
  f.rows.set('questionAssignments/g2', {id: 'g2', setId: 's1', teacherUid: 't1', title: '9모 20번 (2반)', questions, uids: ['kid']});
  const teacher = actor('t1', {role: 'teacher', staff: true});
  await reportQuestion(f.db, teacher, {setId: 's1', index: 0, reason: 'answer', note: '2번도 답'}, NOW);
  await reportQuestion(f.db, teacher, {setId: 's1', index: 0, reason: 'explanation'}, NOW + 1);
  await reportQuestion(f.db, actor('kid'), {assignmentId: 'g1', index: 1, reason: 'answer'}, NOW + 2);
  await reportQuestion(f.db, actor('kid'), {assignmentId: 'g2', index: 1, reason: 'question'}, NOW + 3); // the same question in another task: the same report
  await assert.rejects(reportQuestion(f.db, actor('other'), {setId: 's1', index: 0, reason: 'answer'}, NOW), /FORBIDDEN/, 'someone else\'s set');
  await assert.rejects(reportQuestion(f.db, actor('other'), {assignmentId: 'g1', index: 0, reason: 'answer'}, NOW), /FORBIDDEN/, 'not given to them');
  await assert.rejects(reportQuestion(f.db, teacher, {setId: 's1', index: 0, reason: 'nope'}, NOW), /BAD_REQUEST/);
  await assert.rejects(listQuestionReports(f.db, teacher), /FORBIDDEN/);
  const admin = actor('boss', {admin: true, role: 'admin', staff: true});
  const list: any = await listQuestionReports(f.db, admin);
  assert.deepEqual(list.reports.map((r: any) => [r.index, r.reason, r.role]), [[1, 'question', 'student'], [0, 'explanation', 'teacher']], 'asking again changes the report; newest first');
  assert.deepEqual([list.made, list.reported, list.rate], [2, 2, 100]);
  await closeQuestionReport(f.db, admin, {id: list.reports[0].id, status: 'ok'}, NOW);
  assert.equal(((await listQuestionReports(f.db, admin)) as any).reports.length, 1, 'closed ones leave the list');
});
