import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMultipleChoiceItems, crammingAnswer, crammingDistractors, shuffle } from '../src/lib/multipleChoiceItems.ts';
import { VERB_FORM_QUIZ_POOL } from '../src/lib/verbFormQuizPool.ts';
import { MODAL_QUIZ_POOL, BASIC_MODAL_QUIZ_POOL } from '../src/lib/modalQuizPool.ts';
import { GRAMMAR_CRAMMING_POOL } from '../src/lib/grammarCrammingPool.ts';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('객관식 인쇄: the 시험지 and the 정답지 come from one set of items', () => {
  const src = fs.readFileSync('src/lib/wordTestGenerator.ts', 'utf8');
  const quiz = src.slice(src.indexOf('export const generateMultipleChoiceQuiz'), src.indexOf('export const generateIrregularVerbTest'));
  const build = quiz.indexOf('buildMultipleChoiceItems('), doc = quiz.indexOf('const createDocument');
  assert.ok(build > 0 && build < doc, 'choices are fixed before createDocument');
  assert.doesNotMatch(quiz.slice(doc), /Math\.random/, 'nothing is shuffled again inside createDocument');
});

test('객관식 인쇄: every question keeps its answer among its choices, without repeats', () => {
  const words = [
    { word: 'apple', meaning: '사과' }, { word: 'book', meaning: '책' }, { word: 'cat', meaning: '고양이' }, { word: 'dog', meaning: '개' }, { word: 'egg', meaning: '달걀' },
  ];
  const items = buildMultipleChoiceItems(words, undefined, [], seeded(7));
  items.forEach((it, i) => {
    assert.equal(it.choices.length, 4);
    assert.equal(new Set(it.choices).size, 4);
    assert.deepEqual(it.correct, [words[i].meaning]);
  });
});

test('객관식 인쇄: (힌트) at the end of a question or sentence is printed', () => {
  const [item] = buildMultipleChoiceItems([{ word: 'x', meaning: "can't", quizSentence: 'The interview ___ be long. (그 인터뷰는 오래 걸릴 리가 없다.)', question: '빈칸에 알맞은 표현은? (강한 추측 부정)', distractors: ['must', "shouldn't", 'may not'] }], 'modal-grammar', [], seeded(3));
  assert.equal(item.stem, 'The interview ___ be long. (그 인터뷰는 오래 걸릴 리가 없다.)');
  assert.equal(item.prompt, '빈칸에 알맞은 표현은? (강한 추측 부정)');
  assert.deepEqual(item.correct, ["can't"]);
});

test('문법 벼락치기: the answer is quizChoices[quizAnswerIndex], the other choices are the same question\'s', () => {
  const w = { word: '5형식', meaning: 'do', quizSentence: 'This suit will ___ for the party.', quizChoices: ['make', 'do', 'take', 'run'], quizAnswerIndex: 1 };
  assert.equal(crammingAnswer(w), 'do');
  assert.deepEqual(crammingDistractors(w), ['make', 'take', 'run']);
  // A teacher changed the index but not meaning: the index wins (print, quiz and test agree)
  assert.equal(crammingAnswer({ ...w, quizAnswerIndex: 2 }), 'take');
  assert.equal(crammingAnswer({ meaning: 'do' }), 'do', 'old words without choices keep meaning');
  const [item] = buildMultipleChoiceItems([w], 'grammar-cramming', [], seeded(5));
  assert.deepEqual([...item.choices].sort(), ['do', 'make', 'run', 'take']);
  assert.deepEqual(item.correct, ['do']);
  // Every question in the pool, as seeded (meaning = choices[answer], quizAnswerIndex = answer)
  for (const q of GRAMMAR_CRAMMING_POOL) {
    const seededWord = { meaning: q.choices[q.answer], quizChoices: q.choices, quizAnswerIndex: q.answer };
    assert.equal(crammingAnswer(seededWord), q.choices[q.answer], `id ${q.id}`);
    assert.equal(crammingDistractors(seededWord).length, q.choices.length - 1, `id ${q.id}`);
  }
});

test('관계사: how and the way are both marked when both are offered', () => {
  const [item] = buildMultipleChoiceItems([{ word: 'x', distractors: ['how', 'the way', 'which', 'where'] }], 'relative-grammar', [], seeded(9));
  assert.deepEqual([...item.correct].sort(), ['how', 'the way']);
});

test('문제은행 ids are unique (a repeated id showed another question\'s choices and answer)', () => {
  for (const [name, pool] of [['형식 동사', VERB_FORM_QUIZ_POOL], ['조동사', MODAL_QUIZ_POOL], ['조동사 기초', BASIC_MODAL_QUIZ_POOL], ['벼락치기', GRAMMAR_CRAMMING_POOL]] as const) {
    const ids = (pool as readonly { id: number }[]).map(q => q.id);
    assert.equal(new Set(ids).size, ids.length, `${name}: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);
  }
});

test('shuffle keeps every element', () => {
  const list = [1, 2, 3, 4, 5, 6];
  assert.deepEqual([...shuffle(list, seeded(11))].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6], 'the input is not changed');
});
