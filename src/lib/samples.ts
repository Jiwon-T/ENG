// 샘플 보기: what 지문 분석, 변형 문제 만들기 and 워크북 make, shown on one fixed example passage before anyone
// presses a button. Everything here is made in the browser: the app-made parts by the real makers (with a fixed seed,
// so the sample is the same every time), the AI-made parts from the fixed examples below put through the same
// builders and checks. No server request, nothing counted.
import { buildAiQuestion, checkQuestion, makeAppQuestions, QUESTION_TYPES, type AiQuestionType, type AppQuestionType, type MadeQuestion, type QuestionType } from './questionMaker';
import { buildWorkbook, type WorkbookBuild } from './workbook';
import { chunkHints } from './passageTools';
import type { Passage } from './passageApi';

export const SAMPLE_SENTENCES = [
  'Many people believe that talent is something we are born with.',
  'However, research shows that practice matters more than we think.',
  'For example, musicians who practiced for ten thousand hours performed best.',
  'This suggests that effort can shape ability.',
  'Of course, natural gifts still play a role.',
  'But without steady work, those gifts rarely grow.',
  'Therefore, we should value the process of learning.',
  'In the end, persistence is what turns potential into skill.',
];
export const SAMPLE_TEXT = SAMPLE_SENTENCES.join(' ');
const KO = [
  '많은 사람들은 재능이 타고나는 것이라고 믿는다.',
  '하지만 연구에 따르면 연습은 우리가 생각하는 것보다 더 중요하다.',
  '예를 들어, 만 시간 동안 연습한 음악가들이 가장 좋은 연주를 했다.',
  '이것은 노력이 능력을 만들 수 있다는 것을 보여 준다.',
  '물론 타고난 재능도 여전히 어떤 역할을 한다.',
  '하지만 꾸준한 노력 없이는 그 재능이 좀처럼 자라지 않는다.',
  '그러므로 우리는 배우는 과정을 소중히 여겨야 한다.',
  '결국 끈기가 잠재력을 실력으로 바꾸는 것이다.',
];

/** A fixed-seed random, so a sample looks the same every time it is opened. */
export function seeded(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/* ------------------------------------------------------------------ 변형 문제 */

// what the AI would write for the meaning parts (the app places the answer and checks it, as for real ones)
export const SAMPLE_AI: Record<AiQuestionType, any> = {
  blank: { phrase: 'practice matters more than we think', wrong: ['talent decides everything', 'luck is the key to success', 'gifts never change over time', 'rest is more useful than work'], explanation: '타고난 재능보다 연습이 더 중요하다는 글이므로 빈칸에는 연습이 생각보다 중요하다는 말이 와요.' },
  irrelevant: { sentence: 'Many musicians also enjoy cooking at home on weekends.', explanation: '연습과 재능에 관한 글인데, 음악가들의 요리 취미는 흐름과 관계가 없어요.' },
  summary: { summary: 'Although talent plays a part, (A) effort is what truly (B) ability.', a: 'steady', b: 'develops', wrongPairs: [{ a: 'natural', b: 'limits' }, { a: 'little', b: 'hides' }, { a: 'lucky', b: 'replaces' }, { a: 'early', b: 'measures' }], explanation: '재능도 역할을 하지만 꾸준한(steady) 노력이 능력을 키운다(develops)는 내용이에요.' },
  title: { answer: 'Practice Shapes Ability', wrong: ['Born to Be Great', 'The Secret of Luck', 'Why Music Is Hard', 'Gifts Never Fade'], explanation: '노력과 연습이 능력을 만든다는 글이므로 제목은 Practice Shapes Ability가 알맞아요.' },
  topic: { answer: 'the role of steady effort in building skill', wrong: ['the history of classical music', 'ways to find your hidden talent', 'why some people are born lucky', 'the dangers of too much practice'], explanation: '꾸준한 노력이 실력을 만든다는 것이 글의 주제예요.' },
  gist: { answer: '꾸준한 노력이 타고난 재능보다 실력을 키우는 데 더 중요하다.', wrong: ['재능은 타고나므로 노력으로 바꿀 수 없다.', '음악가는 어릴 때부터 훈련을 시작해야 한다.', '연습 시간보다 휴식 시간이 더 중요하다.', '재능 있는 사람만 끝까지 배울 수 있다.'], explanation: '연구와 예시를 들어 노력이 능력을 만든다고 말하고 있어요.' },
  claim: { answer: '배우는 과정을 소중히 여기고 꾸준히 노력해야 한다.', wrong: ['재능을 일찍 찾아 그 분야에만 집중해야 한다.', '결과보다 타고난 능력을 먼저 따져야 한다.', '연습은 짧게 하고 쉬는 시간을 늘려야 한다.', '음악가의 연습 방법을 그대로 따라야 한다.'], explanation: 'Therefore 이후 문장에서 배우는 과정을 소중히 여겨야 한다고 주장해요.' },
  consistency: { truths: ['많은 사람들은 재능이 타고난다고 믿는다.', '연구는 연습이 생각보다 중요하다고 말한다.', '타고난 재능도 여전히 역할을 한다.', '끈기가 잠재력을 실력으로 바꾼다.'], lie: '만 시간 연습한 음악가들은 오히려 실력이 떨어졌다.', explanation: '만 시간 연습한 음악가들이 가장 좋은 연주를 했다고 했으므로, 실력이 떨어졌다는 내용은 글과 맞지 않아요.' },
  vocab: { words: ['believe', 'more', 'shape', 'rarely', 'value'], opposites: ['doubt', 'less', 'limit', 'often', 'ignore'], reasons: ['많은 사람들이 재능을 타고난다고 믿는 통념을 소개해요.', '연습이 생각보다 더 중요하다는 것이 연구 결과예요.', '노력이 능력을 만들 수 있다는 결론이에요.', '꾸준한 노력 없이는 재능이 좀처럼 자라지 않아요.', '그래서 배우는 과정을 소중히 여겨야 해요.'] },
  compose: { index: 7, ko: '결국 끈기가 잠재력을 실력으로 바꾸는 것이다.', words: ['what', 'turns', 'into'], explanation: 'what이 이끄는 명사절(~하는 것)이 보어로 쓰였고, turn A into B는 A를 B로 바꾸다예요.' },
};

/** One sample question per type (null when the maker could not make it, which the tests rule out). */
export function sampleQuestions(): Record<QuestionType, MadeQuestion | null> {
  const out = {} as Record<QuestionType, MadeQuestion | null>;
  for (const t of QUESTION_TYPES) {
    const rand = seeded(QUESTION_TYPES.indexOf(t) + 3);
    if (t.by === 'app') out[t.id] = makeAppQuestions(SAMPLE_TEXT, [t.id as AppQuestionType], rand).questions[0] || null;
    else { const q = buildAiQuestion(t.id as AiQuestionType, SAMPLE_SENTENCES, SAMPLE_AI[t.id as AiQuestionType], rand); out[t.id] = q && !checkQuestion(q, SAMPLE_SENTENCES).length ? q : null; }
  }
  return out;
}

/* ------------------------------------------------------------------ 워크북 */

/** The 워크북 for the sample passage (Part 1 빈칸, Part 2 배열, with the Korean of each sentence). */
export const sampleWorkbook = (): WorkbookBuild => buildWorkbook(SAMPLE_SENTENCES.map((text, i) => ({ id: `sample${i}`, text, ko: KO[i] })), { blanks: [], orders: [] }, seeded(11));

/* ------------------------------------------------------------------ 지문 분석 */

const CHUNK_KO: string[][] = [
  ['많은 사람들은 믿는다', '재능이 ~이라고', '우리가 가지고 태어나는 것'],
  ['하지만 연구는 보여 준다', '연습이 더 중요하다는 것을', '우리가 생각하는 것보다'],
  ['예를 들어, 음악가들은', '만 시간 동안 연습한', '가장 좋은 연주를 했다'],
  ['이것은 보여 준다', '노력이 능력을 만들 수 있다는 것을'],
  ['물론, 타고난 재능도', '여전히 역할을 한다'],
  ['하지만 꾸준한 노력 없이는', '그 재능은 좀처럼 자라지 않는다'],
  ['그러므로 우리는 소중히 여겨야 한다', '배우는 과정을'],
  ['결국, 끈기가 ~이다', '잠재력을 실력으로 바꾸는 것'],
];
const CHUNK_EN: string[][] = [
  ['Many people believe', 'that talent is something', 'we are born with.'],
  ['However, research shows', 'that practice matters more', 'than we think.'],
  ['For example, musicians', 'who practiced for ten thousand hours', 'performed best.'],
  ['This suggests', 'that effort can shape ability.'],
  ['Of course, natural gifts', 'still play a role.'],
  ['But without steady work,', 'those gifts rarely grow.'],
  ['Therefore, we should value', 'the process of learning.'],
  ['In the end, persistence is', 'what turns potential into skill.'],
];
/** The 지문 분석 of the sample passage, with every part filled, as a stored analysis would look (no names). */
export function samplePassage(): Passage {
  return {
    id: 'sample', text: SAMPLE_TEXT, sentences: SAMPLE_SENTENCES, hints: SAMPLE_SENTENCES.map(chunkHints), title: '예시 지문 · 연습의 힘', examInfo: '샘플', public: false, updatedAt: 0,
    parts: {
      reading: { sentences: CHUNK_EN.map((chunks, i) => ({ chunks: chunks.map((en, k) => ({ en, ko: CHUNK_KO[i][k] })), ko: KO[i] })) },
      grammar: {
        sentences: [
          { structure: 'S(Many people) V(believe) O(that절)', points: ['believe의 목적어로 쓰인 명사절 that', 'something (that) we are born with: 목적격 관계대명사 생략'] },
          { structure: 'S(research) V(shows) O(that절)', points: ['However: 앞의 통념을 뒤집는 역접', 'more than we think: 비교급 + than'] },
          { structure: 'S(musicians) [who ~ hours] V(performed) M(best)', points: ['주격 관계대명사 who가 musicians를 꾸밈', '주어가 길어도 동사는 performed'] },
          { structure: 'S(This) V(suggests) O(that절)', points: ['This: 앞 문장의 연구 결과를 가리킴', 'can shape: 조동사 + 동사원형'] },
          { structure: 'S(natural gifts) V(play) O(a role)', points: ['Of course: 양보(인정)의 표현', 'play a role: 역할을 하다'] },
          { structure: 'M(without steady work) S(those gifts) V(grow)', points: ['rarely: 부정의 뜻을 가진 빈도부사', 'without ~: ~이 없으면'] },
          { structure: 'S(we) V(should value) O(the process of learning)', points: ['should: 필자의 주장을 나타내는 조동사', 'Therefore: 결론을 이끄는 연결어'] },
          { structure: 'S(persistence) V(is) C(what절)', points: ['what = the thing which: 보어로 쓰인 관계대명사 what절', 'turn A into B: A를 B로 바꾸다'] },
        ],
        essay: { index: 7, reason: '관계대명사 what절이 보어로 쓰여 어순 배열·영작 문제로 내기 좋아요.' },
      },
      summary: {
        title: '연습이 능력을 만든다', englishTitle: 'Practice Shapes Ability',
        topic: { ko: '실력을 키우는 데 꾸준한 노력이 하는 역할', en: 'the role of steady effort in building skill' },
        mainIdea: { ko: '타고난 재능보다 꾸준한 노력과 끈기가 실력을 만든다.', en: 'Steady effort and persistence, more than talent, build skill.' },
        summary: { ko: '사람들은 재능을 타고난다고 믿지만 연구는 연습이 더 중요하다고 보여 준다. 오래 연습한 음악가들이 가장 잘했다. 재능도 역할을 하지만 노력 없이는 자라지 않으므로 배우는 과정을 소중히 여겨야 한다.', en: 'People think talent is inborn, but research shows practice matters more. Talent plays a role, yet it grows only with steady work, so we should value learning.' },
        logic: '통념 제시 → 반박(연구) → 예시 → 양보 → 결론',
      },
      structure: { roles: ['통념', '반박', '예시', '근거', '대조', '근거', '결론', '결론'], key: 6 },
      words: { known: [
        { word: 'talent', meaning: '재능', seen: 'talent' }, { word: 'research', meaning: '연구', seen: 'research' }, { word: 'matter', meaning: '중요하다', seen: 'matters' },
        { word: 'perform', meaning: '공연하다, 수행하다', seen: 'performed' }, { word: 'suggest', meaning: '보여 주다, 시사하다', seen: 'suggests' }, { word: 'effort', meaning: '노력', seen: 'effort' },
        { word: 'ability', meaning: '능력', seen: 'ability' }, { word: 'steady', meaning: '꾸준한', seen: 'steady' }, { word: 'rarely', meaning: '좀처럼 ~하지 않는', seen: 'rarely' },
        { word: 'value', meaning: '소중히 여기다', seen: 'value' }, { word: 'persistence', meaning: '끈기', seen: 'persistence' }, { word: 'potential', meaning: '잠재력', seen: 'potential' },
      ], unknown: [] },
    },
  };
}
