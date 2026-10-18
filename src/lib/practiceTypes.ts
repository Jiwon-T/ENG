// 지문 분석 › 연습 유형 추천: practice types suggested from formal clues in the passage the app can see (no AI). Each comes
// with the clue it was found by (연결어로 시작하는 문장 3개, 확실한 어법 포인트 4곳 …). The order only sorts them; no score,
// percentage or "출제 가능성" is shown — it is a suggestion for practice, not an exam forecast.
import { grammarHighlights, type QuestionType } from './questionMaker';
import { splitToken, tokenize } from './workbook';

export interface PracticeHint { type: QuestionType; reason: string; order: number }
const LINKER = /^["'“‘(]*(however|but|yet|instead|therefore|thus|hence|as a result|for example|for instance|in addition|moreover|furthermore|similarly|likewise|on the other hand|in contrast|nevertheless|this|these|those|such|then|also)\b/i;
const CLAIM = /\b(should|must|need to|have to|ought to|it is (important|essential|necessary|crucial))\b/i;
const CONCLUDE = /^["'“‘(]*(therefore|thus|in short|in conclusion|in sum|as a result|hence|ultimately)\b/i;
const word = (s: string) => s.replace(/^["'“‘(]+/, '').split(/[\s,]+/)[0];

/** The practice types this passage suits, best first (at most a few; only types with a clue). */
export function practiceHints(sentences: string[]): PracticeHint[] {
  const n = sentences.length, out: PracticeHint[] = [];
  const linked = sentences.slice(1).filter(s => LINKER.test(s)), linkWords = [...new Set(linked.map(word))].slice(0, 3).join(' · ');
  if (n >= 4 && linked.length >= 2) out.push({ type: 'order', reason: `연결어·지시어로 시작하는 문장 ${linked.length}개 (${linkWords})`, order: 10 + linked.length });
  if (n >= 6 && linked.length >= 1) out.push({ type: 'insert', reason: `연결어·지시어로 시작하는 문장 ${linked.length}개 (${linkWords})`, order: 9 + linked.length });
  const sure = grammarHighlights(sentences).flat().filter(p => p.kind === 'sure').length;
  if (n >= 3 && sure >= 3) out.push({ type: 'choice', reason: `확실한 어법 포인트 ${sure}곳`, order: 8 + sure });
  if (n >= 3 && sure >= 1) out.push({ type: 'grammar', reason: `확실한 어법 포인트 ${sure}곳`, order: 6 + sure });
  const claims = sentences.filter(s => CLAIM.test(s)).length, concl = sentences.filter(s => CONCLUDE.test(s)), conclWords = [...new Set(concl.map(word))].slice(0, 2).join(' · ');
  if (n >= 3 && claims >= 1) out.push({ type: 'claim', reason: `should·must 같은 주장 표현이 있는 문장 ${claims}개`, order: 7 + claims });
  if (n >= 3 && (concl.length || claims)) out.push({ type: 'gist', reason: concl.length ? `결론을 여는 말로 시작하는 문장 (${conclWords})` : `주장 표현이 있는 문장 ${claims}개`, order: 6 + concl.length + claims });
  if (n >= 3 && (concl.length || claims)) out.push({ type: 'title', reason: concl.length ? `결론을 여는 말로 시작하는 문장 (${conclWords})` : `주장 표현이 있는 문장 ${claims}개`, order: 5 + concl.length });
  if (n >= 3 && (concl.length || claims)) out.push({ type: 'blank', reason: '핵심 생각을 담은 문장이 있어 빈칸 연습에 좋아요', order: 4 });
  if (n >= 7) out.push({ type: 'irrelevant', reason: `${n}문장으로 긴 지문`, order: 5 });
  if (n >= 6) out.push({ type: 'summary', reason: `${n}문장으로 긴 지문`, order: 3 });
  // numbers and names inside sentences (not the first word): facts to check
  const facts = sentences.flatMap(s => tokenize(s).slice(1).map(t => splitToken(t).core)).filter(w => /\d/.test(w) || (/^[A-Z][a-z]+/.test(w) && w !== 'I')).length;
  if (n >= 3 && facts >= 3) out.push({ type: 'consistency', reason: `숫자·이름 ${facts}개`, order: 4 + Math.min(facts, 5) });
  return out.sort((a, b) => b.order - a.order);
}
