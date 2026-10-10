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

