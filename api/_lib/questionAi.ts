// 변형 문제 (AI-helped types): one model call for all chosen types (3 at most). The model writes only the parts that need
// meaning — the blank's phrase and wrong choices, one off-topic sentence, the summary line with its two words, the
// right and wrong titles/topics/claims, true and false statements — and the app builds and checks each question
// (src/lib/questionMaker.ts buildAiQuestion). A stored 지문 분석 summary keeps the right answers consistent with it.
// The same call can also review 어법 places the app found but can't decide by rule (reviewCandidates): the AI only picks
// which of the two words fits, not told which is the original.
import type { AiQuestionType } from '../../src/lib/questionMaker.js';

const S = { type: 'STRING' } as const, LIST = { type: 'ARRAY', items: S } as const;
const SCHEMA: Record<AiQuestionType, any> = {
  blank: { type: 'OBJECT', properties: { phrase: S, wrong: LIST, explanation: S }, required: ['phrase', 'wrong', 'explanation'] },
  irrelevant: { type: 'OBJECT', properties: { sentence: S, explanation: S }, required: ['sentence', 'explanation'] },
  summary: { type: 'OBJECT', properties: { summary: S, a: S, b: S, wrongPairs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { a: S, b: S }, required: ['a', 'b'] } }, explanation: S }, required: ['summary', 'a', 'b', 'wrongPairs', 'explanation'] },
  title: { type: 'OBJECT', properties: { answer: S, wrong: LIST, explanation: S }, required: ['answer', 'wrong', 'explanation'] },
  topic: { type: 'OBJECT', properties: { answer: S, wrong: LIST, explanation: S }, required: ['answer', 'wrong', 'explanation'] },
  gist: { type: 'OBJECT', properties: { answer: S, wrong: LIST, explanation: S }, required: ['answer', 'wrong', 'explanation'] },
  claim: { type: 'OBJECT', properties: { answer: S, wrong: LIST, explanation: S }, required: ['answer', 'wrong', 'explanation'] },
  consistency: { type: 'OBJECT', properties: { truths: LIST, lie: S, explanation: S }, required: ['truths', 'lie', 'explanation'] },
  vocab: { type: 'OBJECT', properties: { words: LIST, opposites: LIST, reasons: LIST }, required: ['words', 'opposites', 'reasons'] },
  compose: { type: 'OBJECT', properties: { index: { type: 'INTEGER' }, ko: S, words: LIST, explanation: S }, required: ['index', 'ko', 'words', 'explanation'] },
};
const RULES: Record<AiQuestionType, string> = {
  blank: 'blank: phrase = 글의 핵심 생각을 담은 영어 구절(3~12단어)을 지문에서 한 글자도 바꾸지 말고 그대로 복사. wrong = 길이와 형태가 비슷하지만 틀린 영어 구절 4개(지문에 없는 말).',
  irrelevant: 'irrelevant: sentence = 지문의 낱말을 쓰지만 글의 요지와 관계 없는 영어 문장 하나(지문에 없는 새 문장, 다른 문장과 비슷한 길이).',
  summary: 'summary: summary = 글을 한 문장으로 요약한 영어 문장, 핵심 낱말 두 곳을 "(A)", "(B)"로 비움. a, b = 정답 낱말. wrongPairs = 틀린 (a, b) 짝 4개.',
  title: 'title: answer = 가장 알맞은 영어 제목, wrong = 그럴듯하지만 틀린 영어 제목 4개.',
  topic: 'topic: answer = 가장 알맞은 영어 주제(명사구), wrong = 그럴듯하지만 틀린 영어 주제 4개.',
  gist: 'gist: answer = 글의 요지를 담은 한국어 문장, wrong = 그럴듯하지만 틀린 한국어 문장 4개.',
  claim: 'claim: answer = 필자의 주장을 담은 한국어 문장(~해야 한다), wrong = 그럴듯하지만 틀린 한국어 문장 4개.',
  consistency: 'consistency: truths = 지문 내용과 일치하는 한국어 문장 4개(지문 순서대로), lie = 지문과 일치하지 않는 한국어 문장 1개(한 부분만 살짝 틀리게).',
  vocab: 'vocab: words = 글의 흐름을 결정하는 지문 속 내용어(동사·형용사·부사·명사) 5개, 지문에 나온 순서대로 한 단어씩 철자 그대로 복사(서로 떨어진 자리, 같은 단어 두 번 금지). opposites = 각 단어를 문맥상 반대 뜻으로 바꾼 영어 한 단어 5개(같은 품사·같은 형태: 시제·수·비교급까지). reasons = 각 원래 단어가 이 문맥에 맞는 이유(한국어 한 문장) 5개.',
  compose: 'compose: index = 서술형 영작으로 내기 좋은 지문 문장 하나의 번호(지문 문장 순서, 0부터; 7~20단어, 구문이 분명한 문장). ko = 그 문장의 자연스러운 한국어 해석. words = 그 문장에서 그대로 가져온, 구문의 핵심이 되는 영어 낱말 2~3개(한 단어씩, 철자 그대로). explanation = 핵심 구문을 한국어로 짧게 설명.',
};

export function aiQuestionsRequest(types: AiQuestionType[], text: string, summary?: { title?: string; englishTitle?: string; topic?: { en?: string; ko?: string }; mainIdea?: { ko?: string } } | null, review: { id: string; sentence: string }[] = []) {
  const known = summary ? `\n참고(이 지문의 저장된 분석, 정답은 이것과 어긋나지 않게): 제목 ${summary.englishTitle || summary.title || ''} / 주제 ${summary.topic?.en || summary.topic?.ko || ''} / 요지 ${summary.mainIdea?.ko || ''}` : '';
  const reviewRule = review.length ? '\nreview: 지문의 [r1: X / Y] 표시는 두 낱말 중 하나가 들어갈 자리야(아래 review 목록에 그 문장이 있어). 이 글의 문맥에서 어법상 맞는 낱말 하나를 right에 그대로 적어. 둘 다 맞을 수 있거나 확실하지 않으면 right는 빈 문자열. 목록의 모든 id에 답해. 다른 항목을 만들 때 이 표시가 있는 부분은 그대로 옮기지 말고, 정답은 둘 중 문맥에 맞는 낱말로 써.' : '';
  const properties: Record<string, any> = Object.fromEntries(types.map(t => [t, SCHEMA[t]]));
  if (review.length) properties.review = { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: S, right: S }, required: ['id', 'right'] } };
  return {
    contents: [{ role: 'user', parts: [{ text }, ...(review.length ? [{ text: JSON.stringify({ review }) }] : [])] }],
    config: {
      systemInstruction: `너는 한국 고등학교 영어 시험 문제를 만드는 선생님이야. 주어진 영어 지문으로 아래 항목만 만들어. 정답이 하나뿐이어야 하고, 틀린 보기는 분명히 틀려야 하며, 보기끼리 겹치지 마. 보기 앞에 번호를 붙이지 마. explanation은 정답인 이유를 한국어로 1~2문장.${known}\n${types.map(t => RULES[t]).join('\n')}${reviewRule}`,
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties, required: [...types, ...(review.length ? ['review'] : [])] },
      temperature: 0.4, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}
