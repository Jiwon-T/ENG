import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonDraftSchema } from '../api/_lib/teacherWorkspacePolicy.ts';
import { directLessonReport } from '../api/_lib/teacherDirectReport.ts';
import { parentLessonDTO, studentLessonDTO } from '../api/_lib/reportAudienceDTO.ts';
import { testLabel, testScoreTitle } from '../src/lib/lessonReportText.ts';
import { scoreRows } from '../src/lib/academicChart.ts';
import { messageVariables } from '../src/lib/teacherMessage.ts';
const studentKey='11111111-1111-4111-8111-111111111111';
const lesson={studentKey,subject:'영어',date:'2026-10-02',start:'14:00',end:'15:30',attendance:'출석',attitude:'상',homework:'상',test:'상',content:'관계대명사',assignment:'문제 1–10',note:'다음 시간 재확인',nextPlan:'복습',correct:27,total:30,round:1};

test('테스트 점수: shown as 테스트 (or the name the teacher gave), never as 단어 by itself', () => {
  assert.equal(testLabel(''), '테스트'); assert.equal(testLabel(undefined), '테스트'); assert.equal(testLabel(' 모의고사 '), '모의고사');
  assert.equal(testScoreTitle(''), '테스트 점수'); assert.equal(testScoreTitle('단어'), '테스트 점수 · 단어');
});

test('테스트 이름: saved with the lesson (trimmed, 30 letters at most), carried into the report and both audiences', () => {
  const saved = lessonDraftSchema.parse({...lesson, correct: 17, total: 20, testName: '  모의고사 '});
  assert.equal(saved.testName, '모의고사');
  assert.equal(lessonDraftSchema.parse(lesson).testName, '', 'an old lesson has no name');
  assert.equal(lessonDraftSchema.safeParse({...lesson, testName: 'x'.repeat(31)}).success, false);
  const report: any = directLessonReport('22222222-2222-4222-8222-222222222222', {academyId: 'main', revision: 1, data: saved}, {studentKey, internalStudentId: 'student', notionStudentPageId: studentKey});
  assert.equal(report.vocabularyScore, 85); assert.equal(report.testName, '모의고사');
  assert.equal(studentLessonDTO(report).testName, '모의고사'); assert.equal(parentLessonDTO(report).testName, '모의고사');
  assert.equal(studentLessonDTO({...report, testName: undefined}).testName, '', 'a report saved before stays nameless');
});

test('성적 그래프: the tab is 학원 테스트 and each point keeps its 테스트 이름; SMS gets {테스트 점수} and keeps {단어}', () => {
  const rows = scoreRows({records: [], academyScores: [
    {recordId: 'a', subject: '영어', examDate: '2026-10-01', vocabularyScore: 90, testName: '단어', schoolExamScore: null},
    {recordId: 'b', subject: '수학', examDate: '2026-10-02', vocabularyScore: 70, testName: '', schoolExamScore: null},
  ]} as any, '학원 테스트');
  assert.deepEqual(rows.map(r => [r.title, r.score]), [['학원 테스트 · 단어', 90], ['학원 테스트', 70]]);
  const sms = messageVariables({displayName: '학생'}, {correct: 17, total: 20});
  assert.equal(sms['테스트 점수'], 85); assert.equal(sms['단어'], 85); assert.equal(sms['단어테스트 점수'], 85);
});
