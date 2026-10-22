// 단어 먹이 주기: the pet holds an English word, the student picks its Korean meaning out of 3 cards.
// The server builds every question from the student's own study (3 most recently studied standard wordbooks + up to 3
// unreviewed wrong answers), keeps the answers to itself and grades each choice, so points can't be claimed from the
// browser. One game is also one 원정대 stage later on.
import {FieldPath} from 'firebase-admin/firestore';
import {awardStudy, seoulDay, type ServerPetState} from './pet.js';
import {PET_WORD_FEED, type StageGame} from '../../src/lib/petCatalog.js';
import {orderPieces, shuffledOrder} from '../../src/lib/sentenceGame.js';

export const PET_GAMES = 'petGames';
export interface FeedWord { wordbookId: string; wordId: string; word: string; meaning: string }
/**
 * One question. `type` (none = 'meaning'): 뜻 고르기 / 듣고 고르기 (the same cards; the word is heard, not shown) are graded
 * by the card; 철자 맞히기 by the spelled word; 문장 배열 by the sentence put together; 짝 맞추기 (`pairs`, one board) and
 * 낭독 (speech is heard in the browser) report how it went. `meaning` is the Korean prompt for spelling and sentences.
 */
export type FeedType = 'meaning' | 'listen' | 'spell' | 'match' | 'order' | 'read';
export interface FeedQuestion { key: string; wordbookId: string; word: string; choices: string[]; answer: number; retry?: boolean; fromWrong?: boolean; type?: FeedType; meaning?: string; chunked?: string; pairs?: {word: string; meaning: string; key: string}[];
  /** Kept on the server, shown without the answer: 철자's given letters and shuffled rest, 문장 배열's shuffled pieces,
   *  짝 맞추기's shuffled meanings (`meaningOrder[i]` = the pair shown i-th), and the tries, matches and mistakes so far. */
  hint?: string; letters?: string[]; pieces?: string[]; meaningOrder?: number[]; tries?: number; matched?: number[]; mistakes?: number }
/** A sentence from the 원정대 문장 세트: `text` without the / marks, `chunked` as registered (the pieces). */
export interface FeedSentence { wordbookId: string; text: string; chunked: string; meaning: string }
/** `stage`: the 원정대 stage this game is for (none for a plain game). */
export interface FeedRun { id: string; questions: FeedQuestion[]; results: {choice: number; correct: boolean; points: number}[]; startedAt: number; finished: boolean; stage?: string; slot?: number; /** 단어 과제 (petWordTasks): the task this game is for */ task?: string }
export interface PetGameState { version: 1; day: string; rewardedToday: string[]; run: FeedRun | null; updatedAt: number }
export interface FeedSource { books: {id: string; words: FeedWord[]}[]; wrongs: FeedWord[] }

/** Meanings split into parts ("밝은, 빛나는 (빛이)" → 밝은 · 빛나는 · 빛이) so two cards never share a meaning. */
export const meaningParts = (meaning: string) => String(meaning || '').split(/[,;/·・\n()（）\[\]~]+|\s+-\s+/).map(p => p.replace(/\s+/g, '').toLowerCase()).filter(Boolean);
export const meaningsOverlap = (a: string, b: string) => { const pa = new Set(meaningParts(a)); return meaningParts(b).some(p => pa.has(p)); };
export const wordKey = (w: {wordbookId: string; word: string}) => `${w.wordbookId}:${w.word.trim().toLowerCase()}`;

export const initialGameState = (now = Date.now()): PetGameState => ({version: 1, day: seoulDay(now), rewardedToday: [], run: null, updatedAt: now});
export function rollGameDay(g: PetGameState, now = Date.now()) { const day = seoulDay(now); if (g.day !== day) { g.day = day; g.rewardedToday = []; } return g; }

/** Two meanings from the same book that share nothing with the answer or with each other; null when that isn't possible. */
export function distractors(answer: FeedWord, pool: FeedWord[], rand: () => number) {
  const picks: string[] = [];
  for (const w of shuffle(pool, rand)) {
    if (picks.length === PET_WORD_FEED.choices - 1) break;
    if (w.word === answer.word || meaningsOverlap(w.meaning, answer.meaning) || picks.some(p => meaningsOverlap(p, w.meaning))) continue;
    picks.push(w.meaning.trim());
  }
  return picks.length === PET_WORD_FEED.choices - 1 ? picks : null;
}
export function shuffle<T>(list: T[], rand: () => number) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Build options: the stage's game, the sentences for it, and a quiet place (듣고 고르기 → 뜻 고르기, 낭독 → 문장 배열) or no
 *  speech recognition here (낭독 → 문장 배열). No sentences: 문장 배열 → 듣고 고르기 (뜻 고르기 when quiet), 낭독 → 철자. */
export interface BuildOptions { game?: StageGame; sentences?: FeedSentence[]; quiet?: boolean; noMic?: boolean }
const spellable = (w: string) => /^[a-z]{3,12}$/i.test(w.trim());
const sentenceKey = (s: FeedSentence) => `${s.wordbookId}:s:${s.text.toLowerCase().slice(0, 80)}`;

/** One game. 뜻 고르기 (and 듣고 고르기): up to 3 wrong answers first, then words not rewarded today; a word whose 3 cards
 *  can't be made is skipped. Other games follow `options.game` (see stageGame); `count`: questions (boards for 짝 맞추기). */
export function buildRun(source: FeedSource, rewardedToday: string[], now: number, rand: () => number = Math.random, stage?: string, count: number = PET_WORD_FEED.questions, options: BuildOptions = {}): FeedRun | null {
  const game = options.game || 'meaning';
  if (game !== 'meaning') return buildGameRun(source, rewardedToday, now, rand, stage, count, options);
  return buildMeaningRun(source, rewardedToday, now, rand, stage, count, 'meaning');
}
function buildMeaningRun(source: FeedSource, rewardedToday: string[], now: number, rand: () => number, stage: string | undefined, count: number, type: 'meaning' | 'listen'): FeedRun | null {
  const poolOf = new Map(source.books.map(b => [b.id, b.words.filter(w => w.word.trim() && w.meaning.trim())]));
  const used = new Set<string>(), questions: FeedQuestion[] = [];
  const add = (w: FeedWord, fromWrong: boolean) => {
    const key = wordKey(w); if (used.has(key) || questions.length >= count) return;
    const wrong = distractors(w, poolOf.get(w.wordbookId) || [], rand); if (!wrong) return;
    const choices = shuffle([w.meaning.trim(), ...wrong], rand);
    used.add(key); questions.push({key, wordbookId: w.wordbookId, word: w.word.trim(), choices, answer: choices.indexOf(w.meaning.trim()), ...(fromWrong ? {fromWrong: true} : {}), ...(type === 'listen' ? {type} : {})});
  };
  for (const w of shuffle(source.wrongs, rand).slice(0, PET_WORD_FEED.wrongAnswers * 2)) { if (questions.filter(q => q.fromWrong).length < PET_WORD_FEED.wrongAnswers) add(w, true); }
  const rewarded = new Set(rewardedToday), all = [...poolOf.values()].flat();
  for (const w of shuffle(all.filter(w => !rewarded.has(wordKey(w))), rand)) add(w, false);
  for (const w of shuffle(all, rand)) add(w, false); // everything rewarded today: still playable, just no points
  if (questions.length < PET_WORD_FEED.minQuestions) return null;
  return {id: `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`, questions: shuffle(questions, rand), results: [], startedAt: now, finished: false, ...(stage ? {stage} : {})};
}

/** The other games: words for 철자 / 짝 맞추기 / 듣고 고르기, sentences for 문장 배열 / 낭독, the crown stage mixing them. */
function buildGameRun(source: FeedSource, rewardedToday: string[], now: number, rand: () => number, stage: string | undefined, count: number, options: BuildOptions): FeedRun | null {
  const game = options.game!, sentences = shuffle((options.sentences || []).filter(x => x.text.trim() && x.meaning.trim()), rand);
  const listenOr = (): 'listen' | 'meaning' => options.quiet ? 'meaning' : 'listen';
  const rewarded = new Set(rewardedToday);
  const words = shuffle([...new Map(source.books.flatMap(b => b.words).filter(w => w.word.trim() && w.meaning.trim()).map(w => [wordKey(w), w])).values()], rand)
    .sort((a, b) => Number(rewarded.has(wordKey(a))) - Number(rewarded.has(wordKey(b))));
  const used = new Set<string>(), questions: FeedQuestion[] = [];
  const spell = (n: number) => { for (const w of words) { if (n <= 0) break; const key = wordKey(w); if (used.has(key) || !spellable(w.word)) continue; used.add(key);
    const word = w.word.trim(), hint = word.slice(0, Math.min(2, word.length - 1)), rest = word.slice(hint.length).split('');
    questions.push({key, wordbookId: w.wordbookId, word, meaning: w.meaning.trim(), choices: [], answer: -1, type: 'spell', hint, letters: shuffledOrder(rest, rand).map(i => rest[i]), tries: 0}); n--; } };
  const boards = (n: number) => {
    for (let b = 0; b < n; b++) {
      const pairs: {word: string; meaning: string; key: string}[] = [];
      for (const w of words) { const key = wordKey(w); if (pairs.length === 4) break; if (used.has(key) || pairs.some(p => meaningsOverlap(p.meaning, w.meaning) || p.word === w.word.trim())) continue; pairs.push({word: w.word.trim(), meaning: w.meaning.trim(), key}); }
      if (pairs.length < 3) break;
      pairs.forEach(p => used.add(p.key));
      questions.push({key: pairs.map(p => p.key).join('|'), wordbookId: '', word: '', choices: [], answer: -1, type: 'match', pairs, meaningOrder: shuffledOrder(pairs.map(p => p.meaning), rand), matched: [], mistakes: 0});
    }
  };
  const meaningLike = (n: number, type: 'meaning' | 'listen') => {
    const run = buildMeaningRun({books: source.books, wrongs: source.wrongs}, rewardedToday, now, rand, stage, Math.max(n, PET_WORD_FEED.minQuestions), type);
    for (const q of run?.questions || []) { if (n <= 0) break; if (used.has(q.key)) continue; used.add(q.key); questions.push(q); n--; }
  };
  const sentence = (n: number, type: 'order' | 'read') => {
    for (const x of sentences) { if (n <= 0) break; const key = sentenceKey(x); if (used.has(key)) continue; used.add(key);
      const pieces = type === 'order' ? orderPieces({word: x.text, chunked: x.chunked, meaning: x.meaning}) : [];
      questions.push({key, wordbookId: x.wordbookId, word: x.text, chunked: x.chunked, meaning: x.meaning, choices: [], answer: -1, type, ...(type === 'order' ? {pieces: shuffledOrder(pieces, rand).map(i => pieces[i]), tries: 0} : {})}); n--; }
  };
  const readType = (): 'read' | 'order' => options.quiet || options.noMic ? 'order' : 'read';
  if (game === 'spell') spell(count);
  else if (game === 'listen') meaningLike(count, listenOr());
  else if (game === 'match') boards(Math.max(1, Math.ceil(count / 4)));
  else if (game === 'order') { if (sentences.length) sentence(Math.min(count, 8), 'order'); else meaningLike(count, listenOr()); }
  else {
    // 👑 the crown stage: a little of everything (sentences from 4장, when the grade's 문장 세트 has some).
    const withSentences = sentences.length > 0 && Boolean(options.sentences);
    const sent = withSentences ? Math.min(4, Math.floor(count / 3)) : 0, rest = count - sent;
    meaningLike(Math.ceil(rest / 3), 'meaning'); spell(Math.ceil(rest / 3)); meaningLike(rest - Math.ceil(rest / 3) * 2, listenOr());
    if (sent) { sentence(Math.ceil(sent / 2), 'order'); sentence(Math.floor(sent / 2), readType()); }
  }
  // Too few for a game (a tiny book): fall back to 뜻 고르기.
  if (questions.length < (game === 'match' ? 1 : Math.min(PET_WORD_FEED.minQuestions, count))) return buildMeaningRun(source, rewardedToday, now, rand, stage, count, 'meaning');
  const ordered = game === 'mix' ? shuffle(questions, rand) : questions;
  return {id: `${now.toString(36)}${Math.floor(rand() * 1e9).toString(36)}`, questions: ordered, results: [], startedAt: now, finished: false, ...(stage ? {stage} : {})};
}

/** What an answer brings for each kind: the card (뜻 고르기, 듣고 고르기), the spelled word or the sentence put together (a
 *  try: wrong ones come back `pending` until the third), one pick on the 짝 맞추기 board ([word, shown meaning]), or how
 *  the 낭독 went (heard in the browser, so it counts for the stars but pays no points). */
export interface FeedAnswer { choice?: number; text?: string; correct?: boolean; pick?: [number, number] }
export const FEED_TRIES = 3;
const normText = (t: string) => t.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

/**
 * Grade one answer. The same (runId, index) twice returns the stored result and never pays twice; an older index from
 * another device is refused so the newer progress is kept. A miss brings the word back 3 questions later, once, for 0P.
 */
export function answerRun(g: PetGameState, pet: ServerPetState, runId: string, index: number, input: number | FeedAnswer) {
  const run = g.run, a: FeedAnswer = typeof input === 'number' ? {choice: input} : input || {};
  if (!run || run.id !== runId) throw Error('FEED_STALE');
  if (index < run.results.length) return {repeat: true, ...run.results[index]};
  if (index !== run.results.length || run.finished) throw Error('FEED_STALE');
  const q = run.questions[index], type = q.type || 'meaning';
  let correct: boolean, choice = -1;
  if (type === 'meaning' || type === 'listen') {
    choice = Number(a.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices.length) throw Error('FEED_BAD_CHOICE');
    correct = choice === q.answer;
  } else if (type === 'spell' || type === 'order') {
    if (typeof a.text !== 'string') throw Error('FEED_BAD_CHOICE');
    correct = type === 'spell' ? a.text.trim().toLowerCase() === q.word.toLowerCase() : normText(a.text) === normText(q.word);
    // A wrong try: three in all, the answer stays hidden until the last.
    if (!correct) { q.tries = (q.tries || 0) + 1; if (q.tries < FEED_TRIES) return {repeat: false, pending: true, correct: false, triesLeft: FEED_TRIES - q.tries}; }
  } else if (type === 'match') {
    // One pick at a time; the server knows the pairs. The board ends when every pair is found (one slip still passes).
    const [w, m] = Array.isArray(a.pick) ? a.pick.map(Number) : [NaN, NaN], pairs = q.pairs || [];
    if (!Number.isInteger(w) || !Number.isInteger(m) || w < 0 || m < 0 || w >= pairs.length || m >= pairs.length || q.matched!.includes(w)) throw Error('FEED_BAD_CHOICE');
    if (q.meaningOrder![m] !== w) { q.mistakes = (q.mistakes || 0) + 1; return {repeat: false, pending: true, correct: false, mistakes: q.mistakes}; }
    q.matched!.push(w);
    if (q.matched!.length < pairs.length) return {repeat: false, pending: true, correct: true, mistakes: q.mistakes || 0};
    correct = (q.mistakes || 0) <= 1;
  } else correct = a.correct === true;
  // Points: one study unit a word (a board pays its pairs); words already paid today, retries and 낭독 pay nothing.
  let points = 0, xp = 0;
  const units = type === 'read' ? 0 : type === 'match' ? (q.pairs || []).filter(p => !g.rewardedToday.includes(p.key)).length : g.rewardedToday.includes(q.key) ? 0 : 1;
  if (correct && !q.retry && units > 0) {
    const r = awardStudy(pet, 'wordbook-quiz', units); points = r.points; xp = r.xp;
    if (points > 0) { if (type === 'match') q.pairs!.forEach(p => { if (!g.rewardedToday.includes(p.key)) g.rewardedToday.push(p.key); }); else g.rewardedToday.push(q.key); } // capped today: not marked
  }
  // A missed word comes back 3 questions later, once (뜻 고르기, 듣고 고르기, 철자).
  if (!correct && !q.retry && (type === 'meaning' || type === 'listen' || type === 'spell')) run.questions.splice(Math.min(run.questions.length, index + 1 + PET_WORD_FEED.retryAfter), 0, {...q, retry: true, ...(type === 'spell' ? {tries: 0} : {})});
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
  return {id: run.id, stage: run.stage || null, task: run.task || null, finished: run.finished, total: run.questions.length, index: run.results.length,
    questions: run.questions.map((q, i) => {
      const type = q.type || 'meaning', done = i < run.results.length;
      // Never the answer before it is given: 철자 gets the given letters and the shuffled rest, 문장 배열 the shuffled pieces,
      // 짝 맞추기 the words and the shuffled meanings (the server checks each pick). 듣고 고르기 needs the word for the voice;
      // 낭독 shows the sentence to read.
      const hidden = (type === 'spell' || type === 'order') && !done;
      const extra = type === 'spell' ? {meaning: q.meaning, hint: q.hint, letters: q.letters, triesLeft: FEED_TRIES - (q.tries || 0)}
        : type === 'order' ? {meaning: q.meaning, pieces: q.pieces, triesLeft: FEED_TRIES - (q.tries || 0)}
        : type === 'match' ? {words: q.pairs!.map(p => p.word), meanings: q.meaningOrder!.map(k => q.pairs![k].meaning), matched: q.matched || [], mistakes: q.mistakes || 0}
        : type === 'read' ? {meaning: q.meaning} : {};
      return {type, word: hidden ? '' : q.word, choices: q.choices, retry: Boolean(q.retry), ...extra, ...(done ? {answer: q.answer, ...run.results[i]} : {})};
    }),
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
  // The books studied most recently, newest first; their documents are read together, 10 at a time, until three plain
  // word books are found.
  const bookDocs = new Map<string, any>(), recent: string[] = [];
  const order = [...new Set(sessions.sort((a: any, b: any) => ms(b.createdAt) - ms(a.createdAt)).map((s: any) => typeof s.wordbookId === 'string' ? s.wordbookId : '').filter(Boolean))] as string[];
  const fetched = new Map<string, any>();
  for (let i = 0; i < order.length && recent.length < PET_WORD_FEED.books; i += 10) {
    const ids = order.slice(i, i + 10), docs = await Promise.all(ids.map(id => db.collection('wordbooks').doc(id).get()));
    ids.forEach((id, k) => fetched.set(id, docs[k].data() || null));
    // Only the books up to the third plain one count (as when they were read one by one), wrong answers included.
    for (const id of ids) { if (recent.length >= PET_WORD_FEED.books) break; bookDocs.set(id, fetched.get(id)); if (isStandardWordBook(fetched.get(id))) recent.push(id); }
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
  // Candidates in order (newest session first). They're looked up a few at a time, together, until six that still exist
  // are found (as when they were looked up one by one); later candidates are only read when needed.
  const candidates: {wordbookId: string; word: string}[] = [], tried = new Set<string>(), want = PET_WORD_FEED.wrongAnswers * 2;
  for (const s of sessions) {
    if (!isStandardWordBook(bookDocs.get(s.wordbookId)) || !Array.isArray(s.incorrectAnswers)) continue;
    for (const x of s.incorrectAnswers) {
      if (x?.isReviewed || x?.quizSentence || typeof x?.word !== 'string') continue;
      const k = wordKey({wordbookId: s.wordbookId, word: x.word}); if (tried.has(k)) continue; tried.add(k);
      candidates.push({wordbookId: s.wordbookId, word: x.word});
    }
  }
  const wrongs: FeedWord[] = [];
  for (let i = 0; i < candidates.length && wrongs.length < want; i += want) {
    const batch = candidates.slice(i, i + want);
    const hits = await Promise.all(batch.map(c => db.collection('wordbooks').doc(c.wordbookId).collection('words').where('word', '==', c.word).limit(1).get().then((r: any) => r.docs[0] ? toWord(c.wordbookId, r.docs[0]) : null)));
    for (const w of hits) if (w && wrongs.length < want) wrongs.push(w);
  }
  const others = [...new Set(wrongs.map(w => w.wordbookId).filter(id => !books.some(b => b.id === id)))];
  const otherWords = await Promise.all(others.map(id => db.collection('wordbooks').doc(id).collection('words').limit(PET_WORD_FEED.wordWindow).get()));
  others.forEach((id, k) => books.push({id, words: otherWords[k].docs.map((d: any) => toWord(id, d)).filter(Boolean)}));
  for (const w of wrongs) { const book = books.find(b => b.id === w.wordbookId)!; if (!book.words.some(b => b.word === w.word)) book.words.push(w); }
  return {books, wrongs};
}
