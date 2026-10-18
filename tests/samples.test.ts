import test from 'node:test';
import assert from 'node:assert/strict';
import { CIRCLED, QUESTION_TYPES, checkQuestion } from '../src/lib/questionMaker.ts';
import { SAMPLE_AI, SAMPLE_SENTENCES, samplePassage, sampleQuestions, sampleWorkbook } from '../src/lib/samples.ts';
import { checkWorkbook } from '../src/lib/workbook.ts';
import { cleanStructure } from '../src/lib/passageLevel.ts';
import { chunkHints } from '../src/lib/passageTools.ts';

test('샘플 보기 · 변형 문제: every type has a sample of its own type that passes the app check, the same every time', () => {
  const samples = sampleQuestions(), again = sampleQuestions();
  for (const t of QUESTION_TYPES) {
    const q = samples[t.id];
    assert.ok(q, `${t.label} has a sample`);
    assert.equal(q!.type, t.id);
    assert.deepEqual(checkQuestion(q!, SAMPLE_SENTENCES), [], `${t.label} passes the check`);
    assert.deepEqual(q, again[t.id], `${t.label} is the same each time`);
  }
  // the answer the sample shows is the one written for it
  const right = (id: 'title' | 'topic' | 'gist' | 'claim') => samples[id]!.options![(samples[id]!.answer as number) - 1];
  for (const id of ['title', 'topic', 'gist', 'claim'] as const) assert.equal(right(id), SAMPLE_AI[id].answer);
  assert.equal(samples.blank!.options![(samples.blank!.answer as number) - 1], SAMPLE_AI.blank.phrase);
  assert.equal(samples.consistency!.options![(samples.consistency!.answer as number) - 1], SAMPLE_AI.consistency.lie);
  assert.ok(samples.irrelevant!.passage!.includes(`${CIRCLED[(samples.irrelevant!.answer as number) - 1]} ${SAMPLE_AI.irrelevant.sentence}`));
  assert.ok(samples.summary!.options![(samples.summary!.answer as number) - 1].includes(SAMPLE_AI.summary.a));
});

test('샘플 보기 · 워크북 and 지문 분석: complete and fitting the example passage', () => {
  const wb = sampleWorkbook();
  assert.deepEqual(checkWorkbook(SAMPLE_SENTENCES.map((text, i) => ({ id: `sample${i}`, text, ko: 'x' })), wb), []);
  assert.equal(wb.blanks.length, SAMPLE_SENTENCES.length);
  const p = samplePassage();
  assert.equal(p.parts.reading!.sentences.length, SAMPLE_SENTENCES.length);
  p.parts.reading!.sentences.forEach((r, i) => assert.equal(r.chunks.map(c => c.en).join(' '), SAMPLE_SENTENCES[i], `직독직해 ${i + 1} gives the sentence back`));
  assert.equal(p.parts.grammar!.sentences.length, SAMPLE_SENTENCES.length);
  assert.deepEqual(cleanStructure(p.parts.structure, SAMPLE_SENTENCES.length), { roles: p.parts.structure!.roles, key: p.parts.structure!.key });
  assert.deepEqual(p.hints, SAMPLE_SENTENCES.map(chunkHints));
  assert.equal(p.history, undefined, 'shown as a student would see it: no names, no edit tools');
});
