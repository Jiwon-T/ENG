import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { hashStudentKey } from '../api/_lib/security.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { makeQuestionSet } from '../api/_lib/questionSets.ts';
import { assignQuestionSet } from '../api/_lib/questionAssignments.ts';
import { openAttempt, submitAttempt } from '../api/_lib/questionAttempts.ts';
import { judgeQuestionAttempt, loadStudentQuestionAttempts } from '../api/_lib/teacherQuestionAttempts.ts';
import { initialPetState } from '../api/_lib/pet.ts';
import { SAMPLE_AI } from '../src/lib/samples.ts';

const NOW = Date.parse('2026-10-19T10:00:00Z');
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const K1 = '11111111-1111-4111-8111-111111111111', KX = '44444444-4444-4444-8444-444444444444';

async function setup() {
  const f = registrationFirestore();
  f.rows.set('users/teacher', { name: '이지원', role: 'teacher' }); f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main' });
  f.rows.set(`notionStudentMappings/${hashStudentKey(K1)}`, { studentKey: K1, notionStudentPageId: K1, internalStudentId: 'int-1', studentDisplayName: '김하늘', sourceMode: 'firestore', firebaseUid: 'kid1' });
  f.rows.set('users/kid1', { name: '김하늘', role: 'student', notionStudentKey: K1 });
  f.rows.set('petStates/kid1', initialPetState(NOW));
  const actor = { uid: 'teacher', admin: false, principal: false, academyId: 'main', scopes: [{ studentKey: K1, subject: '영어' }] };
  resetWordIndex();
  const teacher = await passageActor(f.db, 'teacher'), kid = await passageActor(f.db, 'kid1');
  const made: any = await makeQuestionSet(f.db, teacher, { text: TEXT, types: ['order', 'compose'] }, NOW, seeded(), async () => JSON.stringify({ compose: SAMPLE_AI.compose }));
  const asg: any = await assignQuestionSet(f.db, actor, { setId: made.set.id, studentKeys: [K1] }, NOW);
  await openAttempt(f.db, kid, { assignmentId: asg.assignment.id }, NOW + 1);
  // 순서 배열 right, the 영작 written another way and the check failing: 1 of 2
  const r: any = await submitAttempt(f.db, kid, { assignmentId: asg.assignment.id, answers: { 0: made.set.questions[0].answer, 1: ['At last, persistence turns what potential into skill.'] } }, NOW + 2, async () => { throw Error('down'); });
  const row = (await loadStudentQuestionAttempts(f.db, actor, K1)).attempts[0] as any;
  return { f, actor, kid, r, row };
}
const points = (f: any) => f.rows.get('petStates/kid1').points - initialPetState(NOW).points;

test('판정 바꾸기: only 서술형 answers are offered; marking right raises the score and pays the difference once', async () => {
  const { f, actor, r, row } = await setup();
  assert.deepEqual([r.attempt.score.correct, r.attempt.reward.points, points(f)], [1, 7, 7], '5P right + 2P wrong');
  assert.deepEqual(row.results.map((x: any) => Boolean(x.written)), [false, true], 'the 영작 only');
  assert.equal(row.results[1].answer, 'At last, persistence turns what potential into skill.');
  const up: any = await judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: row.id, index: row.results[1].index, ok: true }, NOW + 3);
  assert.deepEqual([up.attempt.score.correct, up.attempt.reward.points, points(f), up.attempt.results[1].judged], [2, 10, 10, true], '+3P (now right)');
  assert.match(f.rows.get(`questionAttempts/${row.id}`).results[1].check.reason, /맞음/);
  const down: any = await judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: row.id, index: row.results[1].index, ok: false }, NOW + 4);
  assert.deepEqual([down.attempt.score.correct, down.attempt.reward.points, points(f)], [1, 10, 10], 'lower: the score drops, the points stay');
  const again: any = await judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: row.id, index: row.results[1].index, ok: true }, NOW + 5);
  assert.deepEqual([again.attempt.score.correct, again.attempt.reward.points, points(f)], [2, 10, 10], 'right again: not paid twice');
  assert.equal(f.rows.get(`questionAttempts/${row.id}`).results[1].check.before.by, 'none', 'the first verdict is kept');
});

test('판정 바꾸기: not a chosen-answer question, not another teacher\'s student, not before 채점', async () => {
  const { f, actor, row } = await setup();
  await assert.rejects(judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: row.id, index: row.results[0].index, ok: false }, NOW), /INVALID_INPUT/);
  await assert.rejects(judgeQuestionAttempt(f.db, { ...actor, scopes: [{ studentKey: KX, subject: '영어' }] }, { studentKey: K1, attemptId: row.id, index: 1, ok: true }, NOW), /FORBIDDEN/);
  await assert.rejects(judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: 'nope', index: 1, ok: true }, NOW), /FORBIDDEN/);
  await assert.rejects(judgeQuestionAttempt(f.db, actor, { studentKey: K1, attemptId: row.id, index: 1, ok: 'yes' }, NOW), /INVALID_INPUT/);
});
