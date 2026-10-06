import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LessonTests from '../src/components/teacher/LessonTests';
import {wrongAnswers,testInputPatch} from '../src/lib/lessonTestInput.ts';
import {newGridLesson} from '../src/lib/teacherLessonGrid.ts';
import {lessonDraftSchema} from '../api/_lib/teacherWorkspacePolicy.ts';
import {teacherTestProperties} from '../api/_lib/teacherTestProperties.ts';
import {readMirroredPages as readPersistentMirror,matchesNotionFilter} from '../api/_lib/teacherNotionMirror.ts';
const readMirroredPages=(db:any,actor:any,database:string,filter:any,load:any,force=false)=>readPersistentMirror(db,actor,database,filter,load,force,'firestore');
import {scheduleRange,readReflectedRange,readManagedScheduleRange} from '../api/_lib/teacherScheduleRange.ts';
import {classStatusOnlyChange,changedStatusSlots} from '../api/_lib/teacherClassStatus.ts';
import {handleWorkspace} from '../api/teacher/workspace.ts';
import {DEFAULT_SOURCE,syncManagedRecord} from '../api/_lib/teacherNotionWorkspace.ts';
const key='11111111-1111-4111-8111-111111111111';
test('wrong-first and total-first input both calculate 27/30 without changing mistakes when the total changes',()=>{
 let value:any=newGridLesson(key,'영어','2026-10-05','15:00','16:00');
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',3)};assert.equal(value.correct,null);assert.equal(value.wrong,3);assert.equal(lessonDraftSchema.safeParse(value).success,false);
 value={...value,...testInputPatch(value,'correct','total','wrong','total',30)};assert.equal(value.correct,27);
 const parsed=lessonDraftSchema.parse(value);assert.equal(teacherTestProperties(parsed)['틀린 단어'].number,3);
 value={...value,...testInputPatch(value,'correct','total','wrong','total',40)};assert.equal(value.correct,37);assert.equal(value.wrong,3);
 const legacy={correct:27,total:30};assert.equal(wrongAnswers(legacy,'correct','total','wrong'),3);
 assert.equal(testInputPatch(legacy,'correct','total','wrong','total',40).correct,37);
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',0)};assert.equal(value.correct,40);
 value={...value,...testInputPatch(value,'correct','total','wrong','wrong',41)};assert.equal(lessonDraftSchema.safeParse(value).success,false);
 const exam={...newGridLesson(key,'영어','2026-10-05','15:00','16:00'),examTotal:20,examWrong:2,examCorrect:18};assert.equal(teacherTestProperties(lessonDraftSchema.parse(exam))['오답 수'].number,2);
});
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
test('persistent mirror performs scoped first read, then edited-time deltas, removes moved rows and reconciles deletion',async()=>{
 const {db,values}=memoryDb();const actor={uid:'teacher',scopes:[]},filter={property:'학원',rich_text:{equals:'main'}},requests:any[]=[];
 let remote=[page(key)];const load=async(f:any)=>{requests.push(f);return remote;};
 assert.equal((await readMirroredPages(db,actor,'database',filter,load)).length,1);assert.deepEqual(requests[0],filter);
 const meta=()=>[...values.keys()].find(k=>!k.includes('/pages/'))!;
 values.get(meta()).syncedAt=Date.now()-61000;
 remote=[page(key,'other')];assert.equal((await readMirroredPages(db,actor,'database',filter,load)).length,0);assert.equal(requests[1].timestamp,'last_edited_time');
 remote=[page(key)];await readMirroredPages(db,actor,'database',filter,load,true);
 remote=[];values.get(meta()).syncedAt=Date.now()-61000;values.get(meta()).reconciledAt=Date.now()-610001;
 assert.equal((await readMirroredPages(db,actor,'database',filter,load)).length,0);assert.deepEqual(requests.at(-1),filter);
});
test('mirror checkpoints only after page writes and failed writes are replayed; permission keys stay isolated',async()=>{
 const {db,values,failNext}=memoryDb();const actor={uid:'teacher',scopes:[]};let calls=0;
 const load=async()=>{calls++;return [page(key)];};failNext();await assert.rejects(readMirroredPages(db,actor,'database',undefined,load),/batch failed/);
 assert.equal([...values.values()][0].ready,undefined);await readMirroredPages(db,actor,'database',undefined,load);assert.equal(calls,2);
 await readMirroredPages(db,actor,'database',undefined,load);assert.equal(calls,2);
 await readMirroredPages(db,{...actor,scopes:[{studentKey:key}]},'database',undefined,load);assert.equal(calls,3);
 assert.equal(matchesNotionFilter({...page(key),archived:true},undefined),false);
});
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
test('only status changes qualify for partial sync; name, times, members, books and failed writes require full sync',()=>{
 const old:any={notionPageId:key,notionSyncStage:'synced',name:'반',subject:'영어',status:'진행 중',students:[key],slots:[{id:key,weekday:1,start:'15:00',end:'16:00',status:'진행 중'}],books:[{id:key,title:'교재',status:'current'}]};
 const next={...old,status:'중단',slots:old.slots.map((s:any)=>({...s,status:'중단'}))};assert.equal(classStatusOnlyChange(old,next),true);assert.deepEqual(changedStatusSlots(old,next),[key]);
 for(const patch of [{name:'다른 반'},{students:[]},{slots:[{...next.slots[0],end:'17:00'}]},{books:[{...old.books[0],title:'새 교재'}]}])assert.equal(classStatusOnlyChange(old,{...next,...patch}),false);
 assert.equal(classStatusOnlyChange({...old,notionSyncStage:'failed'},next),false);assert.deepEqual(changedStatusSlots(undefined,{slots:[]}),[]);
});
test('status-only synchronization updates parent and changed slots without querying or updating curriculum',async()=>{
 const oldFetch=globalThis.fetch,admin=process.env.ADMIN_UID,token=process.env.NOTION_INTEGRATION_TOKEN;
 process.env.ADMIN_UID='owner';process.env.NOTION_INTEGRATION_TOKEN='test';
 const slot='22222222-2222-4222-8222-222222222222',time='2026-10-05T00:00:00Z';
 const record:any={notionPageId:key,notionEditedAt:time,revision:1,ownerUid:'owner',academyId:'main',subject:'영어',name:'반',students:[],notionSyncStage:'synced',status:'진행 중',slots:[{id:slot,weekday:1,start:'15:00',end:'16:00',status:'진행 중',notionEditedAt:time}],books:[{id:key,linkedPlanId:key,title:'교재',status:'planned',progress:'시작 전'}]};
 const pages=new Map([[key,{id:key,parent:{database_id:DEFAULT_SOURCE.classDatabaseId},last_edited_time:time,properties:{상태:{status:{name:'진행 중'}}}}],[slot,{id:slot,parent:{database_id:DEFAULT_SOURCE.timetableDatabaseId},last_edited_time:time,properties:{상태:{status:{name:'진행 중'}},반:{relation:[{id:key}]}}}]]);
 const requests:any[]=[];globalThis.fetch=async(input:any,init:any)=>{const path=String(input).split('/v1/')[1];requests.push({path,method:init.method,body:init.body?JSON.parse(init.body):undefined});assert.ok(path.startsWith('pages/'));const id=path.slice(6),page:any=pages.get(id);assert.ok(page);if(init.method==='PATCH'){page.properties={...page.properties,...JSON.parse(init.body).properties};page.last_edited_time='2026-10-05T00:00:01Z';}return new Response(JSON.stringify(page));};
 const ref:any={get:async()=>({data:()=>record}),update:async(p:any)=>Object.assign(record,p)};
 const db:any={collection:(name:string)=>({doc:()=>name==='teacherClasses'?ref:{get:async()=>({data:()=>undefined})},get:async()=>({docs:[]})}),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),update:async(_r:any,p:any)=>Object.assign(record,p),set:async(_r:any,p:any)=>Object.assign(record,p)})};
 try{let result:any;const response:any={setHeader:()=>{},end:(v:string)=>result=JSON.parse(v)};
 await handleWorkspace({method:'POST',body:{action:'save-class',id:key,revision:1,notionEditedAt:time,data:{name:'반',students:[],subject:'영어',status:'중단',slots:record.slots.map((s:any)=>({...s,status:'중단'})),books:record.books}}} as any,response,async()=>({uid:'owner',admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[],db}) as any);
 assert.equal(response.statusCode,200);assert.equal(result.syncError,undefined);assert.equal(result.statusOnly,true);assert.equal(record.revision,2);assert.equal(record.notionSyncStage,'synced');assert.equal(record.notionStatusOnly,false);assert.equal(requests.filter(r=>r.method==='PATCH').length,2);for(const r of requests.filter(r=>r.body))assert.deepEqual(Object.keys(r.body.properties),['상태']);assert.equal((pages.get(slot) as any).properties.상태.status.name,'중단');}
 finally{globalThis.fetch=oldFetch;if(admin===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=admin;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});

test('mirror date predicates preserve early Korea-time schedules at day boundaries',()=>{
 const filter={and:[{property:'날짜 및 시간',date:{on_or_after:'2026-10-05T00:00:00+09:00'}},{property:'날짜 및 시간',date:{before:'2026-10-06T00:00:00+09:00'}}]};
 const record=(date:string)=>({properties:{'날짜 및 시간':{date:{start:date}}}});
 assert.equal(matchesNotionFilter(record('2026-10-05T07:00:00+09:00'),filter),true);
 assert.equal(matchesNotionFilter(record('2026-10-04T23:59:00+09:00'),filter),false);
 assert.equal(matchesNotionFilter(record('2026-10-06T00:00:00+09:00'),filter),false);
});
