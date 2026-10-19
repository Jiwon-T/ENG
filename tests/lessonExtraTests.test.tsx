import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import LessonTests from '../src/components/teacher/LessonTests';
import {lessonDraftSchema, continuation} from '../api/_lib/teacherWorkspacePolicy.js';
import {directLessonReport} from '../api/_lib/teacherDirectReport.js';
import {parentLessonDTO, studentLessonDTO} from '../api/_lib/reportAudienceDTO.js';
import {messageVariables} from '../src/lib/teacherMessage.js';
import {applyPreviousLesson} from '../src/lib/teacherTodayLessons.js';
import {TEST_NAME_OPTIONS, extraScoresText} from '../src/lib/lessonReportText.js';

const lesson = {studentKey: '11111111-1111-4111-8111-111111111111', subject: '영어', date: '2026-10-19', start: '14:00', end: '15:20', attendance: '출석', attitude: '상', homework: '상', test: '상', content: '수업', assignment: '', note: '', nextPlan: '', correct: 18, total: 20, wrong: 2, testName: '단어', round: 1};

test('테스트 점수 chips: 문법 right after 단어', () => {
  assert.deepEqual([...TEST_NAME_OPTIONS], ['단어', '문법', '모의고사', '단원평가']);
});

test('more tests: saved after the first, blank ones dropped, 오답 수 counted like the first', () => {
  const d = lessonDraftSchema.parse({...lesson, extraTests: [{name: ' 벼락치기 ', correct: null, total: 20, wrong: 3}, {name: '', correct: null, total: null}]});
  assert.deepEqual(d.extraTests, [{name: '벼락치기', correct: 17, total: 20, wrong: 3, scorePercent: false}]);
  assert.equal(d.correct, 18);
  assert.deepEqual(lessonDraftSchema.parse(lesson).extraTests, [], 'old lessons: none');
  assert.throws(() => lessonDraftSchema.parse({...lesson, extraTests: [{name: 'a', correct: null, total: 10, wrong: 11}]}), /추가한 테스트/);
  assert.throws(() => lessonDraftSchema.parse({...lesson, extraTests: Array(4).fill({name: 'a', correct: 1, total: 2})}));
  assert.deepEqual(continuation({}).extraTests, []);
});

test('the first test empty: the next one with a score becomes the first', () => {
  const d = lessonDraftSchema.parse({...lesson, correct: null, total: null, wrong: null, testName: '', extraTests: [{name: '문법', correct: 9, total: 10}, {name: '단어', correct: 20, total: 20}]});
  assert.deepEqual([d.correct, d.total, d.testName], [9, 10, '문법']);
  assert.deepEqual(d.extraTests.map(t => t.name), ['단어']);
});

test('학부모 리포트 and 문자 carry the other tests; the student card and the first score stay as they were', () => {
  const data = {...lesson, extraTests: [{name: '벼락치기', correct: 17, total: 20}, {name: '', correct: 7, total: 10}]};
  const r: any = directLessonReport('22222222-2222-4222-8222-222222222222', {data, revision: 1}, {studentKey: lesson.studentKey, internalStudentId: 's'});
  assert.equal(r.vocabularyScore, 90);
  assert.deepEqual(r.extraScores, [{name: '벼락치기', score: 85}, {name: '', score: 70}]);
  assert.deepEqual(parentLessonDTO(r).extraScores, r.extraScores);
  assert.equal('extraScores' in studentLessonDTO(r), false);
  assert.equal(extraScoresText(r.extraScores), '벼락치기 85점 · 테스트 70점');
  assert.deepEqual(directLessonReport('22222222-2222-4222-8222-222222222222', {data: lesson, revision: 1}, {studentKey: lesson.studentKey, internalStudentId: 's'}).extraScores, [], 'removed later: cleared on the report too');
  assert.equal(messageVariables({displayName: '학생'}, data)['테스트 점수'], '단어 90점 · 벼락치기 85점 · 테스트 70');
  assert.equal(messageVariables({displayName: '학생'}, lesson)['테스트 점수'], 90, 'one test: the number as before');
});

test('the previous lesson carries its other tests with the first, never over ones typed', () => {
  const seed: any = {studentKey: 'k', subject: '영어', date: '2026-10-19', correct: null, total: null};
  const previous = {correct: 8, total: 10, extraTests: [{name: '문법', correct: 5, total: 10}]};
  assert.deepEqual(applyPreviousLesson({...seed}, seed, previous).extraTests, previous.extraTests);
  assert.equal(applyPreviousLesson({...seed, extraTests: [{name: 'x', correct: 1, total: 1}]}, seed, previous).correct, null);
});

test('the score box: tabs in the title row only when there is more than one test, and a + to add one', () => {
  const one = renderToStaticMarkup(<LessonTests value={{...lesson}} onChange={() => {}}/>);
  assert.match(one, /aria-label="테스트 하나 더 기록"/);
  assert.doesNotMatch(one, /①/);
  const many = renderToStaticMarkup(<LessonTests value={{...lesson, extraTests: [{name: '벼락치기', correct: 17, total: 20}]}} onChange={() => {}}/>);
  assert.match(many, /①<span class="lesson-test-tab-name"> 단어<\/span> 90/);
  assert.match(many, /②<span class="lesson-test-tab-name"> 벼락치기<\/span> 85/);
  const full = renderToStaticMarkup(<LessonTests value={{...lesson, extraTests: Array(3).fill({name: '', correct: 1, total: 2})}} onChange={() => {}}/>);
  assert.doesNotMatch(full, /테스트 하나 더 기록/, 'four tests: no more');
});
