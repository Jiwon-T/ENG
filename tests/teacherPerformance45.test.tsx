import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LessonTests from '../src/components/teacher/LessonTests';
import {wrongAnswers,testInputPatch} from '../src/lib/lessonTestInput.ts';
import {newGridLesson} from '../src/lib/teacherLessonGrid.ts';
import {lessonDraftSchema} from '../api/_lib/teacherWorkspacePolicy.ts';
import {scheduleRange,readReflectedRange,readManagedScheduleRange} from '../api/_lib/teacherScheduleRange.ts';
import {handleWorkspace} from '../api/teacher/workspace.ts';
const key='11111111-1111-4111-8111-111111111111';
test('test editor displays legacy data as wrong answers with unchanged score and no correct-answer input',()=>{
 const html=renderToStaticMarkup(<LessonTests value={{correct:27,total:30,examCorrect:18,examTotal:20}} onChange={()=>{}}/>);
 assert.ok(html.includes('일반 테스트 오답 수'));assert.ok(html.includes('내신 대비 테스트 오답 수'));assert.ok(html.includes('value="3"'));assert.ok(html.includes('환산 90 / 100'));assert.equal(html.includes('정답 수'),false);
});
function memoryDb(){
 const values=new Map<string,any>();let fail=false;
 const doc=(path:string):any=>({path,collection:(name:string)=>collection(path+'/'+name),get:async()=>({data:()=>values.get(path)}),set:async(v:any)=>values.set(path,structuredClone(v))});
 const collection=(path:string):any=>({doc:(id:string)=>doc(path+'/'+id),get:async()=>({docs:[...values].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key,value])=>({id:key.slice(path.length+1),data:()=>value}))})});
 const db:any={collection,runTransaction:async(fn:any)=>fn({get:(ref:any)=>ref.get(),set:(ref:any,v:any)=>values.set(ref.path,structuredClone(v))}),batch:()=>{const writes:any[]=[];return {set:(ref:any,value:any)=>writes.push([ref.path,value]),delete:(ref:any)=>writes.push([ref.path,undefined]),commit:async()=>{if(fail){fail=false;throw Error('batch failed');}for(const [path,value] of writes)value===undefined?values.delete(path):values.set(path,structuredClone(value));}};}};
 return {db,values,failNext:()=>{fail=true;}};
}
const page=(id:string,academy='main')=>({id,last_edited_time:'2026-10-05T00:00:00Z',properties:{학원:{rich_text:[{plain_text:academy}]}}});
test('reflected schedules query authorized students and a bounded period, retain all recipients and handle timestamp offsets',async()=>{
 const requests:any[]=[];const values=[{internalStudentId:'a',startAt:'2026-10-04T16:00:00Z'},{internalStudentId:'b',startAt:'2026-10-05T15:00:00+09:00'},{internalStudentId:'other',startAt:'2026-10-05T15:00:00+09:00'},{internalStudentId:'a',startAt:'2026-10-03T15:00:00+09:00'}];
 const db:any={collection:(name:string)=>{assert.equal(name,'studentSchedules');const q:any={where:(...args:any[])=>{requests.push(args);return q;},get:async()=>({docs:values.map(value=>({data:()=>value}))})};return q;}};
 const mappings=new Map([[key,{internalStudentId:'a'}],['second',{internalStudentId:'b'}]]);const actor={admin:false,scopes:[{studentKey:key},{studentKey:'second'}]};
 const result=await readReflectedRange(db,actor,mappings,scheduleRange({day:'2026-10-05'}));assert.equal(result.length,2);
 assert.deepEqual(requests[0],['internalStudentId','in',['a','b']]);assert.equal(requests[1][0],'startAt');assert.equal(requests[2][0],'startAt');
 for(const v of [{day:'2026-99-99'},{day:'2026-02-30'},{from:'2026-10-07',to:'2026-10-05'},{from:'2020-01-01',to:'2026-01-01'}])assert.throws(()=>scheduleRange(v),/INVALID_INPUT/);
});
test('missing composite index falls back to a period query and retains access filtering',async()=>{
 let inQuery=false;const rows=[{internalStudentId:'a',startAt:'2026-10-05T15:00:00+09:00'},{internalStudentId:'other',startAt:'2026-10-05T15:00:00+09:00'}];
 const db:any={collection:()=>{let membership=false;const q:any={where:(key:string)=>{if(key==='internalStudentId')membership=true;return q;},get:async()=>{if(membership){inQuery=true;throw Error('requires an index');}return {docs:rows.map(value=>({data:()=>value}))};}};return q;}};
 const result=await readReflectedRange(db,{admin:true},new Map([[key,{internalStudentId:'a'}]]),{from:'2026-10-05',to:'2026-10-05'});assert.equal(inQuery,true);assert.equal(result.length,1);
});

test('wrong-first and total-first input both calculate 27/30 without changing mistakes when the total changes',()=>{
 let value:any=newGridLesson(key,'영어','2026-10-05','15:00','16:00');
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',3)};assert.equal(value.correct,null);assert.equal(value.wrong,3);assert.equal(lessonDraftSchema.safeParse(value).success,false);
 value={...value,...testInputPatch(value,'correct','total','wrong','total',30)};assert.equal(value.correct,27);
 const parsed=lessonDraftSchema.parse(value);assert.equal(parsed.total-parsed.correct,3);
 value={...value,...testInputPatch(value,'correct','total','wrong','total',40)};assert.equal(value.correct,37);assert.equal(value.wrong,3);
 const legacy={correct:27,total:30};assert.equal(wrongAnswers(legacy,'correct','total','wrong'),3);
 assert.equal(testInputPatch(legacy,'correct','total','wrong','total',40).correct,37);
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',0)};assert.equal(value.correct,40);
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',41)};assert.equal(lessonDraftSchema.safeParse(value).success,false);
 const exam=lessonDraftSchema.parse({...newGridLesson(key,'영어','2026-10-05','15:00','16:00'),examTotal:20,examWrong:2,examCorrect:18});assert.equal(exam.examTotal-exam.examCorrect,2);
});
