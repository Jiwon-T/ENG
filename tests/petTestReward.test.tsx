import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {claimStudyRewards, initialPetState, pendingStudyRewards} from '../api/_lib/pet.ts';
import {lessonDraftSchema, continuation} from '../api/_lib/teacherWorkspacePolicy.ts';
import {directLessonReport} from '../api/_lib/teacherDirectReport.ts';
import {parentLessonDTO, studentLessonDTO} from '../api/_lib/reportAudienceDTO.ts';
import LessonTests from '../src/components/teacher/LessonTests';

const NOW = Date.parse('2026-10-19T03:00:00Z');
const lesson = {studentKey: '11111111-1111-4111-8111-111111111111', subject: '영어', date: '2026-10-19', start: '14:00', end: '15:20', attendance: '출석', attitude: '상', homework: '상', test: '최상', content: '수업', assignment: '', note: '', nextPlan: '', correct: 18, total: 20, round: 1};

test('테스트 평가 points: paper 40/30/20/10, app 20/15/10/5, once a lesson, outside the study cap; 중하 and below nothing', () => {
  const s = initialPetState(NOW); s.today.studyPoints = 10_000;
  const reports = [
    {id: 'a', date: '2026-10-18T14:00:00+09:00', attendance: '결석', test: '최상', testPaper: true},
    {id: 'b', date: '2026-10-17T14:00:00+09:00', attendance: '결석', test: '상', testPaper: false},
    {id: 'c', date: '2026-10-16T14:00:00+09:00', attendance: '결석', test: '중하', testPaper: true},
  ];
  const pending = pendingStudyRewards(s, reports, NOW);
  assert.deepEqual(pending.map(p => [p.id, p.kind, p.paper]), [['a', 'test', true], ['b', 'test', false]]);
  const before = s.points, got = claimStudyRewards(s, pending);
  assert.equal(got.points, 40 + 15); assert.equal(s.points - before, 55, 'paid although the study cap is used up');
  assert.deepEqual(pendingStudyRewards(s, reports, NOW), [], 'once');
});

test('일지: 테스트 방식 is 자동 (null) unless the teacher picks 종이 or 앱; it reaches the stored report only, never the audiences', () => {
  assert.equal(lessonDraftSchema.parse(lesson).testPaper, null);
  assert.equal(lessonDraftSchema.parse({...lesson, testPaper: true}).testPaper, true);
  assert.equal(continuation({}).testPaper, null);
  const r: any = directLessonReport('22222222-2222-4222-8222-222222222222', {data: {...lesson, testPaper: true}, revision: 1}, {studentKey: lesson.studentKey, internalStudentId: 's'});
  assert.equal(r.testPaper, true);
  assert.equal('testPaper' in parentLessonDTO(r), false); assert.equal('testPaper' in studentLessonDTO(r), false);
  const chip = (v: any) => renderToStaticMarkup(<LessonTests value={{...lesson, testPaper: v}} onChange={() => {}}/>).match(/class="lesson-test-paper"[^>]*>([^<]+)</)?.[1];
  assert.deepEqual([chip(null), chip(true), chip(false)], ['시험 자동', '종이 시험', '앱 시험']);
});

test('출석 30P, 지각 (보강 지각) 15P, 결석 nothing', () => {
  const s = initialPetState(NOW);
  const reports = ['출석', '지각', '보강 지각', '결석'].map((attendance, i) => ({id: `r${i}`, date: '2026-10-18T14:00:00+09:00', attendance}));
  assert.equal(claimStudyRewards(s, pendingStudyRewards(s, reports, NOW)).points, 30 + 15 + 15);
});

test('자동: paper only for a day read in full with no app 단어 테스트; a day not read (or a failed read) counts as app', async () => {
  const {isPaperDay} = await import('../api/_lib/student/pet.ts');
  const seen = {days: new Set(['2026-10-15']), from: '2026-10-10'};
  assert.equal(isPaperDay(seen, '2026-10-16'), true, 'read, no app test');
  assert.equal(isPaperDay(seen, '2026-10-15'), false, 'an app test that day');
  assert.equal(isPaperDay(seen, '2026-10-05'), false, 'older than what was read in full');
  assert.equal(isPaperDay(null, '2026-10-16'), false, 'the read failed');
});

test('수업 태도 칭찬: 최상 15P, 상 10P, below that nothing; once a lesson, outside the study cap', () => {
  const s = initialPetState(NOW); s.today.studyPoints = 10_000;
  const reports = ['최상', '상', '중상', '하'].map((attitude, i) => ({id: `t${i}`, date: '2026-10-18T14:00:00+09:00', attendance: '결석', attitude}));
  const pending = pendingStudyRewards(s, reports, NOW);
  assert.deepEqual(pending.map(p => [p.id, p.kind, p.grade]), [['t0', 'attitude', '최상'], ['t1', 'attitude', '상']]);
  assert.equal(claimStudyRewards(s, pending).points, 25);
  assert.deepEqual(pendingStudyRewards(s, reports, NOW), [], 'once');
});

test('테스트가 여럿일 때: each test its own 종이/앱; one on paper makes the lesson paper', async () => {
  const {lessonTestPaper} = await import('../src/lib/lessonReportText.ts');
  assert.equal(lessonTestPaper({testPaper: false, extraTests: [{paper: true}]}), true, '앱 1개 + 종이 1개 = 종이');
  assert.equal(lessonTestPaper({testPaper: false, extraTests: [{paper: null}]}), false);
  assert.equal(lessonTestPaper({testPaper: null, extraTests: []}), null, '자동');
  const r: any = directLessonReport('22222222-2222-4222-8222-222222222222', {data: {...lesson, testPaper: false, extraTests: [{name: '문법', correct: 8, total: 10, paper: true}]}, revision: 1}, {studentKey: lesson.studentKey, internalStudentId: 's'});
  assert.equal(r.testPaper, true);
  const chip = renderToStaticMarkup(<LessonTests value={{...lesson, testPaper: false, extraTests: [{name: '문법', correct: 8, total: 10, paper: true}]}} onChange={() => {}}/>).match(/class="lesson-test-paper"[^>]*>([^<]+)</)?.[1];
  assert.equal(chip, '앱 시험', 'the chip shows the chosen tab (the first)');
});
