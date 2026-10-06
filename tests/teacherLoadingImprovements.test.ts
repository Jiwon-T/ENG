import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTeacherSection} from '../src/lib/loadTeacherSection.ts';
import {readTeacherStudentSnapshot,saveTeacherStudentSnapshot} from '../api/_lib/teacherStudentSnapshot.ts';
import {notionTeachingScopes} from '../api/_lib/teacherNotionWorkspace.ts';
import {handleWorkspace} from '../api/teacher/workspace.ts';
import {teacherReadCache} from '../api/_lib/teacherReadCache.ts';
const deferred=()=>{let resolve!:(v:string)=>void;let reject!:(e:Error)=>void;const promise=new Promise<string>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
test('fast and fresh start together; a late fast result cannot overwrite fresh data',async()=>{
 const fast=deferred(),fresh=deferred(),started:string[]=[],applied:string[]=[];
 const task=loadTeacherSection({fast:()=>{started.push('fast');return fast.promise;},fresh:()=>{started.push('fresh');return fresh.promise;},apply:v=>applied.push(v)});
 assert.deepEqual(started,['fast','fresh']);fresh.resolve('latest');await Promise.resolve();fast.resolve('old');await task;
 assert.deepEqual(applied,['latest']);
});
test('fast failure does not block fresh; fresh failure preserves fast and reports the error',async()=>{
 const applied:string[]=[];
 await loadTeacherSection({fast:async()=>{throw Error('fast unavailable');},fresh:async()=>'latest',apply:v=>applied.push(v)});
 assert.deepEqual(applied,['latest']);
 const fast=deferred(),fresh=deferred();
 const task=loadTeacherSection({fast:()=>fast.promise,fresh:()=>fresh.promise,apply:v=>applied.push(v)});
 fast.resolve('app data');await Promise.resolve();fresh.reject(Error('notion unavailable'));
 await assert.rejects(task,/notion unavailable/);assert.deepEqual(applied,['latest','app data']);
});
test('display snapshots are scoped, expire, and omit guardian phone/PIN data',async()=>{
 const records=new Map<string,any>();
 const db={collection:()=>({doc:(id:string)=>({get:async()=>({data:()=>records.get(id)}),set:async(v:any)=>{records.set(id,v);}})})};
 const actor={uid:'one',admin:false,academyId:'main',scopes:[{studentKey:'a',subject:'영어'}]};
 await saveTeacherStudentSnapshot(db,actor,[{studentKey:'a',studentDisplayName:'A',hasGuardianContact:true,enrollmentStatus:'등록',parentPhone:'secret',pin:'1234'} as any,{studentKey:'b',studentDisplayName:'B',hasGuardianContact:true,enrollmentStatus:'등록'}]);
 assert.equal((await readTeacherStudentSnapshot(db,actor))?.length,1);
 assert.equal(JSON.stringify([...records.values()]).includes('secret'),false);
 assert.equal(JSON.stringify([...records.values()]).includes('1234'),false);
 assert.equal(await readTeacherStudentSnapshot(db,{...actor,uid:'two'}),null);
 assert.equal(await readTeacherStudentSnapshot(db,{...actor,scopes:[]}),null);
 records.values().next().value!.updatedAt=Date.now()-300001;
 assert.equal(await readTeacherStudentSnapshot(db,actor),null);
});
test('fast bootstrap reads app mappings without calling Notion on a cold cache',async()=>{
 teacherReadCache.clear();const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('must not call Notion');};
 const key='11111111-1111-4111-8111-111111111111';
 const db:any={collection:(name:string)=>{const query:any={where:()=>query,doc:()=>({get:async()=>({data:()=>undefined})}),get:async()=>({docs:name==='notionStudentMappings'?[{id:'legacy',data:()=>({notionStudentPageId:key,internalStudentId:'a',studentDisplayName:'앱 학생',firebaseUid:null})}]:[]})};return query;}};
 let body:any;const res:any={setHeader:()=>{},end:(v:string)=>body=JSON.parse(v)};
 try {
  await handleWorkspace({method:'GET',url:'/api/teacher/workspace?action=bootstrap-fast&section=lesson'} as any,res,async()=>({uid:'teacher',admin:false,principal:false,academyId:'main',scopes:[{studentKey:key,subject:'영어'}],teachingScopes:[],db}) as any);
  assert.equal(res.statusCode,200);assert.equal(body.students[0].studentDisplayName,'앱 학생');assert.equal(calls,0);
 }finally{globalThis.fetch=old;teacherReadCache.clear();}
});
test('concurrent permission reads share remote requests, batch memberships, and recheck changes',async()=>{
 const previous=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;
 process.env.NOTION_INTEGRATION_TOKEN='test';
 const teacher='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
 let remote=0,batches=0,disabled=false,teacherStopped=false;
 globalThis.fetch=async(input:any)=>{
  remote++;await new Promise(resolve=>setTimeout(resolve,5));
  if(String(input).includes('/pages/'))return new Response(JSON.stringify({parent:{database_id:'3d274aff-32ce-4a33-870d-2689259113a6'},properties:{'상태':{status:{name:teacherStopped?'중단':'진행 중'}}}}));
  return new Response(JSON.stringify({results:[a,b].map(id=>({properties:{'학생':{relation:[{id}]},'영어 담당':{relation:[{id:teacher}]},'수학 담당':{relation:[{id:teacher}]}}})),has_more:false}));
 };
 const db={collection:()=>({doc:(id:string)=>({id})}),getAll:async(...refs:any[])=>{batches++;assert.equal(refs.length,2);return refs.map(()=>({data:()=>({academyId:'main',disabled})}));}};
 const profile={notionTeacherPageId:teacher,academyId:'main'};
 try {
  const values=await Promise.all([notionTeachingScopes(db,profile),notionTeachingScopes(db,profile)]);
  assert.deepEqual(values.map(v=>v.length),[4,4]);assert.equal(remote,2);assert.equal(batches,1);
  disabled=true;assert.deepEqual(await notionTeachingScopes(db,profile),[]);assert.equal(remote,4);
  teacherStopped=true;await assert.rejects(notionTeachingScopes(db,profile),/TEACHER_NOT_CONFIGURED/);
  teacherStopped=false;assert.deepEqual(await notionTeachingScopes(db,profile),[]);
 }finally{globalThis.fetch=previous;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
