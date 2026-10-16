// 문장 세트: pasted sentences → rows of English and Korean, shown in a table before saving (nothing is guessed silently).

export interface SentenceRow { english: string; korean: string }

/** Leading numbers: 001. / 1. / 1) / (3) / ① ❶ ➀ ➊ ⓵ ⑴ ⒈ …, and a bare "2 " only before a capital letter (so
 *  "100 people …" or "2026 is …" keep their number). */
const NUMBER = /^\s*(?:\(\d{1,4}\)|\d{1,4}[.)](?!\d)|\d{1,3}(?=\s+[\"'“‘(]?[A-Z])|[①-⑳⑴-⒇⒈-⒛⓫-⓴⓵-⓾❶-➓])\s*/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const LATIN = /[A-Za-z]/;

export const stripNumber = (line: string) => line.replace(NUMBER, '').trim();
/** `/` marks where to pause (끊어 읽기): kept in the data, hidden when a sentence is shown. */
export const showSentence = (text: string) => text.replace(/\s*\/\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

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
  for (const raw of text.split(/\r?\n/)) {
    const line = stripNumber(raw);
    if (!line) continue;
    const pair = splitPair(line);
    if (pair) { rows.push(pair); continue; }
    if (HANGUL.test(line)) {
      // A translation: for the sentence above it, if that one has none yet; otherwise it is listed under the table.
      const last = rows[rows.length - 1];
      if (last && !last.korean) last.korean = line; else skipped.push(line);
      continue;
    }
    if (LATIN.test(line)) rows.push({ english: line, korean: '' }); else skipped.push(line);
  }
  return { rows: rows.map(r => ({ english: r.english.replace(/\s{2,}/g, ' '), korean: r.korean.replace(/\s{2,}/g, ' ') })), skipped };
}
