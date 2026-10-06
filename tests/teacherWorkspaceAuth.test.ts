import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherActor } from '../api/_lib/teacherWorkspaceAuth.ts';
test('workspace authentication refuses unapproved teachers, disabled access, and student roles',async()=>{
 const prior=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';
 const request={headers:{authorization:'Bearer fake'}} as any;
 const initialize=(role:string,profile:any,uid='teacher')=>(()=>({auth:{verifyIdToken:async(_token:string,revoked:boolean)=>{assert.equal(revoked,true);return {uid};}},db:{collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='users'?{role}:profile})})})}})) as any;
 try {
  await assert.rejects(teacherActor(request,initialize('student',{scopes:[]})),/FORBIDDEN/);
  await assert.rejects(teacherActor(request,initialize('teacher',null)),/TEACHER_NOT_CONFIGURED/);
  await assert.rejects(teacherActor(request,initialize('teacher',{disabled:true,scopes:[]})),/TEACHER_NOT_CONFIGURED/);
  await assert.rejects(teacherActor(request,initialize('teacher',{scopes:[]})),/TEACHER_NOT_CONFIGURED/);
  const actor=await teacherActor(request,initialize('teacher',{academyId:'main',scopes:[{studentKey:'id',subject:'영어'}]}));assert.equal(actor.admin,false);assert.equal(actor.scopes.length,1);
  const admin=await teacherActor(request,initialize('teacher',null,'admin'));assert.equal(admin.admin,true);
  await assert.rejects(teacherActor(request,initialize('teacher',{disabled:true},'admin')),/TEACHER_NOT_CONFIGURED/);
  await assert.rejects(teacherActor({headers:{}} as any,initialize('teacher',null)),/UNAUTHORIZED/);
 }finally{if(prior===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=prior;}
});

test('revoked tokens and disabled Firebase accounts cannot enter the workspace',async()=>{
 for(const code of ['auth/id-token-revoked','auth/user-disabled'])await assert.rejects(teacherActor({headers:{authorization:'Bearer token'}} as any,(()=>({auth:{verifyIdToken:async(_token:string,check:boolean)=>{assert.equal(check,true);throw {code};}}})) as any),/SESSION_REVOKED/);
});
test('stored teaching scopes are filtered by current academy membership on each request',async()=>{
 const previous=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';let member:any={academyId:'main'};
 const initialize:any=()=>({auth:{verifyIdToken:async()=>({uid:'t'})},db:{collection:(name:string)=>({doc:()=>({get:async()=>({data:()=>name==='users'?{role:'teacher'}:name==='teacherWorkspaceAccess'?{academyId:'main',scopes:[{studentKey:'student',subject:'영어'}]}:member})})})}});
 try{const req:any={headers:{authorization:'Bearer token'}};assert.equal((await teacherActor(req,initialize)).scopes.length,1);for(const value of [{academyId:'other'},{academyId:'main',disabled:true},undefined]){member=value;assert.equal((await teacherActor(req,initialize)).scopes.length,0);}}finally{if(previous===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=previous;}
});
