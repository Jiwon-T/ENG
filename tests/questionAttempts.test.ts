import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { bundleQuestionSets, makeQuestionSet } from '../api/_lib/questionSets.ts';
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

test('더 만들기: new questions go after the set’s own (1–3 then 4–…), one 만들기 each; owner only; an unfinished try keeps its answers', async () => {
  const { f, kid, kid2, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW);
  await saveAttempt(f.db, kid, { setId: set.id, answers: { 0: 2 } }, NOW + 1000);
  const more: any = await makeQuestionSet(f.db, kid, { appendTo: set.id, types: ['grammar'] }, NOW + 2000, seeded(5));
  assert.equal(more.set.id, set.id, 'the same set');
  assert.deepEqual([more.set.questions.length, more.added, more.set.questions.slice(0, 3).map((q: any) => q.type)], [4, 1, ['order', 'insert', 'choice']]);
  assert.equal(more.set.questions[3].type, 'grammar');
  assert.equal(f.rows.get('aiMonthly/kid_2026-10').generator, 2, 'each 만들기 counts');
  await assert.rejects(makeQuestionSet(f.db, kid2, { appendTo: set.id, types: ['order'] }, NOW), /FORBIDDEN/);
  const reopened: any = (await openAttempt(f.db, kid, { setId: set.id }, NOW + 3000)).attempt;
  assert.deepEqual([reopened.questions.length, reopened.answers], [4, { 0: 2 }], 'the try moved to the grown set, answers kept');
  // a full set takes no more
  const row = f.rows.get(`questionSets/${set.id}`);
  f.rows.set(`questionSets/${set.id}`, { ...row, questions: Array.from({ length: 30 }, () => row.questions[0]) });
  await assert.rejects(makeQuestionSet(f.db, kid, { appendTo: set.id, types: ['order'] }, NOW), /QUESTIONS_SET_FULL/);
});

test('합본: picked sets saved as one new set (questions in order, nothing counted); originals kept; mine only; 더 만들기 from one of its passages', async () => {
  const { f, kid, kid2, set } = await setup();
  const second: any = (await makeQuestionSet(f.db, kid, { text: TEXT, types: ['grammar'] }, NOW + 10, seeded(7))).set;
  const month = f.rows.get('aiMonthly/kid_2026-10').generator;
  const b: any = (await bundleQuestionSets(f.db, kid, { ids: [set.id, second.id] }, NOW + 20)).set;
  assert.deepEqual([b.kind, b.questions.length, b.questions.map((q: any) => q.type), b.sources.map((x: any) => x.count)], ['bundle', 4, ['order', 'insert', 'choice', 'grammar'], [3, 1]]);
  assert.match(b.title, / 외 1세트$/);
  assert.equal(f.rows.get('aiMonthly/kid_2026-10').generator, month, 'nothing counted');
  assert.ok(f.rows.get(`questionSets/${set.id}`) && f.rows.get(`questionSets/${second.id}`), 'the originals stay');
  await assert.rejects(bundleQuestionSets(f.db, kid2, { ids: [set.id, second.id] }, NOW), /FORBIDDEN/);
  await assert.rejects(bundleQuestionSets(f.db, kid, { ids: [set.id] }, NOW), /QUESTIONS_BUNDLE_PICK/);
  await assert.rejects(makeQuestionSet(f.db, kid, { appendTo: b.id, types: ['order'] }, NOW), /QUESTIONS_BUNDLE_NO_MORE/, 'a bundle needs the passage to add from');
  const grown: any = await makeQuestionSet(f.db, kid, { appendTo: b.id, fromSet: second.id, types: ['order'] }, NOW + 25, seeded(9));
  assert.deepEqual([grown.set.id, grown.added, grown.set.questions.length, grown.set.questions[4].type], [b.id, 1, 5, 'order'], '더 만들기 from one of its passages');
  await assert.rejects(makeQuestionSet(f.db, kid, { appendTo: b.id, fromSet: 'not-in-it', types: ['order'] }, NOW), /QUESTIONS_BUNDLE_NO_MORE/);
  // solved like any set
  assert.equal(((await openAttempt(f.db, kid, { setId: b.id }, NOW + 30)) as any).attempt.questions.length, 5);
});

test('제출 중 더 만들기: a set grown between reading it and grading is not graded on the old count (open it again)', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW);
  const row = f.rows.get(`questionSets/${set.id}`);
  const racing: any = { ...f.db, runTransaction: (fn: any) => { f.rows.set(`questionSets/${set.id}`, { ...row, questions: [...row.questions, row.questions[0]], version: NOW + 1 }); return f.db.runTransaction(fn); } };
  await assert.rejects(submitAttempt(racing, kid, { setId: set.id, answers: rightAnswers(set) }, NOW + 1000), /ATTEMPT_STALE/);
  assert.equal(f.rows.get(`questionAttempts/${attemptId('kid', set.id)}`).status, 'draft');
});
