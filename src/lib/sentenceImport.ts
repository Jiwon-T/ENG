// 문장 세트: pasted sentences → rows of English and Korean, shown in a table before saving (nothing is guessed silently).

/** `unit`, `unitTitle` and `chapter` come from UNIT / CHAPTER lines in the paste (a book like 천일문); the UNIT number is
 *  saved as the sentence's Day. */
export interface SentenceRow { english: string; korean: string; unit?: number; unitTitle?: string; chapter?: string }

/** Leading numbers: 001. / 1. / 1) / (3) / ① ❶ ➀ ➊ ⓵ ⑴ ⒈ …, and a bare "2 " only before a capital letter (so
 *  "100 people …" or "2026 is …" keep their number). */
const NUMBER = /^\s*(?:\(\d{1,4}\)|\d{1,4}[.)](?!\d)|\d{1,3}(?=\s+[\"'“‘(]?[A-Z])|[①-⑳⑴-⒇⒈-⒛⓫-⓴⓵-⓾❶-➓])\s*/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const LATIN = /[A-Za-z]/;

export const stripNumber = (line: string) => line.replace(NUMBER, '').trim();
/** `/` marks where to pause (끊어 읽기): kept in the data, hidden when a sentence is shown. */
export const showSentence = (text: string) => text.replace(/\s*\/\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** "UNIT 01 주어+동사" / "CHAPTER 01 문장의 기본 구조" on a line of their own. In capitals it is always a heading (a title
 *  may end in "p.p."); otherwise a line ending like a sentence ("Unit 3 is closed.") is a sentence. */
const UNIT_LINE = /^UNIT\s*(\d{1,3})(?!\d)\s*[.:\-–·]?\s*(.*)$/i;
const CHAPTER_LINE = /^CHAPTER\s*(\d{1,3})(?!\d)\s*[.:\-–·]?\s*(.*)$/i;
const heading = (line: string, re: RegExp) => {
  const m = line.match(re);
  return m && (/^(UNIT|CHAPTER)/.test(line) || !/[.?!"”']$/.test(m[2].trim())) ? { no: Number(m[1]), title: m[2].replace(/\s{2,}/g, ' ').trim() } : null;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
/** "UNIT 01 · 주어+동사" for a Day that came from a UNIT line, otherwise "Day 3". `short` leaves the title out. */
export const unitLabel = (day: number, unit?: { title: string }, short = false) =>
  unit ? `UNIT ${pad2(day)}${unit.title && !short ? ` · ${unit.title}` : ''}` : `Day ${day}`;

/** The Days of a 문장 세트 that came from UNIT lines, with their title and CHAPTER (from the first sentence that has one). */
export function sentenceUnits(words: { day?: number; unitTitle?: string; chapter?: string }[]) {
  const units = new Map<number, { title: string; chapter: string }>();
  for (const w of words) {
    const day = Number(w.day) || 1;
    if (typeof w.unitTitle !== 'string' || units.has(day)) continue;
    units.set(day, { title: w.unitTitle, chapter: w.chapter || '' });
  }
  return units;
}

/** One line holding both: split at the first Korean letter ("She runs. 그녀는 달린다."), or at a tab. */
function splitPair(line: string): SentenceRow | null {
  if (line.includes('\t')) {
    const [en, ...ko] = line.split('\t').map(p => p.trim()).filter(Boolean);
    if (en && LATIN.test(en) && !HANGUL.test(en)) return { english: en, korean: stripNumber(ko.join(' ')) };
  }
  const at = line.search(HANGUL);
  if (at <= 0) return null;
  const en = line.slice(0, at).replace(/[\s|\-–—:]+$/, '').trim();
  return LATIN.test(en) ? { english: en, korean: line.slice(at).trim() } : null;
}

/**
 * Lines may be numbered, English and Korean may alternate (a Korean line belongs to the English line above it), or one
 * line may hold both. An English line with no Korean after it keeps an empty translation (filled by hand or by AI).
 */
export function parseSentences(text: string): { rows: SentenceRow[]; skipped: string[] } {
  const rows: SentenceRow[] = [], skipped: string[] = [];
  let unit: { no: number; title: string } | null = null, chapter = '';
  const add = (row: SentenceRow) => rows.push(unit ? { ...row, unit: unit.no, unitTitle: unit.title, ...(chapter ? { chapter } : {}) } : row);
  for (const raw of text.split(/\r?\n/)) {
    const chapterLine = heading(raw.trim(), CHAPTER_LINE), unitLine = heading(raw.trim(), UNIT_LINE);
    if (chapterLine) { chapter = `CHAPTER ${pad2(chapterLine.no)}${chapterLine.title ? ` · ${chapterLine.title}` : ''}`; continue; }
    if (unitLine && unitLine.no > 0) { unit = unitLine; continue; }
    const line = stripNumber(raw);
    if (!line) continue;
    const pair = splitPair(line);
    if (pair) { add(pair); continue; }
    if (HANGUL.test(line)) {
      // A translation: for the sentence above it, if that one has none yet; otherwise it is listed under the table.
      const last = rows[rows.length - 1];
      if (last && !last.korean) last.korean = line; else skipped.push(line);
      continue;
    }
    if (LATIN.test(line)) add({ english: line, korean: '' }); else skipped.push(line);
  }
  return { rows: rows.map(r => ({ ...r, english: r.english.replace(/\s{2,}/g, ' '), korean: r.korean.replace(/\s{2,}/g, ' ') })), skipped };
}
