import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { makeQuestionSet } from '../api/_lib/questionSets.ts';
import { ATTEMPT_SESSION, attemptId, openAttempt, saveAttempt, submitAttempt, touchSessions } from '../api/_lib/questionAttempts.ts';

const NOW = Date.parse('2026-10-18T10:00:00Z');
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

async function setup() {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' }); f.rows.set('users/kid2', { name: '박서준', role: 'student' });
  resetWordIndex();
  const kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['order', 'insert', 'choice'] }, NOW, seeded());
  return { f, kid, kid2, set: made.set };
}
/** The right answers of a set (as the server knows them), to answer like a student who knows. */
const rightAnswers = (set: any) => Object.fromEntries(set.questions.map((q: any, i: number) => [String(i), q.answer]));

test('변형 문제 풀기: open makes a draft with no answers or explanations shown; only one’s own set', async () => {
  const { f, kid, kid2, set } = await setup();
  const { attempt }: any = await openAttempt(f.db, kid, { setId: set.id }, NOW);
  assert.equal(attempt.status, 'draft');
  assert.equal(attempt.questions.length, 3);
  const shown = JSON.stringify(attempt.questions);
  assert.ok(!/"answer"|"explanation"|"fix"/.test(shown), 'no answer key before grading');
  assert.equal(attempt.questions[2].pairs, set.questions[2].answer.length);
  await assert.rejects(openAttempt(f.db, kid2, { setId: set.id }, NOW), /FORBIDDEN/);
  const row = f.rows.get(`questionAttempts/${attemptId('kid', set.id)}`);
  assert.deepEqual([row.uid, row.kind, row.sessions.length], ['kid', 'self', 1]);
});

test('변형 문제 풀기: answers saved on the server and checked; visits logged by server time (30 minutes apart = a new one)', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW);
  await saveAttempt(f.db, kid, { setId: set.id, answers: { 0: 3 } }, NOW + 60_000);
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 0: 9 } }, NOW), /BAD_REQUEST/, 'a choice that does not exist');
  const pairs = set.questions[2].answer.length;
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 2: Array(pairs).fill('zzz') } }, NOW), /BAD_REQUEST/, 'a word that is not in the pair');
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 7: 1 } }, NOW), /BAD_REQUEST/, 'no such question');
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 60_000 + ATTEMPT_SESSION.gapMs + 1);
  const row = f.rows.get(`questionAttempts/${attemptId('kid', set.id)}`);
  assert.deepEqual(row.answers, { 0: 3 });
  assert.deepEqual(row.sessions.map((s: any) => [s.start - NOW, s.end - NOW]), [[0, 60_000], [60_000 + ATTEMPT_SESSION.gapMs + 1, 60_000 + ATTEMPT_SESSION.gapMs + 1]]);
  // reopening shows the saved answers
  assert.deepEqual(((await openAttempt(f.db, kid, { setId: set.id }, NOW + 4e6)) as any).attempt.answers, { 0: 3 });
});

test('변형 문제 풀기: visits kept up to 100, older ones folded into a count and a total', () => {
  let s: any = { sessions: [], folded: { count: 0, ms: 0 } };
  for (let i = 0; i < ATTEMPT_SESSION.keep + 5; i++) s = touchSessions(s.sessions, s.folded, NOW + i * (ATTEMPT_SESSION.gapMs + 1000));
  assert.deepEqual([s.sessions.length, s.folded.count], [ATTEMPT_SESSION.keep, 5]);
  const back = touchSessions([{ start: NOW, end: NOW + 1000 }], { count: 0, ms: 0 }, NOW + 500);
  assert.equal(back.sessions.length, 2, 'a time before the last save (a clock gone back) starts a new visit, never a negative one');
});

test('변형 문제 풀기: 채점 once by the server; all answers needed; resent = the same result; no saving after', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW);
  await assert.rejects(submitAttempt(f.db, kid, { setId: set.id, answers: { 0: 1 } }, NOW), /ATTEMPT_INCOMPLETE/);
  const answers: any = rightAnswers(set);
  answers['0'] = (set.questions[0].answer % 5) + 1; // one wrong
  const first: any = (await submitAttempt(f.db, kid, { setId: set.id, answers }, NOW + 5000)).attempt;
  assert.deepEqual([first.status, first.score], ['submitted', { correct: 2, total: 3 }]);
  assert.equal(first.results[0].ok, false);
  assert.ok(first.results.every((r: any) => r.explanation), 'explanations right after grading');
  assert.equal(first.results[2].pairs.length, set.questions[2].answer.length);
  const again: any = (await submitAttempt(f.db, kid, { setId: set.id, answers: rightAnswers(set) }, NOW + 9000)).attempt;
  assert.deepEqual([again.score, again.submittedAt], [{ correct: 2, total: 3 }, NOW + 5000], 'resent: the first result, not new answers');
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 0: 1 } }, NOW), /ATTEMPT_SUBMITTED/);
  const row = f.rows.get(`questionAttempts/${attemptId('kid', set.id)}`);
  assert.deepEqual([row.gradingVersion, row.questions.length, row.setVersion], [1, 3, set.createdAt], 'the questions graded are kept with the result');
  // a submitted set opens on its result
  assert.equal(((await openAttempt(f.db, kid, { setId: set.id }, NOW + 1e7)) as any).attempt.score.correct, 2);
});
