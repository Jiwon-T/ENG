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

test('both admin audiences load without a separately deployed reportSlugs compound index', async () => {
 const db = { collection: (name: string) => {
   let constraints = 0;
   const query: any = { where: () => { constraints++; return query; }, get: async () => {
     if (name === 'reportSlugs' && constraints > 1) throw new Error('FAILED_PRECONDITION: The query requires an index');
     const rows = name === 'lessonReports' ? [english] : name === 'reportSlugs' ? [{active:false,reportSlug:'inactive'}, {active:true,reportSlug:'active'}] : [];
     return { docs: rows.map((row, i) => ({ id: String(i), data: () => row })) };
   } };
   return query;
 } } as any;
 const deps: any = { readStudentMapping: async () => ({internalStudentId:'secret',firebaseUid:null}), loadAcademicData: async () => ({records:[],subjects:[],academyScores:[]}) };
 for (const audience of ['parent','student'] as const) {
   const result = await loadTeacherReportReview(db, {admin:true,scopes:[]}, studentKey, audience, deps);
   assert.equal(result.reports.length, 1);
   assert.equal(result.parentUrl, '/active');
   if (audience === 'student') assert.equal('feedback' in result.reports[0], false);
 }
});

test('legacy reports missing source ID use their stable document ID for both audiences', async()=>{
 const {notionPageId,...legacy}=english;
 const query:any={where:()=>query,get:async()=>({docs:[{id:'stable-document',data:()=>legacy}]})};
 const empty:any={where:()=>empty,get:async()=>({docs:[]})};
 const db:any={collection:(name:string)=>name==='lessonReports'?query:empty};
 const deps:any={readStudentMapping:async()=>({internalStudentId:'secret'}),loadAcademicData:async()=>({records:[],subjects:[],academyScores:[]})};
 const parent=await loadTeacherReportReview(db,{admin:true,scopes:[]},studentKey,'parent',deps);
 const student=await loadTeacherReportReview(db,{admin:true,scopes:[]},studentKey,'student',deps);
 assert.equal(parent.reports[0].reportId,student.reports[0].reportId);
 assert.equal(student.reports[0].reportId.length,16);
});

test('section loading skips unrelated report collections and pages each audience by five',async()=>{
 const queried:string[]=[];let academics=0;
 const rows=Array.from({length:13},(_,i)=>({...english,notionPageId:'lesson-'+i,lessonDateStart:`2026-10-${String(1+i).padStart(2,'0')}T14:00:00+09:00`}));
 const db:any={collection:(name:string)=>{queried.push(name);const query:any={where:()=>query,get:async()=>({docs:rows.map((value,i)=>({id:String(i),data:()=>value}))})};return query;}};
 const deps:any={readStudentMapping:async()=>({internalStudentId:'secret',firebaseUid:null}),loadAcademicData:async()=>{academics++;return {records:[],subjects:[],academyScores:[]};}};
 for(const audience of ['parent','student'] as const){
  queried.length=0;
  const result=await loadTeacherReportReview(db,{admin:false,scopes:[{studentKey,subject:'영어'}]},studentKey,audience,deps,{section:'lessons',page:2,subject:'영어'});
  assert.equal(result.reports.length,5);assert.ok('reportTotal' in result&&'reportPages' in result&&'reportPage' in result);assert.equal(result.reportTotal,13);assert.equal(result.reportPages,3);assert.equal(result.reportPage,2);
  assert.deepEqual(queried,['lessonReports']);assert.equal(academics,0);assert.deepEqual(result.schedules,[]);
  if(audience==='student')assert.equal('feedback' in result.reports[0],false);
 }
 queried.length=0;
 await loadTeacherReportReview(db,{admin:false,scopes:[{studentKey,subject:'영어'}]},studentKey,'parent',deps,{section:'grades',page:1,subject:''});
 assert.deepEqual(queried,[]);assert.equal(academics,1);
});
