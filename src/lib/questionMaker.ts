// 변형 문제. App-made types (순서 배열, 문장 삽입, 어법 수정, 어법 선택) are built from the passage by rules, so the
// answer is known by construction and the original text is never changed. AI-helped types (빈칸 추론, 무관한 문장, 요약문,
// 제목·주제·요지·주장, 내용 일치) take only the parts that need meaning from the AI (buildAiQuestion); the app places the
// answer at a random number and checks everything. Every question is checked before it is shown (checkQuestion).
// Server-imported: keep relative imports with .js.
import { splitPassage, splitToken, tokenize } from './workbook.js';

export type AppQuestionType = 'order' | 'insert' | 'grammar' | 'choice' | 'correct';
export type AiQuestionType = 'blank' | 'irrelevant' | 'summary' | 'title' | 'topic' | 'gist' | 'claim' | 'consistency' | 'vocab' | 'compose';
/** 'workbook': 빈칸 워크북, made before 어법 선택 took its place (the 워크북 menu makes blanks); old sets still show. */
export type QuestionType = AppQuestionType | AiQuestionType | 'workbook';
export const QUESTION_TYPES: { id: QuestionType; label: string; by: 'app' | 'ai'; minSentences: number }[] = [
  { id: 'order', label: '순서 배열', by: 'app', minSentences: 4 },
  { id: 'insert', label: '문장 삽입', by: 'app', minSentences: 6 },
  { id: 'grammar', label: '어법 수정', by: 'app', minSentences: 3 },
  { id: 'choice', label: '어법 선택', by: 'app', minSentences: 3 },
  { id: 'vocab', label: '어휘 선택', by: 'ai', minSentences: 4 },
  { id: 'blank', label: '빈칸 추론', by: 'ai', minSentences: 3 },
  { id: 'irrelevant', label: '무관한 문장', by: 'ai', minSentences: 5 },
  { id: 'summary', label: '요약문 완성', by: 'ai', minSentences: 3 },
  { id: 'title', label: '제목', by: 'ai', minSentences: 3 },
  { id: 'topic', label: '주제', by: 'ai', minSentences: 3 },
  { id: 'gist', label: '요지', by: 'ai', minSentences: 3 },
  { id: 'claim', label: '주장', by: 'ai', minSentences: 3 },
  { id: 'consistency', label: '내용 일치', by: 'ai', minSentences: 3 },
  // 서술형: written answers (어법 고치기 graded by the words; 조건 영작 by the sentence, else checked by the AI at 채점)
  { id: 'correct', label: '서술형 어법', by: 'app', minSentences: 3 },
  { id: 'compose', label: '서술형 영작', by: 'ai', minSentences: 3 },
];
export const APP_TYPES = QUESTION_TYPES.filter(t => t.by === 'app').map(t => t.id as AppQuestionType);
export const AI_TYPES = QUESTION_TYPES.filter(t => t.by === 'ai').map(t => t.id as AiQuestionType);
/** Types per 만들기, all kinds together (fewer at once keeps each one good). */
export const MAX_TYPES = 3;
/** 서술형 types: the answer is written, not chosen. */
export const WRITTEN_TYPES: string[] = ['correct', 'compose'];
export const LETTERS5 = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ'];
/** A written answer compared leniently: case, spaces and end marks do not matter. */
export const sameWriting = (a: string, b: string) => { const f = (s: string) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); return f(a) !== '' && f(a) === f(b); };
/** 고치기: the types whose five choices and answer a teacher may rewrite (the others' answers come from the passage). */
export const OPTION_EDIT_TYPES: string[] = ['blank', 'summary', 'title', 'topic', 'gist', 'claim', 'consistency'];
export const typeLabel = (id: string) => QUESTION_TYPES.find(t => t.id === id)?.label || (id === 'workbook' ? '빈칸 워크북' : id);

export const CIRCLED = ['①', '②', '③', '④', '⑤'];
const LETTERS = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', 'ⓕ', 'ⓖ', 'ⓗ', 'ⓘ', 'ⓙ', 'ⓚ', 'ⓛ'];
/** The five 순서 배열 choices of the 수능 (A-B-C itself is never the answer). */
export const ORDER_OPTIONS = ['(A)-(C)-(B)', '(B)-(A)-(C)', '(B)-(C)-(A)', '(C)-(A)-(B)', '(C)-(B)-(A)'];

/** One question. `answer`: the choice number 1–5, or for 어법 선택 the right words in bracket order. In `passage`, `①{word}`
 *  is an underlined, numbered part (어법 수정) and `ⓐ[a / b]` a pair to choose from (어법 선택). `fix`: the right word for
 *  어법 수정 (to check the passage comes back). */
export interface MadeQuestion {
  id: string; type: QuestionType; prompt: string;
  box?: string; passage?: string; paragraphs?: { label: string; text: string }[]; options?: string[];
  answer: number | string[]; explanation: string; fix?: string;
}
/** Shuffle a correct choice among wrong ones: the choices and the right number (1–5). */
export function placeAnswer(right: string, wrong: string[], rand: Rand = Math.random) {
  const all = [right, ...wrong].map(o => ({ o, k: rand() })).sort((a, b) => a.k - b.k).map(x => x.o);
  return { options: all, answer: all.indexOf(right) + 1 };
}
type Rand = () => number;
const pick = <T,>(list: T[], rand: Rand) => list[Math.floor(rand() * list.length)];

/** 순서 배열: the first sentence (two for long passages) is given; the rest is cut into three parts at sentence ends,
 *  labelled (A)(B)(C) in a shuffled order that is never the original. */
export function orderQuestion(sentences: string[], rand: Rand = Math.random): MadeQuestion | null {
  if (sentences.length < 4) return null;
  const head = sentences.length >= 9 ? 2 : 1, rest = sentences.slice(head), n = rest.length;
  const cut1 = Math.max(1, Math.round(n / 3)), cut2 = Math.max(cut1 + 1, Math.round((2 * n) / 3));
  const parts = [rest.slice(0, cut1), rest.slice(cut1, cut2), rest.slice(cut2)].map(p => p.join(' '));
  if (parts.some(p => !p)) return null;
  // labels[k]: the label shown for part k (in the right order). Never A, B, C in that order.
  const perms = [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], labelOf = pick(perms, rand), names = ['(A)', '(B)', '(C)'];
  const right = labelOf.map(l => names[l]).join('-');
  const paragraphs = names.map((name, l) => ({ label: name, text: parts[labelOf.indexOf(l)] }));
  const answer = ORDER_OPTIONS.indexOf(right) + 1;
  return { id: 'order', type: 'order', prompt: '주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?', box: sentences.slice(0, head).join(' '), paragraphs, options: ORDER_OPTIONS, answer,
    explanation: `원문은 ${right.replace(/-/g, ' → ')} 순서로 이어져요.` };
}

const LINKERS = /^(however|but|yet|instead|therefore|thus|hence|as a result|for example|for instance|in addition|moreover|furthermore|similarly|likewise|on the other hand|in contrast|nevertheless|this|these|that|those|such|it|they|he|she|then|also)\b/i;
/** 문장 삽입: one middle sentence (one that leans on what comes before, when there is one) is taken out; five marks
 *  ①–⑤ stand at sentence gaps around where it belongs. */
export function insertQuestion(sentences: string[], rand: Rand = Math.random): MadeQuestion | null {
  if (sentences.length < 6) return null;
  const middle = sentences.map((s, i) => i).filter(i => i >= 2 && i <= sentences.length - 2);
  const leaning = middle.filter(i => LINKERS.test(sentences[i].replace(/^["'“‘(]+/, '')));
  const out = pick(leaning.length ? leaning : middle, rand), rest = sentences.filter((_, i) => i !== out);
  // Gap g = before rest[g] (g = 1 … rest.length; rest.length = after the last). The true gap is `out`.
  const gaps = Array.from({ length: rest.length }, (_, k) => k + 1), at = gaps.indexOf(out);
  const startMax = Math.max(0, gaps.length - 5), start = Math.min(startMax, Math.max(0, at - Math.floor(rand() * 5)));
  const marks = gaps.slice(start, start + 5);
  if (marks.length < 5 || !marks.includes(out)) return null;
  const pieces = rest.map((s, i) => (marks.includes(i) && i > 0 ? `( ${CIRCLED[marks.indexOf(i)]} ) ` : '') + s);
  const passage = pieces.join(' ') + (marks.includes(rest.length) ? ` ( ${CIRCLED[marks.indexOf(rest.length)]} )` : '');
  const answer = marks.indexOf(out) + 1;
  return { id: 'insert', type: 'insert', prompt: '글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳은?', box: sentences[out], passage, answer,
    explanation: `주어진 문장은 ${CIRCLED[answer - 1]} 자리에 들어가야 앞뒤 흐름이 이어져요.` };
}

/* ------------------------------------------------------------------ 어법 수정 (rules) */

const NOT_ADVERBS = new Set(['only', 'early', 'family', 'likely', 'friendly', 'daily', 'lonely', 'lovely', 'silly', 'holy', 'ugly', 'supply', 'apply', 'reply', 'rely', 'july', 'italy', 'fly', 'ally', 'belly', 'jelly', 'rally', 'bully', 'monthly', 'weekly', 'yearly', 'costly', 'elderly', 'lively', 'deadly', 'orderly', 'unlikely', 'assembly', 'anomaly', 'butterfly', 'imply', 'multiply', 'comply', 'kindly', 'lowly', 'timely', 'hourly', 'ghastly', 'leisurely', 'sickly', 'chilly', 'hilly', 'curly', 'woolly', 'scholarly', 'cowardly', 'motherly', 'fatherly', 'brotherly', 'sisterly', 'worldly', 'heavenly', 'earthly', 'beastly', 'stately', 'homely', 'unruly', 'surly', 'burly', 'jolly', 'oily', 'bubbly', 'wobbly', 'prickly', 'smelly', 'friendly', 'neighborly', 'quarterly', 'nightly', 'unfriendly', 'unseemly', 'unsightly', 'lonely', 'goodly', 'ungodly', 'godly', 'manly', 'womanly', 'courtly', 'masterly', 'saintly', 'shapely', 'sprightly', 'portly', 'rely']);
const AGREE: Record<string, string> = { is: 'are', are: 'is', was: 'were', were: 'was', has: 'have', have: 'has', does: 'do', do: 'does' };
const NOT_ANTECEDENT = /^(of|in|on|at|by|for|with|from|to|about|is|are|was|were|be|been|know|knew|see|saw|think|thought|wonder|ask|asked|tell|told|show|showed|explain|understand|decide|learn|discover|realize|and|but|or|that|this|it)$/i;
type Slot = { at: number; word: string; wrong?: string; why?: string };
const cap = (like: string, word: string) => (like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word);
const SINGULAR_VERB = new Set(['is', 'was', 'has', 'does']);
const SING_PRON = /^(he|she|it|this|everyone|everybody|everything|someone|somebody|something|anyone|anybody|anything|nobody|nothing|each)$/;
const PLUR_PRON = /^(they|we|you|these|those|both|several)$/;
/** Nouns whose number is not settled by their form (집합명사, -s singulars, irregular plurals) and words that are no subject. */
const UNSURE = /^(data|media|criteria|phenomena|family|families|team|staff|crew|class|group|government|committee|audience|public|majority|minority|number|couple|pair|percent|half|rest|all|most|some|none|any|more|lot|lots|police|cattle|people|children|men|women|feet|teeth|mice|news|physics|mathematics|economics|politics|athletics|ethics|statistics|series|species|means|headquarters|who|which|that|what|there|here|where|when|why|how|and|or|but|nor|also|not|never|always|often|still|only|just|then|even|ever|already|now|so|too|very|really|than|as|if|because|i|one)$/;
/** be/have/do agreement only when the word just before the verb settles the number for sure (a pronoun, a plain plural
 *  in -s, a plain singular noun) and agrees with the original verb: "The data is" (data either way), "One of the students
 *  is" (the subject is not next to it) and "There are" are not asked. */
function agreementSure(prev: string, verb: string) {
  const w = prev.toLowerCase();
  if (prev !== w && !/^(He|She|It|They|We|You|This|These|Those)$/.test(prev)) return false; // names, sentence starts
  if (UNSURE.test(w) || /ly$|ing$|ed$/.test(w)) return false;
  const plural = PLUR_PRON.test(w) ? true : SING_PRON.test(w) ? false : /^[a-z]{3,}s$/.test(w) && !/(ss|us|is|ous|ics)$/.test(w) ? true : /^[a-z]{3,}$/.test(w) && !w.endsWith('s') ? false : null;
  return plural !== null && plural === !SINGULAR_VERB.has(verb);
}
/** 비교급 강조: comparatives that much/even/far/still can strengthen but very cannot. */
const COMPARATIVE = /^(more|less|better|worse|fewer|greater|larger|smaller|higher|lower|faster|slower|easier|harder|stronger|weaker|longer|shorter|bigger|older|younger|richer|poorer|safer|cheaper|deeper|wider|closer|earlier|later|healthier|happier|heavier|lighter|further|farther|simpler|clearer|wiser|warmer|colder)$/i;
/** Adjectives very can strengthen but much cannot ("much loved", "much different", "much preferable" are fine, so not those). */
const PLAIN_ADJECTIVE = /^(?!(different|preferable|superior|inferior)$)[a-z]+(ful|ous|ive|able|ible|al|ic|ant|less|ary|ory|ish)$|^important$/i;
/** Words after little/much/many that are not a plain noun (so little/few, much/many is not asked there). */
const NOT_NOUN = /^(of|to|in|on|at|by|for|with|from|about|as|than|that|this|the|a|an|and|or|but|is|are|was|were|be|been|more|less|better|worse|too|so|very|bit|while|longer|later|else|other|enough|like|less|known|used)$/i;
/** Function words that can follow little/much but are no noun ("Little did he know", "much can change"). */
const FUNCTION_WORD = /^(did|do|does|done|can|could|will|would|shall|should|may|might|must|have|has|had|am|he|she|it|they|we|you|me|him|her|them|us|my|your|his|its|our|their|these|those|there|here|not|no|some|any|each|every|both|either|neither|one|ones|own|such|same|other|another|ever|never|else|yet|now|then|still|just|only|also|into|onto|upon|over|under|after|before|since|until|while|when|where|why|how|what|which|who|whom|whose|if|whether|though|although|because|unless|even|enough|less|least|most|much|many|little|few|lot|way)$/i;
const isPlainSingularNoun = (w: string) => !FUNCTION_WORD.test(w) && /^[a-z]{3,}$/.test(w) && !/(s|ed|ing|ly)$/.test(w) && !UNSURE.test(w) && !NOT_NOUN.test(w) && !PLAIN_ADJECTIVE.test(w) && !ADJECTIVE_NEXT.test(w) && !COMPARATIVE.test(w);
const isPlainPlural = (w: string) => /^[a-z]{3,}s$/.test(w) && !/(ss|us|is|ous|ics|ness|less)$/.test(w) && !UNSURE.test(w);
/** -ly words that modify a following adjective or past participle ("extremely important", "carefully designed"): there
 *  the adjective form is plainly wrong. Elsewhere both can be right ("shone brightly / bright", "grew steadily / steady"). */
const ADJECTIVE_NEXT = /^[a-z]+(ed|ful|ous|ive|able|ible|al|ic|ent|ant|less|ary|ory|ish)$|^(important|different|difficult|possible|aware|known|done|made|seen|given|taken)$/i;  // not plain ones like good or easy ("real good" is said)
/** Places that can carry the 어법 question, each with one right answer: be/have/do agreement (agreementSure), which/who
 *  after a noun (→ what), -ly adverbs before an adjective or past participle (→ the adjective), 비교급 강조 (much/even/far/
 *  still → very), very before a plain adjective (→ much), such a (→ so), little/much before a singular noun (→ few/many)
 *  and many before a plural (→ much).
 *  Each knows the wrong form and a short Korean reason. Only forms with one right answer whatever the context: that/what
 *  (it depends on whether the clause after is complete: "know that story is true" / "know what story is true") is not
 *  made here. */
function grammarSlots(tokens: string[], extra: Slot[] = []): Slot[] {
  const out: Slot[] = [];
  tokens.forEach((t, i) => {
    const { core } = splitToken(t), low = core.toLowerCase(), prev = i > 0 ? splitToken(tokens[i - 1]) : null, next = tokens[i + 1] ? splitToken(tokens[i + 1]).core.toLowerCase() : '';
    if (AGREE[low] && prev && !/[,.;:!?]$/.test(tokens[i - 1]) && agreementSure(prev.core, low) && !(low === 'have' && /^to$/i.test(splitToken(tokens[i + 1] || '').core))) {
      const wrong = core[0] === core[0].toUpperCase() ? AGREE[low][0].toUpperCase() + AGREE[low].slice(1) : AGREE[low];
      out.push({ at: i, word: core, wrong, why: `주어의 수에 맞게 '${core}'가 와야 해요.` });
    } else if ((low === 'which' || low === 'who') && prev && !/[,.;:!?]$/.test(tokens[i - 1]) && /^[a-z]+s?$/i.test(prev.core) && !NOT_ANTECEDENT.test(prev.core)) {
      out.push({ at: i, word: core, wrong: core[0] === 'W' ? 'What' : 'what', why: `앞에 선행사 '${prev.core}'가 있으니 what이 아니라 관계대명사 '${core}'가 와야 해요.` });
    } else if (/^[a-z]{5,}ly$/.test(low) && !NOT_ADVERBS.has(low) && !/[,.;:!?]$/.test(t) && tokens[i + 1] && ADJECTIVE_NEXT.test(splitToken(tokens[i + 1]).core)) {
      const adj = low.endsWith('ically') ? core.slice(0, -2) : low.endsWith('ably') || low.endsWith('ibly') ? core.slice(0, -1) + 'e' : low.endsWith('ily') ? core.slice(0, -3) + 'y' : core.slice(0, -2);
      if (adj.length >= 3) out.push({ at: i, word: core, wrong: adj, why: `동사나 형용사, 문장을 꾸미므로 부사 '${core}'가 와야 해요.` });
    } else if (/^(much|even|far|still)$/.test(low) && next && COMPARATIVE.test(next) && !/[,.;:!?]$/.test(t) && !(low === 'still' && prev && /^(is|are|was|were|be|am)$/i.test(prev.core))) {
      out.push({ at: i, word: core, wrong: cap(core, 'very'), why: `비교급 '${next}'은 very가 아니라 much·even·far·still로 강조해요.` });
    } else if (low === 'very' && next && PLAIN_ADJECTIVE.test(next) && !/[,.;:!?]$/.test(t)) {
      out.push({ at: i, word: core, wrong: cap(core, 'much'), why: `원급 형용사 '${next}'은 much가 아니라 very로 강조해요.` });
    } else if (low === 'such' && next && /^(a|an)$/i.test(next) && !/[,.;:!?]$/.test(t)) {
      out.push({ at: i, word: core, wrong: cap(core, 'so'), why: `'${core} ${next} + (형용사) + 명사' 순서이므로 so가 아니라 such가 와야 해요.` });
    } else if ((low === 'little' || low === 'much') && next && isPlainSingularNoun(next) && !/[,.;:!?]$/.test(t) && !(prev && /^(very|too|so|how|as)$/i.test(prev.core))) {
      out.push({ at: i, word: core, wrong: cap(core, low === 'little' ? 'few' : 'many'), why: `뒤에 셀 수 없는(단수) 명사 '${next}'가 오니 ${low === 'little' ? 'few' : 'many'}가 아니라 '${low}'가 와야 해요.` });
    } else if (low === 'many' && next && isPlainPlural(next) && !/[,.;:!?]$/.test(t)) {
      out.push({ at: i, word: core, wrong: cap(core, 'much'), why: `뒤에 셀 수 있는 복수 명사 '${next}'가 오니 much가 아니라 many가 와야 해요.` });
    } else if (/^(that|what|which|to|being|having)$/.test(low) || /^[a-z]{4,}(ing|ed)$/.test(low)) out.push({ at: i, word: core });
  });
  // Places the AI said have one right answer here (reviewed): they replace any plain slot at the same place.
  return extra.length ? [...out.filter(s => !extra.some(e => e.at === s.at)), ...extra].sort((x, y) => x.at - y.at) : out;
}

/* ------------------------------------------------------------------ 어법: places that need the context (AI review) */

/** 감정 분사: the -ing / -ed pairs 내신 asks about. */
const FEELING: Record<string, string> = {};
for (const [ing, ed] of [
  ...['interest', 'disappoint', 'embarrass', 'shock', 'frighten', 'depress', 'overwhelm', 'exhaust', 'thrill', 'annoy', 'bor', 'confus', 'excit', 'surpris', 'amaz', 'frustrat', 'fascinat', 'relax', 'encourag', 'motivat', 'pleas', 'tir'].map(b => [b + 'ing', b + 'ed']),
  ...['satisf', 'terrif', 'worr'].map(b => [b + 'ying', b + 'ied']),
]) { FEELING[ing] = ed; FEELING[ed] = ing; }
const feelingPair = (low: string) => FEELING[low] || '';
/** `sentence`: its sentence with every review place shown as `[r1: X / Y]` (random order), never the original word. */
/** 지문 분석 › 어법 출제 포인트: for each sentence, the places 어법 questions are made from. `sure`: a form the 어법 rules
 *  always get right (with the wrong form and why); `check`: a place to look at in context (that/what, 감정 분사,
 *  where/which, its/their), with only the general way to decide (it never says which is right). `at`: the word's place
 *  in the sentence's tokens (tokenize). */
export interface GrammarHighlight { at: number; word: string; wrong?: string; why: string; kind: 'sure' | 'check' }
export function grammarHighlights(sentences: string[]): GrammarHighlight[][] {
  const perSentence = sentences.map(tokenize), tokens = perSentence.flat(), sure = new Map(grammarSlots(tokens).filter(s => s.wrong).map(s => [s.at, s]));
  let offset = 0;
  return perSentence.map(words => {
    const out: GrammarHighlight[] = [];
    words.forEach((t, k) => {
      const i = offset + k, { core } = splitToken(t), low = core.toLowerCase(), prev = k > 0 ? splitToken(words[k - 1]).core : '';
      const s = sure.get(i);
      if (s) { out.push({ at: k, word: core, wrong: s.wrong, why: s.why || '', kind: 'sure' }); return; }
      // that/what inside a sentence after a word (not 'That book …', 'What happened?' at the start, nor after a comma)
      if ((low === 'that' || low === 'what') && k > 0 && !/[,.;:!?]$/.test(words[k - 1])) out.push({ at: k, word: core, why: '접속사·관계사로 쓰였다면, 뒤 문장이 빠진 것 없이 완전하면 that, 주어나 목적어가 빠져 있고 앞에 선행사가 없으면 what이 와요 (지시어 that·의문사 what이면 해당 없어요).', kind: 'check' });
      else if (feelingPair(low)) { const ing = low.endsWith('ing') ? low : feelingPair(low), ed = low.endsWith('ing') ? feelingPair(low) : low; out.push({ at: k, word: core, why: `감정을 일으키는 쪽이면 ${ing}, 감정을 느끼는 쪽이면 ${ed}가 와요.`, kind: 'check' }); }
      else if ((low === 'where' || low === 'which') && /^[a-z]+$/.test(prev) && !NOT_ANTECEDENT.test(prev)) out.push({ at: k, word: core, why: '뒤 문장이 완전하면 관계부사 where, 주어나 목적어가 빠져 있으면 관계대명사 which가 와요.', kind: 'check' });
      else if (low === 'its' || low === 'their') out.push({ at: k, word: core, why: '가리키는 명사가 단수면 its, 복수면 their가 와요.', kind: 'check' });
    });
    offset += words.length;
    return out;
  });
}
export interface ReviewSlot extends Slot { id: string; sentence: string; shown: string }
/** The places whose AI pick is the original word (a pick of the other word, both or none: not used). */
export function reviewApproved(candidates: ReviewSlot[], picks: unknown): Slot[] {
  const list = Array.isArray(picks) ? picks : [];
  return candidates.filter(c => list.some((p: any) => p?.id === c.id && String(p?.right ?? '').trim().toLowerCase() === c.word.toLowerCase())).map(({ at, word, wrong, why }) => ({ at, word, wrong, why }));
}
/** Places whose right form depends on the context (that/what, 감정 분사, where/which, its/their): the app finds them and
 *  the AI only picks the word that fits, not knowing which is the original: the pair is shown in a random order, and the
 *  passage the AI gets has every review place masked the same way (reviewPassage). A place is used only when its pick
 *  is the original (reviewApproved). At most 12, none where a sure rule already asks. */
export function reviewCandidates(sentences: string[], rand: Rand = Math.random): ReviewSlot[] {
  const out: ReviewSlot[] = [], sure = new Set(grammarSlots(sentences.flatMap(tokenize)).filter(s => s.wrong).map(s => s.at));
  let at = 0;
  const spans: [number, number][] = [];
  sentences.forEach(sentence => {
    const words = tokenize(sentence);
    spans.push([at, at + words.length]);
    words.forEach((t, k) => {
      const i = at + k, { core } = splitToken(t), low = core.toLowerCase(), prev = k > 0 ? splitToken(words[k - 1]).core : '';
      if (sure.has(i) || out.length >= 12) return;
      let wrong = '', why = '';
      if (low === 'that' || low === 'what') { wrong = cap(core, low === 'that' ? 'what' : 'that'); why = low === 'that' ? `뒤에 빠진 성분이 없는 완전한 문장이 오니 접속사(관계사) 'that'이 와야 해요.` : `앞에 선행사가 없고 뒤 문장에 빠진 성분이 있으니 '${core}'가 와야 해요.`; }
      else if (feelingPair(low)) { wrong = cap(core, feelingPair(low)); why = low.endsWith('ing') ? `감정을 일으키는 쪽이므로 현재분사 '${core}'가 와야 해요.` : `감정을 느끼는 쪽이므로 과거분사 '${core}'가 와야 해요.`; }
      else if ((low === 'where' || low === 'which') && /^[a-z]+$/.test(prev) && !NOT_ANTECEDENT.test(prev)) { wrong = low === 'where' ? 'which' : 'where'; why = low === 'where' ? `뒤에 완전한 문장이 오니 관계부사 'where'가 와야 해요.` : `뒤 문장에 빠진 성분(주어·목적어)이 있으니 관계대명사 'which'가 와야 해요.`; }
      else if (low === 'its' || low === 'their') { wrong = cap(core, low === 'its' ? 'their' : 'its'); why = low === 'its' ? `가리키는 명사가 단수이므로 'its'가 와야 해요.` : `가리키는 명사가 복수이므로 'their'가 와야 해요.`; }
      if (wrong) { const id = `r${out.length + 1}`, pair = rand() < 0.5 ? [core, wrong] : [wrong, core]; out.push({ id, at: i, word: core, wrong, why, shown: `[${id}: ${pair[0]} / ${pair[1]}]`, sentence: '' }); }
    });
    at += words.length;
  });
  const masked = maskTokens(sentences.flatMap(tokenize), out);
  for (const c of out) { const [from, to] = spans.find(([a, b]) => c.at >= a && c.at < b)!; c.sentence = masked.slice(from, to).join(' '); }
  return out;
}
function maskTokens(tokens: string[], candidates: { at: number; shown: string }[]) {
  return tokens.map((t, i) => { const c = candidates.find(x => x.at === i); if (!c) return t; const { lead, trail } = splitToken(t); return `${lead}${c.shown}${trail}`; });
}
/** The passage for the AI with every review place masked (so the original word can't be looked up in it). */
export const reviewPassage = (sentences: string[], candidates: ReviewSlot[]) => maskTokens(sentences.flatMap(tokenize), candidates).join(' ');
/** 어법 수정: five underlined parts spread over the passage, one made wrong by a rule (the reason comes with it). */
export function grammarQuestion(sentences: string[], rand: Rand = Math.random, extra: Slot[] = []): MadeQuestion | null {
  const tokens = sentences.flatMap(tokenize), slots = grammarSlots(tokens, extra), wrongable = slots.filter(x => x.wrong);
  if (slots.length < 5 || !wrongable.length) return null;
  const target = pick(wrongable, rand), chosen = [target];
  // the other four: spread out (not next to each other), the passage order kept
  for (const sl of [...slots].sort(() => rand() - 0.5)) { if (chosen.length >= 5) break; if (chosen.every(c => Math.abs(c.at - sl.at) > 2)) chosen.push(sl); }
  if (chosen.length < 5) return null;
  chosen.sort((a, b) => a.at - b.at);
  const answer = chosen.indexOf(target) + 1;
  const passage = tokens.map((t, i) => {
    const k = chosen.findIndex(c => c.at === i); if (k < 0) return t;
    const { lead, core, trail } = splitToken(t); return `${lead}${CIRCLED[k]}{${chosen[k] === target ? target.wrong : core}}${trail}`;
  }).join(' ');
  return { id: 'grammar', type: 'grammar', prompt: '다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?', passage, answer, fix: target.word,
    explanation: `${CIRCLED[answer - 1]} '${target.wrong}' → '${target.word}': ${target.why}` };
}

/** 서술형 어법 고치기: five underlined parts ⓐ–ⓔ, two of them wrong (apart from each other); the answer is each wrong
 *  one's letter with the right word ('ⓐ matters'), in letter order. */
export function correctQuestion(sentences: string[], rand: Rand = Math.random, extra: Slot[] = []): MadeQuestion | null {
  const tokens = sentences.flatMap(tokenize), slots = grammarSlots(tokens, extra), wrongable = [...slots.filter(x => x.wrong)].sort(() => rand() - 0.5);
  const targets = wrongable.slice(0, 1);
  for (const sl of wrongable.slice(1)) if (targets.length < 2 && Math.abs(sl.at - targets[0].at) > 2) targets.push(sl);
  if (slots.length < 5 || targets.length < 2) return null;
  const chosen = [...targets];
  for (const sl of [...slots].sort(() => rand() - 0.5)) { if (chosen.length >= 5) break; if (chosen.every(c => Math.abs(c.at - sl.at) > 2)) chosen.push(sl); }
  if (chosen.length < 5) return null;
  chosen.sort((a, b) => a.at - b.at);
  const passage = tokens.map((t, i) => {
    const k = chosen.findIndex(c => c.at === i); if (k < 0) return t;
    const { lead, core, trail } = splitToken(t); return `${lead}${LETTERS5[k]}{${targets.includes(chosen[k]) ? chosen[k].wrong : core}}${trail}`;
  }).join(' ');
  const wrong = chosen.map((c, k) => ({ c, k })).filter(x => targets.includes(x.c));
  return { id: 'correct', type: 'correct', prompt: '다음 글의 밑줄 친 ⓐ~ⓔ 중 어법상 틀린 것 2개를 찾아 기호를 쓰고 바르게 고쳐 쓰시오.', passage,
    answer: wrong.map(x => `${LETTERS5[x.k]} ${x.c.word}`), explanation: wrong.map(x => `${LETTERS5[x.k]} '${x.c.wrong}' → '${x.c.word}': ${x.c.why}`).join('\n') };
}

/** 어법 선택: the usual 고등학교 워크북 form — pairs like ⓐ[is / are] spread over the passage (one per sentence and a half,
 *  3–12); the original word is always the right one, its order in the pair is random. */
export function choiceQuestion(sentences: string[], rand: Rand = Math.random, extra: Slot[] = []): MadeQuestion | null {
  const tokens = sentences.flatMap(tokenize), want = Math.max(3, Math.min(LETTERS.length, Math.round(sentences.length * 1.5)));
  const chosen: Slot[] = [];
  for (const sl of grammarSlots(tokens, extra).filter(x => x.wrong).sort(() => rand() - 0.5)) { if (chosen.length >= want) break; if (chosen.every(c => Math.abs(c.at - sl.at) > 2)) chosen.push(sl); }
  if (chosen.length < 3) return null;
  chosen.sort((a, b) => a.at - b.at);
  const passage = tokens.map((t, i) => {
    const k = chosen.findIndex(c => c.at === i); if (k < 0) return t;
    const { lead, core, trail } = splitToken(t), pair = rand() < 0.5 ? [core, chosen[k].wrong] : [chosen[k].wrong, core];
    return `${lead}${LETTERS[k]}[${pair[0]} / ${pair[1]}]${trail}`;
  }).join(' ');
  return { id: 'choice', type: 'choice', prompt: '다음 글의 [ ] 안에서 어법상 알맞은 것을 고르시오.', passage, answer: chosen.map(c => c.word),
    explanation: chosen.map((c, k) => `${LETTERS[k]} ${c.word}: ${c.why}`).join('\n') };
}

/* ------------------------------------------------------------------ AI-helped types */

const PROMPTS: Record<AiQuestionType, string> = {
  blank: '다음 빈칸에 들어갈 말로 가장 적절한 것은?',
  irrelevant: '다음 글에서 전체 흐름과 관계 없는 문장은?',
  summary: '다음 글의 내용을 한 문장으로 요약하고자 한다. 빈칸 (A), (B)에 들어갈 말로 가장 적절한 것은?',
  title: '다음 글의 제목으로 가장 적절한 것은?', topic: '다음 글의 주제로 가장 적절한 것은?',
  gist: '다음 글의 요지로 가장 적절한 것은?', claim: '다음 글에서 필자가 주장하는 바로 가장 적절한 것은?',
  consistency: '다음 글의 내용과 일치하지 않는 것은?',
  vocab: '다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것은?',
  compose: '다음 우리말과 같은 뜻이 되도록 <조건>에 맞게 영작하시오.',
};
const clean = (v: unknown, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const fiveDistinct = (options: string[]) => options.length === 5 && options.every(Boolean) && new Set(options.map(o => o.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))).size === 5;
/** An AI-helped question from the AI's parts (`data`): the app puts the answer at a random number and checks it. */
export function buildAiQuestion(type: AiQuestionType, sentences: string[], data: any, rand: Rand = Math.random): MadeQuestion | null {
  const text = sentences.join(' '), why = clean(data?.explanation, 400), wrongs = (Array.isArray(data?.wrong) ? data.wrong : []).map((w: unknown) => clean(w, 160)).slice(0, 4);
  if (type === 'compose') {
    // 조건 영작: the AI picks a sentence of the passage, writes its Korean and names 2–3 of its words; the app checks them
    // and sets the word count from the sentence itself. The answer is that sentence.
    const sentence = sentences[Number(data?.index)], ko = clean(data?.ko, 300), cores = sentence ? tokenize(sentence).map(t => splitToken(t).core) : [];
    const words = (Array.isArray(data?.words) ? data.words : []).map((w: unknown) => clean(w, 30)).filter(Boolean).slice(0, 3);
    if (!sentence || !ko || words.length < 2) return null;
    const used = words.map((w: string) => cores.find(c => c.toLowerCase() === w.toLowerCase()));
    if (used.some((w: string | undefined) => !w) || new Set(used.map((w: string) => w.toLowerCase())).size !== used.length || cores.length < 5 || cores.length > 25) return null;
    // the Korean in the box, then the conditions one a line (shown in that order everywhere: box, then paragraphs)
    return { id: type, type, prompt: PROMPTS.compose, box: ko, paragraphs: [{ label: '<조건>', text: `1. 다음 낱말을 모두 그대로 쓸 것: ${used.join(', ')}` }, { label: '', text: `2. ${cores.length}단어로 쓸 것` }],
      answer: [sentence], explanation: why || '지문의 문장 그대로예요.' };
  }
  if (type === 'vocab') {
    // 어휘 선택: the AI names five words of the passage (in order) with an opposite for each; the app finds them, picks
    // which one is swapped for its opposite (so the answer's place is the app's), and underlines all five.
    const words = (Array.isArray(data?.words) ? data.words : []).map((w: unknown) => clean(w, 40)), opposites = (Array.isArray(data?.opposites) ? data.opposites : []).map((w: unknown) => clean(w, 40));
    const reasons = (Array.isArray(data?.reasons) ? data.reasons : []).map((w: unknown) => clean(w, 200));
    const oneWord = /^[A-Za-z][A-Za-z'-]*$/;
    if (words.length !== 5 || opposites.length !== 5 || !words.every((w: string) => oneWord.test(w)) || !opposites.every((w: string, k: number) => oneWord.test(w) && w.toLowerCase() !== words[k].toLowerCase())) return null;
    const tokens = sentences.flatMap(tokenize), at: number[] = [];
    for (const w of words) {
      const from = at.length ? at[at.length - 1] + 2 : 0, i = tokens.findIndex((t, k) => k >= from && splitToken(t).core.toLowerCase() === w.toLowerCase());
      if (i < 0) return null;
      at.push(i);
    }
    const k = Math.floor(rand() * 5), core = splitToken(tokens[at[k]]).core;
    const swap = /^[A-Z]/.test(core) ? opposites[k][0].toUpperCase() + opposites[k].slice(1) : opposites[k].toLowerCase();
    const passage = tokens.map((t, i) => { const j = at.indexOf(i); if (j < 0) return t; const s = splitToken(t); return `${s.lead}${CIRCLED[j]}{${j === k ? swap : s.core}}${s.trail}`; }).join(' ');
    return { id: type, type, prompt: PROMPTS.vocab, passage, answer: k + 1, fix: core, explanation: `${CIRCLED[k]} '${swap}' → '${core}': ${reasons[k] || why || '문맥상 원래 낱말이 알맞아요.'}` };
  }
  if (type === 'blank') {
    const phrase = clean(data?.phrase, 160);
    if (!phrase || text.split(phrase).length !== 2 || wrongs.length !== 4) return null;
    const { options, answer } = placeAnswer(phrase, wrongs, rand);
    return { id: type, type, prompt: PROMPTS.blank, passage: text.replace(phrase, '__________'), options, answer, explanation: why, fix: phrase };
  }
  if (type === 'irrelevant') {
    const odd = clean(data?.sentence, 300);
    if (!odd || sentences.length < 5 || text.includes(odd)) return null;
    // five numbered sentences after the first (the odd one among them, never first of the five)
    const start = 1 + Math.floor(rand() * Math.max(1, sentences.length - 4)), window = sentences.slice(start, start + 4);
    if (window.length < 4) return null;
    const at = 1 + Math.floor(rand() * 4), numbered = [...window.slice(0, at), odd, ...window.slice(at)];
    const passage = [...sentences.slice(0, start), ...numbered.map((x, k) => `${CIRCLED[k]} ${x}`), ...sentences.slice(start + 4)].join(' ');
    return { id: type, type, prompt: PROMPTS.irrelevant, passage, answer: at + 1, explanation: why, fix: odd };
  }
  if (type === 'summary') {
    const line = clean(data?.summary, 400), a = clean(data?.a, 40), b = clean(data?.b, 40);
    const pairs = (Array.isArray(data?.wrongPairs) ? data.wrongPairs : []).map((p: any) => `${clean(p?.a, 40)} — ${clean(p?.b, 40)}`).slice(0, 4);
    if (!line.includes('(A)') || !line.includes('(B)') || !a || !b || pairs.length !== 4) return null;
    const { options, answer } = placeAnswer(`${a} — ${b}`, pairs, rand);
    return { id: type, type, prompt: PROMPTS.summary, passage: text, box: line.replace('(A)', '(A) ______').replace('(B)', '(B) ______'), options: options.map(o => `(A) ${o.split(' — ')[0]} … (B) ${o.split(' — ')[1]}`), answer, explanation: why };
  }
  if (type === 'consistency') {
    const truths = (Array.isArray(data?.truths) ? data.truths : []).map((x: unknown) => clean(x, 160)).slice(0, 4), lie = clean(data?.lie, 160);
    if (truths.length !== 4 || !lie) return null;
    const { options, answer } = placeAnswer(lie, truths, rand);
    return { id: type, type, prompt: PROMPTS.consistency, passage: text, options, answer, explanation: why };
  }
  const right = clean(data?.answer, 160);
  if (!right || wrongs.length !== 4) return null;
  const { options, answer } = placeAnswer(right, wrongs, rand);
  return { id: type, type, prompt: PROMPTS[type], passage: text, options, answer, explanation: why };
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Problems with a made question (empty = fine): the passage must come back exactly, the answer must fit. */
export function checkQuestion(q: MadeQuestion, sentences: string[]): string[] {
  const original = flat(sentences.join(' ')), issues: string[] = [];
  if (q.type === 'choice') {
    const words = q.answer as string[]; let k = 0, both = true;
    const back = flat(String(q.passage || '').replace(/[ⓐ-ⓛ]\[([^\]/]+) \/ ([^\]]+)\]/g, (_, x, y) => { const w = words[k++] ?? '?'; if (x === y || (x !== w && y !== w)) both = false; return w; }));
    if (back !== original) issues.push('알맞은 말을 고르면 원문과 달라요');
    if (!both) issues.push('고를 말 두 개 중 하나가 정답이어야 해요');
    if (k !== words.length || words.length < 3) issues.push('고를 곳 수가 맞지 않아요');
  } else if (q.type === 'order') {
    const right = ORDER_OPTIONS[Number(q.answer) - 1];
    if (!right) issues.push('정답 번호가 범위를 벗어나요');
    else { const text = right.split('-').map(l => q.paragraphs?.find(p => p.label === l)?.text || '').join(' ');
      if (flat(`${q.box} ${text}`) !== original) issues.push('정답 순서로 이으면 원문과 달라요'); }
  } else if (q.type === 'correct') {
    const fixes = new Map((q.answer as string[]).map(a => [a.slice(0, 1), a.slice(2)])), marks = String(q.passage || '').match(/[ⓐ-ⓔ]\{[^}]*\}/g) || [];
    if (marks.length !== 5 || !fixes.size) issues.push('밑줄이 다섯 곳이 아니에요');
    const back = flat(String(q.passage || '').replace(/([ⓐ-ⓔ])\{([^}]*)\}/g, (_, m, w) => fixes.get(m) ?? w));
    if (back !== original) issues.push('틀린 곳을 고치면 원문과 달라요');
  } else if (q.type === 'compose') {
    const answer = (q.answer as string[])[0] || '';
    if (!sentences.includes(answer)) issues.push('정답이 지문의 문장이 아니에요');
    const named = ((q.paragraphs || []).map(x => x.text).join(' ').match(/그대로 쓸 것: ([^,\s]+(?:, [^,\s]+)*)/)?.[1] || '').split(', ').filter(Boolean);
    if (named.length < 2 || named.some(w => !tokenize(answer).some(t => splitToken(t).core === w))) issues.push('조건의 낱말이 정답 문장에 없어요');
  } else if (q.type === 'grammar' || q.type === 'vocab') {
    const n = Number(q.answer), marks = String(q.passage || '').match(/[①-⑤]\{[^}]*\}/g) || [];
    if (marks.length !== 5 || !CIRCLED[n - 1]) issues.push('밑줄이 다섯 곳이 아니에요');
    const back = flat(String(q.passage || '').replace(/([①-⑤])\{([^}]*)\}/g, (_, m, w) => (m === CIRCLED[n - 1] ? q.fix || '' : w)));
    if (back !== original) issues.push('정답을 고치면 원문과 달라요');
  } else if (q.type === 'blank') {
    if (flat(String(q.passage || '').replace('__________', q.fix || '')) !== original) issues.push('빈칸을 채우면 원문과 달라요');
  } else if (q.type === 'irrelevant') {
    const mark = CIRCLED[Number(q.answer) - 1], back = flat(String(q.passage || '').replace(`${mark} ${q.fix}`, '').replace(/[①-⑤] /g, ''));
    if (!mark || back !== original) issues.push('관계 없는 문장을 빼면 원문과 달라요');
  } else if (q.type === 'insert') {
    const n = Number(q.answer), mark = CIRCLED[n - 1];
    if (!mark) issues.push('정답 번호가 범위를 벗어나요');
    else { const back = flat(String(q.passage || '').replace(`( ${mark} )`, ` ${q.box} `).replace(/\( [①-⑤] \)/g, ''));
      if (back !== original) issues.push('정답 자리에 넣으면 원문과 달라요');
      if ((String(q.passage).match(/\( [①-⑤] \)/g) || []).length !== 5) issues.push('표시가 다섯 곳이 아니에요'); }
  }
  if (q.options && q.type !== 'order' && (!fiveDistinct(q.options) || !(Number(q.answer) >= 1 && Number(q.answer) <= 5))) issues.push('보기 다섯 개가 서로 달라야 해요');
  return issues;
}

/** The app-made questions for a passage (types it can't make for this passage are reported, not invented). */
/** `reviewed`: context places the AI approved (reviewCandidates), used by 어법 수정 and 어법 선택 beside the sure rules. */
export function makeAppQuestions(text: string, types: AppQuestionType[], rand: Rand = Math.random, reviewed: Slot[] = []) {
  const sentences = splitPassage(text), questions: MadeQuestion[] = [], skipped: { type: AppQuestionType; reason: string }[] = [];
  for (const type of types) {
    const info = QUESTION_TYPES.find(t => t.id === type)!;
    if (sentences.length < info.minSentences) { skipped.push({ type, reason: `${info.minSentences}문장 이상인 지문만 만들 수 있어요` }); continue; }
    const q = type === 'choice' ? choiceQuestion(sentences, rand, reviewed) : type === 'order' ? orderQuestion(sentences, rand) : type === 'grammar' ? grammarQuestion(sentences, rand, reviewed) : type === 'correct' ? correctQuestion(sentences, rand, reviewed) : insertQuestion(sentences, rand);
    const issues = q ? checkQuestion(q, sentences) : ['만들 수 없는 지문이에요'];
    if (!q || issues.length) { skipped.push({ type, reason: issues[0] }); continue; }
    questions.push(q);
  }
  return { sentences, questions, skipped };
}
