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

test('자습 1시간을 수업 바로 전·후로: 자정을 넘거나 수업 시간이 없으면 만들지 않아요', async () => {
  const {studyAroundLesson, timeBeforeMinutes} = await import('../src/lib/lessonTimePresets.ts');
  assert.deepEqual(studyAroundLesson({start: '16:30', end: '18:20'}, 'before'), {start: '15:30', end: '16:30'});
  assert.deepEqual(studyAroundLesson({start: '16:30', end: '18:20'}, 'after'), {start: '18:20', end: '19:20'});
  assert.equal(studyAroundLesson({start: '00:30', end: '01:50'}, 'before'), null);
  assert.equal(studyAroundLesson({start: '22:00', end: '23:30'}, 'after'), null);
  assert.equal(studyAroundLesson({start: '', end: ''}, 'before'), null);
  // Only one lesson time typed (or the two out of order): no preset yet.
  assert.equal(studyAroundLesson({start: '16:30', end: ''}, 'before'), null);
  assert.equal(studyAroundLesson({start: '', end: '18:20'}, 'after'), null);
  assert.equal(studyAroundLesson({start: '18:20', end: '16:30'}, 'before'), null);
  assert.equal(studyAroundLesson({start: '16:30', end: '1:20'}, 'after'), null);
  assert.deepEqual([timeBeforeMinutes('10:15', 60), timeBeforeMinutes('00:59', 60), timeBeforeMinutes('7:00', 60)], ['09:15', null, null]);
});

test("'수업 전' 자습: 끝이 수업 시작과 같으면 칩이 수업 시작에서 거꾸로 계산돼요 (80분 = 80분 전부터)", async () => {
  const {chipTimes, isBeforeLesson} = await import('../src/lib/lessonTimePresets.ts');
  const lesson = {start: '18:40', end: '19:40'};
  assert.equal(isBeforeLesson(lesson, '17:40', '18:40'), true);
  assert.deepEqual(chipTimes(80, '17:40', '18:40', lesson), {start: '17:20', end: '18:40'});
  assert.deepEqual(chipTimes(120, '17:20', '18:40', lesson), {start: '16:40', end: '18:40'});
  // After the lesson (or anywhere else): the end follows the start, as before.
  assert.equal(isBeforeLesson(lesson, '19:40', '20:40'), false);
  assert.deepEqual(chipTimes(80, '19:40', '20:40', lesson), {start: '19:40', end: '21:00'});
  assert.deepEqual(chipTimes(60, '15:00', '15:30'), {start: '15:00', end: '16:00'}, 'no lesson given: plain +minutes');
  assert.equal(isBeforeLesson({start: '18:40', end: ''}, '17:40', '18:40'), false, 'lesson end missing: no before mode');
  assert.equal(chipTimes(120, '00:10', '01:00', {start: '01:00', end: '02:00'}), null, 'would start before midnight');
});

test("'수업 후' 선택 표시는 끝 시간까지 있는 자습일 때만 (빈 끝이면 눌러서 채울 수 있어요)", async () => {
  const {isAfterLesson, studyAroundLesson} = await import('../src/lib/lessonTimePresets.ts');
  const lesson = {start: '18:40', end: '19:40'};
  assert.equal(isAfterLesson(lesson, '19:40', '20:40'), true);
  assert.equal(isAfterLesson(lesson, '19:40', ''), false, 'end empty: not selected, so pressing it fills 19:40–20:40');
  assert.equal(isAfterLesson(lesson, '19:40', '19:00'), false);
  assert.deepEqual(studyAroundLesson(lesson, 'after'), {start: '19:40', end: '20:40'});
});
