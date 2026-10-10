import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTeacherSection} from '../src/lib/loadTeacherSection.ts';
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
