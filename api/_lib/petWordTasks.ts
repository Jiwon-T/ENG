// 원정대 › 단어 과제 (과제 모드): the teacher gives a student a word book's Day range (from the 수업 일지 단어 칩); the
// student plays it in 원정대 — only those words, a game of up to 10, no energy — and a word counts once it is answered
// right the first time in a game (a miss comes back in a later game). All of them right: the task is done (completedAt).
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {distractors, shuffle, wordKey, type FeedQuestion, type FeedRun, type FeedWord} from './petWordFeed.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';

export const WORD_TASKS = 'petWordTasks';
export const WORD_TASK_RULES = {maxWords: 200, maxActive: 5, questions: 10} as const;
export interface WordTask {academyId: string; studentKey: string; wordbookId: string; bookTitle: string; startDay: number; endDay: number;
  words: {w: string; m: string}[]; mastered: string[]; createdBy: string; createdAt: number; completedAt: number | null; removed?: boolean}
export interface WordTaskView {id: string; wordbookId: string; title: string; bookTitle: string; startDay: number; endDay: number; total: number; mastered: number; completedAt: number | null; createdAt: number}

const range = (a: number, b: number) => a === b ? `Day ${a}` : `Day ${a}~${b}`;
export const taskView = (id: string, t: WordTask): WordTaskView => ({id, wordbookId: t.wordbookId, title: `${t.bookTitle} · ${range(t.startDay, t.endDay)}`, bookTitle: t.bookTitle, startDay: t.startDay, endDay: t.endDay,
  total: t.words.length, mastered: t.mastered.length, completedAt: t.completedAt ?? null, createdAt: t.createdAt});
const keyOf = (t: WordTask, w: {w: string}) => wordKey({wordbookId: t.wordbookId, word: w.w});
/** A teacher of this student (any subject), the principal or the admin. */
const teaches = (actor: any, key: string) => Boolean(actor?.admin || actor?.principal || (actor?.scopes || []).some((s: any) => s.studentKey === key) || (actor?.teachingScopes || []).some((s: any) => s.studentKey === key));

const createInput = z.object({studentKey: z.string().uuid(), wordbookId: z.string().min(1).max(128), startDay: z.number().int().min(1).max(999), endDay: z.number().int().min(1).max(999)}).strict();
/** 원정대 과제로 내기: the range's words are kept with the task, so the game never reads the book. */
export async function createWordTask(db: any, actor: any, input: unknown, now = Date.now()) {
  const v = createInput.parse(input), key = uuid(v.studentKey), start = Math.min(v.startDay, v.endDay), end = Math.max(v.startDay, v.endDay);
  if (!actor?.uid || !teaches(actor, key)) throw Error('FORBIDDEN');
  const book = (await db.collection('wordbooks').doc(v.wordbookId).get()).data(); if (!book || book.deletedAt) throw Error('WORD_TASK_NO_WORDS');
  const ref = db.collection(`wordbooks/${v.wordbookId}/words`);
  let docs = (await ref.where('day', '>=', start).where('day', '<=', end).get()).docs;
  // a word without a Day is Day 1 (as the 학습 세트 shows it): read the book when the range starts there or found nothing
  if (start === 1 || !docs.length) docs = (await ref.limit(3000).get()).docs.filter((d: any) => { const day = Number(d.data().day) || 1; return day >= start && day <= end; });
  const seen = new Set<string>(), words: {w: string; m: string}[] = [];
  for (const d of [...docs].sort((a: any, b: any) => (Number(a.data().order) || 0) - (Number(b.data().order) || 0))) {
    const x = d.data(), w = String(x.word || '').trim(), m = String(x.meaning || '').trim();
    if (!w || !m || seen.has(w.toLowerCase())) continue; seen.add(w.toLowerCase()); words.push({w: w.slice(0, 60), m: m.slice(0, 80)});
  }
  if (!words.length) throw Error('WORD_TASK_NO_WORDS');
  if (words.length > WORD_TASK_RULES.maxWords) throw Error('WORD_TASK_TOO_MANY');
  const active = (await db.collection(WORD_TASKS).where('studentKey', '==', key).get()).docs.map((d: any) => d.data()).filter((t: any) => !t.removed && !t.completedAt);
  if (active.length >= WORD_TASK_RULES.maxActive) throw Error('WORD_TASK_LIMIT');
  const id = randomUUID(), task: WordTask = {academyId: actor.academyId || 'main', studentKey: key, wordbookId: v.wordbookId, bookTitle: String(book.title || '단어장').slice(0, 60), startDay: start, endDay: end,
    words, mastered: [], createdBy: actor.uid, createdAt: now, completedAt: null};
  await db.collection(WORD_TASKS).doc(id).set(task);
  return {task: taskView(id, task)};
}
/** A student's tasks (newest first; removed ones left out). */
export async function listWordTasks(db: any, studentKey: string) {
  const key = uuid(studentKey);
  const rows = (await db.collection(WORD_TASKS).where('studentKey', '==', key).get()).docs.map((d: any) => ({id: d.id, t: d.data() as WordTask})).filter((r: any) => !r.t.removed);
  return rows.sort((a: any, b: any) => b.t.createdAt - a.t.createdAt).map((r: any) => taskView(r.id, r.t));
}
/** The 일지 단어 칩 (a teacher of the student): the student's tasks. */
export async function teacherWordTasks(db: any, actor: any, studentKey: unknown) {
  const key = uuid(z.string().uuid().parse(studentKey));
  if (!teaches(actor, key)) throw Error('FORBIDDEN');
  return {tasks: await listWordTasks(db, key)};
}
/** 과제 빼기: the teacher who gave it, or 원장님·관리자. */
export async function removeWordTask(db: any, actor: any, idInput: unknown) {
  const ref = db.collection(WORD_TASKS).doc(z.string().uuid().parse(idInput)), t = (await ref.get()).data();
  if (!t || t.removed) throw Error('WORD_TASK_NOT_FOUND');
  if (!(actor.admin || actor.principal || t.createdBy === actor.uid)) throw Error('FORBIDDEN');
  await db.runTransaction(async (tx: any) => { tx.set(ref, {...t, removed: true}); });
  return {removed: true};
}

/** The student's own task (by the linked student). */
export async function studentWordTask(db: any, studentKey: string | null, idInput: unknown) {
  const id = z.string().uuid().parse(idInput), t = (await db.collection(WORD_TASKS).doc(id).get()).data() as WordTask | undefined;
  if (!t || t.removed || !studentKey || t.studentKey !== uuid(studentKey)) throw Error('WORD_TASK_NOT_FOUND');
  return {id, task: t};
}
/** A game of the task: the words not yet right (up to 10, in random order), each with 2 wrong meanings from the task's own
 *  words (so a few words left still make a game). Null when every word is right. */
export function buildTaskRun(id: string, t: WordTask, now: number, rand: () => number = Math.random): FeedRun | null {
  const pool: FeedWord[] = t.words.map(w => ({wordbookId: t.wordbookId, wordId: '', word: w.w, meaning: w.m})), done = new Set(t.mastered), questions: FeedQuestion[] = [];
  for (const w of shuffle(pool.filter(w => !done.has(wordKey(w))), rand)) {
    if (questions.length >= WORD_TASK_RULES.questions) break;
    const wrong = distractors(w, pool, rand); if (!wrong) continue;
    const choices = shuffle([w.meaning, ...wrong], rand);
    questions.push({key: wordKey(w), wordbookId: t.wordbookId, word: w.word, choices, answer: choices.indexOf(w.meaning)});
  }
  if (!questions.length) return null;
  return {id: `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`, questions, results: [], startedAt: now, finished: false, task: id};
}
/** Words answered right the first time in a game count; all of them: done. */
export async function markTaskWords(db: any, id: string, keys: string[], now = Date.now()) {
  if (!keys.length) return null;
  const ref = db.collection(WORD_TASKS).doc(id);
  return db.runTransaction(async (tx: any) => {
    const t = (await tx.get(ref)).data() as WordTask | undefined; if (!t || t.removed) return null;
    const valid = new Set(t.words.map(w => keyOf(t, w))), mastered = [...new Set([...t.mastered, ...keys.filter(k => valid.has(k))])];
    const next = {...t, mastered, completedAt: t.completedAt ?? (mastered.length >= t.words.length ? now : null)};
    tx.set(ref, next);
    return taskView(id, next);
  });
}
