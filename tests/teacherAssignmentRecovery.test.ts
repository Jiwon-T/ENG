import test from 'node:test';import assert from 'node:assert/strict';
import {handleWorkspace} from '../api/teacher/workspace.js';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {assignmentCheckpoint,retryTeacherAssignment} from '../api/_lib/teacherAssignmentRetry.js';
const k='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',t='33333333-3333-4333-8333-333333333333';
const teacherDB='3d274aff-32ce-4a33-870d-2689259113a6',enrollmentDB='3ec0d0f1-c79a-80b2-bb52-ea162888fe9a',subjects=['영어','수학','국어','과학','한국사'];
async function request(db:any,body:any){let result:any;const res:any={setHeader:()=>{},end:(v:string)=>result=JSON.parse(v)};await handleWorkspace({method:'POST',body} as any,res,async()=>({uid:'admin',admin:true,principal:false,academyId:'main',scopes:[],teachingScopes:[],db}) as any);return {status:res.statusCode,body:result};}
test('highest admin remains admin when teacher scopes are saved',async()=>{const f=registrationFirestore(),old=process.env.ADMIN_UID;process.env.ADMIN_UID='highest';f.rows.set('users/highest',{role:'admin'});try{const r=await request(f.db,{action:'grant',uid:'highest',academyId:'main',workspaceRole:'teacher',scopes:[],notionTeacherPageId:null});assert.equal(r.status,200);assert.equal(r.body.syncError,'TEACHER_NOTION_LINK_REQUIRED');assert.equal(f.rows.get('users/highest').role,'admin');}finally{if(old===undefined)delete process.env.ADMIN_UID;else process.env.ADMIN_UID=old;}});
test('duplicate teacher page cannot be saved to another account or retried',async()=>{const f=registrationFirestore();f.rows.set('users/teacher',{role:'teacher'});f.rows.set('teacherWorkspaceAccess/other',{notionTeacherPageId:t,academyId:'main'});const r=await request(f.db,{action:'grant',uid:'teacher',academyId:'main',workspaceRole:'teacher',scopes:[],notionTeacherPageId:t});assert.equal(r.body.error,'NOTION_TEACHER_ID_CONFLICT');assert.equal(f.rows.has('teacherWorkspaceAccess/teacher'),false);f.rows.set('teacherWorkspaceAccess/teacher',{notionTeacherPageId:t,academyId:'main',scopes:[]});await assert.rejects(retryTeacherAssignment(f.db,{admin:true},'teacher'),/NOTION_TEACHER_ID_CONFLICT/);});
test('partial assignment removal keeps original baseline through retries and blocks replacing unresolved request',async()=>{
 const f=registrationFirestore(),actor={uid:'admin',admin:true,academyId:'main'};
 f.rows.set('users/teacher',{role:'teacher'});for(const student of [k,b])f.rows.set('academyStudentMemberships/'+student,{academyId:'main'});
 const original=[{studentKey:k,subject:'영어'},{studentKey:b,subject:'영어'}];f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',workspaceRole:'teacher',notionTeacherPageId:t,scopes:original});
 const pages:any=Object.fromEntries([k,b].map(id=>[id,{id,parent:{database_id:enrollmentDB},properties:{학생:{relation:[{id}]},...Object.fromEntries(subjects.map(s=>[s+' 담당',{relation:s==='영어'?[{id:t}]:[]}]))}}]));
 pages[t]={id:t,parent:{database_id:teacherDB},properties:{'담당 과목':{multi_select:[{name:'영어'}]}}};
 const previousFetch=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN;process.env.NOTION_INTEGRATION_TOKEN='test';let failing=true,patches=0;
 globalThis.fetch=async(url:any,init:any)=>{const path=String(url).split('/v1/')[1],body=init.body?JSON.parse(init.body):{};let result:any;
 if(path==='databases/'+enrollmentDB)result={properties:Object.fromEntries(subjects.map(s=>[s+' 담당',{type:'relation',relation:{database_id:teacherDB}}]))};
 else if(path==='databases/'+teacherDB)result={properties:{'담당 과목':{type:'multi_select',multi_select:{options:subjects.map(name=>({name}))}}}};
 else if(path.endsWith('/query'))result={results:[pages[body.filter.relation.contains]],has_more:false};
 else if(init.method==='PATCH'){patches++;if(path==='pages/'+b&&failing)return new Response('{}',{status:502});Object.assign(pages[path.split('/')[1]].properties,body.properties);result=pages[path.split('/')[1]];}
 else result=pages[path.split('/')[1]];return new Response(JSON.stringify(result),{status:200});};
 try{const value={action:'grant',uid:'teacher',scopes:[],academyId:'main',workspaceRole:'teacher',notionTeacherPageId:t,assignmentRevision:0};
 const failed=await request(f.db,value);assert.equal(failed.status,200);assert.equal(failed.body.syncError,'NOTION_502');
 const saved=f.rows.get('teacherWorkspaceAccess/teacher');assert.deepEqual(saved.previousNotionAssignment.scopes,original);assert.equal(saved.notionAssignmentTouched,true);assert.deepEqual(pages[k].properties['영어 담당'].relation,[]);
 const denied=await request(f.db,{...value,assignmentRevision:1,scopes:[original[0]]});assert.equal(denied.body.error,'ASSIGNMENT_RETRY_REQUIRED');
 failing=false;await retryTeacherAssignment(f.db,actor,'teacher');const final=f.rows.get('teacherWorkspaceAccess/teacher');assert.equal(final.notionAssignmentStage,'synced');assert.equal(final.previousNotionAssignment,null);assert.equal(final.notionAssignmentError,null);assert.deepEqual(pages[b].properties['영어 담당'].relation,[]);assert.equal(patches,4);
 }finally{globalThis.fetch=previousFetch;if(token===undefined)delete process.env.NOTION_INTEGRATION_TOKEN;else process.env.NOTION_INTEGRATION_TOKEN=token;}
});
test('lease fencing and another academy reject retries without upstream writes',async()=>{const f=registrationFirestore();f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',scopes:[],notionAssignmentLease:'new',notionAssignmentLeaseUntil:Date.now()+10000});await assert.rejects(assignmentCheckpoint(f.db,'teacher','old',{notionAssignmentStage:'synced'}),/DRAFT_CONFLICT/);await assert.rejects(retryTeacherAssignment(f.db,{admin:false,principal:true,academyId:'other'},'teacher'),/FORBIDDEN/);await assert.rejects(retryTeacherAssignment(f.db,{admin:true},'teacher'),/PUBLISH_IN_PROGRESS/);});
