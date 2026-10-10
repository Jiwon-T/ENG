import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {hashStudentKey,hashPin} from '../api/_lib/security.js';
import {readDirectoryStudents,directoryRowKey,directorySourceKey,DIRECTORY_ROWS,DIRECTORY_STATE,DIRECTORY_HISTORY} from '../api/_lib/academyDirectorySource.js';
import {CORE_AUTHORITY,readCoreScopes,saveCoreGrant,restoreCoreProfile} from '../api/_lib/academyCore.js';
import {registrationAssignmentOptions} from '../api/_lib/teacherRegistrationAssignments.js';
import {lookupStudentIdentity} from '../api/_lib/studentIdentity.js';
import {readStudentProfile,saveStudentProfile,studentProfileSchema,profileFromPage,profileProperties} from '../api/_lib/teacherStudentProfile.js';
import {readStudentEnrollment,saveStudentEnrollment} from '../api/_lib/teacherStudentEnrollment.js';
import {assertTeacherSettingsAccess} from '../api/_lib/teacherSettingsPolicy.js';
import {teacherActor} from '../api/_lib/teacherWorkspaceAuth.js';
const sid='11111111-1111-4111-8111-111111111111',tid='22222222-2222-4222-8222-222222222222',eid='33333333-3333-4333-8333-333333333333';
const studentDB='e2b0d0f1-c79a-8262-a208-8116c9201cfc',teacherDB='3d274aff-32ce-4a33-870d-2689259113a6',enrollmentDB='3ec0d0f1-c79a-80b2-bb52-ea162888fe9a';
process.env.NOTION_STUDENT_DATABASE_ID=studentDB;process.env.PHONE_PIN_PEPPER='p'.repeat(64);
function fixture(){
 const f=templateFirestore(),actor={uid:'admin',admin:true,principal:false,academyId:'main',coreMode:true},at=new Date(Date.now()-10000).toISOString();let queries=0,gets=0;
 const student:any={id:sid,parent:{database_id:studentDB},last_edited_time:at,properties:{'학생':{type:'title',title:[{plain_text:'모의 학생'}]},'학교':{rich_text:[]},'학년':{select:null},'학생연락처':{phone_number:''},'보호자연락처':{phone_number:'0'+'1'.repeat(10)},'보호자이름':{rich_text:[]},'학생 호칭':{rich_text:[]},'수강료':{number:null},'납부기한':{rich_text:[]},'등록상태':{status:{name:'등록'}},'강의명':{multi_select:[{name:'영어'}]},'소속반':{relation:[]}}};
 const teacher={id:tid,parent:{database_id:teacherDB},last_edited_time:at,properties:{'선생님':{type:'title',title:[{plain_text:'모의 선생님'}]},'상태':{select:{name:'재직'}},'담당 과목':{multi_select:[{name:'영어'}]}}};
 const enrollment={id:eid,parent:{database_id:enrollmentDB},last_edited_time:at,properties:{'수강 내역':{type:'title',title:[{plain_text:'모의 수강'}]},'학생':{type:'relation',relation:[{id:sid}]},'영어':{status:{name:'등록'}},'영어 시작일':{date:{start:'2026-10-01'}},'영어 담당':{relation:[{id:tid}]}}};
 const pages=new Map([[studentDB,[student]],[teacherDB,[teacher]],[enrollmentDB,[enrollment]]]);
 f.rows.set('academyStudentMemberships/'+sid,{academyId:'main',disabled:false,internalStudentId:'stable-internal'});
 f.rows.set('notionStudentMappings/'+hashStudentKey(sid),{notionStudentPageId:sid,studentKey:sid,internalStudentId:'stable-internal',firebaseUid:'student-account',studentDisplayName:'모의 학생'});
 f.rows.set('users/student-account',{role:'student',notionStudentKey:sid});f.rows.set('users/teacher',{role:'teacher'});
 f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,scopes:[],assignmentRevision:0});
 f.rows.set('reportSlugs/stable-url',{slug:'stable-url',internalStudentId:'stable-internal',parentPhonePinHash:'original-pin-hash',authVersion:4,failedAttempts:2,lockedUntil:'kept'});
 f.rows.set('studentReportMappings/stable-internal',{studentKey:sid,slug:'stable-url'});f.rows.set('studentEnrollments/'+eid,{internalStudentId:'stable-internal',sourceUpdatedAt:at,subjects:[]});
 const notion:any=async(path:string,method='GET',body:any={})=>{if(method!=='GET'&& !path.endsWith('/query'))throw Error('Unexpected Notion mutation');
  if(path.endsWith('/query')){queries++;const db=path.split('/')[1],since=body.filter?.last_edited_time?.on_or_after;const source=(pages.get(db)||[]).filter((p:any)=>!p.archived&&(!since||Date.parse(p.last_edited_time)>=Date.parse(since)));return {results:structuredClone(source),has_more:false};}
  gets++;const p=[...pages.values()].flat().find((p:any)=>path==='pages/'+p.id);if(!p)throw Error('NOTION_404');return structuredClone(p);
 };
 // The state the one-time directory import and the core switch left behind (students, teachers, enrollments in the app).
 const setup=async()=>{
  const sources:any={students:[student,{pointer:{internalStudentId:'stable-internal',mappingId:hashStudentKey(sid)},studentKey:sid}],teachers:[teacher,{pointer:{teacherUid:'teacher'},studentKey:null}],enrollments:[enrollment,{pointer:{internalStudentId:'stable-internal',mappingId:hashStudentKey(sid),projectionId:eid},studentKey:sid}]};
  for(const kind of ['students','teachers','enrollments'] as const){const [page,extra]=sources[kind],key=directoryRowKey(kind,page.id),sourceKey=directorySourceKey(kind);
   f.rows.set(DIRECTORY_STATE+'/'+sourceKey,{sourceKey,kind,runVersion:2,phase:'idle',leaseOwner:null,leaseUntil:0,error:null,cursor:null,ready:true,approved:true,approvedBy:'admin'});
   const fields={properties:structuredClone(page.properties),archived:false};
   f.rows.set(DIRECTORY_ROWS+'/'+key,{sourceKey,kind,academyId:'main',databaseId:page.parent.database_id,notionPageId:page.id,...extra,fields,hash:'h-'+kind,issue:null,verified:true,remoteEditedAt:at,revision:1,updatedAt:1,summaryOverride:null});
   f.rows.set(DIRECTORY_HISTORY+'/'+key+':1',{sourceKey,notionPageId:page.id,revision:1,before:null,after:fields,pointer:extra.pointer,issue:null,by:'admin',at:1});}
  f.rows.set('teacherWorkspaceAccess/teacher',{academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,scopes:[{studentKey:sid,subject:'영어'}],assignmentRevision:1,assignmentSource:'firestore'});
  f.rows.set('studentEnrollments/'+eid,{internalStudentId:'stable-internal',sourceUpdatedAt:at,subjects:[{subject:'영어',status:'등록',startAt:'2026-10-01',endAt:null}],studentKey:sid,removed:false,appSource:'firestore'});
  f.rows.set(CORE_AUTHORITY+'/main',{active:true,by:'admin',at:1,sourceMode:'firestore',notionSyncRequired:false});
 };
 const deny:any=async()=>{throw Error('NOTION_ACCESS_BLOCKED');};
 return {...f,actor,notion,deny,student,teacher,enrollment,pages,setup,get queries(){return queries;},get gets(){return gets;},source:(kind:any,id:string)=>f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey(kind,id))};
}
test('Notion blocked: student read/write succeeds; stale/replayed writes preserve latest data and identities',async()=>{
 const f=fixture();await f.setup();const read=await readStudentProfile(f.db,f.actor,sid),op=randomUUID();
 const input={...read.data,displayName:'새 이름'};await saveStudentProfile(f.db,f.actor,sid,op,read.editedAt,input);
 const latest=await readStudentProfile(f.db,f.actor,sid);assert.equal(latest.data.displayName,'새 이름');assert.equal(f.rows.get('reportSlugs/stable-url').parentPhonePinHash,'original-pin-hash');assert.equal(f.rows.get('reportSlugs/stable-url').lockedUntil,'kept');
 await assert.rejects(saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input),/NOTION_EDIT_CONFLICT/);
 await saveStudentProfile(f.db,f.actor,sid,op,read.editedAt,input);assert.equal(f.rows.get('users/student-account').notionStudentKey,sid);
 const list=await readDirectoryStudents(f.db,{...f.actor,admin:false,uid:'teacher',scopes:[{studentKey:sid,subject:'영어'}]});assert.equal(list[0].studentDisplayName,'새 이름');assert.ok(!JSON.stringify(list).includes('phone_number'));
});
test('Notion blocked: contact change rotates PIN/auth version atomically; failed commit cannot change either',async()=>{
 const f=fixture();await f.setup();const read=await readStudentProfile(f.db,f.actor,sid),input={...read.data,guardianPhone:'0'+'2'.repeat(10)};
 f.failNextCommit();await assert.rejects(saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input),/FIRESTORE_UNAVAILABLE/);assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,4);
 await saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input);const slug=f.rows.get('reportSlugs/stable-url');assert.equal(slug.authVersion,5);assert.equal(slug.slug,'stable-url');assert.equal(slug.parentPhonePinHash,hashPin('2222'));assert.equal(slug.failedAttempts,0);
});
test('Notion blocked: enrollment status and teacher removal commit with public projection and immediate scope revocation',async()=>{
 const f=fixture();await f.setup();const r=await readStudentEnrollment(f.db,f.actor,sid);
 await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'중단',startDate:'2026-10-01',endDate:'2026-10-08',addTeacherUid:null,removeTeacherIds:[tid],classIds:[]}});
 const next=await readStudentEnrollment(f.db,f.actor,sid);assert.equal(next.subjects[0].status,'중단');assert.equal(next.subjects[0].teachers.length,0);assert.equal(f.rows.get('studentEnrollments/'+eid).subjects[0].status,'중단');
 const p=f.rows.get('teacherWorkspaceAccess/teacher');assert.deepEqual(await readCoreScopes(f.db,{...p,uid:'teacher'}),[]);
});
test('Notion blocked: explicit assignment grant is CAS/idempotent and reflects enrollment relations without account recreation',async()=>{
 const f=fixture();await f.setup();const p=f.rows.get('teacherWorkspaceAccess/teacher');
 const value={uid:'teacher',academyId:'main',workspaceRole:'teacher',workspaceLabel:'담당',notionTeacherPageId:tid,academyStudents:[],scopes:[]};
 await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);
 assert.deepEqual(f.source('enrollments',eid).fields.properties['영어 담당'].relation,[]);assert.equal(f.rows.get('users/teacher').role,'teacher');
 await assert.rejects(saveCoreGrant(f.db,f.actor,{...value,scopes:[{studentKey:sid,subject:'영어'}]},p.assignmentRevision,assertTeacherSettingsAccess),/DRAFT_CONFLICT/);
});
test('revoked membership and foreign academy never regain access from imported data',async()=>{
 const f=fixture();await f.setup();f.rows.set('academyStudentMemberships/'+sid,{academyId:'other'});
 assert.deepEqual(await readDirectoryStudents(f.db,{...f.actor,admin:false,scopes:[{studentKey:sid,subject:'영어'}]}),[]);
 await assert.rejects(readStudentProfile(f.db,{...f.actor,admin:false,principal:true},sid),/FORBIDDEN/);
});
test('actual workspace actor uses signed account checks and Firestore scopes with all network access blocked',async()=>{
 const f=fixture();await f.setup();const original=globalThis.fetch,admin=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';let calls=0;
 globalThis.fetch=(async()=>{calls++;throw Error('NOTION_ACCESS_BLOCKED');}) as any;
 try{const req:any={headers:{authorization:'Bearer mock-signed-token'}},initialize:any=()=>({db:f.db,auth:{verifyIdToken:async(_token:string,revoked:boolean)=>{assert.equal(revoked,true);return {uid:'teacher'};}}});
  const actor=await teacherActor(req,initialize);assert.equal(actor.coreMode,true);assert.deepEqual(actor.scopes,[{studentKey:sid,subject:'영어'}]);assert.equal(calls,0);
  f.rows.set('academyStudentMemberships/'+sid,{academyId:'main',disabled:true});assert.deepEqual((await teacherActor(req,initialize)).scopes,[]);assert.equal(calls,0);
 }finally{globalThis.fetch=original;admin===undefined?delete process.env.ADMIN_UID:process.env.ADMIN_UID=admin;}
});
test('selective restore keeps account/report identity, advances app version, and replays without rotating PIN twice',async()=>{
 const f=fixture();await f.setup();const r=await readStudentProfile(f.db,f.actor,sid);await saveStudentProfile(f.db,f.actor,sid,randomUUID(),r.editedAt,{...r.data,displayName:'수정 이름',guardianPhone:'0'+'4'.repeat(10)});
 const row=f.source('students',sid),input={id:sid,revision:row.revision,historyRevision:1,operationId:randomUUID(),confirmed:true};
 await restoreCoreProfile(f.db,f.actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);const current=f.source('students',sid);assert.equal(current.revision,row.revision+1);assert.equal((await readStudentProfile(f.db,f.actor,sid)).data.displayName,'모의 학생');assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,6);
 await restoreCoreProfile(f.db,f.actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,6);assert.equal(f.rows.get('users/student-account').notionStudentKey,sid);
});
test('an account snapshot captured before assignment removal cannot restore stale permissions',async()=>{
 const f=fixture();await f.setup();const stale={...structuredClone(f.rows.get('teacherWorkspaceAccess/teacher')),uid:'teacher'};
 await saveCoreGrant(f.db,f.actor,{uid:'teacher',academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,academyStudents:[],scopes:[]},stale.assignmentRevision,assertTeacherSettingsAccess);
 assert.deepEqual(await readCoreScopes(f.db,stale),[]);
 f.rows.set('teacherWorkspaceAccess/teacher',{...f.rows.get('teacherWorkspaceAccess/teacher'),disabled:true});await assert.rejects(readCoreScopes(f.db,stale),/TEACHER_NOT_CONFIGURED/);
});


import {setCoreTeacherAccess} from '../api/_lib/academyCore.js';
test('after the switch the admin registers a new teacher without a Notion page, assigns students, and can stop and resume access',async()=>{
 const f=fixture();await f.setup();
 f.rows.set('users/newbie',{role:'teacher',name:'새 선생님'});
 const value={uid:'newbie',scopes:[{studentKey:sid,subject:'영어'}],notionTeacherPageId:null,workspaceLabel:'새 선생님',workspaceRole:'teacher',academyId:'main',academyStudents:[sid]};
 // A principal cannot create a teacher record; the admin can.
 await assert.rejects(saveCoreGrant(f.db,{...f.actor,admin:false,principal:true},value,0,assertTeacherSettingsAccess),/INVALID_TEACHER|FORBIDDEN/);
 await saveCoreGrant(f.db,f.actor,value,0,assertTeacherSettingsAccess);
 const saved=f.rows.get('teacherWorkspaceAccess/newbie');assert.equal(saved.academyId,'main');assert.deepEqual(saved.scopes,[{studentKey:sid,subject:'영어'}]);assert.equal(saved.notionTeacherPageId,null);
 assert.deepEqual(await readCoreScopes(f.db,{uid:'newbie',academyId:'main',workspaceRole:'teacher'}),[{studentKey:sid,subject:'영어'}]);
 await assert.rejects(setCoreTeacherAccess(f.db,{...f.actor,admin:false,principal:true},{uid:'newbie',disabled:true}),/FORBIDDEN/);
 await setCoreTeacherAccess(f.db,f.actor,{uid:'newbie',disabled:true});
 await assert.rejects(readCoreScopes(f.db,{uid:'newbie',academyId:'main',workspaceRole:'teacher'}),/TEACHER_NOT_CONFIGURED/);
 assert.deepEqual(f.rows.get('teacherWorkspaceAccess/newbie').scopes,[{studentKey:sid,subject:'영어'}],'assignments are kept while stopped');
 await setCoreTeacherAccess(f.db,f.actor,{uid:'newbie',disabled:false});
 assert.equal((await readCoreScopes(f.db,{uid:'newbie',academyId:'main',workspaceRole:'teacher'})).length,1);
 await assert.rejects(setCoreTeacherAccess(f.db,f.actor,{uid:'admin',disabled:true}),/FORBIDDEN/,'the admin cannot stop themselves');
});
/* Workspace action boundaries for 학생 정보 and 수강 on the app path (restored from the Notion-era profile/enrollment tests). */
import {handleWorkspace as workspace} from '../api/teacher/workspace.js';
async function workspaceCall(f:any,method:string,values:any,who:any=f.actor){let body:any;const res:any={setHeader(){},end(v:string){body=JSON.parse(v);}};
 const req:any=method==='POST'?{method,body:values}:{method,url:'/api/teacher/workspace?'+new URLSearchParams(values)};
 await workspace(req,res,async()=>({...who,db:f.db,scopes:[],teachingScopes:[]}) as any);return {status:res.statusCode,body};}
const ordinary=(f:any)=>({...f.actor,admin:false,principal:false});
test('학생 정보·수강 actions refuse ordinary teachers and forged fields with no writes and no network',async()=>{
 const f=fixture();await f.setup();const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('NETWORK_BLOCKED');}) as any;
 try{
  const before=JSON.stringify([...f.rows]);
  for(const action of ['student-profile','student-enrollment'])assert.equal((await workspaceCall(f,'GET',{action,studentKey:sid},ordinary(f))).status,403);
  const profile=await readStudentProfile(f.db,f.actor,sid),enrollment=await readStudentEnrollment(f.db,f.actor,sid);
  const requests=[{action:'save-student-profile',studentKey:sid,operationId:randomUUID(),expectedEditedAt:profile.editedAt,data:profile.data},
   {action:'save-student-enrollment',studentKey:sid,operationId:randomUUID(),studentEditedAt:enrollment.studentEditedAt,enrollmentEditedAt:enrollment.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[]}}];
  for(const request of requests){
   assert.equal((await workspaceCall(f,'POST',request,ordinary(f))).status,403);
   assert.equal((await workspaceCall(f,'POST',{...request,academyId:'foreign'})).status,400,'a forged academy is rejected');
   assert.equal((await workspaceCall(f,'POST',{...request,data:{...request.data,internalStudentId:'hijack'}})).status,400,'a forged internal ID is rejected');
  }
  assert.equal(JSON.stringify([...f.rows]),before,'nothing was written');assert.equal(calls,0,'nothing was sent out');
 }finally{globalThis.fetch=original;}
});
test('학생 정보·수강 read and save through the workspace with no Notion settings',async()=>{
 const f=fixture();await f.setup();const original=globalThis.fetch,token=process.env.NOTION_INTEGRATION_TOKEN,database=process.env.NOTION_STUDENT_DATABASE_ID;
 globalThis.fetch=(async()=>{throw Error('NETWORK_BLOCKED');}) as any;delete process.env.NOTION_INTEGRATION_TOKEN;delete process.env.NOTION_STUDENT_DATABASE_ID;
 try{
  for(const action of ['student-profile','student-enrollment'])assert.equal((await workspaceCall(f,'GET',{action,studentKey:sid})).status,200);
  const p=await readStudentProfile(f.db,f.actor,sid);
  assert.equal((await workspaceCall(f,'POST',{action:'save-student-profile',studentKey:sid,operationId:randomUUID(),expectedEditedAt:p.editedAt,data:{...p.data,displayName:'표시 변경'}})).status,200);
  const e=await readStudentEnrollment(f.db,f.actor,sid);
  assert.equal((await workspaceCall(f,'POST',{action:'save-student-enrollment',studentKey:sid,operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-02',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[]}})).status,200);
  assert.equal((await lookupStudentIdentity(f.db as any,sid)).studentKey,sid);
  assert.equal(f.rows.get('notionStudentMappings/'+hashStudentKey(sid)).internalStudentId,'stable-internal','the student link keeps its internal ID');
  assert.equal((await registrationAssignmentOptions(f.db,f.actor)).teachers.length,1);
 }finally{globalThis.fetch=original;if(token!==undefined)process.env.NOTION_INTEGRATION_TOKEN=token;if(database!==undefined)process.env.NOTION_STUDENT_DATABASE_ID=database;}
});
