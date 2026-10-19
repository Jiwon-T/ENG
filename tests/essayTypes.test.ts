import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { makeQuestionSet } from '../api/_lib/questionSets.ts';
import { openAttempt, questionSig, saveAttempt, submitAttempt } from '../api/_lib/questionAttempts.ts';
import { editQuestion } from '../api/_lib/questionEdits.ts';
import { AI_BURST, takeAiBurst } from '../api/_lib/aiModel.ts';
import { buildAiQuestion, checkQuestion, correctQuestion, sameWriting } from '../src/lib/questionMaker.ts';
import { splitPassage } from '../src/lib/workbook.ts';
import { SAMPLE_AI } from '../src/lib/samples.ts';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const composeReply = async () => JSON.stringify({ compose: SAMPLE_AI.compose });

test('서술형 어법: five parts ⓐ–ⓔ, two wrong and apart; the answer is letter + right word, fixing gives the passage back', () => {
  const sentences = splitPassage(TEXT);
  let made = 0;
  for (let seed = 1; seed < 8; seed++) {
    const q = correctQuestion(sentences, seeded(seed));
    if (!q) continue;
    made++;
    assert.deepEqual(checkQuestion(q, sentences), []);
    assert.equal((q.passage!.match(/[ⓐ-ⓔ]\{[^}]*\}/g) || []).length, 5);
    const answer = q.answer as string[];
    assert.equal(answer.length, 2);
    assert.ok(answer.every(a => /^[ⓐ-ⓔ] \S/.test(a)) && answer[0] < answer[1], 'letter order');
    assert.equal(q.explanation.split('\n').length, 2);
  }
  assert.ok(made > 0, 'made for this passage');
});

test('서술형 영작: a sentence of the passage, its Korean, 2–3 of its own words and its word count as conditions', () => {
  const sentences = splitPassage(TEXT), idx = sentences.length - 1;
  const q = buildAiQuestion('compose', sentences, { index: idx, ko: '결국 끈기가 잠재력을 실력으로 바꾸는 것이다.', words: ['what', 'turns', 'into'], explanation: 'x' })!;
  assert.ok(q);
  assert.deepEqual(q.answer, [sentences[idx]]);
  assert.equal(q.box, '결국 끈기가 잠재력을 실력으로 바꾸는 것이다.');
  assert.match(q.paragraphs![0].text, /what, turns, into/);
  assert.match(q.paragraphs![1].text, new RegExp(`${sentences[idx].split(' ').length}단어`));
  assert.deepEqual(checkQuestion(q, sentences), []);
  assert.equal(buildAiQuestion('compose', sentences, { index: idx, ko: 'x', words: ['what', 'nothing'] }), null, 'a word not in the sentence');
  assert.equal(buildAiQuestion('compose', sentences, { index: 99, ko: 'x', words: ['what', 'turns'] }), null, 'no such sentence');
  assert.equal(buildAiQuestion('compose', sentences, { index: idx, ko: 'x', words: ['what'] }), null, 'at least two words');
  assert.ok(sameWriting('In the end, persistence is what turns potential into skill.', 'in the end persistence is what turns potential into skill'));
  assert.ok(!sameWriting('', ''), 'an empty answer is never right');
});

async function setup() {
  const f = registrationFirestore(); f.rows.set('users/kid', { name: '김하늘', role: 'student' }); resetWordIndex();
  const kid = await passageActor(f.db, 'kid');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['correct', 'compose'] }, NOW, seeded(2), composeReply);
  return { f, kid, set: made.set };
}

test('서술형 풀기: written answers kept as drafts; the count is shown, never the words', async () => {
  const { f, kid, set } = await setup();
  assert.deepEqual(set.questions.map((q: any) => q.type), ['correct', 'compose']);
  const { attempt }: any = await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  assert.deepEqual([attempt.questions[0].fixes, attempt.questions[1].write], [2, true]);
  assert.ok(!JSON.stringify(attempt.questions).includes(set.questions[1].answer[0]), 'the model sentence is not sent');
  await saveAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ x', ''], 1: ['draft'] } }, NOW + 2);
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 0: ['x', ''] } }, NOW + 3), /BAD_REQUEST/, 'a fix starts with its letter');
  await assert.rejects(saveAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ x'] } }, NOW + 3), /BAD_REQUEST/, 'as many fixes as asked');
  await assert.rejects(submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ x', ''], 1: ['a'] } }, NOW + 4), /ATTEMPT_INCOMPLETE/);
});

test('서술형 채점: 어법 by letter and word (leniently); 영작 right when it is the sentence, else checked once by the AI', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  const fixes = set.questions[0].answer as string[];
  const given = [`${fixes[1][0]} ${fixes[1].slice(2).toUpperCase()}`, `${fixes[0]}.`]; // other order, other case, a full stop
  let asked: any = null;
  const r: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: given, 1: ['At last, persistence is what turns potential into skill.'] } }, NOW + 2,
    async (req: any) => { asked = JSON.parse(req.contents[0].parts[0].text); return JSON.stringify({ checks: [{ id: 'q1', ok: true, reason: '뜻과 조건이 맞아요.' }] }); });
  assert.equal(r.attempt.results[0].ok, true, '어법: both fixes found');
  assert.deepEqual(r.attempt.results[0].pairs.map((p: any) => p.label), fixes.map(x => x[0]));
  assert.equal(r.attempt.results[1].ok, true, '영작: the AI said ok');
  assert.equal(r.attempt.results[1].check.by, 'ai');
  assert.equal(asked.length, 1);
  assert.deepEqual(Object.keys(asked[0]).sort(), ['answer', 'box', 'id', 'ko', 'model']);
  const again: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: given, 1: ['x'] } }, NOW + 3, async () => { throw Error('should not be asked again'); });
  assert.deepEqual(again.attempt.score, r.attempt.score, 'sent again: the same result, no second check');
});

test('서술형 채점: the very sentence needs no check; when the check fails the answer is wrong and says so', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  const exact: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ wrong', 'ⓑ wrong'], 1: [set.questions[1].answer[0].toLowerCase()] } }, NOW + 2, async () => { throw Error('not asked'); });
  assert.deepEqual([exact.attempt.results[0].ok, exact.attempt.results[1].ok, exact.attempt.results[1].check.by], [false, true, 'same']);
  const other = await setup();
  await openAttempt(other.f.db, other.kid, { setId: other.set.id }, NOW + 1);
  const failed: any = await submitAttempt(other.f.db, other.kid, { setId: other.set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Something else entirely.'] } }, NOW + 2, async () => { throw Error('AI down'); });
  assert.deepEqual([failed.attempt.results[1].ok, failed.attempt.results[1].check.by], [false, 'none']);
  assert.match(failed.attempt.results[1].check.reason, /선생님/);
});

test('서술형 채점: no AI call for a submission that cannot be graded; the short-time guard first; an answer already checked is not asked again', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  let calls = 0;
  const ask = async () => { calls++; return JSON.stringify({ checks: [{ id: 'q1', ok: false, reason: '조건을 어겼어요.' }] }); };
  await assert.rejects(submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', ''], 1: ['Another sentence here.'] } }, NOW + 2, ask), /ATTEMPT_INCOMPLETE/);
  assert.equal(calls, 0, 'incomplete: not asked');
  await assert.rejects(submitAttempt(f.db, kid, { setId: 'nope', answers: {} }, NOW + 2, ask), /PASSAGE_NOT_FOUND/);
  for (let k = 0; k < AI_BURST.limit; k++) await takeAiBurst(f.db, 'kid', NOW + 3);
  await assert.rejects(submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } }, NOW + 4, ask), /AI_TOO_FAST/);
  assert.equal(calls, 0, 'too fast: not asked');
  const later = NOW + AI_BURST.windowMs + 10;
  const r: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } }, later, ask);
  assert.deepEqual([calls, r.attempt.results[1].ok, r.attempt.results[1].check.reason], [1, false, '조건을 어겼어요.']);
});

test('서술형 채점: a check kept on the draft is used again (the same answer is not asked twice)', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  const id = [...f.rows.keys()].find(k => k.startsWith('questionAttempts/'))!;
  f.rows.set(id, { ...f.rows.get(id), composeChecks: { 1: { answer: 'Another sentence here.', ok: true, reason: '맞아요.', by: 'ai', sig: questionSig(set.questions[1]) } } });
  const r: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } }, NOW + 2, async () => { throw Error('not asked'); });
  assert.deepEqual([r.attempt.results[1].ok, r.attempt.results[1].check.by], [true, 'ai']);
});

test('서술형 채점: a question fixed since is checked again (the kept verdict was for the old one)', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  const id = [...f.rows.keys()].find(k => k.startsWith('questionAttempts/'))!;
  f.rows.set(id, { ...f.rows.get(id), composeChecks: { 1: { answer: 'Another sentence here.', ok: true, reason: '예전 문항', by: 'ai', sig: questionSig(set.questions[1]) } } });
  await editQuestion(f.db, kid, { setId: set.id, index: 1, question: { prompt: '우리말을 영작하시오.', explanation: '바뀐 해설' } }, NOW + 2);
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 3);
  let calls = 0;
  const r: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } }, NOW + 4,
    async () => { calls++; return JSON.stringify({ checks: [{ id: 'q1', ok: false, reason: '새 문항으로 확인' }] }); });
  assert.deepEqual([calls, r.attempt.results[1].check.reason], [0, '예전 문항'], 'prompt only changed: the verdict still holds (same Korean, conditions, answer)');
  const keep = f.rows.get(id);
  f.rows.set(id, { ...keep, status: 'draft', composeChecks: { 1: { ...keep.composeChecks[1], sig: 'other' } } });
  const again: any = await submitAttempt(f.db, kid, { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } }, NOW + 5,
    async () => { calls++; return JSON.stringify({ checks: [{ id: 'q1', ok: false, reason: '새 문항으로 확인' }] }); });
  assert.deepEqual([calls, again.attempt.results[1].check.reason], [1, '새 문항으로 확인'], 'a different question: asked again');
});

test('서술형 채점: two submissions at the same time ask the AI once; the other is told to press again', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  let calls = 0, release: () => void = () => {};
  const gate = new Promise<void>(r => { release = r; });
  const slow = async () => { calls++; await gate; return JSON.stringify({ checks: [{ id: 'q1', ok: true, reason: '맞아요.' }] }); };
  const body = { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } };
  const first = submitAttempt(f.db, kid, body, NOW + 2, slow);
  await new Promise(r => setTimeout(r, 20));
  await assert.rejects(submitAttempt(f.db, kid, body, NOW + 3, slow), /ATTEMPT_CHECKING/);
  release();
  const r: any = await first;
  assert.deepEqual([calls, r.attempt.results[1].ok], [1, true]);
  const id = [...f.rows.keys()].find(k => k.startsWith('questionAttempts/'))!;
  assert.equal(f.rows.get(id).status, 'submitted');
});

test('서술형 채점: a claim left by a failed check is given back (the next press can ask)', async () => {
  const { f, kid, set } = await setup();
  await openAttempt(f.db, kid, { setId: set.id }, NOW + 1);
  const body = { setId: set.id, answers: { 0: ['ⓐ a', 'ⓑ b'], 1: ['Another sentence here.'] } };
  const r: any = await submitAttempt(f.db, kid, body, NOW + 2, async () => { throw Error('down'); });
  assert.equal(r.attempt.results[1].check.by, 'none');
  const id = [...f.rows.keys()].find(k => k.startsWith('questionAttempts/'))!;
  assert.equal(f.rows.get(id).composeLock ?? null, null, 'no claim left behind');
});
