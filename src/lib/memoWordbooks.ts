import {normalizeSearch} from './koreanSearch';

// 수업 일지 메모 → 학습 세트 (바로 출력 칩): a line naming a word book and its DAYs ("능률voca day30 31", "수능2000 day 32,33")
// or starting with "단어:" gives a chip that opens the test paper or the print right there; a line naming several books, each
// with its DAYs ("수능2000 Day 1~2, 중등 실력 Day 1~2"), gives a chip for each. "단어:" and a line with DAYs look in
// the 단어장 and the 내신 대비 단어장 together; "문법:" looks in the 문법 세트 only (its chips are marked 문법).
export type MemoCategory = 'word' | 'exam' | 'grammar';
export interface MemoBook { id: string; title: string; /** the 학습 세트 kind (none: 단어장) */ category?: MemoCategory }
export interface DayGroup { start: number; end: number }
/** `groups`: the sheets the memo wrote apart ("1~2, 3~4" or "1,2 3,4"), for 나눠서 from the start. */
export interface MemoPick { books: MemoBook[]; start: number | null; end: number | null; groups?: DayGroup[]; /** "문법:" */ kind?: 'grammar' }

// a DAY number, not a count after it ("3개", "2문제")
const NUM = String.raw`\d{1,3}(?!\d|\s*(?:개|문제|점|번|분|시간|명|장|쪽|%))`;
const DAY = new RegExp(String.raw`\bday\s*(${NUM}(?:\s*(?:[-~,/]|\s)\s*${NUM})*)`, 'i');
const DAY_ALL = new RegExp(DAY.source, 'gi');
/** Every DAY the memo names: "day30 31" · "Day 1-2" · "day 32,33" → 30~31; "Day 1,2,3,4" · "1~4" → 1~4; "day 5" → 5~5;
 *  none → null. Sheets written apart ("1~2, 3~4", "1,2 3,4") come back as `groups`. */
export function dayRange(text: string): (DayGroup & {groups?: DayGroup[]}) | null {
  const m = String(text || '').match(DAY); if (!m) return null;
  const range = (piece: string): DayGroup => { const n = piece.match(/\d+/g)!.map(Number); return {start: Math.min(...n), end: Math.max(...n)}; };
  // a piece with a range or a list in it is one sheet; two or more of them = written apart
  const chunks = m[1].includes('~') || m[1].includes('-') ? m[1].split(/\s*[,/]\s*|\s+(?=\d)/) : m[1].split(/\s+/);
  const sheets = chunks.filter(c => /\d\s*[-~,]\s*\d/.test(c)).length >= 2 ? chunks.filter(c => /\d/.test(c)).map(range) : [];
  const whole = range(m[1]);
  return sheets.length >= 2 ? {...whole, groups: sheets} : whole;
}
/** 나눠서: the memo's own sheets, else two DAYs a sheet (1~2, 3~4, 5); just two DAYs (1~2) → one DAY a sheet (1, 2), for a
 *  student who needs it smaller. */
export function daySheets(pick: {start: number | null; end: number | null; groups?: DayGroup[]}): DayGroup[] {
  if (pick.start === null || pick.end === null) return [];
  if (pick.groups?.length) return pick.groups;
  const size = pick.end - pick.start === 1 ? 1 : 2;
  const out: DayGroup[] = []; for (let d = pick.start; d <= pick.end; d += size) out.push({start: d, end: Math.min(d + size - 1, pick.end)});
  return out;
}
/** The chips a memo gives: books named on a line with DAYs or after "단어:" / "문법:" (`books` with more than one = which one?),
 *  and `ask` / `grammarAsk` when such a line names none (a chip to look for the set). Only such lines count, so other notes
 *  stay quiet. */
export function memoPicks(text: string, books: MemoBook[]): {picks: MemoPick[]; ask: MemoPick | null; grammarAsk: MemoPick | null} {
  const all = books.map(b => ({b, n: normalizeSearch(b.title), grammar: b.category === 'grammar'})), picks: MemoPick[] = []; let ask: MemoPick | null = null, grammarAsk: MemoPick | null = null;
  for (const line of String(text || '').split('\n')) {
    const trigger = line.match(/(단어|문법)\s*:\s*(.*)$/), whole = trigger ? trigger[2] : line, grammar = trigger?.[1] === '문법';
    if (!trigger && !dayRange(whole)) continue;
    const norm = all.filter(x => x.grammar === grammar);
    // several books on one line ("수능2000 Day 1~2, 중등 실력 Day 1~2"): each book with the DAYs after it
    const days = [...whole.matchAll(DAY_ALL)], parts = days.length >= 2 ? days.map((m, k) => whole.slice(k ? days[k - 1].index! + days[k - 1][0].length : 0, m.index! + m[0].length)) : [whole];
    let found = false;
    for (const part of parts) {
      const range = dayRange(part), tokens = part.replace(DAY_ALL, ' ').split(/[\s,/·()[\]:]+/).filter(Boolean);
      // single words and two side by side ("수능 2000" for "수능2000")
      const tries = tokens.flatMap((t, i) => tokens[i + 1] ? [t + tokens[i + 1], t] : [t]);
      for (const q of tries) {
        const nq = normalizeSearch(q); if (nq.length < 2 || /^\d+$/.test(nq)) continue;
        const hits = norm.filter(x => x.n.startsWith(nq) || (nq.length >= 3 && x.n.includes(nq))).map(x => x.b);
        if (!hits.length) continue;
        found = true;
        const start = range?.start ?? null, end = range?.end ?? null;
        if (!picks.some(p => p.start === start && p.end === end && p.books.length === hits.length && p.books.every((b, k) => b.id === hits[k].id))) picks.push({books: hits, start, end, ...(range?.groups ? {groups: range.groups} : {}), ...(grammar ? {kind: 'grammar' as const} : {})});
        break;
      }
    }
    const range = dayRange(whole);
    if (trigger && !found && grammar && !grammarAsk) grammarAsk = {books: [], start: range?.start ?? null, end: range?.end ?? null, kind: 'grammar'};
    if (trigger && !found && !grammar && !ask) ask = {books: [], start: range?.start ?? null, end: range?.end ?? null};
  }
  return {picks: picks.slice(0, 6), ask, grammarAsk};
}
