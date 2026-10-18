// 객관식 퀴즈 인쇄: each question's choices and answers are fixed once, so the 시험지 and the 정답지 show the same
// numbers in the same order.

/** Fisher–Yates (the old `sort(() => 0.5 - Math.random())` favours some orders). */
export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 문법 벼락치기: the answer is quizChoices[quizAnswerIndex]; `meaning` (a copy saved with it) only when that is missing. */
export function crammingAnswer(w: { quizChoices?: string[]; quizAnswerIndex?: number; meaning?: string }): string {
  const choices = w.quizChoices, i = w.quizAnswerIndex;
  return Array.isArray(choices) && typeof i === 'number' && i >= 0 && i < choices.length ? choices[i] : (w.meaning || '');
}

/** 벼락치기 choices typed in one box: split at "|" when there is one (so a choice may hold a comma), else at commas. */
export const splitChoices = (text: string) => text.split(text.includes('|') ? '|' : ',').map(s => s.trim()).filter(Boolean);
/** The box's text for saved choices: "|" between them when one holds a comma. */
export const joinChoices = (choices: string[] = []) => choices.join(choices.some(c => c.includes(',')) ? ' | ' : ', ');

/** The other choices of a 벼락치기 question (by position, so a choice that repeats the answer's text still counts). */
export function crammingDistractors(w: { quizChoices?: string[]; quizAnswerIndex?: number; meaning?: string }): string[] {
  const choices = w.quizChoices || [], answer = crammingAnswer(w);
  const i = typeof w.quizAnswerIndex === 'number' && choices[w.quizAnswerIndex] === answer ? w.quizAnswerIndex : choices.indexOf(answer);
  return choices.filter((_, k) => k !== i);
}

export interface ComplementQuizLike { verb: string; answers: number[]; choices: string[]; complementForms: string; desc: string; note?: string }

export interface MultipleChoiceItem {
  stem: string;
  /** Shown after the stem ("과거형(Past)을 고르세요", the 문제은행 question). Printed as it is, (힌트) included. */
  prompt: string;
  choices: string[];
  /** Every choice marked correct on the 정답지. */
  correct: string[];
  explanation: string;
  complement?: ComplementQuizLike;
}

const PATTERN_TYPES = ['modal-grammar', 'basic-modal-grammar', 'verb-form-grammar', 'grammar-cramming'];

export function buildMultipleChoiceItems(words: any[], wordbookType: string | undefined, complementData: readonly ComplementQuizLike[], random: () => number = Math.random): MultipleChoiceItem[] {
  // Collect all unique patterns/labels to use as distractors if not provided
  const allPatterns = Array.from(new Set(words.map(w => w.pattern || w.meaning))).filter(p => !!p) as string[];

  return words.map((item, index) => {
    let distractors: string[] = [];
    let correctAnswer = '';
    let prompt = '';
    let stem: string = item.word;
    let choices: string[] = [];
    let correct: string[] | null = null;
    let complement: ComplementQuizLike | undefined;

    if (wordbookType === 'complement-grammar') {
      const compItem = complementData.find(c => c.verb.toLowerCase() === (item.word || '').toLowerCase());
      prompt = '목적격 보어로 가능한 형태를 모두 고르시오';
      if (compItem) {
        complement = compItem;
        choices = compItem.choices;
        correct = compItem.answers.map(a => compItem.choices[a - 1]);
      } else {
        choices = ['O + 명사/형용사', 'O + to V', 'O + 동사원형', 'O + V-ing'];
        correct = [choices[0]];
      }
    } else if (wordbookType === 'irregular') {
      const isPast = index % 2 === 0;
      correctAnswer = isPast ? item.past : item.pastParticiple;
      prompt = isPast ? '과거형(Past)을 고르세요' : '과거분사(Participle)를 고르세요';
      // A distractor that is the answer itself (broken for break's 과거분사) or repeats another is left out, then the
      // made-up forms fill up to three.
      const base = item.base || item.word || '';
      const candidates = [...(Array.isArray(item.distractors) ? item.distractors : []), base + 'ed', item.past + 'ed', base + 'en', base + 't', item.past + 'en', base + 'ened'];
      distractors = [...new Set(candidates.filter((d: unknown): d is string => typeof d === 'string' && !!d && d !== correctAnswer))].slice(0, 3);
    } else if (wordbookType === 'conversion-grammar') {
      const baseOptions = ['동사 O to + 간접목적어', '동사 O for + 간접목적어', '동사 O of + 간접목적어', '3형식 전환 불가'];
      if (item.pattern === 'to') correctAnswer = baseOptions[0];
      else if (item.pattern === 'for') correctAnswer = baseOptions[1];
      else if (item.pattern === 'of') correctAnswer = baseOptions[2];
      else if (item.pattern === 'impossible') correctAnswer = baseOptions[3];
      distractors = baseOptions.filter(o => o !== correctAnswer);
    } else if (wordbookType === 'to-ing-grammar') {
      const baseOptions = ['둘 다 가능(의미도 같음)', '둘 다 가능(의미는 다름)', 'to부정사만 목적어', '동명사(V-ing)만 목적어'];
      if (item.pattern?.includes('의미도 같은')) correctAnswer = baseOptions[0];
      else if (item.pattern?.includes('의미는 다른')) correctAnswer = baseOptions[1];
      else if (item.pattern?.includes('to부정사만')) correctAnswer = baseOptions[2];
      else if (item.pattern?.includes('동명사만')) correctAnswer = baseOptions[3];
      distractors = baseOptions.filter(o => o !== correctAnswer);
    } else if (wordbookType === 'relative-grammar') {
      const dChoices: string[] = item.distractors || [];
      correctAnswer = dChoices[0] || '';
      distractors = dChoices.slice(1);
    } else if (PATTERN_TYPES.includes(wordbookType || '')) {
      if (wordbookType === 'grammar-cramming') {
        correctAnswer = crammingAnswer(item);
        distractors = crammingDistractors(item);
      } else {
        correctAnswer = item.meaning;
        distractors = item.distractors || [];
      }
      // The (힌트) at the end of a question or sentence stays: without it several choices can be right.
      prompt = (item.quizQuestion || item.question || '').trim();
      stem = (item.quizSentence || item.word || '').trim();
    } else {
      correctAnswer = item.meaning;
      distractors = shuffle(allPatterns.filter(p => p !== correctAnswer), random).slice(0, 3);
    }

    if (choices.length === 0) choices = shuffle([correctAnswer, ...distractors], random);
    if (!correct) {
      correct = choices.filter(choice => choice === correctAnswer ||
        (wordbookType === 'relative-grammar' && ((correctAnswer === 'how' && choice === 'the way') || (correctAnswer === 'the way' && choice === 'how'))));
    }
    const explanation = wordbookType === 'relative-grammar' || PATTERN_TYPES.includes(wordbookType || '')
      ? (item.quizExplanation || item.explanation || (wordbookType === 'relative-grammar' ? item.meaning : '') || '')
      : '';
    return { stem, prompt, choices, correct, explanation, complement };
  });
}
