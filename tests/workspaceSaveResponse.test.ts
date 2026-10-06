import test from 'node:test';import assert from 'node:assert/strict';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {newGridLesson} from '../src/lib/teacherLessonGrid.js';
const id='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222';
test('lesson save returns its committed canonical record without a second document read',async()=>{
 const f=registrationFirestore();let reads=0;
 const db:any={...f.db,collection:(name:string)=>{
  const collection=f.db.collection(name);
  return {...collection,doc:(key:string)=>{
   const ref=collection.doc(key);
   return {...ref,get:async()=>{reads++;return ref.get();}};
  }};
 }};
 const actor:any={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:student,subject:'영어'}],db};let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};
 const data={...newGridLesson(student,'영어','2026-10-07','14:00','15:20'),content:'수업',round:1,attendance:'출석',selfStudy:'없음',correct:0,total:10,wrong:10};
 await handleWorkspace({method:'POST',body:{action:'save-draft',id,data}} as any,res,async()=>actor);
 assert.equal(res.statusCode,200);assert.equal(body.record.id,id);assert.equal(body.record.revision,1);assert.equal(body.record.ownerUid,'teacher');assert.equal(body.record.percentage,0);assert.deepEqual(body.record.data,f.rows.get('teacherLessonDrafts/'+id).data);assert.equal(reads,1);
});
test('grade save returns committed record and still rejects stale revisions',async()=>{
 const f=registrationFirestore(),actor:any={uid:'teacher',admin:false,academyId:'main',scopes:[{studentKey:student,subject:'영어'}],db:f.db};
 const data={studentKey:student,subject:'영어',examType:'학교 내신',title:'시험',examDate:'2026-10-07',score:0,maxScore:100,submissionStatus:'제출 완료'};
 const call=async(revision?:number)=>{let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};await handleWorkspace({method:'POST',body:{action:'save-academic',id,revision,data}} as any,res,async()=>actor);return {body,status:res.statusCode};};
 const saved=await call();assert.equal(saved.status,200);assert.equal(saved.body.record.id,id);assert.equal(saved.body.record.data.score,0);assert.deepEqual(saved.body.record.data,f.rows.get('teacherAcademicDrafts/'+id).data);assert.equal((await call(0)).status,409);assert.equal((await call()).status,409);
});
