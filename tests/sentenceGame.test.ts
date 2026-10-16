import test from 'node:test';
import assert from 'node:assert/strict';
import { orderIsRight, orderPieces, readingScore, shuffledOrder } from '../src/lib/sentenceGame.ts';

test('단어 순서 배열: pieces from the teacher\'s / marks, else meaning units, never fewer than 2; the shuffle is never already right', () => {
  assert.deepEqual(orderPieces({ word: 'I want to be a doctor.', chunked: 'I want / to be / a doctor.', meaning: '' }), ['I want', 'to be', 'a doctor.']);
  assert.ok(orderPieces({ word: 'Many people believe that success comes from talent.', meaning: '' }).length >= 3);
  assert.deepEqual(orderPieces({ word: 'Hello there.', meaning: '' }), ['Hello', 'there.']);
  assert.deepEqual(orderPieces({ word: 'She is reading a book in the library.', meaning: '' }), ['She is reading', 'a book', 'in the library.'], 'at least 3 pieces when the sentence is long enough');
  const pieces = ['I want', 'to be', 'a doctor.'];
  for (let k = 0; k < 20; k++) assert.equal(orderIsRight(pieces, shuffledOrder(pieces)), false);
  assert.equal(orderIsRight(pieces, [0, 1, 2]), true);
  assert.equal(orderIsRight(['the', 'cat', 'the'], [2, 1, 0]), true, 'same-text pieces may swap');
});

test('낭독: heard words matched in order; 80% passes; stars by share', () => {
  const full = readingScore('I want to be a doctor.', 'i want to be a doctor');
  assert.deepEqual([full.pass, full.stars], [true, 3]);
  const one = readingScore('I want to be a doctor.', 'I want to be a daughter');
  assert.deepEqual([one.hit, one.pass, one.stars], [[true, true, true, true, true, false], true, 1]);
  assert.equal(readingScore("It's raining.", 'its raining').pass, true, 'apostrophes may be missing');
  assert.equal(readingScore('The key is consistent practice.', 'the key').pass, false);
});
