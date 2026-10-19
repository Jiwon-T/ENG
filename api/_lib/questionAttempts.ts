// 변형 문제 풀기: a student solves a question set on screen. Draft answers are kept on the server with each visit logged
// (풀이 기록 시간), one submission per set, graded by the server, answers and explanations shown right after. Results
// live in questionAttempts (server only; never in studySessions, which the pet's word feed and study rewards read).
// A person's own sets, and sets a teacher gave (questionAssignments; points when graded). The attempt id is fixed per
// person and set or assignment, so a resent submission returns the result already recorded instead of a second one.
import { createHash, randomUUID } from 'node:crypto';
import { CIRCLED, LETTERS5, sameWriting, typeLabel, type MadeQuestion } from '../../src/lib/questionMaker.js';
import { aiErrorCode, guardAiBurst } from './aiModel.js';
import { QUESTION_SETS } from './questionSets.js';
import { QUESTION_ASSIGNMENTS } from './questionAssignments.js';
import { PET_STATES, awardCapped, petSummary, rollDay, type ServerPetState } from './pet.js';
import type { PassageActor } from './passage.js';

export const QUESTION_ATTEMPTS = 'questionAttempts';
/** 2: 서술형 (written answers; 조건 영작 checked by the AI when not the passage's sentence word for word). */
export const GRADING_VERSION = 2;
/** A visit ends after this long without a save; the next save starts a new one. At most this many visits are kept (older
 *  ones are folded into a count and a total). */
export const ATTEMPT_SESSION = { gapMs: 30 * 60_000, keep: 100 };
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const PAIRS = /[ⓐ-ⓛ]\[([^\]/]+) \/ ([^\]]+)\]/g;

export const attemptId = (uid: string, setId: string) => createHash('sha256').update(`set:${uid}:${setId}`).digest('hex').slice(0, 32);
/** The pairs of a 어법 선택 question, in order. */
const pairsOf = (q: MadeQuestion) => [...String(q.passage || '').matchAll(PAIRS)].map(m => [m[1], m[2]]);
/** What a student sees before grading: no answer, explanation or fix. */
export function solveView(q: MadeQuestion, index: number) {
  return { index, type: q.type, label: typeLabel(q.type), prompt: q.prompt, box: q.box, passage: q.passage, paragraphs: q.paragraphs, options: q.options, pairs: q.type === 'choice' ? pairsOf(q).length : undefined,
    // 서술형: how many fixes to write (어법 고치기), or one sentence (조건 영작) — the count only, never the words
    ...(q.type === 'correct' ? { fixes: (q.answer as string[]).length } : q.type === 'compose' ? { write: true } : {}) };
}
/** Solvable on screen: every type with choices (the old 빈칸 워크북 needs written answers, so not those). */
const solvable = (q: MadeQuestion) => q.type !== 'workbook';

/** A given answer, checked against what the question allows: a choice 1–5, or for 어법 선택 one word of each pair; for
 *  서술형 어법 each fix as 'ⓐ word' (blank while unfinished), for 서술형 영작 one sentence. */
function cleanAnswer(q: MadeQuestion, value: unknown): number | string[] | null {
  if (q.type === 'correct') {
    const list = Array.isArray(value) ? value : [], n = (q.answer as string[]).length;
    if (list.length !== n) return null;
    const out = list.map(v => clip(v, 80));
    return out.every(v => v === '' || (LETTERS5.includes(v.slice(0, 1)) && v[1] === ' ')) ? out : null;
  }
  if (q.type === 'compose') { const list = Array.isArray(value) ? value : []; return list.length === 1 ? [clip(list[0], 400)] : null; }
  if (q.type === 'choice') {
    const pairs = pairsOf(q), list = Array.isArray(value) ? value : [];
    if (list.length !== pairs.length) return null;
    const out = list.map((v, k) => (v === null || v === '' ? '' : clip(v, 40)));
    return out.every((v, k) => v === '' || pairs[k].includes(v)) ? out : null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= (q.options?.length || 5) ? n : null;
}
function cleanAnswers(questions: MadeQuestion[], input: unknown) {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}, out: Record<string, number | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    const i = Number(key), q = questions[i];
    if (!Number.isInteger(i) || !q || !solvable(q)) throw Error('BAD_REQUEST');
    if (value === null || value === undefined) continue;
    const v = cleanAnswer(q, value);
    if (v === null) throw Error('BAD_REQUEST');
    out[String(i)] = v;
  }
  return out;
}
/** One question graded: a 어법 선택 question is right only with every pair right (the pairs are shown one by one). */
function grade(q: MadeQuestion, given: number | string[] | undefined, judged?: { ok: boolean; reason: string; by: 'ai' | 'none' }) {
  if (q.type === 'correct') {
    // each wrong part found (its letter) and fixed (the word, leniently); right only with every fix right
    const mine = (Array.isArray(given) ? given : []).filter(Boolean);
    const pairs = (q.answer as string[]).map(right => { const g = mine.find(m => m.slice(0, 1) === right.slice(0, 1)) || '';
      return { label: right.slice(0, 1), right: right.slice(2), given: g.slice(2), ok: Boolean(g) && sameWriting(g.slice(2), right.slice(2)) }; });
    return { ok: pairs.every(x => x.ok) && mine.length === pairs.length, right: q.answer as string[], given: mine, pairs };
  }
  if (q.type === 'compose') {
    const right = (q.answer as string[])[0], mine = (Array.isArray(given) ? given[0] : '') || '';
    if (sameWriting(mine, right)) return { ok: true, right: [right], given: [mine], check: { by: 'same', reason: '' } };
    return { ok: Boolean(judged?.ok), right: [right], given: [mine], check: judged ? { by: judged.by, reason: judged.reason } : { by: 'none', reason: '' } };
  }
  if (q.type === 'choice') {
    const right = q.answer as string[], mine = Array.isArray(given) ? given : [];
    const pairs = right.map((w, k) => ({ right: w, given: mine[k] || '', ok: mine[k] === w }));
    return { ok: pairs.every(p => p.ok), right, given: mine, pairs };
  }
  return { ok: given === q.answer, right: q.answer as number, given: typeof given === 'number' ? given : null };
}

/** The visits: a save within 30 minutes of the last one continues the visit; after a longer gap (or a closed browser that
 *  never said goodbye) the last visit is closed at its last save and a new one starts. Server time only. */
export function touchSessions(sessions: { start: number; end: number }[], folded: { count: number; ms: number }, now: number) {
  const list = sessions.map(s => ({ ...s })), last = list[list.length - 1];
  if (last && now >= last.end && now - last.end <= ATTEMPT_SESSION.gapMs) last.end = now;
  else list.push({ start: now, end: now });
  const extra = Math.max(0, list.length - ATTEMPT_SESSION.keep), old = list.splice(0, extra);
  return { sessions: list, folded: { count: folded.count + old.length, ms: folded.ms + old.reduce((sum, s) => sum + (s.end - s.start), 0) } };
}

/** Where the questions come from: one's own set, or a set a teacher gave (the snapshot fixed then; only its students). */
interface Source { kind: 'self' | 'assigned'; id: string; title: string; questions: MadeQuestion[]; version: number; key: string; dueAt: number | null; cancelled: boolean; asgRef?: any; setRef?: any }
async function sourceOf(db: any, a: PassageActor, input: any): Promise<Source> {
  if (input?.assignmentId) {
    const asgRef = db.collection(QUESTION_ASSIGNMENTS).doc(clip(input.assignmentId, 64)), snap = await asgRef.get();
    if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
    const x = snap.data();
    if (!(x.uids || []).includes(a.uid)) throw Error('FORBIDDEN');
    return { kind: 'assigned', id: x.id, title: x.title, questions: x.questions, version: x.createdAt, key: `asg:${a.uid}:${x.id}`, dueAt: x.dueAt ?? null, cancelled: Boolean(x.cancelled), asgRef };
  }
  const setRef = db.collection(QUESTION_SETS).doc(clip(input?.setId, 64)), snap = await setRef.get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const set = snap.data();
  if (set.uid !== a.uid) throw Error('FORBIDDEN'); // someone else's set: only when a teacher gives it
  return { kind: 'self', id: set.id, title: set.title, questions: set.questions, version: set.version || set.createdAt, key: `set:${a.uid}:${set.id}`, dueAt: null, cancelled: false, setRef };
}
/** A given set read again inside the transaction: cancelled (or the student taken off) since it was read = stop. */
const stillGiven = async (tx: any, s: Source, uid: string) => { if (!s.asgRef) return; const x = (await tx.get(s.asgRef)).data(); if (!x || x.cancelled || !(x.uids || []).includes(uid)) throw Error('ASSIGNMENT_CANCELLED'); };
const refOf = (db: any, key: string) => db.collection(QUESTION_ATTEMPTS).doc(createHash('sha256').update(key).digest('hex').slice(0, 32));

/** What the student gets back: the questions to solve (and, once graded, the result with answers and explanations). */
function studentView(s: Source, attempt: any) {
  const questions = (attempt.status === 'submitted' ? attempt.questions : s.questions) as MadeQuestion[];
  const base = { ...(s.kind === 'assigned' ? { assignmentId: s.id } : { setId: s.id }), title: s.title, dueAt: s.dueAt, status: attempt.status, answers: attempt.answers || {}, questions: questions.map(solveView).filter((_, i) => solvable(questions[i])) };
  if (attempt.status !== 'submitted') return base;
  return { ...base, submittedAt: attempt.submittedAt, score: attempt.score, reward: attempt.reward || null,
    results: attempt.results.map((r: any) => ({ ...r, explanation: questions[r.index]?.explanation || '', mark: typeof r.right === 'number' ? CIRCLED[r.right - 1] : undefined })) };
}

/** Open a set to solve: the draft is made on first opening and the visit logged; a submitted one shows its result. */
export async function openAttempt(db: any, a: PassageActor, input: any, now = Date.now()) {
  const s = await sourceOf(db, a, input);
  if (!s.questions.some(solvable)) throw Error('QUESTIONS_NOT_SOLVABLE');
  const ref = refOf(db, s.key);
  const attempt = await db.runTransaction(async (tx: any) => {
    const old = (await tx.get(ref)).data();
    if (old?.status === 'submitted') return old;
    await stillGiven(tx, s, a.uid);
    const touched = touchSessions(old?.sessions || [], old?.folded || { count: 0, ms: 0 }, now);
    // a set that grew (더 만들기) since: the unfinished try moves to the new version, its answers kept; a question made
    // again or fixed since (its rev is newer than the try's version) loses its answer
    const keep = (i: string) => !(Number((s.questions[Number(i)] as any)?.rev) > Number(old?.setVersion || 0));
    const next = old ? { ...old, ...touched, answers: Object.fromEntries(Object.entries(old.answers || {}).filter(([i]) => keep(i))), setVersion: s.version, updatedAt: now }
      : { id: ref.id, uid: a.uid, kind: s.kind, ...(s.kind === 'assigned' ? { assignmentId: s.id } : { setId: s.id }), title: s.title, dueAt: s.dueAt, setVersion: s.version, status: 'draft', answers: {}, ...touched, createdAt: now, updatedAt: now };
    tx.set(ref, next);
    return next;
  });
  return { attempt: studentView(s, attempt) };
}

/** Keep the answers chosen so far (only while not submitted). */
export async function saveAttempt(db: any, a: PassageActor, input: any, now = Date.now()) {
  const s = await sourceOf(db, a, input), answers = cleanAnswers(s.questions, input?.answers), ref = refOf(db, s.key);
  await db.runTransaction(async (tx: any) => {
    const old = (await tx.get(ref)).data();
    if (!old) throw Error('ATTEMPT_NOT_OPEN');
    if (old.status === 'submitted') throw Error('ATTEMPT_SUBMITTED');
    await stillGiven(tx, s, a.uid);
    tx.set(ref, { ...old, answers, ...touchSessions(old.sessions || [], old.folded || { count: 0, ms: 0 }, now), updatedAt: now });
  });
  return { saved: true };
}

/** Points for a set a teacher gave: 5P a right question, 2P a wrong one (XP alike); after the deadline 90% of the total,
 *  rounded once at the end; inside the day's study points (the part over the cap is not paid, nor carried over). */
export const QUESTION_REWARD = { right: { points: 5, xp: 8 }, wrong: { points: 2, xp: 3 }, late: 0.9 };
export function questionReward(correct: number, total: number, late: boolean) {
  const rate = late ? QUESTION_REWARD.late : 1, wrong = total - correct;
  return { points: Math.round((correct * QUESTION_REWARD.right.points + wrong * QUESTION_REWARD.wrong.points) * rate), xp: Math.round((correct * QUESTION_REWARD.right.xp + wrong * QUESTION_REWARD.wrong.xp) * rate) };
}

/** 채점: graded once by the server from the answers sent (all must be given); the questions and answers it used are kept
 *  with the result, and for a set a teacher gave the points are paid in the same transaction (once: `reward` says what
 *  was paid). Sent again: the result already recorded comes back unchanged. */
/** 서술형 영작 answers that are not the passage's sentence word for word, checked by the AI in one call: the meaning and
 *  the conditions. If it can't be asked, the answer counts as wrong and says it was not checked (the teacher sees it). */
export function composeCheckRequest(items: { id: string; ko: string; box: string; model: string; answer: string }[]) {
  const S = { type: 'STRING' } as const;
  return {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(items) }] }],
    config: {
      systemInstruction: '너는 한국 고등학교 영어 서술형 채점 선생님이야. 각 항목은 우리말(ko), 조건(box), 모범 답안(model), 학생 답(answer)이야. 학생 답이 우리말 뜻과 같고, 조건(쓸 낱말, 단어 수)을 모두 지키고, 문법이 맞으면 ok=true. 모범 답안과 표현이 달라도 뜻·조건·문법이 맞으면 ok=true. 철자·문법 오류가 있거나 조건을 어기면 ok=false. reason은 한국어 한 문장(무엇이 맞고 틀렸는지). id는 그대로.',
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { checks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: S, ok: { type: 'BOOLEAN' }, reason: S }, required: ['id', 'ok', 'reason'] } } }, required: ['checks'] },
      temperature: 0, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}
type Judged = { ok: boolean; reason: string; by: 'ai' | 'none' };
/** What a 서술형 영작 verdict was given for: the Korean, the conditions and the model answer. */
export const questionSig = (q: MadeQuestion) => createHash('sha256').update(JSON.stringify([q.box, q.paragraphs, q.answer])).digest('hex').slice(0, 16);
/** While one request has the AI checking a draft, another sent at the same time waits (asked to press again). */
export const COMPOSE_LOCK_MS = 60_000;
/** Every question has its answer (a 어법 선택 or 서술형 어법 one with every part filled). */
const missingAnswer = (questions: MadeQuestion[], answers: Record<string, number | string[]>) => questions.some((q, index) => {
  if (!solvable(q)) return false;
  const v = answers[String(index)]; return v === undefined || (Array.isArray(v) && v.some(w => !w));
});
/** Asks only for answers not already checked by the AI (`cache`: index → the answer it saw and its verdict); the short-time
 *  guard comes first when it will be asked. A failed check is not kept (it may be asked again, within the guard). */
async function checkCompose(questions: MadeQuestion[], answers: Record<string, number | string[]>, cache: Record<string, Judged & { answer: string; sig?: string }>, ask: (items: { id: string; ko: string; box: string; model: string; answer: string; sig: string }[]) => Promise<any>) {
  const out = new Map<number, Judged>(), fresh: Record<string, Judged & { answer: string; sig: string }> = {};
  const items = questions.map((q, index) => ({ q, index, answer: Array.isArray(answers[String(index)]) ? (answers[String(index)] as string[])[0] : '' }))
    .filter(({ q, answer }) => q.type === 'compose' && !sameWriting(answer, (q.answer as string[])[0]));
  // a kept verdict counts only for this very answer to this very question (a question fixed since has another `sig`)
  const todo = items.filter(({ q, index, answer }) => { const c = cache[String(index)]; if (c?.by === 'ai' && c.answer === answer && c.sig === questionSig(q)) { out.set(index, { ok: c.ok, reason: c.reason, by: 'ai' }); return false; } return true; });
  if (todo.length) {
    try {
      const checks = (await ask(todo.map(({ q, index, answer }) => ({ id: `q${index}`, ko: String(q.box || ''), box: (q.paragraphs || []).map(x => x.text).join(' / '), model: (q.answer as string[])[0], answer, sig: questionSig(q) }))))?.checks;
      for (const { q, index, answer } of todo) { const c = (Array.isArray(checks) ? checks : []).find((x: any) => x?.id === `q${index}`); if (c) { const j: Judged = { ok: c.ok === true, reason: clip(c.reason, 200), by: 'ai' }; out.set(index, j); fresh[String(index)] = { ...j, answer, sig: questionSig(q) }; } }
    } catch (error: any) { if (error?.message === 'AI_TOO_FAST' || error?.message === 'ATTEMPT_CHECKING') throw error; console.warn('COMPOSE_CHECK_FAILED', { code: aiErrorCode(error) }); } // the code only, never the answers
  }
  for (const { index } of items) if (!out.has(index)) out.set(index, { ok: false, reason: '자동 확인을 하지 못했어요. 선생님께 확인받아 주세요.', by: 'none' });
  return { judged: out, fresh };
}

export async function submitAttempt(db: any, a: PassageActor, input: any, now = Date.now(), generate?: (request: any) => Promise<string>) {
  const s = await sourceOf(db, a, input), answers = cleanAnswers(s.questions, input?.answers), ref = refOf(db, s.key);
  // 서술형 영작 checked before the transaction, and only for a submission that can be graded: open, complete, on the
  // current version (the same checks the transaction makes again). An already graded try skips it; an answer the AI has
  // seen (kept on the draft) is not asked again; asking at all goes through the short-time guard.
  const before = (await ref.get()).data();
  let judged = new Map<number, Judged>();
  if (before?.status !== 'submitted') {
    if (!before) throw Error('ATTEMPT_NOT_OPEN');
    if (before.setVersion !== s.version) throw Error('ATTEMPT_STALE');
    if (missingAnswer(s.questions, answers)) throw Error('ATTEMPT_INCOMPLETE');
    // Asking claims the draft first (composeLock, in a transaction): a second request at the same time stops there
    // instead of asking the AI about the same answers. The claim ends with the verdicts written, or on failure.
    // Asking claims the draft first (composeLock with this request's token, in a transaction). Inside the claim the
    // latest kept verdicts are read again: answers judged meanwhile (by a request that just finished) are taken from
    // there, and the AI is asked only about the rest — or not at all. A second request while the claim stands stops
    // with ATTEMPT_CHECKING. Only the holder of the token gives the claim back (a late request whose claim ran out never
    // clears a newer one); verdicts are kept either way.
    const token = randomUUID();
    let claimed = false;
    const finish = (fresh: Record<string, unknown>) => db.runTransaction(async (tx: any) => {
      const cur = (await tx.get(ref)).data();
      if (!cur || cur.status === 'submitted') return;
      const mine = cur.composeLock?.token === token;
      tx.set(ref, { ...cur, composeChecks: { ...(cur.composeChecks || {}), ...fresh }, composeLock: mine ? null : cur.composeLock ?? null });
    });
    const checked = await checkCompose(s.questions, answers, before.composeChecks || {}, async items => {
      const known: { id: string; ok: boolean; reason: string }[] = [];
      const rest = await db.runTransaction(async (tx: any) => {
        const cur = (await tx.get(ref)).data();
        if (!cur || cur.status === 'submitted') throw Error('ATTEMPT_CHECKING');
        const kept = cur.composeChecks || {}, left = items.filter(x => { const c = kept[x.id.slice(1)]; if (c?.by === 'ai' && c.answer === x.answer && c.sig === x.sig) { known.push({ id: x.id, ok: c.ok, reason: c.reason }); return false; } return true; });
        if (!left.length) return left;
        if (Number(cur.composeLock?.until) > now) throw Error('ATTEMPT_CHECKING');
        tx.set(ref, { ...cur, composeLock: { until: now + COMPOSE_LOCK_MS, token } });
        return left;
      });
      if (!rest.length) return { checks: known };
      claimed = true;
      if (!a.admin) await guardAiBurst(db, a.uid, now);
      if (!generate) throw Error('AI_FAILED');
      const reply = JSON.parse(await generate(composeCheckRequest(rest.map(({ sig: _, ...x }) => x))));
      return { checks: [...known, ...(Array.isArray(reply?.checks) ? reply.checks : [])] };
    }).catch(async (error: any) => { if (claimed) await finish({}).catch(() => undefined); throw error; });
    judged = checked.judged;
    // the verdicts kept on the draft (read again: a save meanwhile is not lost), the claim given back if still ours
    if (claimed || Object.keys(checked.fresh).length) await finish(checked.fresh);
  }
  const petRef = db.collection(PET_STATES).doc(a.uid), userRef = db.collection('users').doc(a.uid), paying = s.kind === 'assigned';
  const attempt = await db.runTransaction(async (tx: any) => {
    // every read first (the pet too), then the writes
    const [oldSnap, asgSnap, setSnap, petSnap, userSnap] = await Promise.all([tx.get(ref), s.asgRef ? tx.get(s.asgRef) : null, s.setRef ? tx.get(s.setRef) : null, paying ? tx.get(petRef) : null, paying ? tx.get(userRef) : null]);
    const old = oldSnap.data(), asg = asgSnap?.data(), cur = setSnap?.data();
    if (old?.status === 'submitted') return old;
    if (!old) throw Error('ATTEMPT_NOT_OPEN');
    // the given set read again here: a cancel since it was first read stops the grading (and the points)
    if (s.asgRef && (!asg || asg.cancelled || !(asg.uids || []).includes(a.uid))) throw Error('ASSIGNMENT_CANCELLED');
    // the set read again here: grown (더 만들기) since it was first read = open it again, never graded on the old count
    if (old.setVersion !== s.version || (s.setRef && (!cur || (cur.version || cur.createdAt) !== s.version))) throw Error('ATTEMPT_STALE');
    const questions = s.questions, graded = questions.map((q, index) => ({ q, index })).filter(x => solvable(x.q));
    if (missingAnswer(questions, answers)) throw Error('ATTEMPT_INCOMPLETE');
    const results = graded.map(({ q, index }) => ({ index, type: q.type, ...grade(q, answers[String(index)], judged.get(index)) }));
    const score = { correct: results.filter(r => r.ok).length, total: results.length };
    let reward: any = null;
    if (paying) {
      const late = s.dueAt !== null && now > s.dueAt, wanted = questionReward(score.correct, score.total, late);
      if (petSnap?.exists) {
        const pet: ServerPetState = rollDay(petSnap.data(), now), paid = awardCapped(pet, wanted.points, wanted.xp);
        pet.updatedAt = now; tx.set(petRef, pet);
        if (userSnap?.exists) tx.set(userRef, { petStats: petSummary(pet) }, { merge: true });
        reward = { points: paid.points, xp: paid.xp, wanted: wanted.points, capped: paid.capped, late };
      } else reward = { points: 0, xp: 0, wanted: wanted.points, capped: false, late, noPet: true };
    }
    const next = { ...old, answers, ...touchSessions(old.sessions || [], old.folded || { count: 0, ms: 0 }, now), status: 'submitted', submittedAt: now,
      questions, gradingVersion: GRADING_VERSION, results, score, reward, updatedAt: now };
    tx.set(ref, next);
    return next;
  });
  return { attempt: studentView(s, attempt) };
}

/** 내준 변형 문제 for the 숙제 list: the sets teachers gave this student (a cancelled one only once submitted), each with how
 *  far the student got. */
export async function myAssignedSets(db: any, a: PassageActor) {
  // Newest first in the query itself, so the newest 50 are the ones read (index: uids array-contains + createdAt desc).
  // Until that index is built the query is refused; then up to 300 given sets are read and sorted here (a stopgap until
  // the index is ready: the log line says when it is still used).
  const given = db.collection(QUESTION_ASSIGNMENTS).where('uids', 'array-contains', a.uid);
  const snap = await given.orderBy('createdAt', 'desc').limit(50).get().catch((error: any) => {
    if (error?.code !== 9 && !/FAILED_PRECONDITION|index/i.test(String(error?.message || ''))) throw error;
    console.warn('ASSIGNED_LIST_INDEX_MISSING'); return given.limit(300).get();
  });
  const rows = snap.docs.map((d: any) => d.data()).sort((x: any, y: any) => y.createdAt - x.createdAt).slice(0, 50);
  const attempts = await Promise.all(rows.map((x: any) => refOf(db, `asg:${a.uid}:${x.id}`).get().then((s: any) => s.data())));
  return { assigned: rows.map((x: any, k: number) => {
    const at = attempts[k], total = (x.questions || []).filter(solvable).length;
    return { assignmentId: x.id, title: x.title, total, dueAt: x.dueAt ?? null, createdAt: x.createdAt, cancelled: Boolean(x.cancelled), status: at?.status || 'new',
      answered: at ? Object.keys(at.answers || {}).length : 0, score: at?.score || null, reward: at?.reward ? { points: at.reward.points } : null };
  }).filter((r: any) => !r.cancelled || r.status === 'submitted') };
}
