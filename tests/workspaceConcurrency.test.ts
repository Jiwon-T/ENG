import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkspaceOperations} from '../src/lib/workspaceOperations.js';
import {removeGridSelection,upsertWorkspaceRecord} from '../src/lib/workspaceRecords.js';
import {submitLesson} from '../src/lib/lessonSubmission.js';
import {teacherAuthenticatedRequest} from '../src/lib/teacherAuthenticatedRequest.js';
const deferred=()=>{let resolve:any;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
test('different records run concurrently while duplicate actions and aliases issue one callback',async()=>{
 const tasks:any[]=[];const work=createWorkspaceOperations(value=>tasks.push(value)),a=deferred(),b=deferred();let calls=0;
 const first=work.run(['editor:1'],'학생 A',async()=>{calls++;await a.promise;});work.alias('editor:1','lesson-record:A');
 const duplicate=work.run(['lesson-record:A'],'같은 기록',async()=>assert.fail('duplicate')),second=work.run(['editor:2'],'학생 B',async()=>{calls++;await b.promise;});await Promise.resolve();assert.equal(calls,2);assert.equal(work.busy('editor:2'),true);
 b.resolve();await second;assert.equal(work.busy('editor:2'),false);assert.equal(work.busy('editor:1'),true);a.resolve();await Promise.all([first,duplicate]);assert.equal(work.busy('lesson-record:A'),false);assert.equal(tasks.at(-1).filter((t:any)=>t.status==='done').length,2);
});
test('reset cancels queued callbacks and old completion cannot change another account task history',async()=>{
 const states:any[]=[];const work=createWorkspaceOperations(value=>states.push(value)),pending=deferred();
 const task=work.run(['A'],'A',()=>pending.promise);await Promise.resolve();work.reset();pending.resolve();await task;assert.deepEqual(states.at(-1),[]);
 const queued=work.run(['B'],'B',async()=>assert.fail('must not start after account reset'));work.reset();await queued;assert.equal(work.busy('B'),false);
});
test('partial results retain warning without declaring Notion delivery completed',async()=>{
 const work=createWorkspaceOperations(()=>{});const result=await work.run(['a'],'반영',async()=>({warning:'앱 리포트 완료 · Notion 대기'}));assert.equal(result?.note,'앱 리포트 완료 · Notion 대기');
 const failed=await work.run(['b'],'여러 학생',async()=>({failed:2}));assert.equal(failed?.status,'failed');
});
test('removal affects one row, preserves active row identity and blocks in-flight removal',()=>{
 const rows=[{id:'a',student:'same'},{id:'b',student:'same'},{id:'c',student:'other',pending:true}];const removed=removeGridSelection(rows,'a',1);assert.deepEqual(removed.rows.map(r=>r.id),['b','c']);assert.equal(removed.index,0);assert.equal(removeGridSelection(rows,'c',1).removed,false);assert.equal(removeGridSelection([rows[0]],'a',0).rows.length,0);
});
test('late record snapshots cannot overwrite a newer saved revision',()=>{
 const rows=[{id:'a',revision:3,updatedAt:10,data:{content:'new'}}];assert.equal(upsertWorkspaceRecord(rows,{id:'a',revision:2,updatedAt:20}),rows);assert.equal(upsertWorkspaceRecord(rows,{id:'a',revision:3,updatedAt:5}),rows);assert.equal(upsertWorkspaceRecord(rows,{id:'a',revision:4,updatedAt:30})[0].revision,4);
});
test('one save request freezes input and callback can protect a newly selected editor',async()=>{
 const wait=deferred(),calls:any[]=[],input={studentKey:'A',content:'original'};let selection='A',display='A new input';
 const task=submitLesson({mode:'save',id:'stable',data:input,request:async(action,body)=>{calls.push({action,body});return wait.promise;},onSaved:r=>{if(selection==='A')display=r.record.data.content;}});
 input.content='changed';selection='B';display='B input';wait.resolve({id:'stable',record:{data:{content:'original'}}});await task;assert.equal(display,'B input');assert.equal(calls.length,1);assert.equal(calls[0].body.data.content,'original');
});
test('publish reuses a saved record and never publishes after an uncertain save response',async()=>{
 const calls:string[]=[],data={content:'saved'};await submitLesson({mode:'publish',id:'a',data,record:{data},request:async action=>{calls.push(action);return {};},onSaved:()=>assert.fail()});assert.deepEqual(calls,['publish']);
 calls.length=0;await assert.rejects(submitLesson({mode:'publish',id:'a',data,request:async action=>{calls.push(action);throw Error('response lost');},onSaved:()=>assert.fail()}),/response lost/);assert.deepEqual(calls,['save-draft']);
});
test('account changes during token acquisition never transmit the previous account input',async()=>{
 const original=globalThis.fetch,token=deferred();let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}');};
 const auth:any={authStateReady:async()=>{},currentUser:{uid:'A',getIdToken:()=>token.promise}};
 try{const task=teacherAuthenticatedRequest(auth,'/api/teacher/workspace',{method:'POST'},'A');await Promise.resolve();auth.currentUser={uid:'B',getIdToken:async()=>'B token'};token.resolve('A token');await assert.rejects(task,/계정이 변경/);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
