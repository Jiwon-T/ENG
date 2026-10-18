// 변형 문제 만들기: question sets made from a passage (pasted, or one from the 지문 보관함) and kept for the person who made
// them. App-made types (순서 배열·문장 삽입·어법 수정·어법 선택) need no AI; AI-helped types take one AI call
// for all of them, and the app builds and checks each one. Every 만들기 counts once a month against the 'generator' limit
// (the admin has none) — one count whether it asks the AI or not (no separate daily AI use). Nothing is counted when no
// question was made.
import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { AI_TYPES, APP_TYPES, MAX_TYPES, QUESTION_TYPES, buildAiQuestion, checkQuestion, makeAppQuestions, reviewApproved, reviewCandidates, reviewPassage } from '../../src/lib/questionMaker.js';
import { PASSAGE_LIMITS } from '../../src/lib/passageTools.js';
import { aiErrorCode, guardAiBurst, refundMonthlyQuota, takeMonthlyQuota } from './aiModel.js';
import { aiQuestionsRequest } from './questionAi.js';
import { PASSAGES, PASSAGE_MESSAGES, canSeePassage, type PassageActor } from './passage.js';

export const QUESTION_SETS = 'questionSets';
const clip = (v: any, n: number) => String(v ?? '').trim().slice(0, n);
const view = (s: any) => ({ id: s.id, title: s.title, passageId: s.passageId || null, text: s.text, types: s.types, questions: s.questions, createdAt: s.createdAt });

export async function makeQuestionSet(db: any, a: PassageActor, input: any, now = Date.now(), rand: () => number = Math.random, generate?: (request: any) => Promise<string>) {
  const asked = [...new Set((Array.isArray(input?.types) ? input.types : []).map(String))] as string[];
  // in the usual order (app-made first), whatever order they were picked in
  const appTypes = APP_TYPES.filter(t => asked.includes(t)), aiTypes = AI_TYPES.filter(t => asked.includes(t));
  if (!appTypes.length && !aiTypes.length) throw Error('QUESTIONS_NO_TYPE');
  if (appTypes.length + aiTypes.length > MAX_TYPES) throw Error('QUESTIONS_TOO_MANY');
  const types = [...appTypes, ...aiTypes];
  let text = '', passageId: string | null = null, title = '', stored: any = null;
  if (input?.passageId) {
    const snap = await db.collection(PASSAGES).doc(clip(input.passageId, 64)).get();
    if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
    const d = { ...snap.data(), id: snap.id };
    if (!(await canSeePassage(db, a, d))) throw Error('FORBIDDEN');
    text = String(d.text || (d.sentences || []).join(' ')); passageId = d.id; title = String(d.title || ''); stored = d.parts?.summary || null;
  } else text = String(input?.text || '').replace(/\r\n?/g, '\n').trim();
  if (!text || !/[A-Za-z]/.test(text)) throw Error('PASSAGE_EMPTY');
  if (text.length > PASSAGE_LIMITS.textChars) throw Error('PASSAGE_TOO_LONG');
  let made = makeAppQuestions(text, appTypes, rand);
  const sentences = made.sentences;
  if (sentences.length > PASSAGE_LIMITS.sentences) throw Error('PASSAGE_TOO_LONG');
  // 어법 places that need the context go to the AI for a yes/no in the same call (none when it can't be asked).
  // Only for an 어법 type this passage is long enough for (no AI use for one that can't be made anyway).
  const grammarTypes = appTypes.filter(t => (t === 'grammar' || t === 'choice') && sentences.length >= QUESTION_TYPES.find(x => x.id === t)!.minSentences);
  const review = generate && grammarTypes.length ? reviewCandidates(sentences, rand) : [];
  const skipped: { type: string; reason: string }[] = [];
  const aiReady = aiTypes.filter(type => {
    const min = QUESTION_TYPES.find(t => t.id === type)!.minSentences;
    if (sentences.length < min) skipped.push({ type, reason: `${min}문장 이상인 지문만 만들 수 있어요` });
    return sentences.length >= min;
  });
  if (!made.questions.length && !aiReady.length && !review.length) return { set: null, skipped: [...made.skipped, ...skipped], left: null };
  let left: number | null = null;
  // The short-time guard comes first when the AI will be asked (too fast: nothing counted).
  if (!a.admin && generate && (aiReady.length || review.length)) await guardAiBurst(db, a.uid, now);
  if (!a.admin) { left = await takeMonthlyQuota(db, a.uid, 'generator', now); if (left < 0) { const e: any = Error('AI_MONTHLY_LIMIT'); e.feature = 'generator'; throw e; } }
  const giveBack = () => a.admin ? undefined : refundMonthlyQuota(db, a.uid, 'generator', now).catch(() => undefined);
  // The AI: one call for the AI-helped types and the 어법 review. If it can't be asked or fails, the app-made questions are
  // still kept (the AI types are reported as not made, 어법 uses the sure rules only); with nothing else made, the error
  // is shown and the count comes back.
  let data: any = null, failure = '';
  if (aiReady.length || review.length) {
    try {
      if (!generate) throw Error('AI_FAILED');
      // With a review, the AI gets the passage with those places masked; the AI types are built and checked against the real one.
      const reply = await generate(aiQuestionsRequest(aiReady, review.length ? reviewPassage(sentences, review) : sentences.join(' '), stored, review.map(r => ({ id: r.id, sentence: r.sentence })))).catch((error: any) => { throw Error(aiErrorCode(error)); });
      try { data = JSON.parse(reply); } catch { throw Error('PASSAGE_AI_MISMATCH'); }
    } catch (error: any) { failure = PASSAGE_MESSAGES[error?.message] ? error.message : 'AI_FAILED'; }
    // Only the 어법 questions are made again with the approved places; the others stay as they were.
    const approved = reviewApproved(review, data?.review);
    if (approved.length) {
      const redo = makeAppQuestions(text, grammarTypes, rand, approved), keep = (x: { type: string }) => !grammarTypes.includes(x.type as any), order = (x: { type: string }) => QUESTION_TYPES.findIndex(t => t.id === x.type);
      made = { sentences, questions: [...made.questions.filter(keep), ...redo.questions].sort((x, y) => order(x) - order(y)), skipped: [...made.skipped.filter(keep), ...redo.skipped] };
    }
  }
  const questions = [...made.questions];
  skipped.unshift(...made.skipped);
  if (aiReady.length) {
    if (failure && !questions.length) { await giveBack(); throw Error(failure); }
    for (const type of aiReady) {
      const q = data ? buildAiQuestion(type, sentences, data[type], rand) : null, issues = q ? checkQuestion(q, sentences) : [failure ? '지금은 만들지 못했어요. 다시 해 주세요' : '이 지문으로는 알맞은 문제를 만들지 못했어요'];
      if (!q || issues.length) skipped.push({ type, reason: issues[0] }); else questions.push(q);
    }
  }
  if (!questions.length) { await giveBack(); return { set: null, skipped, left: null }; }
  // Ids sort newest first ('n' + a reversed time + a random part), after any older uuid ids (0-9, a-f), so 내가 만든 문제
  // needs no extra index.
  const set = { id: `n${String(9_999_999_999_999 - now).padStart(13, '0')}_${randomUUID().slice(0, 8)}`, uid: a.uid, passageId, title: title || sentences[0].slice(0, 60), text, types, questions, createdAt: now };
  try { await db.collection(QUESTION_SETS).doc(set.id).set(set); }
  catch (error) { await giveBack(); throw error; } // not saved: the count comes back
  return { set: view(set), skipped, left };
}

/** My question sets, the newest 30. Ids in order: any sets saved with a uuid id first (they all sort before 'n'), then
 *  the newer ones newest first; reading a margin past 30 and sorting by time puts both kinds in their place. */
export async function listQuestionSets(db: any, a: PassageActor) {
  const snap = await db.collection(QUESTION_SETS).where('uid', '==', a.uid).orderBy(FieldPath.documentId()).limit(230).get();
  // canAssign: a teacher may give their sets to students (변형 문제 내주기, through the teacher workspace).
  return { canAssign: a.staff, sets: snap.docs.map((d: any) => d.data()).sort((x: any, y: any) => y.createdAt - x.createdAt).slice(0, 30).map((s: any) => ({ id: s.id, title: s.title, types: s.types, count: s.questions?.length || 0, createdAt: s.createdAt })) };
}
export async function readQuestionSet(db: any, a: PassageActor, id: unknown) {
  const snap = await db.collection(QUESTION_SETS).doc(clip(id, 64)).get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const s = snap.data();
  if (s.uid !== a.uid && !a.admin) throw Error('FORBIDDEN');
  return { set: view(s) };
}
