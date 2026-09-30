import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAssignmentFromFeedback } from '../api/_lib/assignmentExtractor.js';

test('extracts the final line-start 과제 block and preserves following lines', () => {
  const feedback = '수업 내용\n과제: 앞부분\n메모\n과제： 교재 10쪽\n- 단어 1~20';
  assert.equal(extractAssignmentFromFeedback(feedback), '교재 10쪽\n- 단어 1~20');
});

test('does not mistake an inline mention for an assignment marker', () => {
  assert.equal(extractAssignmentFromFeedback('오늘 과제:라는 표현을 설명함'), null);
});

test('normalizes explicit no-assignment phrases to null', () => {
  for (const value of ['없음', '없는 날', '해당 없음', 'X', '-']) {
    assert.equal(extractAssignmentFromFeedback(`피드백\n과제: ${value}`), null);
  }
});

test('returns null when marker or content is absent', () => {
  assert.equal(extractAssignmentFromFeedback('수업만 진행함'), null);
  assert.equal(extractAssignmentFromFeedback('과제:'), null);
  assert.equal(extractAssignmentFromFeedback(null), null);
});

test('extracts assignments after a spaced colon with multiline Korean homework', () => {
  assert.equal(
    extractAssignmentFromFeedback('오늘은 관계대명사를 배웠습니다.\n\n과제 : 교재 25쪽 풀기\n단어 DAY 3 암기'),
    '교재 25쪽 풀기\n단어 DAY 3 암기'
  );
});
