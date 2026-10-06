import test from 'node:test';import assert from 'node:assert/strict';
import {workspaceInflightRead} from '../api/_lib/workspaceInflightRead.js';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
import {teacherActor} from '../api/_lib/teacherWorkspaceAuth.js';
import {teacherAuthenticatedRequest} from '../src/lib/teacherAuthenticatedRequest.js';
import {readMirroredPages} from '../api/_lib/teacherNotionMirror.js';
import {teacherReadCache} from '../api/_lib/teacherReadCache.js';
test('raw Notion cache uses no Firestore units, isolates permissions and refreshes after mutation',async()=>{
 teacherReadCache.clear();const db:any={batch:()=>assert.fail(),runTransaction:()=>assert.fail(),collection:()=>assert.fail('raw cache must not read/write Firestore')},actor={uid:'teacher',academyId:'main',scopes:[]};let calls=0;
 const load=async()=>[{id:String(++calls)}];
 assert.equal((await readMirroredPages(db,actor,'db',undefined,load))[0].id,'1');assert.equal((await readMirroredPages(db,actor,'db',undefined,load))[0].id,'1');
 assert.equal((await readMirroredPages(db,{...actor,uid:'other'},'db',undefined,load))[0].id,'2');assert.equal((await readMirroredPages(db,actor,'db',undefined,load,true))[0].id,'3');
 teacherReadCache.clear();assert.equal((await readMirroredPages(db,actor,'db',undefined,load))[0].id,'4');teacherReadCache.clear();
});
test('concurrent permission reads are shared but completed values and failures are never cached',async()=>{
 const db={},other={},calls:any[]=[];let resolve:any;
 const load=()=>{calls.push('load');return new Promise(r=>resolve=r);};
 const first=workspaceInflightRead(db,'account:a',load),second=workspaceInflightRead(db,'account:a',load);await Promise.resolve();assert.equal(calls.length,1);resolve('first');assert.deepEqual(await Promise.all([first,second]),['first','first']);
 assert.equal(await workspaceInflightRead(db,'account:a',async()=>'new'),'new');assert.equal(await workspaceInflightRead(other,'account:a',async()=>'other'),'other');
 await assert.rejects(workspaceInflightRead(db,'failed',async()=>{throw Error('offline');}));assert.equal(await workspaceInflightRead(db,'failed',async()=>'recovered'),'recovered');
});
test('simultaneous teacher room requests share account documents and later disabling is checked again',async()=>{
 const before=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';let reads=0,disabled=false;
 const db:any={collection:(name:string)=>({doc:()=>({get:async()=>{reads++;await new Promise(r=>setTimeout(r,5));return {data:()=>name==='users'?{role:'teacher'}:{academyId:'main',scopes:[],disabled}};}})})};
 const initialize:any=()=>({db,auth:{verifyIdToken:async()=>({uid:'teacher'})}}),req:any={headers:{authorization:'Bearer token'}};
 try{await Promise.all([teacherActor(req,initialize),teacherActor(req,initialize),teacherActor(req,initialize)]);assert.equal(reads,2);disabled=true;await assert.rejects(teacherActor(req,initialize),/TEACHER_NOT_CONFIGURED/);assert.equal(reads,4);}finally{if(before===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=before;}
});
test('Firestore resource exhausted has explicit 429 guidance without leaking raw details',()=>{
 for(const code of [8,'resource-exhausted','firestore/resource-exhausted']){const result=workspaceError(Object.assign(Error('private raw details'),{code}),'workspace-account');assert.equal(result.status,429);assert.equal(result.body.error,'FIRESTORE_RESOURCE_EXHAUSTED');assert.match(result.body.message,/사용량/);assert.ok(!JSON.stringify(result).includes('private raw details'));}
 assert.equal(workspaceError(Object.assign(Error('other'),{code:7}),'workspace-account').status,500);
});
test('known quota rejection pauses further requests, never retries writes and stays isolated by account',async()=>{
 const original=globalThis.fetch,clock=Date.now;let now=100000,calls=0;
 Date.now=()=>now;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(calls===1?{ok:false,error:'FIRESTORE_RESOURCE_EXHAUSTED',message:'한도 확인',diagnosticId:'safe-id'}:{ok:true}),{status:calls===1?429:200,headers:{'Content-Type':'application/json'}});};
 const auth:any={authStateReady:async()=>{},currentUser:{getIdToken:async()=>'test-token'}};
 try{assert.equal((await teacherAuthenticatedRequest(auth,'/api/teacher/workspace')).status,429);assert.equal((await teacherAuthenticatedRequest(auth,'/api/teacher/workspace',{method:'POST'})).status,429);assert.equal(calls,1);auth.currentUser={getIdToken:async()=>'other-test-token'};assert.equal((await teacherAuthenticatedRequest(auth,'/api/teacher/workspace')).status,200);assert.equal(calls,2);now+=31000;assert.equal((await teacherAuthenticatedRequest(auth,'/api/teacher/workspace')).status,200);}finally{globalThis.fetch=original;Date.now=clock;}
});
