import test from 'node:test';
import assert from 'node:assert/strict';
import {autoTestGrade, withAutoTestGrade} from '../src/lib/lessonTestInput.ts';

test('테스트 평가 자동: from the average score; no score = 미확인', () => {
  assert.equal(autoTestGrade({correct: 19, total: 20}), '최상');
  assert.equal(autoTestGrade({correct: 18, total: 20}), '상');
  assert.equal(autoTestGrade({correct: 27, total: 30, extraTests: [{correct: 7, total: 10}]}), '중', '(90 + 70) / 2 = 80');
  assert.equal(autoTestGrade({correct: null, total: null}), '미확인');
  assert.equal(autoTestGrade({correct: 5, total: 20}), '최하');
});

test('테스트 평가 자동: the last thing done wins — a score typed, changed or cleared sets it; a picked grade stays until then', () => {
  const start = {test: '미확인', correct: null, total: null};
  const typed = withAutoTestGrade(start, {...start, total: 20, correct: 18}, 'correct');
  assert.equal(typed.test, '상');
  assert.equal(withAutoTestGrade(typed, {...typed, correct: null, total: null}, 'correct').test, '미확인', 'scores cleared');
  // the teacher picked 최상 (a chip, not a score): it stays…
  const picked = {...typed, test: '최상'};
  assert.equal(withAutoTestGrade(typed, picked, 'test').test, '최상');
  assert.equal(withAutoTestGrade(picked, {...picked, note: 'x'}, 'note').test, '최상', 'other fields leave it');
  // …until the next score change
  assert.equal(withAutoTestGrade(picked, {...picked, correct: 15}, 'correct').test, '중하');
  assert.equal(withAutoTestGrade(picked, {...picked, correct: null, total: null}, 'total').test, '미확인');
  // a lesson saved before (score there, grade left 미확인): the next score change sets it
  assert.equal(withAutoTestGrade({test: '미확인', correct: 18, total: 20}, {test: '미확인', correct: 19, total: 20}, 'correct').test, '최상');
  // a percentage typed, a second test added
  assert.equal(withAutoTestGrade(start, {...start, correct: 85, total: 100, wrong: 15}, 'wrong').test, '중상');
  assert.equal(withAutoTestGrade(typed, {...typed, extraTests: [{correct: 7, total: 10}]}, 'extraTests').test, '중', '(90 + 70) / 2');
});

test('테스트 평가 자동: a score still being typed (오답 수 above 문항 수) is skipped, never a crash', () => {
  assert.equal(autoTestGrade({correct: -4, total: 2}), '미확인', '오답 6 carried over, 문항 수 "2" of 20 typed');
  assert.equal(autoTestGrade({correct: 30, total: 20}), '미확인');
  assert.equal(autoTestGrade({correct: -4, total: 2, extraTests: [{correct: 18, total: 20}]}), '상', 'the other test still counts');
  assert.equal(withAutoTestGrade({}, {wrong: 6, total: 2, correct: -4}, 'total').test, '미확인');
});
