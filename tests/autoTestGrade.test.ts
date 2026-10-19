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

test('테스트 평가 자동: follows the scores until the teacher picks a grade; scores cleared = 미확인', () => {
  const start = {test: '미확인', correct: null, total: null};
  const typed = withAutoTestGrade(start, {...start, total: 20, correct: 18}, 'correct', ['correct']);
  assert.equal(typed.test, '상');
  const cleared = withAutoTestGrade(typed, {...typed, correct: null, total: null}, 'correct', []);
  assert.equal(cleared.test, '미확인');
  // the teacher picked 최상: a score change keeps it
  assert.equal(withAutoTestGrade({...typed, test: '최상'}, {...typed, test: '최상', correct: 15}, 'correct', ['test']).test, '최상');
  // a saved lesson whose grade differs from its scores (chosen before): kept
  assert.equal(withAutoTestGrade({test: '미제출', correct: 18, total: 20}, {test: '미제출', correct: 19, total: 20}, 'correct', []).test, '미제출');
  // not a score: untouched
  assert.equal(withAutoTestGrade(start, {...start, note: 'x'}, 'note', []).test, '미확인');
});
