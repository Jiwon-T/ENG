// 단어장 출력하기: which words go in the Word file and the number shown beside each ("Day 3 - 5").
// 'registered': the DAY (or UNIT) each word was saved with, whatever its size — books like 능률VOCA have 25–38 words a DAY.
// 'count': cut the book every N words in order (the old way), and the range picks by that same cut.

export type WordbookPrintMode = 'registered' | 'count';
export interface PrintableWord { day?: number; order?: number }

/** `dayOf`: the day a word was saved with (the manager's getWordDay). `label`: how a day is written ('Day 3', 'UNIT 03'). */
export function wordbookPrintPlan<T extends PrintableWord>(words: T[], mode: WordbookPrintMode, range: { startDay: number; endDay: number; unitSize: number },
  dayOf: (word: T, index: number) => number, label: (day: number) => string = day => `Day ${day}`) {
  const size = Math.max(1, Math.floor(range.unitSize) || 1);
  const days = words.map((w, i) => mode === 'count' ? Math.floor(i / size) + 1 : dayOf(w, i));
  const picked = words.map((word, i) => ({ word, day: days[i], i })).filter(x => x.day >= range.startDay && x.day <= range.endDay);
  // Registered days: in day order, each day's words in their own order.
  if (mode === 'registered') picked.sort((a, b) => a.day - b.day || (a.word.order ?? a.i) - (b.word.order ?? b.i));
  const within = new Map<number, number>();
  const numbers = picked.map(x => { const n = (within.get(x.day) || 0) + 1; within.set(x.day, n); return `${label(x.day)} - ${n}`; });
  return { words: picked.map(x => x.word), numbers, days: [...new Set(picked.map(x => x.day))] };
}

/** The days to choose from: registered ones with their word counts, or 1…N for a cut of N words. */
export function wordbookPrintDays<T extends PrintableWord>(words: T[], mode: WordbookPrintMode, unitSize: number, dayOf: (word: T, index: number) => number) {
  if (mode === 'count') { const size = Math.max(1, Math.floor(unitSize) || 1); const n = Math.ceil(words.length / size); return Array.from({ length: n }, (_, i) => ({ day: i + 1, count: Math.min(size, words.length - i * size) })); }
  const counts = new Map<number, number>();
  words.forEach((w, i) => { const d = dayOf(w, i); counts.set(d, (counts.get(d) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([day, count]) => ({ day, count }));
}
