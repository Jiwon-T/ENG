import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonDraftSchema, percentage } from '../api/_lib/teacherWorkspacePolicy.ts';
import { percentInputPatch } from '../src/lib/lessonTestInput.ts';
import { messageVariables } from '../src/lib/teacherMessage.ts';
const studentKey='11111111-1111-4111-8111-111111111111';
const lesson={studentKey,subject:'영어',date:'2026-10-02',start:'14:00',end:'15:30',attendance:'출석',attitude:'상',homework:'상',test:'상',content:'관계대명사',assignment:'문제 1–10',note:'다음 시간 재확인',nextPlan:'복습',correct:27,total:30,round:1};

test('수업 일지 점수: a percentage typed in is kept as that many right out of 100, and empty clears all three', () => {
  assert.deepEqual(percentInputPatch('correct', 'total', 'wrong', 85), {wrong: 15, total: 100, correct: 85});
  assert.deepEqual(percentInputPatch('examCorrect', 'examTotal', 'examWrong', 72.5), {examWrong: 27.5, examTotal: 100, examCorrect: 72.5});
  assert.deepEqual(percentInputPatch('correct', 'total', 'wrong', null), {wrong: null, total: null, correct: null});
  assert.equal(percentage(85, 100), 85);
});

test('수업 일지 점수: the percent mark is saved only with a 100-question score; SMS 문항·오답 stay empty for it', () => {
  const saved = lessonDraftSchema.parse({...lesson, examCorrect: 85, examTotal: 100, examWrong: 15, examScorePercent: true});
  assert.equal(saved.examScorePercent, true);
  assert.equal(saved.scorePercent, false, 'an old lesson without the mark reads as counted questions');
  assert.equal(lessonDraftSchema.parse({...lesson, correct: 27, total: 30, scorePercent: true}).scorePercent, false);
  assert.equal(lessonDraftSchema.safeParse({...lesson, examCorrect: 101, examTotal: 100, examScorePercent: true}).success, false, 'more than 100점 is refused');
  const sms = messageVariables({displayName: '학생'}, saved);
  assert.equal(sms['내신 대비 점수'], 85);
  assert.equal(sms['문항'], undefined);
  assert.equal(sms['오답'], undefined);
  const counted = messageVariables({displayName: '학생'}, {...saved, examScorePercent: false, examCorrect: 17, examTotal: 20, examWrong: 3});
  assert.equal(counted['문항'], 20);
  assert.equal(counted['오답'], 3);
});
