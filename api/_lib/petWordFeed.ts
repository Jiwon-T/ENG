// 단어 먹이 주기: the pet holds an English word, the student picks its Korean meaning out of 3 cards.
// The server builds every question from the student's own study (3 most recently studied standard wordbooks + up to 3
// unreviewed wrong answers), keeps the answers to itself and grades each choice, so points can't be claimed from the
// browser. One game is also one 원정대 stage later on.
import {FieldPath} from 'firebase-admin/firestore';
import {awardStudy, seoulDay, type ServerPetState} from './pet.js';
import {PET_WORD_FEED} from '../../src/lib/petCatalog.js';

export const PET_GAMES = 'petGames';
export interface FeedWord { wordbookId: string; wordId: string; word: string; meaning: string }
export interface FeedQuestion { key: string; wordbookId: string; word: string; choices: string[]; answer: number; retry?: boolean; fromWrong?: boolean }
/** `stage`: the 원정대 stage this game is for (none for a plain game). */
export interface FeedRun { id: string; questions: FeedQuestion[]; results: {choice: number; correct: boolean; points: number}[]; startedAt: number; finished: boolean; stage?: string }
export interface PetGameState { version: 1; day: string; rewardedToday: string[]; run: FeedRun | null; updatedAt: number }
export interface FeedSource { books: {id: string; words: FeedWord[]}[]; wrongs: FeedWord[] }

/** Meanings split into parts ("밝은, 빛나는 (빛이)" → 밝은 · 빛나는 · 빛이) so two cards never share a meaning. */
export const meaningParts = (meaning: string) => String(meaning || '').split(/[,;/·・\n()（）\[\]~]+|\s+-\s+/).map(p => p.replace(/\s+/g, '').toLowerCase()).filter(Boolean);
export const meaningsOverlap = (a: string, b: string) => { const pa = new Set(meaningParts(a)); return meaningParts(b).some(p => pa.has(p)); };
export const wordKey = (w: {wordbookId: string; word: string}) => `${w.wordbookId}:${w.word.trim().toLowerCase()}`;

export const initialGameState = (now = Date.now()): PetGameState => ({version: 1, day: seoulDay(now), rewardedToday: [], run: null, updatedAt: now});
export function rollGameDay(g: PetGameState, now = Date.now()) { const day = seoulDay(now); if (g.day !== day) { g.day = day; g.rewardedToday = []; } return g; }

/** Two meanings from the same book that share nothing with the answer or with each other; null when that isn't possible. */
function distractors(answer: FeedWord, pool: FeedWord[], rand: () => number) {
  const picks: string[] = [];
  for (const w of shuffle(pool, rand)) {
    if (picks.length === PET_WORD_FEED.choices - 1) break;
    if (w.word === answer.word || meaningsOverlap(w.meaning, answer.meaning) || picks.some(p => meaningsOverlap(p, w.meaning))) continue;
    picks.push(w.meaning.trim());
  }
  return picks.length === PET_WORD_FEED.choices - 1 ? picks : null;
}
function shuffle<T>(list: T[], rand: () => number) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** One game: up to 3 wrong answers first, then words not rewarded today; a word whose 3 cards can't be made is skipped. */
export function buildRun(source: FeedSource, rewardedToday: string[], now: number, rand: () => number = Math.random, stage?: string): FeedRun | null {
  const poolOf = new Map(source.books.map(b => [b.id, b.words.filter(w => w.word.trim() && w.meaning.trim())]));
  const used = new Set<string>(), questions: FeedQuestion[] = [];
  const add = (w: FeedWord, fromWrong: boolean) => {
    const key = wordKey(w); if (used.has(key) || questions.length >= PET_WORD_FEED.questions) return;
    const wrong = distractors(w, poolOf.get(w.wordbookId) || [], rand); if (!wrong) return;
    const choices = shuffle([w.meaning.trim(), ...wrong], rand);
    used.add(key); questions.push({key, wordbookId: w.wordbookId, word: w.word.trim(), choices, answer: choices.indexOf(w.meaning.trim()), ...(fromWrong ? {fromWrong: true} : {})});
  };
  for (const w of shuffle(source.wrongs, rand).slice(0, PET_WORD_FEED.wrongAnswers * 2)) { if (questions.filter(q => q.fromWrong).length < PET_WORD_FEED.wrongAnswers) add(w, true); }
  const rewarded = new Set(rewardedToday), all = [...poolOf.values()].flat();
  for (const w of shuffle(all.filter(w => !rewarded.has(wordKey(w))), rand)) add(w, false);
  for (const w of shuffle(all, rand)) add(w, false); // everything rewarded today: still playable, just no points
  if (questions.length < PET_WORD_FEED.minQuestions) return null;
  return {id: `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`, questions: shuffle(questions, rand), results: [], startedAt: now, finished: false, ...(stage ? {stage} : {})};
}

/**
 * Grade one answer. The same (runId, index) twice returns the stored result and never pays twice; an older index from
 * another device is refused so the newer progress is kept. A miss brings the word back 3 questions later, once, for 0P.
 */
export function answerRun(g: PetGameState, pet: ServerPetState, runId: string, index: number, choice: number) {
  const run = g.run;
  if (!run || run.id !== runId) throw Error('FEED_STALE');
  if (index < run.results.length) return {repeat: true, ...run.results[index]};
  if (index !== run.results.length || run.finished) throw Error('FEED_STALE');
  const q = run.questions[index];
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) throw Error('FEED_BAD_CHOICE');
  const correct = choice === q.answer;
  let points = 0, xp = 0;
  if (correct && !q.retry && !g.rewardedToday.includes(q.key)) {
    const r = awardStudy(pet, 'wordbook-quiz', 1); points = r.points; xp = r.xp;
    if (points > 0) g.rewardedToday.push(q.key); // capped today: not marked, and nothing carried over
  }
  if (!correct && !q.retry) run.questions.splice(Math.min(run.questions.length, index + 1 + PET_WORD_FEED.retryAfter), 0, {...q, retry: true});
  run.results.push({choice, correct, points});
  if (run.results.length === run.questions.length) run.finished = true;
  return {repeat: false, choice, correct, points, xp};
}

/** Stars from first tries (retries don't count): ★3 from 90%, ★2 from 70%, ★1 from 50%, else none. */
export function runSummary(run: FeedRun) {
  const first = run.results.filter((_, i) => !run.questions[i].retry), right = first.filter(r => r.correct).length;
  const rate = first.length ? right / first.length : 0;
  return {correct: right, total: first.length, points: run.results.reduce((a, r) => a + r.points, 0), stars: rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : rate >= 0.5 ? 1 : 0};
}

/** What the browser sees: answers only for questions already answered. */
export function publicRun(run: FeedRun | null) {
  if (!run) return null;
  return {id: run.id, stage: run.stage || null, finished: run.finished, total: run.questions.length, index: run.results.length,
    questions: run.questions.map((q, i) => ({word: q.word, choices: q.choices, retry: Boolean(q.retry), ...(i < run.results.length ? {answer: q.answer, ...run.results[i]} : {})})),
    ...(run.finished ? {summary: runSummary(run)} : {})};
}

/** A random point in the document-id order: Firestore auto ids are 20 characters of 0-9, A-Z, a-z (sorted in that order),
 *  so the start is drawn from the same characters and every word has the same chance to be in the window. */
const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const randomDocId = (rand: () => number = Math.random) => Array.from({length: 20}, () => ID_CHARS[Math.floor(rand() * ID_CHARS.length)]).join('');
const ms = (t: any) => typeof t?.toMillis === 'function' ? t.toMillis() : Number(t) || 0;
const isStandardWordBook = (b: any) => Boolean(b) && (b.category || 'word') === 'word' && (!b.type || b.type === 'standard');

/**
 * The student's study, read on the server: the 3 most recently studied standard wordbooks (from studySessions), a window
 * of each book's words (not the whole book, to keep reads small) and unreviewed wrong answers checked against the book.
 */
export async function loadFeedSource(db: any, uid: string, rand: () => number = Math.random): Promise<FeedSource> {
  const sessions = (await db.collection('studySessions').where('uid', '==', uid).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PET_WORD_FEED.sessionScan).get()).docs.map((d: any) => d.data());
  const bookDocs = new Map<string, any>(), recent: string[] = [];
  for (const s of sessions.sort((a: any, b: any) => ms(b.createdAt) - ms(a.createdAt))) {
    const id = typeof s.wordbookId === 'string' ? s.wordbookId : '';
    if (!id || recent.includes(id)) continue;
    if (!bookDocs.has(id)) bookDocs.set(id, (await db.collection('wordbooks').doc(id).get()).data() || null);
    if (isStandardWordBook(bookDocs.get(id))) recent.push(id);
    if (recent.length === PET_WORD_FEED.books) break;
  }
  const toWord = (bookId: string, d: any): FeedWord | null => { const x = d.data(); return typeof x?.word === 'string' && typeof x?.meaning === 'string' && x.word.trim() && x.meaning.trim() ? {wordbookId: bookId, wordId: d.id, word: x.word, meaning: x.meaning} : null; };
  const books = await Promise.all(recent.map(async id => {
    const words = db.collection('wordbooks').doc(id).collection('words'), start = randomDocId(rand);
    const first = await words.orderBy(FieldPath.documentId()).startAt(start).limit(PET_WORD_FEED.wordWindow).get();
    const rest = first.size < PET_WORD_FEED.wordWindow ? await words.orderBy(FieldPath.documentId()).limit(PET_WORD_FEED.wordWindow - first.size).get() : {docs: []};
    const seen = new Set<string>(), list: FeedWord[] = [];
    for (const d of [...first.docs, ...rest.docs]) { if (seen.has(d.id)) continue; seen.add(d.id); const w = toWord(id, d); if (w) list.push(w); }
    return {id, words: list};
  }));
  // Wrong answers: standard books only (elsewhere "meaning" is a verb form or a label), matched to the word as it is now.
  const wrongs: FeedWord[] = [], tried = new Set<string>();
  for (const s of sessions) {
    if (!isStandardWordBook(bookDocs.get(s.wordbookId)) || !Array.isArray(s.incorrectAnswers)) continue;
    for (const x of s.incorrectAnswers) {
      if (wrongs.length >= PET_WORD_FEED.wrongAnswers * 2 || x?.isReviewed || x?.quizSentence || typeof x?.word !== 'string') continue;
      const k = wordKey({wordbookId: s.wordbookId, word: x.word}); if (tried.has(k)) continue; tried.add(k);
      const hit = (await db.collection('wordbooks').doc(s.wordbookId).collection('words').where('word', '==', x.word).limit(1).get()).docs[0];
      const w = hit && toWord(s.wordbookId, hit); if (!w) continue;
      wrongs.push(w);
      const book = books.find(b => b.id === w.wordbookId);
      if (book) { if (!book.words.some(b => b.word === w.word)) book.words.push(w); }
      else books.push({id: w.wordbookId, words: [w, ...(await db.collection('wordbooks').doc(w.wordbookId).collection('words').limit(PET_WORD_FEED.wordWindow).get()).docs.map((d: any) => toWord(w.wordbookId, d)).filter(Boolean)]});
    }
  }
  return {books, wrongs};
}
