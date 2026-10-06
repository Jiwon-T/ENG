import test from 'node:test';import assert from 'node:assert/strict';import {submitSchedule} from '../src/lib/scheduleSubmission.js';
test('schedule apply freezes input, waits for durable save and continues after editor closes',async()=>{
 let acknowledge:any;const saved=new Promise(resolve=>acknowledge=resolve),calls:any[]=[],data={title:'원래 입력'},record={revision:1,data:{title:'기존'}};let editorOpen=true;
 const task=submitSchedule({id:'same-id',revision:1,data,record,request:async(action,body)=>{calls.push({action,body});if(action==='save-schedule')return saved;return {ok:true};},onSaved:()=>{assert.equal(editorOpen,false);}});
 data.title='다른 입력';editorOpen=false;assert.equal(calls.length,1);acknowledge({id:'same-id'});await task;
 assert.deepEqual(calls,[{action:'save-schedule',body:{id:'same-id',revision:1,data:{title:'원래 입력'}}},{action:'publish-schedule',body:{id:'same-id'}}]);
});
test('unchanged schedule uses same saved intent and failed save never publishes automatically',async()=>{
 const calls:string[]=[],data={title:'기존'};await submitSchedule({id:'same-id',revision:2,data,record:{revision:2,data},request:async(action)=>{calls.push(action);return {};},onSaved:()=>assert.fail('no second save')});assert.deepEqual(calls,['publish-schedule']);
 calls.length=0;await assert.rejects(submitSchedule({id:'same-id',data,request:async(action)=>{calls.push(action);throw Error('lost response');},onSaved:()=>assert.fail()}),/lost response/);assert.deepEqual(calls,['save-schedule']);
});
