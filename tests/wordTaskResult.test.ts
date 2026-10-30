import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionTaskTag, testTaskResult, wordTaskResult} from '../src/lib/wordTaskResult.ts';

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

test('온라인 학습 기록의 과제 표시: the task 단어 테스트 after it was given (통과 / 몇 점 부족), 원정대 과제 games; others none', () => {
  const tasks: any[] = [
    {id: 't1', kind: 'test', wordbookId: 'wm', startDay: 30, endDay: 30, createdAt: Date.parse('2026-10-27T00:00:00Z'), total: 30, mastered: 0, passScore: 90},
    {id: 'e1', kind: 'expedition', wordbookId: 'wm', startDay: 28, endDay: 28, createdAt: 0, total: 30, mastered: 12},
  ];
  const test = (score: number, at = '2026-10-27T10:00:00Z', extra: any = {}) => ({type: 'test', wordbookId: 'wm', dayStart: 30, dayEnd: 30, score, totalItems: 30, createdAt: at, ...extra});
  assert.deepEqual(sessionTaskTag(test(27), tasks), {kind: 'test', passed: true, label: '과제 · 통과'});
  assert.deepEqual(sessionTaskTag(test(25), tasks), {kind: 'test', passed: false, label: '과제 · 83점, 7점 부족'});
  assert.equal(sessionTaskTag(test(27, '2026-10-26T10:00:00Z'), tasks), null, 'before the task was given');
  assert.equal(sessionTaskTag(test(27, undefined, {dayStart: 26, dayEnd: 26}), tasks), null, 'another range');
  assert.equal(sessionTaskTag({type: 'quiz', wordbookId: 'wm', dayStart: 30, dayEnd: 30, createdAt: '2026-10-27T10:00:00Z'}, tasks), null);
  assert.deepEqual(sessionTaskTag({type: 'quiz', source: 'word-task', taskId: 'e1', createdAt: '2026-10-27T10:00:00Z'}, tasks), {kind: 'expedition', passed: false, label: '원정대 과제 · 지금 12/30 맞힘'});
  assert.equal(sessionTaskTag({type: 'quiz', source: 'word-task', taskId: 'gone', createdAt: null}, tasks)?.label, '원정대 과제', 'a removed task still reads as one');
});
