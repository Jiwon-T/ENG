import {normalizeSearch} from './koreanSearch';

// 수업 일지 메모 → 학습 세트 (바로 출력 칩): a line naming a word book and its DAYs ("능률voca day30 31", "수능2000 day 32,33")
// or starting with "단어:" gives a chip that opens the test paper or the print right there.
export interface MemoBook { id: string; title: string }
export interface MemoPick { books: MemoBook[]; start: number | null; end: number | null }

const DAY = /\bday\s*(\d{1,3})(?:\s*(?:[-~,]|\s)\s*(\d{1,3}))?/i;
const DAY_ALL = new RegExp(DAY.source, 'gi');
/** "day30 31" · "Day 1-2" · "day 32,33" → 30~31; "day 5" → 5~5; none → null. */
export function dayRange(text: string) {
  const m = String(text || '').match(DAY); if (!m) return null;
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  return {start: Math.min(a, b), end: Math.max(a, b)};
}
/** The chips a memo gives: books named on a line with DAYs or after "단어:" (`books` with more than one = which one?), and
 *  `ask` when a "단어:" line names none (a chip to look for the book). Only such lines count, so other notes stay quiet. */
export function memoPicks(text: string, books: MemoBook[]): {picks: MemoPick[]; ask: MemoPick | null} {
  const norm = books.map(b => ({b, n: normalizeSearch(b.title)})), picks: MemoPick[] = []; let ask: MemoPick | null = null;
  for (const line of String(text || '').split('\n')) {
    const trigger = line.match(/단어\s*:\s*(.*)$/), part = trigger ? trigger[1] : line, range = dayRange(part);
    if (!trigger && !range) continue;
    const tokens = part.replace(DAY_ALL, ' ').split(/[\s,/·()[\]:]+/).filter(Boolean);
    // single words and two side by side ("수능 2000" for "수능2000")
    const tries = tokens.flatMap((t, i) => tokens[i + 1] ? [t + tokens[i + 1], t] : [t]);
    let found = false;
    for (const q of tries) {
      const nq = normalizeSearch(q); if (nq.length < 2 || /^\d+$/.test(nq)) continue;
      const hits = norm.filter(x => x.n.startsWith(nq) || (nq.length >= 3 && x.n.includes(nq))).map(x => x.b);
      if (!hits.length) continue;
      found = true;
      if (!picks.some(p => p.books.length === hits.length && p.books.every((b, k) => b.id === hits[k].id))) picks.push({books: hits, start: range?.start ?? null, end: range?.end ?? null});
      break;
    }
    if (trigger && !found && !ask) ask = {books: [], start: range?.start ?? null, end: range?.end ?? null};
  }
  return {picks: picks.slice(0, 3), ask};
}
