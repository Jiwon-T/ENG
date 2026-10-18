// 지문 분석 4단계, the parts the app works out by itself (no AI): 난이도 ★ with the measurements behind it, and the
// linking words (역접·예시·결과·결론) to mark in the sentences. Also the 구조 지도 contract shared with the server:
// roles[i] is the role of sentence i (0-based; '' = no role), key is the 0-based index of the key sentence.
import { grammarTags } from './passageTools.js';
import { splitToken, tokenize } from './workbook.js';

/* ------------------------------------------------------------------ 난이도 */

export interface PassageLevel { stars: number; label: string; measures: string[]; short: boolean }
const LEVEL_LABEL = ['', '쉬움', '조금 쉬움', '보통', '조금 어려움', '어려움'];
const step = (v: number, cuts: number[]) => 1 + cuts.filter(c => v >= c).length;
/** 난이도 ★1~5 from fixed rules (sentence length, long sentences, long words, clauses). All four are ratios, so a
 *  short passage still gets stars, marked `short` (fewer than 3 sentences or 40 words: a rough value). Null only for a
 *  fragment under 15 words. */
export function passageLevel(sentences: string[]): PassageLevel | null {
  const words = sentences.map(s => tokenize(s).map(t => splitToken(t).core).filter(w => /[a-z]/i.test(w)));
  const all = words.flat();
  if (all.length < 15) return null;
  const avg = all.length / sentences.length, long = words.filter(w => w.length >= 25).length;
  const longWords = all.filter(w => w.replace(/[^a-z]/gi, '').length >= 9).length / all.length;
  const clauses = sentences.reduce((n, s) => n + grammarTags(s).filter(t => t.kind === 'clause' || t.label === '분사구문').length, 0);
  const score = (step(avg, [12, 16, 20, 25]) + step(longWords, [0.06, 0.09, 0.12, 0.16]) + step(clauses / sentences.length, [0.3, 0.6, 1, 1.4])) / 3 + (long / sentences.length >= 0.3 ? 0.5 : 0);
  const stars = Math.min(5, Math.max(1, Math.round(score)));
  return { stars, label: LEVEL_LABEL[stars], short: sentences.length < 3 || all.length < 40, measures: [`평균 ${Math.round(avg)}단어`, `25단어 이상 문장 ${long}개`, `긴 단어(9글자 이상) ${Math.round(longWords * 100)}%`, `관계사·접속사·분사구 ${clauses}곳`] };
}

/* ------------------------------------------------------------------ 연결어 */

export type LinkKind = '역접' | '예시' | '결과' | '결론';
const LINKS: [LinkKind, string[]][] = [
  ['역접', ['however', 'nevertheless', 'nonetheless', 'on the other hand', 'in contrast', 'on the contrary', 'by contrast', 'instead', 'but', 'yet', 'still']],
  ['예시', ['for example', 'for instance', 'to illustrate']],
  ['결과', ['as a result', 'consequently', 'as a consequence', 'accordingly', 'so']],
  ['결론', ['therefore', 'thus', 'hence', 'in short', 'in conclusion', 'in sum', 'to sum up', 'in brief', 'ultimately']],
];
// short words that are linkers only at the start of a sentence or after ; (elsewhere "but"/"so"/"still" mean other things)
const START_ONLY = new Set(['but', 'yet', 'still', 'instead', 'so']);
export interface LinkMark { at: number; length: number; kind: LinkKind }
/** The linking words in a sentence, by token position (at = first token, length = tokens), for marking in place. */
export function linkWords(sentence: string): LinkMark[] {
  const tokens = tokenize(sentence), core = tokens.map(t => splitToken(t).core.toLowerCase()), out: LinkMark[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const starts = i === 0 || /[;:]$/.test(tokens[i - 1]);
    for (const [kind, list] of LINKS) {
      const hit = list.find(p => { const w = p.split(' '); return w.every((x, k) => core[i + k] === x) && (!START_ONLY.has(p) || starts)
        // the phrase must be one piece: no mark inside it ("For example," ends at the comma, not before)
        && w.slice(0, -1).every((_, k) => !/[,.;:!?]$/.test(tokens[i + k])); });
      if (hit) { const length = hit.split(' ').length; out.push({ at: i, length, kind }); i += length - 1; break; }
    }
  }
  return out;
}

/** A sentence cut into pieces (직독직해 chunks, pause hints, or the whole sentence) as runs of plain words and of one
 *  linking phrase each ("For example," is one run). The pieces must hold the sentence's tokens in order; if they do not,
 *  each piece is one plain run. Used on screen, on the printed 분석지 and in Word alike. */
export function linkRuns(sentence: string, pieces: string[]): { text: string; kind?: LinkKind }[][] {
  const marks = linkWords(sentence), split = pieces.map(p => tokenize(p));
  if (!marks.length || split.reduce((n, t) => n + t.length, 0) !== tokenize(sentence).length) return pieces.map(p => [{ text: p }]);
  const markOf = new Map<number, LinkMark>();
  for (const m of marks) for (let k = 0; k < m.length; k++) markOf.set(m.at + k, m);
  let at = 0;
  return split.map(tokens => { const start = at; at += tokens.length;
    const runs: { mark?: LinkMark; words: string[] }[] = [];
    tokens.forEach((t, k) => { const m = markOf.get(start + k), last = runs[runs.length - 1];
      if (last && last.mark === m) last.words.push(t); else runs.push({ mark: m, words: [t] }); });
    return runs.map(r => ({ text: r.words.join(' '), ...(r.mark ? { kind: r.mark.kind } : {}) })); });
}

/* ------------------------------------------------------------------ 구조 지도 */

export const STRUCTURE_ROLES = ['도입', '통념', '문제 제기', '주장', '반박', '근거', '예시', '대조', '결과', '결론'] as const;
export type StructureRole = typeof STRUCTURE_ROLES[number];
/** Short definitions shown with the map, so the roles read the same every time. */
export const ROLE_MEANING: Record<StructureRole, string> = {
  도입: '화제를 꺼내는 문장', 통념: '많은 사람이 믿는 생각', '문제 제기': '질문이나 문제를 던지는 문장', 주장: '글쓴이의 생각',
  반박: '앞의 생각을 뒤집는 문장', 근거: '주장을 받치는 사실·연구', 예시: '구체적인 예', 대조: '다른 것과 비교하는 문장', 결과: '앞 내용에서 생긴 일', 결론: '글을 마무리하는 핵심 생각',
};
export interface StructureMap { roles: string[]; key: number }
/** Check a 구조 지도 against the passage: one role per sentence ('' allowed, unknown roles become ''), a key sentence
 *  in range. Null when it does not fit (wrong length, no key). */
export function cleanStructure(data: any, count: number): StructureMap | null {
  const roles = Array.isArray(data?.roles) ? data.roles : null, key = Number(data?.key);
  if (!roles || roles.length !== count || !Number.isInteger(key) || key < 0 || key >= count) return null;
  const clean = roles.map((r: any) => (STRUCTURE_ROLES as readonly string[]).includes(String(r).trim()) ? String(r).trim() : '');
  return clean.some(Boolean) ? { roles: clean, key } : null;
}
/** The flow of the passage from its roles: neighbours with the same role are one step (통념 → 반박 → 근거 → 결론). */
export const structureFlow = (roles: string[]) => roles.filter(Boolean).filter((r, i, a) => r !== a[i - 1]).join(' → ');
