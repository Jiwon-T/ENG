import test from 'node:test';
import assert from 'node:assert/strict';
import {testTaskResult, wordTaskResult} from '../src/lib/wordTaskResult.ts';

test('단어 과제 결과 화면: the last word → 🎉 완료 (no next game); otherwise the progress and another game', () => {
  const done = wordTaskResult({title: '워드마스터 중등 고난도 · Day 1~2', total: 60, mastered: 60, completedAt: 1});
  assert.deepEqual([done.heading, done.line, done.percent, done.more], ['🎉 단어 과제 완료!', '선생님이 정한 단어를 모두 맞혔어요!', 100, false]);
  const midway = wordTaskResult({title: 'x', total: 60, mastered: 23, completedAt: null});
  assert.deepEqual([midway.heading, midway.line, midway.percent, midway.more], ['과제 한 판 끝!', '과제 23 / 60 맞힘 · 37개 남았어요', 38, true]);
});

test('단어 테스트 과제 결과: passed at the 통과 점수, else how many points are missing', () => {
  assert.deepEqual(testTaskResult(94, 90), {passed: true, heading: '📝 단어 테스트 과제 통과!', line: '통과 90점 · 선생님께 완료로 보여요'});
  assert.deepEqual(testTaskResult(76, 90), {passed: false, heading: '과제 통과까지 14점 더', line: '통과 90점 · 다시 도전해요'});
  assert.equal(testTaskResult(90, 90).passed, true);
});
