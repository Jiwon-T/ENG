import test from 'node:test';
import assert from 'node:assert/strict';
import {directLessonReport} from '../api/_lib/teacherDirectReport.ts';
import {studentLessonDTO,parentLessonDTO,lessonReportId} from '../api/_lib/reportAudienceDTO.ts';
import {hashStudentKey} from '../api/_lib/security.ts';
const studentKey='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',pageId='33333333-3333-4333-8333-333333333333';
const mapping={studentKey,internalStudentId:'student',notionStudentPageId:studentKey};
const draft:any={academyId:'main',revision:1,data:{studentKey,subject:'영어',date:'2026-10-05',classSession:'있음',start:'12:40',end:'15:20',round:3,selfStudy:'없음',attendance:'출석',attitude:'최상',homework:'상',test:'상',correct:null,total:null,examCorrect:43.5,examWrong:16.5,examTotal:60,content:'수업 내용',assignment:'교재 10쪽',note:'',nextPlan:'',specialNote:'특이 사항'}};
test('direct app report preserves fractional score, homework and audience separation',()=>{
 const r=directLessonReport(id,draft,mapping);
 assert.equal(r.schoolExamScore,72.5);assert.equal(r.derivedAssignment,'교재 10쪽');assert.equal(r.lessonTime,'12:40 ~ 15:20');
 const student=studentLessonDTO(r as any),parent=parentLessonDTO(r as any);
 assert.equal(student.schoolExamScore,72.5);assert.equal('feedback' in student,false);assert.match(parent.feedback,/특이 사항/);
 const mirror=directLessonReport(id,{...draft,notionPageId:pageId},mapping,r);assert.equal(lessonReportId(mirror as any),lessonReportId(r as any));
});


test('선생님 메모, 시험범위 and 회차 never reach the report; the preview text is the server text', async () => {
 const {parentFeedbackText} = await import('../src/lib/lessonReportText.ts');
 const secret={...draft,data:{...draft.data,teacherNote:'상담 필요(비공개)',examScope:'3과~5과',specialNote:'집중 잘함'}};
 const r=directLessonReport(id,secret,mapping),all=JSON.stringify([r,studentLessonDTO(r as any),parentLessonDTO(r as any)]);
 assert.ok(!all.includes('상담 필요') && !all.includes('3과~5과'), 'teacher-only fields stay out');
 assert.equal(r.feedback, parentFeedbackText(secret.data));
 assert.equal(r.feedback, '수업 내용\n\n과제: 교재 10쪽\n\n특이 사항: 집중 잘함');
});
