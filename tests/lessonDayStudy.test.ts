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
