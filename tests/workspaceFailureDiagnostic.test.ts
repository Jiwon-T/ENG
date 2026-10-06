import test from 'node:test';import assert from 'node:assert/strict';
import {workspaceFailureDiagnostic} from '../api/_lib/workspaceFailureDiagnostic.js';
import {teacherActor} from '../api/_lib/teacherWorkspaceAuth.js';
test('failure categories expose stable codes without raw credential or request details',()=>{
 assert.deepEqual(workspaceFailureDiagnostic(Error('Firestore has already been initialized.')), {causeCode:'FIRESTORE_REINITIALIZED'});
 assert.deepEqual(workspaceFailureDiagnostic({code:7,message:'private raw text'}),{causeCode:'FIRESTORE_GRPC_7'});
 for(const error of [{message:'private raw text',code:'private raw code'},{message:'https://private/request',name:'private name'}])assert.equal(JSON.stringify(workspaceFailureDiagnostic(error)),JSON.stringify({causeCode:'UNCLASSIFIED'}));
});
test('authentication failures retain initialization and account lookup stage',async()=>{
 await assert.rejects(teacherActor({headers:{}} as any,()=>{throw Error('Firestore has already been initialized.');}),e=>(e as any).workspaceStage==='firebase-initialize');
 const prior=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';
 const initialize:any=()=>({
  auth:{verifyIdToken:async()=>({uid:'admin'})},
  db:{collection:()=>({doc:()=>({get:async()=>{throw Object.assign(Error('private raw details'),{code:14});}})})},
 });
 try{await assert.rejects(teacherActor({headers:{authorization:'Bearer token'}} as any,initialize),e=>(e as any).workspaceStage==='workspace-account'&&(e as any).code===14);}finally{if(prior===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=prior;}
});
