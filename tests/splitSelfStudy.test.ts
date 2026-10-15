import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLessonComplete, lessonDraftSchema} from '../api/_lib/teacherWorkspacePolicy.ts';
import {nextSessionNumbers, studyMinutes, studyTimeText, studyLastEnd, kindMinutes} from '../src/lib/sessionNumbers.ts';

const studentKey = '11111111-1111-4111-8111-111111111111';
const lesson = {studentKey, subject: '영어', date: '2026-10-15', classSession: '있음', start: '16:30', end: '18:20', attendance: '출석', attitude: '상', homework: '상', test: '미확인', content: '관계대명사', assignment: '', note: '', nextPlan: '', correct: null, total: null, round: 2.4, selfStudy: '있음', selfStudyStart: '18:20', selfStudyEnd: '18:50', selfStudyRound: 3.3};

test('자습을 나눠 하면 모든 조각을 합친 시간으로 회차를 세요 (30분 + 30분 = +1)', () => {
  const d = {...lesson, selfStudyMore: [{start: '16:00', end: '16:30'}]};
  assert.equal(studyMinutes(d), 60);
  assert.equal(kindMinutes('lesson', d), 110);
  assert.equal(studyMinutes({...d, selfStudyMore: [{start: '16:00', end: ''}]}), null, 'a piece without its end: not counted yet');
  const earlier = [{id: 'a', stage: 'published', data: {...lesson, date: '2026-10-14', selfStudyRound: 2.3, round: 1}}];
  assert.equal(nextSessionNumbers(earlier, d).study, 3.3);
  assert.equal(nextSessionNumbers(earlier, {...lesson, selfStudyEnd: '18:50'}).study, 2.8, 'one 30-minute piece alone: +0.5');
});

test('조각은 시간 순으로 저장해요: 가장 이른 조각이 첫 자습, 빈 줄은 빠져요', () => {
  const d = lessonDraftSchema.parse({...lesson, selfStudyMore: [{start: '16:00', end: '16:30'}, {start: '', end: ''}]});
  assert.deepEqual([d.selfStudyStart, d.selfStudyEnd, d.selfStudyMore], ['16:00', '16:30', [{start: '18:20', end: '18:50'}]]);
  assert.equal(studyTimeText(d), '16:00–16:30, 18:20–18:50');
  assert.equal(studyLastEnd(d), '18:50');
  assert.equal(studyTimeText({selfStudyStart: '18:20', selfStudyEnd: '19:20'}), '18:20–19:20', 'old lessons: one piece');
  assert.deepEqual(lessonDraftSchema.parse(lesson).selfStudyMore, []);
});

test('반영할 때: 조각마다 시작·종료가 있어야 하고 겹치면 안 돼요; 자습 없음이면 조각도 없어야 해요', () => {
  assert.doesNotThrow(() => assertLessonComplete({...lesson, selfStudyMore: [{start: '16:00', end: '16:30'}]}));
  assert.throws(() => assertLessonComplete({...lesson, selfStudyMore: [{start: '18:40', end: '19:00'}]}), /SELF_STUDY_REQUIRED/, 'overlaps 18:20–18:50');
  assert.throws(() => assertLessonComplete({...lesson, selfStudyMore: [{start: '19:00', end: ''}]}), /SELF_STUDY_REQUIRED/);
  assert.throws(() => assertLessonComplete({...lesson, selfStudy: '없음', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, selfStudyMore: [{start: '19:00', end: '19:30'}]}), /SELF_STUDY_REQUIRED/);
  assert.throws(() => lessonDraftSchema.parse({...lesson, selfStudyMore: [{start: '1', end: '2'}, {start: '3', end: '4'}, {start: '5', end: '6'}]}), 'at most 3 pieces in all');
});
