import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceHints } from '../src/lib/practiceTypes.ts';
import { SAMPLE_SENTENCES } from '../src/lib/samples.ts';

const passage = [
  'Many people believe that talent decides success.',
  'However, researchers found a different answer in 2015.',
  'They studied 300 students at Harvard for ten years.',
  'These students practiced every day without rest.',
  'For example, Mina played the piano for two hours.',
  'As a result, most of them improved quickly.',
  'Therefore, we should focus on effort rather than talent.',
];

test('연습 유형 추천: each type comes with the clue it was found by, no percentages', () => {
  const hints = practiceHints(passage), types = hints.map(h => h.type);
  assert.ok(types.includes('order') && types.includes('insert'));
  assert.match(hints.find(h => h.type === 'order')!.reason, /연결어·지시어로 시작하는 문장 \d+개/);
  assert.ok(types.includes('claim') && types.includes('gist') && types.includes('irrelevant') && types.includes('summary') && types.includes('consistency'));
  assert.ok(hints.every(h => !/%|확률|가능성/.test(h.reason)));
  // sorted by the internal order
  assert.deepEqual(hints.map(h => h.order), [...hints.map(h => h.order)].sort((a, b) => b - a));
});

test('연습 유형 추천: a short plain passage gets few or no types', () => {
  assert.deepEqual(practiceHints(['I like apples.', 'My sister likes pears.']), []);
  const types = practiceHints(['The sky is blue.', 'The sea is blue too.', 'I go to the beach often.']).map(h => h.type);
  assert.ok(!types.includes('order') && !types.includes('irrelevant') && !types.includes('summary'));
});

test('연습 유형 추천: 어휘 선택 (역접·비교 표현), 서술형 어법 (확실한 어법 포인트 2곳+), 서술형 영작 (구문이 분명한 문장)', () => {
  const hints = practiceHints(SAMPLE_SENTENCES), by = (t: string) => hints.find(h => h.type === t);
  assert.match(by('vocab')!.reason, /역접 연결어 \d+곳 · 비교 표현 \d+곳/);
  assert.match(by('correct')!.reason, /확실한 어법 포인트 \d+곳 — 찾아 고쳐 쓰기/);
  assert.match(by('compose')!.reason, /구문이 분명한 7~20단어 문장 \d+개/);
  const plain = practiceHints(['I like apples.', 'My sister likes pears.', 'We eat them.', 'They are sweet.']).map(h => h.type);
  assert.ok(!plain.includes('vocab') && !plain.includes('correct'), 'no clue, no hint');
});
