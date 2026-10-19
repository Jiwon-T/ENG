// 지문 분석 › 연습 유형 추천: practice types suggested from formal clues in the passage the app can see (no AI). Each comes
// with the clue it was found by (연결어로 시작하는 문장 3개, 확실한 어법 포인트 4곳 …). The order only sorts them; no score,
// percentage or "출제 가능성" is shown — it is a suggestion for practice, not an exam forecast.
import { grammarHighlights, type QuestionType } from './questionMaker';
import { splitToken, tokenize } from './workbook';
import { linkWords as linkMarks } from './passageLevel';
import { grammarTags } from './passageTools';

const COMPARE = /\b(more|less|better|worse|[a-z]+er) than\b/gi;

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
  // 서술형 어법: two sure points to find and fix
  if (n >= 3 && sure >= 2) out.push({ type: 'correct', reason: `확실한 어법 포인트 ${sure}곳 — 찾아 고쳐 쓰기`, order: 3 + Math.min(sure, 4) });
  // 어휘 선택: where the flow turns (역접) or two things are compared, a word's meaning decides the sense
  const turns = sentences.filter(s => linkMarks(s).some(m => m.kind === '역접')).length, compares = sentences.reduce((t, s) => t + (s.match(COMPARE) || []).length, 0);
  if (n >= 4 && turns + compares >= 2) out.push({ type: 'vocab', reason: `역접 연결어 ${turns}곳 · 비교 표현 ${compares}곳 — 낱말 뜻이 흐름을 정하는 곳`, order: 4 + Math.min(turns + compares, 4) });
  // 서술형 영작: sentences of 7–20 words built on a clear structure (관계사·접속사·to부정사 …)
  const built = sentences.filter(s => { const w = tokenize(s).length; return w >= 7 && w <= 20 && grammarTags(s).some(t => t.kind === 'clause' || t.kind === 'phrase'); }).length;
  if (n >= 3 && built >= 1) out.push({ type: 'compose', reason: `구문이 분명한 7~20단어 문장 ${built}개`, order: 3 + Math.min(built, 3) });
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
