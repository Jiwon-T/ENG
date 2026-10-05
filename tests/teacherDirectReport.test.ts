import test from 'node:test';
import assert from 'node:assert/strict';
import {directLessonReport,writeDirectLessonReport} from '../api/_lib/teacherDirectReport.ts';
import {studentLessonDTO,parentLessonDTO,lessonReportId} from '../api/_lib/reportAudienceDTO.ts';
import {hashStudentKey} from '../api/_lib/security.ts';
const studentKey='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',pageId='33333333-3333-4333-8333-333333333333';
const mapping={studentKey,internalStudentId:'student',notionStudentPageId:studentKey};
const draft:any={revision:1,data:{studentKey,subject:'영어',date:'2026-10-05',classSession:'있음',start:'12:40',end:'15:20',round:3,selfStudy:'없음',attendance:'출석',attitude:'최상',homework:'상',test:'상',correct:null,total:null,examCorrect:43.5,examWrong:16.5,examTotal:60,content:'수업 내용',assignment:'교재 10쪽',note:'',nextPlan:'',specialNote:'특이 사항'}};
test('direct app report preserves fractional score, homework and audience separation',()=>{
 const r=directLessonReport(id,draft,mapping);
 assert.equal(r.schoolExamScore,72.5);assert.equal(r.derivedAssignment,'교재 10쪽');assert.equal(r.lessonTime,'12:40 ~ 15:20');
 const student=studentLessonDTO(r as any),parent=parentLessonDTO(r as any);
 assert.equal(student.schoolExamScore,72.5);assert.equal('feedback' in student,false);assert.match(parent.feedback,/특이 사항/);
 const mirror=directLessonReport(id,{...draft,notionPageId:pageId},mapping,r);assert.equal(lessonReportId(mirror as any),lessonReportId(r as any));
});
test('direct writes require no Notion/Make call for mapped students and migrate without duplicates',async()=>{
 const store=new Map<string,any>([[`notionStudentMappings/${hashStudentKey(studentKey)}`,mapping],[`teacherLessonDrafts/${id}`,draft]]);
 function ref(path:string):any{return {id:path.split('/').at(-1),get:async()=>snap(path)};}
 function snap(path:string){return {exists:store.has(path),data:()=>store.get(path)};}
 const db:any={collection:(name:string)=>({doc:(key:string)=>{const r=ref(`${name}/${key}`);r.path=`${name}/${key}`;return r;}}),runTransaction:async(fn:any)=>fn({get:async(r:any)=>snap(r.path),set:(r:any,d:any)=>store.set(r.path,{...store.get(r.path),...d}),delete:(r:any)=>store.delete(r.path),update:(r:any,d:any)=>store.set(r.path,{...store.get(r.path),...d})})};
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('External service must not be called');};
 try{await writeDirectLessonReport(db,id,draft);assert.ok(store.has(`lessonReports/${id}`));await writeDirectLessonReport(db,id,{...draft,notionPageId:pageId});assert.equal(store.has(`lessonReports/${id}`),false);assert.ok(store.has(`lessonReports/${pageId}`));await writeDirectLessonReport(db,id,{...draft,notionPageId:pageId,revision:2,data:{...draft.data,assignment:'새 과제'}});assert.equal([...store.keys()].filter(k=>k.startsWith('lessonReports/')).length,1);assert.equal(store.get(`lessonReports/${pageId}`).derivedAssignment,'새 과제');assert.equal(store.get(`teacherLessonDrafts/${id}`).directReportRevision,2);}finally{globalThis.fetch=originalFetch;}
});
test('migration preserves temporary public identity even if a Notion mirror already exists',async()=>{
 const {registrationFirestore}=await import('./helpers/registrationFirestore.js');const f=registrationFirestore();
 f.rows.set('notionStudentMappings/'+hashStudentKey(studentKey),mapping);f.rows.set('teacherLessonDrafts/'+id,draft);
 const temporary=directLessonReport(id,draft,mapping);f.rows.set('lessonReports/'+id,temporary);
 f.rows.set('lessonReports/'+pageId,{...temporary,teacherDraftId:undefined,reportIdentity:pageId,notionPageId:pageId});
 await writeDirectLessonReport(f.db,id,{...draft,notionPageId:pageId});
 assert.equal(f.rows.has('lessonReports/'+id),false);assert.equal(f.rows.get('lessonReports/'+pageId).reportIdentity,id);
 assert.equal(lessonReportId(f.rows.get('lessonReports/'+pageId)),lessonReportId(temporary as any));
});
test('conflicting temporary report is retained and never deleted during canonical migration',async()=>{
 const {registrationFirestore}=await import('./helpers/registrationFirestore.js');const f=registrationFirestore();
 f.rows.set('notionStudentMappings/'+hashStudentKey(studentKey),mapping);f.rows.set('teacherLessonDrafts/'+id,draft);
 f.rows.set('lessonReports/'+id,{...directLessonReport(id,draft,mapping),internalStudentId:'other-student'});
 await assert.rejects(writeDirectLessonReport(f.db,id,{...draft,notionPageId:pageId}),/SOURCE_IDENTITY_LOCKED/);assert.equal(f.rows.has('lessonReports/'+id),true);assert.equal(f.rows.has('lessonReports/'+pageId),false);
});
