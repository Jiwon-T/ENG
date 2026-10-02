import test from 'node:test';
import assert from 'node:assert/strict';
import { studentLessonDTO,parentLessonDTO } from '../api/_lib/reportAudienceDTO.ts';
import { loadTeacherReportReview } from '../api/_lib/teacherReportReview.ts';
const studentKey='11111111-1111-4111-8111-111111111111';
const english:any={notionPageId:'lesson',internalStudentId:'secret',subject:'영어',lessonDateStart:'2026-10-03T14:00:00+09:00',lessonDateEnd:null,category:'수업',attendance:'출석',homework:'상',attitude:'상',test:'상',feedback:'개인 피드백',vocabularyScore:0,schoolExamScore:null,derivedAssignment:'교재 10쪽',lessonTime:'14:00–15:30',selfStudyTime:''};
test('actual audience DTOs preserve zero and assignments while student view excludes parent-only fields',()=>{
 const student=studentLessonDTO(english),parent=parentLessonDTO(english);
 assert.equal(student.vocabularyScore,0);assert.equal(student.assignmentContent,'교재 10쪽');assert.equal(parent.feedback,'개인 피드백');
 for(const field of ['feedback','attitude','test','selfStudyTime','notionPageId','internalStudentId','studentKey'])assert.equal(field in student,false);
 assert.equal(student.reportId,parent.reportId);
});
test('teacher review rejects an unrelated student before mapping or data queries',async()=>{
 let reads=0;
 await assert.rejects(loadTeacherReportReview({} as any,{admin:false,scopes:[]},studentKey,'parent',{readStudentMapping:async()=>{reads++;return null;},loadAcademicData:async()=>({})} as any),/FORBIDDEN/);
 assert.equal(reads,0);
});
test('teacher review applies subject scope to lessons, schedules, and every academic collection',async()=>{
 const math={...english,notionPageId:'math',subject:'수학',feedback:'다른 선생님 피드백'};
 const schedule={scheduleDocId:'schedule',subject:'수학',title:'수학 보강',startAt:'2026-10-03',endAt:null,scheduleType:'보강',status:'예정',notice:null};
 const docs=(rows:any[])=>rows.map((value,i)=>({id:String(i),data:()=>value}));
 const db={collection:(name:string)=>{const query:any={where:()=>query,get:async()=>({docs:docs(name==='lessonReports'?[english,math]:name==='studentSchedules'?[schedule]:[])})};return query;}} as any;
 const deps:any={readStudentMapping:async()=>({internalStudentId:'secret',firebaseUid:null}),loadAcademicData:async()=>({records:[{subject:'수학'},{subject:'영어'}],subjects:[{subject:'수학'},{subject:'영어'}],academyScores:[{subject:'수학'},{subject:'영어'}]})};
 const result=await loadTeacherReportReview(db,{admin:false,scopes:[{studentKey,subject:'영어'}]},studentKey,'student',deps);
 assert.equal(result.reports.length,1);assert.equal(result.schedules.length,0);
 for(const rows of Object.values(result.academic))assert.deepEqual(rows.map((r:any)=>r.subject),['영어']);
 assert.equal(JSON.stringify(result).includes('다른 선생님 피드백'),false);
 assert.equal(result.studentLinked,false);
});
