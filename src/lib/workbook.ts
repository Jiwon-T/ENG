// 워크북 만들기: turn English sentences into Part 1 (빈칸), Part 2 (단어 배열) and an answer key, without changing the
// original text. Everything here is plain rules (no AI): the Korean translations come from the teacher or the server.
// Every sentence keeps its id, so its translation travels with it when sentences are split, merged or moved.

export interface WorkbookSentence { id: string; text: string; ko: string; koEdited?: boolean }
export interface BlankItem { id: string; text: string; ko: string; tokens: string[]; blanks: number[] }
export interface ArrangeItem { id: string; text: string; ko: string; pieces: string[]; order: number[] }
export interface WorkbookBuild { blanks: BlankItem[]; arrange: ArrangeItem[]; key: string }
/** What was used before for the same passage: blank positions and arrange orders, per sentence position. */
export interface WorkbookHistory { blanks: number[][][]; orders: number[][][] }

export const WORKBOOK_LIMITS = { textChars: 20000, sentences: 80, sentenceChars: 600, minBlanks: 3, maxBlanks: 5 };
export const BLANK = '__________';
let nextId = 0;
export const sentenceId = () => `s${Date.now().toString(36)}${(nextId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ sentences */

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc', 'e.g', 'i.e', 'no', 'vol', 'fig', 'approx', 'inc', 'ltd', 'co', 'corp', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'a.m', 'p.m', 'u.s', 'u.k', 'u.n', 'ph.d']);
/** A word that ends with a period but does not end a sentence (Mr., U.S., e.g., p.m., single initials like J.). */
function isAbbreviation(word: string) {
  const bare = word.replace(/^[("'“‘\[]+/, '').replace(/\.+$/, '').toLowerCase();
  return ABBREVIATIONS.has(bare) || /^[a-z]$/i.test(bare) || /^([a-z]\.)+[a-z]$/i.test(bare);
}
const collapse = (s: string) => s.replace(/[ \t ]+/g, ' ').trim();

/** 연속 지문: split into sentences in order. A sentence ends at . ! ? (also with closing quotes or brackets after it)
 *  followed by a space and a capital letter, digit or opening quote, unless the word is an abbreviation or a number. */
export function splitPassage(text: string): string[] {
  const words = collapse(String(text || '').replace(/\r\n?/g, '\n').replace(/\s*\n\s*/g, ' ')).split(' ').filter(Boolean);
  const out: string[] = []; let current: string[] = [];
  words.forEach((word, i) => {
    current.push(word);
    const next = words[i + 1];
    const ends = /[.!?]["'”’)\]]*$/.test(word) && !/\.{3}["'”’)\]]*$/.test(word);
    const nextStarts = next ? /^["'“‘(\[]*[A-Z0-9]/.test(next) : true;
    if (ends && nextStarts && !(word.endsWith('.') && isAbbreviation(word) && next)) { out.push(current.join(' ')); current = []; }
  });
  if (current.length) out.push(current.join(' '));
  return out;
}

const NUMBERING = /^\s*(?:\(?\d{1,3}[).]|\d{1,3}\s*[-–]|[①-⑳]|[a-z][).]|Q\d{1,3}[.:)]?)\s+/i;
/** A leading item number ("1.", "2)", "(3)", "①", "a)") is not part of the sentence. */
export const stripNumbering = (line: string) => collapse(line).replace(NUMBERING, '');

/** 발췌 문장: one sentence per line; numbering removed, blank lines dropped, order kept. */
export function splitExcerpts(text: string): string[] {
  return String(text || '').replace(/\r\n?/g, '\n').split('\n').map(stripNumbering).filter(Boolean);
}

/* ------------------------------------------------------------------ tokens */

/** Words as written: split on spaces only, so punctuation stays on its word and NASA's, don't, eco-friendly, $20 and
 *  3.5% stay whole. Joining the tokens with single spaces gives the sentence back exactly. */
export function tokenize(sentence: string): string[] {
  return collapse(sentence).split(' ').filter(Boolean);
}
/** The leading and trailing punctuation around a word's core: `"space."` → `"`, `space`, `."`. */
export function splitToken(token: string) {
  const m = token.match(/^([^\p{L}\p{N}$]*)(.*?)([^\p{L}\p{N}%]*)$/u)!;
  return { lead: m[1], core: m[2], trail: m[3] };
}

/* ------------------------------------------------------------------ blanks */

const STOPWORDS = new Set(('a an the and or but nor so yet for of to in on at by from with as into onto upon about over under than then that this these those ' +
  'there here it its it\'s is am are was were be been being do does did done have has had having will would shall should can could may might must ' +
  'i me my mine you your yours he him his she her hers we us our ours they them their theirs who whom whose which what when where why how ' +
  'not no if also just very too only even such each every all any some more most much many other another both either neither one ones own same ' +
  'up down out off again further once while because until though although whether s').split(/\s+/));
const SUFFIXES = /(tion|sion|ment|ness|ity|ance|ence|ship|ism|ous|ive|able|ible|ful|less|ical|al|ize|ise|ify|ly|ed|ing|ist|ure|cy)$/i;

/** a / an / the (any case, with or without punctuation around): never a blank, and kept with the next word in Part 2. */
export const isArticle = (token: string) => /^(a|an|the)$/i.test(splitToken(token).core);

/** How useful a word is to blank out: content words first, longer and suffixed ones (명사·동사·형용사·부사) higher,
 *  words from the teacher's word books highest. 0 = never (punctuation only, numbers, single letters). */
export function blankScore(token: string, known: ReadonlySet<string> = new Set()) {
  const core = splitToken(token).core, lower = core.toLowerCase();
  if (!/\p{L}/u.test(core) || core.length < 2 || isArticle(token)) return 0;
  if (STOPWORDS.has(lower) || STOPWORDS.has(lower.replace(/'s$|’s$/, ''))) return 0.2;
  let score = 1 + Math.min(core.length, 12) / 4;
  if (SUFFIXES.test(lower)) score += 1;
  if (known.has(lower)) score += 3;
  if (core.includes('-')) score += 0.5;
  return score;
}
/** 3–5 blanks by length: about one per four words, never fewer than 3 (or every word when shorter). */
export const blankCount = (tokens: number) => Math.min(tokens, Math.max(WORKBOOK_LIMITS.minBlanks, Math.min(WORKBOOK_LIMITS.maxBlanks, Math.round(tokens / 4))));

type Rand = () => number;
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Pick blank positions: weighted by score, spread out (no two side by side while there's room), and different from
 *  every set used before for this sentence when any other set is possible. */
export function chooseBlanks(tokens: string[], used: number[][] = [], rand: Rand = Math.random, known?: ReadonlySet<string>): number[] {
  const want = blankCount(tokens.length);
  const scores = tokens.map(t => blankScore(t, known));
  const pool = scores.map((s, i) => ({i, s})).filter(x => x.s > 0);
  // Too few blankable words: allow anything that has letters or digits so every sentence still gets 3.
  // Articles are never blanks (too hard for this level), even then.
  const candidates = pool.length >= want ? pool : tokens.map((t, i) => ({i, s: isArticle(t) ? 0 : Math.max(scores[i], /[\p{L}\p{N}]/u.test(t) ? 0.1 : 0)})).filter(x => x.s > 0);
  if (!candidates.length) return [];
  const pickOnce = (spread: boolean) => {
    const left = [...candidates], picked: number[] = [];
    while (picked.length < Math.min(want, candidates.length) && left.length) {
      const allowed = spread ? left.filter(c => !picked.some(p => Math.abs(p - c.i) <= 1)) : left;
      const from = allowed.length ? allowed : left;
      const total = from.reduce((a, c) => a + c.s * c.s, 0); let r = rand() * total, at = 0;
      for (; at < from.length - 1; at++) { r -= from[at].s * from[at].s; if (r <= 0) break; }
      const chosen = from[at]; picked.push(chosen.i); left.splice(left.indexOf(chosen), 1);
    }
    return picked.sort((a, b) => a - b);
  };
  let best: number[] | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const set = pickOnce(attempt < 60);
    if (!best) best = set;
    if (!used.some(u => sameSet(u, set))) return set;
  }
  return best!; // every possible set was used before: a repeat can't be avoided
}

/** The sentence with its blanks: each blank replaces one word's core and keeps its punctuation (`space.` → `____.`). */
export function blankedText(tokens: string[], blanks: number[]) {
  return tokens.map((t, i) => { if (!blanks.includes(i)) return t; const {lead, trail} = splitToken(t); return `${lead}${BLANK}${trail}`; }).join(' ');
}

/* ------------------------------------------------------------------ arrange */

const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
/** A shuffled order of the words (Fisher–Yates), not the original order and not an order used before when avoidable. */
export function shuffleOrder(count: number, used: number[][] = [], rand: Rand = Math.random): number[] {
  const identity = Array.from({length: count}, (_, i) => i);
  if (count < 2) return identity;
  let fallback: number[] | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const order = [...identity];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (sameOrder(order, identity)) continue;
    if (!fallback) fallback = order;
    if (!used.some(u => sameOrder(u, order))) return order;
  }
  return fallback || [...identity.slice(1), identity[0]];
}
/** The pieces students put in order, case kept exactly as written. An article stays with the word after it (the first
 *  word of its noun phrase: "the opportunity", "an eco-friendly"), which makes the puzzle a step easier. */
export function arrangePieces(sentence: string): string[] {
  const out: string[] = [], tokens = tokenize(sentence);
  for (let i = 0; i < tokens.length; i++) {
    // Several articles in a row ("the a") or one before punctuation stay separate words; only a plain article joins.
    if (isArticle(tokens[i]) && /^[A-Za-z]+$/.test(tokens[i]) && i + 1 < tokens.length && !isArticle(tokens[i + 1])) { out.push(`${tokens[i]} ${tokens[i + 1]}`); i++; }
    else out.push(tokens[i]);
  }
  return out;
}

/* ------------------------------------------------------------------ passage identity */

/** The same passage gives the same key however it was spaced or numbered (case and punctuation still count). */
export function passageKey(sentences: string[]) {
  const text = sentences.map(s => collapse(stripNumbering(s))).join('\n');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${text.length.toString(36)}`;
}

/* ------------------------------------------------------------------ build + checks */

/** Build both parts from the sentences, avoiding what earlier versions of the same passage used. */
export function buildWorkbook(sentences: WorkbookSentence[], history: WorkbookHistory = {blanks: [], orders: []}, rand: Rand = Math.random, known?: ReadonlySet<string>): WorkbookBuild {
  const blanks = sentences.map((s, n) => { const tokens = tokenize(s.text); return {id: s.id, text: s.text, ko: s.ko, tokens, blanks: chooseBlanks(tokens, history.blanks.map(v => v[n]).filter(Boolean), rand, known)}; });
  const arrange = sentences.map((s, n) => { const pieces = arrangePieces(s.text); return {id: s.id, text: s.text, ko: s.ko, pieces, order: shuffleOrder(pieces.length, history.orders.map(v => v[n]).filter(Boolean), rand)}; });
  return {blanks, arrange, key: passageKey(sentences.map(s => s.text))};
}

/** Toggle one word in or out of a sentence's blanks (the preview lets the teacher fix the choice); at most 5. */
export function toggleBlank(item: BlankItem, index: number): BlankItem {
  if (!item.tokens[index] || !/[\p{L}\p{N}]/u.test(item.tokens[index]) || isArticle(item.tokens[index])) return item;
  if (!item.blanks.includes(index) && item.blanks.length >= WORKBOOK_LIMITS.maxBlanks) return item;
  const blanks = item.blanks.includes(index) ? item.blanks.filter(i => i !== index) : [...item.blanks, index].sort((a, b) => a - b);
  return {...item, blanks};
}

/** Every check the spec asks for; an empty list means the workbook is complete and faithful to the original. */
export function checkWorkbook(sentences: WorkbookSentence[], build: WorkbookBuild): string[] {
  const issues: string[] = [];
  if (!sentences.length) issues.push('문장이 없어요.');
  if (build.blanks.length !== sentences.length) issues.push(`Part 1 문항 수(${build.blanks.length})가 문장 수(${sentences.length})와 달라요.`);
  if (build.arrange.length !== sentences.length) issues.push(`Part 2 문항 수(${build.arrange.length})가 문장 수(${sentences.length})와 달라요.`);
  sentences.forEach((s, n) => {
    const label = `${n + 1}번`, b = build.blanks[n], a = build.arrange[n];
    if (!s.ko.trim()) issues.push(`${label} 문장의 한글 해석이 비어 있어요.`);
    if (!b || b.id !== s.id || b.text !== s.text) { issues.push(`${label} Part 1 문장이 원문과 순서나 내용이 달라요.`); return; }
    if (!a || a.id !== s.id || a.text !== s.text) { issues.push(`${label} Part 2 문장이 원문과 순서나 내용이 달라요.`); return; }
    if (b.tokens.join(' ') !== collapse(s.text)) issues.push(`${label} 단어를 나누는 중 원문이 바뀌었어요.`);
    if (b.blanks.length < WORKBOOK_LIMITS.minBlanks) issues.push(`${label} 문장의 빈칸이 ${b.blanks.length}개예요 (3개 이상 필요).`);
    if (b.blanks.length > WORKBOOK_LIMITS.maxBlanks) issues.push(`${label} 문장의 빈칸이 ${b.blanks.length}개예요 (5개까지).`);
    if (new Set(b.blanks).size !== b.blanks.length || b.blanks.some(i => i < 0 || i >= b.tokens.length)) issues.push(`${label} 빈칸 위치가 올바르지 않아요.`);
    if (b.blanks.some(i => isArticle(b.tokens[i] || ''))) issues.push(`${label} 관사(a·an·the)가 빈칸이 됐어요.`);
    // Restoring each blank with its word must give the original sentence back.
    const restored = blankedText(b.tokens, b.blanks).split(' ').map((t, i) => b.blanks.includes(i) ? t.replace(BLANK, splitToken(b.tokens[i]).core) : t).join(' ');
    if (restored !== collapse(s.text)) issues.push(`${label} 빈칸을 채우면 원문과 달라져요.`);
    const pieces = arrangePieces(s.text);
    if (a.pieces.length !== pieces.length || a.pieces.some((p, i) => p !== pieces[i]) || a.pieces.join(' ') !== collapse(s.text)) issues.push(`${label} 배열 단어가 원문과 달라요.`);
    const sorted = [...a.order].sort((x, y) => x - y);
    if (sorted.length !== pieces.length || sorted.some((x, i) => x !== i)) issues.push(`${label} 배열에 빠지거나 겹친 단어가 있어요.`);
    if (a.pieces.some(p => !/[\p{L}\p{N}$]/u.test(p))) issues.push(`${label} 문장부호만 있는 배열 항목이 있어요.`);
  });
  return issues;
}

/** One line of the 단어 배열 for students: the pieces in shuffled order. */
export const arrangeLine = (item: ArrangeItem) => item.order.map(i => item.pieces[i]).join(' / ');

/** AI translations arrive for the sentences as they were when asked: each fills its sentence only if that sentence
 *  still has the same English text and is still empty (anything typed or changed meanwhile wins). */
export function applyAiTranslations(current: WorkbookSentence[], asked: { id: string; text: string }[], translations: string[]): WorkbookSentence[] {
  const byId = new Map(asked.map((s, i) => [s.id, { text: s.text, ko: String(translations[i] || '').trim() }]));
  return current.map(s => { const got = byId.get(s.id); return got && got.ko && got.text === s.text && !s.ko.trim() ? { ...s, ko: got.ko, koEdited: false } : s; });
}
/** What the teacher confirmed about the AI translations: each AI-filled sentence with its English and Korean. Any change
 *  to one of them (or a new AI one) gives a different key, so the confirmation no longer counts. */
export const aiReviewKey = (sentences: WorkbookSentence[]) => JSON.stringify(sentences.filter(s => s.ko.trim() && s.koEdited === false).map(s => [s.id, s.text, s.ko]));

/** Translations pasted one per line are matched to the sentences in order; edited ones stay unless `overwrite`. */
export function applyTranslations(sentences: WorkbookSentence[], lines: string[], overwrite = false): WorkbookSentence[] {
  return sentences.map((s, i) => { const ko = (lines[i] || '').trim(); return ko && (overwrite || !s.ko.trim()) ? {...s, ko, koEdited: true} : s; });
}

/** A file name without characters Windows or macOS refuse. */
export const safeFileName = (title: string, version: number) => `${(title || '워크북').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || '워크북'}_v${version}.docx`;
