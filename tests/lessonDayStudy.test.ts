import test from 'node:test';
import assert from 'node:assert/strict';
import { dayStudyLabel, dayStudyRange, dayStudyScore, type DayStudySession } from '../src/components/teacher/LessonDayStudy.tsx';

const session = (over: Partial<DayStudySession>): DayStudySession => ({id: 's', wordbookTitle: '단어장', type: 'test', category: 'word', createdAt: null, duration: null, score: 27, totalItems: 30, dayStart: 3, dayEnd: 4, incorrectCount: 3, wrongWords: [], ...over});

test('이날 앱 학습: labels, DAY range, and the score that 점수로 넣기 would put in (오답 = 문항 − 정답)', () => {
  assert.equal(dayStudyLabel(session({})), '단어 테스트');
  assert.equal(dayStudyLabel(session({type: 'quiz'})), '객관식 퀴즈');
  assert.equal(dayStudyLabel(session({category: 'grammar', type: 'quiz'})), '문법');
  assert.equal(dayStudyLabel(session({type: 'mystery'})), '학습');
  assert.equal(dayStudyRange(session({})), ' · DAY 03~04');
  assert.equal(dayStudyRange(session({dayEnd: 3})), ' · DAY 03');
  assert.equal(dayStudyRange(session({dayStart: null})), '');
  assert.deepEqual(dayStudyScore(session({})), {wrong: 3, total: 30});
  assert.equal(dayStudyScore(session({score: null})), null, 'a flashcard run without a score cannot fill');
  assert.equal(dayStudyScore(session({totalItems: 0})), null);
  assert.equal(dayStudyScore(session({score: 31})), null);
});

test('이날 앱 학습 › 합쳐서 점수로 넣기: 정답 and 문항 each added up; word only when every picked one is; none scored → null', async () => {
  const {combinedDayStudyScore} = await import('../src/components/teacher/LessonDayStudy.tsx');
  const s = (over: Partial<DayStudySession>): DayStudySession => ({id: 'x', wordbookTitle: '', type: 'test', category: 'word', createdAt: null, duration: null, score: 18, totalItems: 20, dayStart: null, dayEnd: null, incorrectCount: 0, wrongWords: [], ...over});
  assert.deepEqual(combinedDayStudyScore([s({}), s({score: 17})]), {wrong: 5, total: 40, count: 2, word: true});
  assert.deepEqual(combinedDayStudyScore([s({}), s({category: 'grammar', score: 9, totalItems: 10})]), {wrong: 3, total: 30, count: 2, word: false});
  assert.deepEqual(combinedDayStudyScore([s({}), s({score: null, totalItems: null})]), {wrong: 2, total: 20, count: 1, word: true}, 'a session without a score is left out');
  assert.equal(combinedDayStudyScore([]), null);
});
