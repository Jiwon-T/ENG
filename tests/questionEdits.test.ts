import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { bundleQuestionSets, makeQuestionSet } from '../api/_lib/questionSets.ts';
import { editQuestion, redoQuestion } from '../api/_lib/questionEdits.ts';
import { openAttempt, saveAttempt } from '../api/_lib/questionAttempts.ts';
import { SAMPLE_AI } from '../src/lib/samples.ts';

const NOW = Date.parse('2026-10-19T10:00:00Z'), month = '2026-10';
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const titleReply = async () => JSON.stringify({ title: SAMPLE_AI.title });

async function setup() {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' }); f.rows.set('users/kid2', { name: '박서준', role: 'student' });
  resetWordIndex();
  const kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['order', 'grammar', 'title'] }, NOW, seeded(), titleReply);
  return { f, kid, kid2, set: made.set };
}

test('다시 만들기: an app type again for free (a different one), an AI type counts once; owner only, not in a 합본', async () => {
  const { f, kid, kid2, set } = await setup();
  assert.deepEqual(set.questions.map((q: any) => q.type), ['order', 'grammar', 'title']);
  const used = () => f.rows.get(`aiMonthly/kid_${month}`)?.generator || 0, before = used();
  const r1: any = await redoQuestion(f.db, kid, { setId: set.id, index: 1 }, NOW + 1, seeded(9));
  assert.equal(r1.set.questions[1].type, 'grammar');
  assert.notEqual(r1.set.questions[1].passage, set.questions[1].passage, 'a different question');
  assert.equal(used(), before, 'an app type: nothing counted');
  assert.ok(r1.set.questions[1].rev > 0 && !r1.set.questions[0].rev, 'only the changed question gets a rev');
  let asked: any = null;
  const r2: any = await redoQuestion(f.db, kid, { setId: set.id, index: 2 }, NOW + 2, seeded(4), async (req: any) => { asked = req; return titleReply(); });
  assert.equal(r2.set.questions[2].type, 'title');
  assert.deepEqual(Object.keys(asked.config.responseSchema.properties), ['title'], 'only that type asked');
  assert.equal(used(), before + 1, 'an AI type: counted once');
  await assert.rejects(redoQuestion(f.db, kid, { setId: set.id, index: 2 }, NOW + 3, seeded(), async () => 'not json'), /PASSAGE_AI_MISMATCH/);
  assert.equal(used(), before + 1, 'a failed one is given back');
  await assert.rejects(redoQuestion(f.db, kid2, { setId: set.id, index: 0 }, NOW), /FORBIDDEN/);
  await assert.rejects(redoQuestion(f.db, kid, { setId: set.id, index: 9 }, NOW), /BAD_REQUEST/);
  const other: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['insert'] }, NOW + 4, seeded(2));
  const bundle: any = await bundleQuestionSets(f.db, kid, { ids: [set.id, other.set.id] }, NOW + 5);
  await assert.rejects(redoQuestion(f.db, kid, { setId: bundle.set.id, index: 0 }, NOW + 6, seeded()), /QUESTIONS_REDO_BUNDLE/);
});

test('고치기: words and the explanation for any type; choices and answer for choice types, checked against the passage', async () => {
  const { f, kid, set } = await setup();
  const order: any = await editQuestion(f.db, kid, { setId: set.id, index: 0, question: { prompt: '글의 순서로 알맞은 것은?', explanation: '연결어를 보세요.', options: ['a', 'b', 'c', 'd', 'e'], answer: 1 } }, NOW + 1);
  assert.deepEqual([order.set.questions[0].prompt, order.set.questions[0].explanation, order.set.questions[0].answer], ['글의 순서로 알맞은 것은?', '연결어를 보세요.', set.questions[0].answer], 'order: choices and answer stay the app ones');
  const t = set.questions[2], options = [...t.options]; options[(t.answer % 5)] = 'A Completely New Wrong Title';
  const title: any = await editQuestion(f.db, kid, { setId: set.id, index: 2, question: { prompt: t.prompt, explanation: t.explanation, options, answer: t.answer } }, NOW + 2);
  assert.equal(title.set.questions[2].options[t.answer % 5], 'A Completely New Wrong Title');
  const dup = [...options]; dup[(t.answer + 1) % 5] = dup[(t.answer) % 5];
  await assert.rejects(editQuestion(f.db, kid, { setId: set.id, index: 2, question: { options: dup, answer: t.answer } }, NOW + 3), (e: any) => e.message === 'QUESTIONS_EDIT_CHECK' && /서로 달라야/.test(e.detail));
  await assert.rejects(editQuestion(f.db, kid, { setId: set.id, index: 2, question: { options: options.slice(0, 4), answer: 1 } }, NOW + 3), /QUESTIONS_EDIT_BAD/);
  const same: any = await editQuestion(f.db, kid, { setId: set.id, index: 1, question: { prompt: set.questions[1].prompt, explanation: set.questions[1].explanation } }, NOW + 4);
  assert.equal(same.changed, false, 'nothing changed: nothing saved');
});

test('고치기 · 빈칸: the right choice must still fill the blank', async () => {
  const f = registrationFirestore(); f.rows.set('users/kid', { name: '김하늘', role: 'student' }); resetWordIndex();
  const kid = await passageActor(f.db, 'kid');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['blank'] }, NOW, seeded(), async () => JSON.stringify({ blank: SAMPLE_AI.blank }));
  const q = made.set.questions[0], options = [...q.options];
  options[q.answer - 1] = 'practice never matters at all';
  await assert.rejects(editQuestion(f.db, kid, { setId: made.set.id, index: 0, question: { options, answer: q.answer } }, NOW + 1), /QUESTIONS_EDIT_CHECK/);
});

test('an unfinished try loses only the answer to a question made again or fixed since', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  await saveAttempt(f.db, kid, { setId: set.id, answers: { 0: 1, 1: 2, 2: 3 } }, NOW + 2);
  await redoQuestion(f.db, kid, { setId: set.id, index: 1 }, NOW + 3, seeded(9));
  const { attempt }: any = await openAttempt(f.db, kid, { setId: set.id }, NOW + 4);
  assert.deepEqual(attempt.answers, { 0: 1, 2: 3 });
});
