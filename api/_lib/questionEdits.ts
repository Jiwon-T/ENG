// 변형 문제 › 문제 하나 다시 만들기 · 고치기 (the set's owner only). 다시 만들기 makes the same type again from the set's
// passage: app-made types cost nothing, AI-helped ones count once against the monthly 'generator' limit (given back if
// nothing is made). 고치기 changes the words a teacher may fix — the question, the explanation, and for the choice types
// the five choices and the answer — and the app checks the result against the passage as for a made one. A changed
// question gets the set's new version as its `rev`, so an unfinished try drops its answer to that question (only);
// sets already given to students are snapshots and stay as they were.
import { AI_TYPES, CIRCLED, OPTION_EDIT_TYPES, checkQuestion, makeAppQuestions, buildAiQuestion, type AiQuestionType, type AppQuestionType, type MadeQuestion } from '../../src/lib/questionMaker.js';
import { aiErrorCode, guardAiBurst, refundMonthlyQuota, takeMonthlyQuota } from './aiModel.js';
import { aiQuestionsRequest } from './questionAi.js';
import { PASSAGES, PASSAGE_MESSAGES, type PassageActor } from './passage.js';
import { QUESTION_SETS } from './questionSets.js';

const clip = (v: any, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const same = (x: MadeQuestion, y: MadeQuestion) => JSON.stringify([x.passage, x.box, x.paragraphs, x.options, x.answer]) === JSON.stringify([y.passage, y.box, y.paragraphs, y.options, y.answer]);

async function ownSet(db: any, a: PassageActor, input: any) {
  const ref = db.collection(QUESTION_SETS).doc(clip(input?.setId, 64)), snap = await ref.get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const set = snap.data(), index = Number(input?.index);
  if (set.uid !== a.uid) throw Error('FORBIDDEN');
  const q = set.questions?.[index] as MadeQuestion | undefined;
  if (!Number.isInteger(index) || !q || q.type === 'workbook') throw Error('BAD_REQUEST');
  return { ref, set, index, q };
}
/** Put one question in place, in a transaction: the question must still be the one this was made from. */
async function replace(db: any, ref: any, a: PassageActor, index: number, before: MadeQuestion, next: MadeQuestion, now: number) {
  return db.runTransaction(async (tx: any) => {
    const cur = (await tx.get(ref)).data();
    if (!cur || cur.uid !== a.uid) throw Error('FORBIDDEN');
    if (JSON.stringify(cur.questions?.[index]) !== JSON.stringify(before)) throw Error('QUESTIONS_CHANGED');
    const version = Math.max(now, Number(cur.version || cur.createdAt || 0) + 1), questions = [...cur.questions];
    questions[index] = { ...next, rev: version };
    const out = { ...cur, questions, version, updatedAt: now };
    tx.set(ref, out);
    return out;
  });
}
const setView = (s: any) => ({ id: s.id, title: s.title, passageId: s.passageId || null, text: s.text, types: s.types, questions: s.questions, createdAt: s.createdAt, updatedAt: s.updatedAt || s.createdAt, ...(s.kind === 'bundle' ? { kind: 'bundle', sources: s.sources || [] } : {}) });

/** 다시 만들기: the same type again from the set's passage (not in a 합본, whose questions come from several passages). */
export async function redoQuestion(db: any, a: PassageActor, input: any, now = Date.now(), rand: () => number = Math.random, generate?: (request: any) => Promise<string>) {
  const { ref, set, index, q } = await ownSet(db, a, input);
  if (set.kind === 'bundle') throw Error('QUESTIONS_REDO_BUNDLE');
  const text = String(set.text || '');
  if (!AI_TYPES.includes(q.type as AiQuestionType)) {
    // app-made: a few tries for one that differs from the question there now
    for (let k = 0; k < 6; k++) {
      const made = makeAppQuestions(text, [q.type as AppQuestionType], rand).questions[0];
      if (made && !same(made, q)) return { set: setView(await replace(db, ref, a, index, q, made, now)), left: null };
    }
    throw Error('QUESTIONS_REDO_SAME');
  }
  if (!generate) throw Error('AI_FAILED');
  if (!a.admin) await guardAiBurst(db, a.uid, now);
  let left: number | null = null;
  if (!a.admin) { left = await takeMonthlyQuota(db, a.uid, 'generator', now); if (left < 0) { const e: any = Error('AI_MONTHLY_LIMIT'); e.feature = 'generator'; throw e; } }
  const giveBack = () => a.admin ? undefined : refundMonthlyQuota(db, a.uid, 'generator', now).catch(() => undefined);
  try {
    const sentences = makeAppQuestions(text, []).sentences;
    const stored = set.passageId ? (await db.collection(PASSAGES).doc(set.passageId).get()).data()?.parts?.summary || null : null;
    const reply = await generate(aiQuestionsRequest([q.type as AiQuestionType], sentences.join(' '), stored)).catch((error: any) => { throw Error(aiErrorCode(error)); });
    let data: any; try { data = JSON.parse(reply); } catch { throw Error('PASSAGE_AI_MISMATCH'); }
    const made = buildAiQuestion(q.type as AiQuestionType, sentences, data?.[q.type], rand);
    if (!made || checkQuestion(made, sentences).length) throw Error('QUESTIONS_REDO_SAME');
    return { set: setView(await replace(db, ref, a, index, q, made, now)), left };
  } catch (error: any) {
    await giveBack();
    throw Error(PASSAGE_MESSAGES[error?.message] ? error.message : 'AI_FAILED');
  }
}

/** 고치기: the question and the explanation; for the choice types also the five choices and the answer. Checked against
 *  the passage (a 합본 question: its choices and answer only, as the passage it came from is not kept with it). */
export async function editQuestion(db: any, a: PassageActor, input: any, now = Date.now()) {
  const { ref, set, index, q } = await ownSet(db, a, input), x = input?.question || {};
  const next: MadeQuestion = { ...q, prompt: clip(x.prompt, 300) || q.prompt, explanation: String(x.explanation ?? q.explanation).trim().slice(0, 1200) };
  delete (next as any).rev;
  if (OPTION_EDIT_TYPES.includes(q.type) && (x.options !== undefined || x.answer !== undefined)) {
    const options = (Array.isArray(x.options) ? x.options : []).map((o: unknown) => clip(o, 200)), answer = Number(x.answer);
    if (options.length !== 5 || options.some((o: string) => !o) || !Number.isInteger(answer) || answer < 1 || answer > 5) throw Error('QUESTIONS_EDIT_BAD');
    next.options = options; next.answer = answer;
    if (q.type === 'blank') next.fix = options[answer - 1]; // the right phrase must still fill the blank
  }
  const issues = set.kind === 'bundle'
    ? (next.options && new Set(next.options.map(o => o.toLowerCase())).size !== 5 ? ['보기 다섯 개가 서로 달라야 해요'] : [])
    : checkQuestion(next, makeAppQuestions(String(set.text || ''), []).sentences);
  if (issues.length) { const e: any = Error('QUESTIONS_EDIT_CHECK'); e.detail = issues[0]; throw e; }
  if (JSON.stringify({ ...q, rev: undefined }) === JSON.stringify({ ...next, rev: undefined })) return { set: setView(set), changed: false };
  return { set: setView(await replace(db, ref, a, index, q, next, now)), changed: true };
}
/** The answer as a teacher reads it (for the 고치기 form and messages). */
export const answerMark = (q: MadeQuestion) => typeof q.answer === 'number' ? CIRCLED[q.answer - 1] : '';
