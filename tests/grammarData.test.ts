import test from 'node:test';
import assert from 'node:assert/strict';
import { changedFields, matchBuiltIn } from '../src/lib/builtInSync.ts';
import { grammarSetCount, grammarSetWords } from '../src/lib/grammarSetRanges.ts';
import { buildMultipleChoiceItems, joinChoices, splitChoices } from '../src/lib/multipleChoiceItems.ts';
import { GRAMMAR_CRAMMING_POOL } from '../src/lib/grammarCrammingPool.ts';
import { RELATIVE_GRAMMAR_CONCEPTS, VERB_FORM_GRAMMAR_DATA } from '../src/lib/grammarSets.ts';
import { irregularVerbsData } from '../src/lib/irregularVerbsData.ts';
import { VERB_FORM_QUIZ_POOL } from '../src/lib/verbFormQuizPool.ts';
import { MODAL_QUIZ_POOL, BASIC_MODAL_QUIZ_POOL } from '../src/lib/modalQuizPool.ts';

test('built-in sync: a question finds its saved copy by pool id, then sentence, then a sentence it had before', () => {
  const items = [
    { id: 1, sentence: 'A ___.' },
    { id: 2, sentence: 'B ___.', replaces: ['B ___ old.'] },
    { id: 3, sentence: 'Same ___.' },
    { id: 4, sentence: 'Same ___.' },
    { id: 5, sentence: 'New ___.' },
  ];
  const docs = [
    { id: 'd1', data: { poolId: 1, quizSentence: 'A ___ (edited by a teacher).' } },
    { id: 'd2', data: { quizSentence: 'B ___ old.' } },
    { id: 'd3', data: { quizSentence: 'Same ___.' } },
    { id: 'd4', data: { quizSentence: 'Same ___.' } },
    { id: 'mine', data: { quizSentence: 'A teacher\'s own ___.' } },
  ];
  const m = matchBuiltIn(items, docs, it => [`id:${it.id}`, `s:${it.sentence}`, ...(it.replaces || []).map(r => `s:${r}`)],
    d => [typeof d.poolId === 'number' ? `id:${d.poolId}` : '', `s:${d.quizSentence ?? ''}`]);
  assert.equal(m.get(0), 'd1');
  assert.equal(m.get(1), 'd2', 'the old sentence finds it');
  assert.deepEqual([m.get(2), m.get(3)].sort(), ['d3', 'd4'], 'two questions with one sentence get two docs');
  assert.equal(m.has(4), false, 'a new question is added');
  assert.ok(![...m.values()].includes('mine'), 'a teacher\'s question is not touched');
});

test('built-in sync: only fields that differ are written', () => {
  assert.equal(changedFields({ a: 1, b: ['x'], order: 3 }, { a: 1, b: ['x'] }), null);
  assert.deepEqual(changedFields({ a: 1, b: ['x'] }, { a: 1, b: ['y'], c: 'new' }), { b: ['y'], c: 'new' });
});

// The answer put into the blank must not repeat the word right before or after it ("Never have I I seen").
const doubled = (filled: string) => /\b(\w+)\s+\1\b/i.test(filled.replace(/\b(that|had)\s+\1\b/gi, ''));

test('문법 벼락치기: the answer fits its blank, ids and sentences are unique', () => {
  const sentences = new Set<string>();
  for (const q of GRAMMAR_CRAMMING_POOL) {
    assert.ok(q.answer >= 0 && q.answer < q.choices.length, `id ${q.id}`);
    assert.equal(new Set(q.choices).size, q.choices.length, `id ${q.id}: choices repeat`);
    assert.ok(!doubled(q.sentence.replace('___', q.choices[q.answer])), `id ${q.id}: ${q.sentence.replace('___', q.choices[q.answer])}`);
    assert.ok(!sentences.has(q.sentence), `id ${q.id}: the same sentence twice`);
    sentences.add(q.sentence);
  }
});

test('형식 동사·조동사 문제은행: the answer fits its blank', () => {
  for (const q of [...VERB_FORM_QUIZ_POOL, ...MODAL_QUIZ_POOL]) {
    if (!q.sentence.includes('___')) continue;
    const answer = q.choices[q.answer].replace(/\s*\(.*\)$/, '');
    assert.ok(!doubled(q.sentence.replace('___', answer)), `id ${q.id}: ${q.sentence.replace('___', answer)}`);
  }
});

test('관계사 예문: choices[0] is the answer and no choice repeats', () => {
  for (const concept of RELATIVE_GRAMMAR_CONCEPTS)
    for (const ex of concept.examples) {
      assert.equal(new Set(ex.choices).size, ex.choices.length, ex.sentence);
      if (ex.type === 'A') assert.ok(!doubled(ex.sentence.replace('(___)', ex.choices[0])), ex.sentence);
    }
});

test('불규칙 동사 인쇄: each question has 4 different choices and exactly one answer', () => {
  const words = irregularVerbsData.map(v => ({ word: v.base, past: v.past, pastParticiple: v.pastParticiple, distractors: v.distractors }));
  // Both questions for every verb: index 0 asks the 과거형, index 1 the 과거분사
  for (const w of words) for (const item of buildMultipleChoiceItems([w, w], 'irregular', [])) {
    assert.equal(item.choices.length, 4, w.word);
    assert.equal(new Set(item.choices).size, 4, `${w.word}: ${item.choices.join(', ')}`);
    assert.equal(item.choices.filter(c => item.correct.includes(c)).length, 1, `${w.word}: ${item.choices.join(', ')}`);
  }
});

test('벼락치기 선택지 칸: commas split, "|" splits when a choice holds a comma, and the box shows them back the same way', () => {
  assert.deepEqual(splitChoices('make, do , take,run'), ['make', 'do', 'take', 'run']);
  assert.deepEqual(splitChoices('Yes, I do | No, I don\'t | Yes | No'), ['Yes, I do', 'No, I don\'t', 'Yes', 'No']);
  for (const list of [['make', 'do'], ['Yes, I do', 'No']]) assert.deepEqual(splitChoices(joinChoices(list)), list);
});

test('1·2·3형식 대표 동사: each verb is one word per set (the seed finds its saved word by word and set)', () => {
  const keys = VERB_FORM_GRAMMAR_DATA.map(v => `${v.word}|${v.set}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('조동사 문제은행: no sentence is asked twice', () => {
  for (const pool of [MODAL_QUIZ_POOL, BASIC_MODAL_QUIZ_POOL]) {
    const sentences = pool.map(q => q.sentence);
    assert.equal(new Set(sentences).size, sentences.length, sentences.filter((s, i) => sentences.indexOf(s) !== i).join(' / '));
  }
});

test('문법 세트 범위: 세트 by the set field or fixed boundaries, others split every N words', () => {
  const words = Array.from({ length: 48 }, (_, i) => ({ id: `w${i}`, set: (i % 6) + 1 }));
  assert.equal(grammarSetCount('modal-grammar'), 6);
  assert.deepEqual(grammarSetWords('modal-grammar', words, 6)!.map(w => w.id), ['w42', 'w43', 'w44', 'w45', 'w46', 'w47']);
  assert.deepEqual(grammarSetWords('modal-grammar', words, 7), []);
  assert.equal(grammarSetWords('grammar-cramming', words, 2)!.length, 8);
  assert.equal(grammarSetWords('complement-grammar', words, 3)!.length, 12);
  assert.equal(grammarSetCount('standard'), 0);
  assert.equal(grammarSetWords('standard', words, 1), null);
});
