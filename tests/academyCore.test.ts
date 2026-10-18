import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {hashStudentKey,hashPin} from '../api/_lib/security.js';
import {readDirectoryStudents,directoryRowKey,directorySourceKey,DIRECTORY_ROWS,DIRECTORY_STATE,DIRECTORY_HISTORY} from '../api/_lib/academyDirectorySource.js';
import {CORE_AUTHORITY,readCoreScopes,saveCoreGrant,restoreCoreProfile} from '../api/_lib/academyCore.js';
import {forgetTeacherActors} from '../api/_lib/teacherActorMemory.js';
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
 const value={uid:'teacher',academyId:'main',workspaceRole:'teacher',workspaceLabel:'담당',notionTeacherPageId:tid,academyStudents:[],scopes:[],transferReason:'학원 사정'};
 await assert.rejects(saveCoreGrant(f.db,f.actor,{...value,transferReason:undefined},p.assignmentRevision,assertTeacherSettingsAccess),/TRANSFER_REASON_REQUIRED/,'taking the teacher off a continuing subject needs a reason');
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
  f.rows.set('academyStudentMemberships/'+sid,{academyId:'main',disabled:true});assert.deepEqual((await teacherActor(req,initialize)).scopes,[{studentKey:sid,subject:'영어'}],'remembered for up to a minute');
  forgetTeacherActors();assert.deepEqual((await teacherActor(req,initialize)).scopes,[]);assert.equal(calls,0);forgetTeacherActors();
  // a read (GET) checks the signature only; writes ask whether the account was revoked
  let revokedAsked:boolean|null=null;const readInit:any=()=>({db:f.db,auth:{verifyIdToken:async(_t:string,revoked:boolean)=>{revokedAsked=revoked;return {uid:'teacher',exp:Date.now()/1000+3600};}}});
  await teacherActor({method:'GET',headers:{authorization:'Bearer read-token'}} as any,readInit);assert.equal(revokedAsked,false);forgetTeacherActors();
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
 await saveCoreGrant(f.db,f.actor,{uid:'teacher',academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,academyStudents:[],scopes:[],transferReason:'학원 사정'},stale.assignmentRevision,assertTeacherSettingsAccess);
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
 const saved=f.rows.get('teacherWorkspaceAccess/newbie');assert.equal(saved.academyId,'main');assert.deepEqual(saved.scopes,[{studentKey:sid,subject:'영어'}]);
 const newRow=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',saved.notionTeacherPageId));assert.equal(newRow.pointer.teacherUid,'newbie','an account approved before automatic 명부 줄 gets one on its first save');assert.equal(saved.appTeacherRow,true);
 assert.ok(f.source('enrollments',eid).fields.properties['영어 담당'].relation.some((x:any)=>x.id===saved.notionTeacherPageId),'and is on the enrollment');
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
test('입학·상담 정보: admin reads and saves only admission properties; teachers are refused; stale or replayed saves are safe',async()=>{
 const f=fixture();await f.setup();
 assert.equal((await workspaceCall(f,'GET',{action:'student-admission',studentKey:sid},ordinary(f))).status,403);
 const read=async()=>(await workspaceCall(f,'GET',{action:'student-admission',studentKey:sid})).body.record;
 const first=await read();assert.equal(first.data.admission.birthDate,'');assert.equal(first.data.admission.levels.length,4);
 const profileBefore=await readStudentProfile(f.db,f.actor,sid);
 const data={guardianName:'김보호',guardianSalutation:'어머님',admission:{...first.data.admission,birthDate:'2012-03-04',address:'평택시',referral:'지인 소개',goal:'내신 1등급',availableDays:['월','수'],notes:'긴 메모 '.repeat(500).trim(),
  levels:first.data.admission.levels.map((l:any)=>l.subject==='영어'?{...l,schoolScore:88,schoolGrade:'2',diagnostic:'문법 약함'}:l),consent:'동의',consentDate:'2026-10-01',signerName:'김보호',signedPaper:true}};
 const request={action:'save-student-admission',studentKey:sid,operationId:randomUUID(),expectedEditedAt:first.editedAt,data};
 assert.equal((await workspaceCall(f,'POST',request,ordinary(f))).status,403,'an ordinary teacher cannot save');
 assert.equal((await workspaceCall(f,'POST',{...request,data:{...data,displayName:'hijack'}})).status,400,'only admission fields are accepted');
 const saved=await workspaceCall(f,'POST',request);assert.equal(saved.status,200);
 const again=await read();assert.deepEqual(again.data,data,'read back exactly, long notes included');assert.equal(again.editedAt,saved.body.editedAt);
 const profileAfter=await readStudentProfile(f.db,f.actor,sid);
 assert.deepEqual({...profileAfter.data,guardianName:undefined},{...profileBefore.data,guardianName:undefined},'profile fields are untouched');assert.equal(profileAfter.data.guardianName,'김보호');
 const replay=await workspaceCall(f,'POST',request);assert.equal(replay.status,200);assert.equal(replay.body.alreadySaved,true,'the same operation is answered once');
 const stale=await workspaceCall(f,'POST',{...request,operationId:randomUUID(),data:{...data,guardianName:'덮어쓰기'}});assert.notEqual(stale.status,200,'a stale screen cannot overwrite');
 assert.equal((await read()).data.guardianName,'김보호');
});
test('중단 예약: saved only while 등록 and not before the start, read back, kept in the projection, cleared when left out',async()=>{
 const f=fixture();await f.setup();
 const save=async(extra:any)=>{const e=await readStudentEnrollment(f.db,f.actor,sid);return workspaceCall(f,'POST',{action:'save-student-enrollment',studentKey:sid,operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-02',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[],...extra}});};
 assert.equal((await save({plannedEndDate:'2026-12-31'})).status,200);
 const read=await readStudentEnrollment(f.db,f.actor,sid);assert.equal(read.subjects.find((s:any)=>s.subject==='영어')!.plannedEndDate,'2026-12-31');assert.equal(read.subjects.find((s:any)=>s.subject==='영어')!.status,'등록','still 등록 until the stop is confirmed');
 const projected=[...f.rows.entries()].find(([k])=>k.startsWith('studentEnrollments/'))![1];assert.equal(projected.subjects.find((s:any)=>s.subject==='영어').plannedEndDate,'2026-12-31','the lesson-tab list sees it too');
 assert.equal((await save({status:'중단',endDate:'2026-12-31',plannedEndDate:'2026-12-31'})).status,400,'no reservation on a stopped subject');
 assert.equal((await save({plannedEndDate:'2026-09-01'})).status,400,'not before the start date');
 assert.equal((await save({})).status,200);assert.equal((await readStudentEnrollment(f.db,f.actor,sid)).subjects.find((s:any)=>s.subject==='영어')!.plannedEndDate,null,'left out = cleared');
});
test('담당 변경: taking a teacher off a continuing subject needs a reason and is recorded for the principal and admin only',async()=>{
 const f=fixture();await f.setup();
 const {readTeacherTransfers}=await import('../api/_lib/teacherTransfers.js');
 const save=async(extra:any)=>{const e=await readStudentEnrollment(f.db,f.actor,sid);return workspaceCall(f,'POST',{action:'save-student-enrollment',studentKey:sid,operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-02',endDate:null,addTeacherUid:null,removeTeacherIds:[tid],classIds:[],...extra}});};
 const transfers=()=>[...f.rows.entries()].filter(([k])=>k.startsWith('teacherTransfers/')).map(([,v])=>v);
 const refused=await save({});assert.equal(refused.status,400);assert.match(JSON.stringify(refused.body),/TRANSFER_REASON_REQUIRED|바꾸는 이유/);
 assert.equal((await readStudentEnrollment(f.db,f.actor,sid)).subjects[0].teachers.length,1,'nothing changed without a reason');assert.equal(transfers().length,0);
 assert.equal((await save({transferReason:'학생·학부모 요청',transferNote:'메모는 기타일 때만'})).status,200);
 const [t]=transfers();assert.equal(t.reason,'학생·학부모 요청');assert.equal(t.note,'','the note is kept only with 기타');assert.equal(t.subject,'영어');assert.deepEqual(t.toUids,[]);assert.deepEqual(t.fromUids,['teacher'],'who handed the student over');assert.equal(t.academyId,'main');
 assert.equal((await readStudentEnrollment(f.db,f.actor,sid)).subjects[0].teachers.length,0);
 const list=await readTeacherTransfers(f.db,{...f.actor,admin:true,academyId:'main'});assert.equal(list.transfers.length,1);
 await assert.rejects(readTeacherTransfers(f.db,{uid:'teacher',academyId:'main',admin:false,principal:false}),/FORBIDDEN/,'teachers never read transfer records');
});
test('담당 변경: a stop is not a transfer (no reason, no record); 기타 keeps its optional note',async()=>{
 const f=fixture();await f.setup();const transfers=()=>[...f.rows.entries()].filter(([k])=>k.startsWith('teacherTransfers/')).map(([,v])=>v);
 let r=await readStudentEnrollment(f.db,f.actor,sid);
 await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'중단',startDate:'2026-10-01',endDate:'2026-10-08',addTeacherUid:null,removeTeacherIds:[tid],classIds:[]}});
 assert.equal(transfers().length,0,'중단 with the teacher removed is a stop');
 const g=fixture();await g.setup();r=await readStudentEnrollment(g.db,g.actor,sid);
 await saveStudentEnrollment(g.db,g.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[tid],classIds:[],transferReason:'기타',transferNote:' 학원 내부 조정 '}});
 const [t]=[...g.rows.entries()].filter(([k])=>k.startsWith('teacherTransfers/')).map(([,v])=>v);assert.equal(t.reason,'기타');assert.equal(t.note,'학원 내부 조정');
});
test('담당 변경: removing one of two co-teachers records who stays (afterUids), not "담당 없음"',async()=>{
 const f=fixture();await f.setup();
 const tid2='44444444-4444-4444-8444-444444444444',tRow=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',tid));
 f.rows.set(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',tid2),{...structuredClone(tRow),notionPageId:tid2,pointer:{teacherUid:'teacher2'}});
 f.rows.set('users/teacher2',{role:'teacher'});f.rows.set('teacherWorkspaceAccess/teacher2',{academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid2,scopes:[{studentKey:sid,subject:'영어'}],assignmentRevision:1,assignmentSource:'firestore'});
 const eKey=DIRECTORY_ROWS+'/'+directoryRowKey('enrollments',eid),eRow=f.rows.get(eKey);eRow.fields.properties['영어 담당']={relation:[{id:tid},{id:tid2}]};f.rows.set(eKey,eRow);
 const r=await readStudentEnrollment(f.db,f.actor,sid);assert.equal(r.subjects[0].teachers.length,2,'two co-teachers before');
 await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[tid],classIds:[],transferReason:'시간 변경'}});
 const [t]=[...f.rows.entries()].filter(([k])=>k.startsWith('teacherTransfers/')).map(([,v])=>v);
 assert.deepEqual(t.fromUids,['teacher']);assert.deepEqual(t.toUids,[],'nobody new');assert.deepEqual(t.afterUids,['teacher2'],'the co-teacher stays');
 const {readTeacherTransfers}=await import('../api/_lib/teacherTransfers.js');assert.deepEqual((await readTeacherTransfers(f.db,f.actor)).transfers[0].afterUids,['teacher2']);
});
test('담당 변경 from the teacher dialog: one record per student and subject, retry writes nothing new, a stopped subject needs no reason',async()=>{
 const f=fixture();await f.setup();const p=f.rows.get('teacherWorkspaceAccess/teacher');
 const transfers=()=>[...f.rows.entries()].filter(([k])=>k.startsWith('teacherTransfers/')).map(([,v])=>v);
 const value={uid:'teacher',academyId:'main',workspaceRole:'teacher',workspaceLabel:'담당',notionTeacherPageId:tid,academyStudents:[],scopes:[],transferReason:'기타',transferNote:' 시간표 정리 '};
 await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);
 const list=transfers();assert.equal(list.length,1,'one record, the retry adds none');
 assert.deepEqual({from:list[0].fromUids,to:list[0].toUids,after:list[0].afterUids,subject:list[0].subject,reason:list[0].reason},{from:['teacher'],to:[],after:[],subject:'영어',reason:'기타'});
 assert.equal(list[0].note,'시간표 정리');
 const g=fixture();await g.setup();const eKey=DIRECTORY_ROWS+'/'+directoryRowKey('enrollments',eid),eRow=g.rows.get(eKey);eRow.fields.properties['영어']={status:{name:'중단'}};g.rows.set(eKey,eRow);
 const q=g.rows.get('teacherWorkspaceAccess/teacher');
 await saveCoreGrant(g.db,g.actor,{uid:'teacher',academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,academyStudents:[],scopes:[]},q.assignmentRevision,assertTeacherSettingsAccess);
 assert.equal([...g.rows.keys()].filter(k=>k.startsWith('teacherTransfers/')).length,0,'a stopped subject is not a transfer');
});
test('담당 변경 from the teacher dialog: a subject with no status still needs a reason and is recorded (only 중단 is exempt)',async()=>{
 const f=fixture();await f.setup();const eKey=DIRECTORY_ROWS+'/'+directoryRowKey('enrollments',eid),eRow=f.rows.get(eKey);delete eRow.fields.properties['영어'];f.rows.set(eKey,eRow);
 const p=f.rows.get('teacherWorkspaceAccess/teacher'),value={uid:'teacher',academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,academyStudents:[],scopes:[]};
 await assert.rejects(saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess),/TRANSFER_REASON_REQUIRED/,'missing status is not a stop');
 await saveCoreGrant(f.db,f.actor,{...value,transferReason:'시간 변경'},p.assignmentRevision,assertTeacherSettingsAccess);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('teacherTransfers/')).length,1);
});
test('campus per subject in 수강 관리: saved, read back, kept when left out, cleared with null; in the summary and the student 캠퍼스',async()=>{
 const f=fixture();await f.setup();
 const save=async(extra:any)=>{const e=await readStudentEnrollment(f.db,f.actor,sid);return saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[],...extra}});};
 await save({campus:'이충'});
 const read=async()=>(await readStudentEnrollment(f.db,f.actor,sid)).subjects.find((s:any)=>s.subject==='영어')!.campus;
 assert.equal(await read(),'이충');
 assert.equal(f.rows.get('studentEnrollments/'+eid).subjects.find((s:any)=>s.subject==='영어').campus,'이충','the lesson-tab summary sees it');
 assert.deepEqual(f.source('students',sid).fields.properties['캠퍼스'],{multi_select:[{name:'이충'}]});
 await save({});assert.equal(await read(),'이충','left out = kept');
 await save({campus:null});assert.equal(await read(),null,'null = cleared');
 const {readCoreEnrollmentSummaries}=await import('../api/_lib/academyCore.js');await save({campus:'고덕'});
 assert.equal((await readCoreEnrollmentSummaries(f.db,f.actor)).get(sid)!.find((s:any)=>s.subject==='영어').campus,'고덕');
});
test('student 캠퍼스 follows the subjects when a campus changes, down to an empty list; untouched saves keep it',async()=>{
 const f=fixture();await f.setup();
 const save=async(extra:any)=>{const e=await readStudentEnrollment(f.db,f.actor,sid);return saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[],...extra}});};
 const campus=()=>f.source('students',sid).fields.properties['캠퍼스'];
 await save({campus:'이충'});assert.deepEqual(campus(),{multi_select:[{name:'이충'}]});
 await save({campus:null});assert.deepEqual(campus(),{multi_select:[]},'the last subject campus cleared → empty');
 const sKey=DIRECTORY_ROWS+'/'+directoryRowKey('students',sid),sRow=f.rows.get(sKey);sRow.fields.properties['캠퍼스']={multi_select:[{name:'고덕'}]};f.rows.set(sKey,sRow);
 await save({});assert.deepEqual(campus(),{multi_select:[{name:'고덕'}]},'a save that does not touch the campus keeps the student value');
});
test('a link to a deleted or missing class neither blocks reading nor saving 수강 관리, and is kept untouched',async()=>{
 const f=fixture();await f.setup();const gone='55555555-5555-4555-8555-555555555555';
 const sKey=DIRECTORY_ROWS+'/'+directoryRowKey('students',sid),sRow=f.rows.get(sKey);sRow.fields.properties['소속반']={relation:[{id:gone}]};f.rows.set(sKey,sRow);
 const r=await readStudentEnrollment(f.db,f.actor,sid);assert.equal(r.subjects.find((s:any)=>s.subject==='영어')!.classes.length,0,'the missing class is skipped');
 await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[]}});
 assert.deepEqual(f.source('students',sid).fields.properties['소속반'].relation.map((x:any)=>x.id),[gone],'kept as it was (no data removed)');
 const e=await readStudentEnrollment(f.db,f.actor,sid);
 const res=await workspaceCall(f,'POST',{action:'save-student-enrollment',studentKey:sid,operationId:randomUUID(),studentEditedAt:e.studentEditedAt,enrollmentEditedAt:e.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[gone]}});
 assert.ok(res.status>=400,'refused');assert.match(JSON.stringify(res.body),/찾을 수 없는 반/,'with the clear message');
});
test('a teacher without an app account: added by the principal/admin, listed for 수강 관리, assigned without a user account, info edited',async()=>{
 const f=fixture();await f.setup();
 const {createOfflineTeacher}=await import('../api/_lib/offlineTeacher.js');const {coreRegistrationOptions}=await import('../api/_lib/academyCore.js');
 await assert.rejects(createOfflineTeacher(f.db,{uid:'teacher',academyId:'main',admin:false,principal:false},{name:'박민지',subjects:['수학'],phone:'010-0000-1234'}),/FORBIDDEN/,'ordinary teachers cannot add');
 await assert.rejects(createOfflineTeacher(f.db,f.actor,{name:'박민지',subjects:['영어'],phone:'02-12'}),/연락처/,'phone is required and checked');
 const made=await createOfflineTeacher(f.db,f.actor,{name:'박민지',subjects:['수학','영어'],phone:'010-0000-1234',memo:'엑셀 제출'});
 assert.match(made.uid,/^offline-/);assert.equal(made.label,'영수 박민지T','subject initials in 국영수과한 order');
 const profile=f.rows.get('teacherWorkspaceAccess/'+made.uid);assert.equal(profile.offline,true);assert.equal(profile.phone,'01000001234');assert.equal(profile.memo,'엑셀 제출');
 assert.ok((await coreRegistrationOptions(f.db,f.actor)).teachers.some((t:any)=>t.uid===made.uid&&t.subjects.includes('영어')),'listed for 수강 관리 / 원서');
 const value={uid:made.uid,academyId:'main',workspaceRole:'teacher',workspaceLabel:'영수 박민지T',notionTeacherPageId:profile.notionTeacherPageId,academyStudents:[sid],scopes:[{studentKey:sid,subject:'영어'}]};
 await saveCoreGrant(f.db,f.actor,value,0,assertTeacherSettingsAccess);
 assert.equal(f.rows.has('users/'+made.uid),false,'no user account is created');
 assert.ok(f.source('enrollments',eid).fields.properties['영어 담당'].relation.some((x:any)=>x.id===profile.notionTeacherPageId),'on the enrollment like any teacher');
 await saveCoreGrant(f.db,f.actor,{...value,workspaceLabel:'국영수 박민지T',offlinePhone:'01099998888',offlineMemo:'',offlineSubjects:['국어','영어','수학']},1,assertTeacherSettingsAccess);
 const after=f.rows.get('teacherWorkspaceAccess/'+made.uid);assert.equal(after.phone,'01099998888');assert.deepEqual(after.subjects,['국어','영어','수학']);
 const row=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',profile.notionTeacherPageId));assert.deepEqual(row.fields.properties['담당 과목'].multi_select.map((x:any)=>x.name),['국어','영어','수학']);
 assert.equal(row.fields.properties['선생님'].title[0].plain_text,'국영수 박민지T');
 await assert.rejects(saveCoreGrant(f.db,f.actor,{...value,workspaceRole:'principal'},2,assertTeacherSettingsAccess),/INVALID_TEACHER/,'never 원장 without an account');
});
test('앱 미연결 선생님 → 가입한 계정: the principal links them; 담당·row·name·담당 변경 기록·정산 move, the account can read its students',async()=>{
 const f=fixture();await f.setup();
 const {createOfflineTeacher}=await import('../api/_lib/offlineTeacher.js');const {linkOfflineTeacher,coreRegistrationOptions}=await import('../api/_lib/academyCore.js');
 const principal={uid:'principal',admin:false,principal:true,academyId:'main',coreMode:true};
 const made=await createOfflineTeacher(f.db,f.actor,{name:'박민지',subjects:['영어'],phone:'010-0000-1234'}),off=f.rows.get('teacherWorkspaceAccess/'+made.uid),rowId=off.notionTeacherPageId;
 // A principal saving an offline teacher (no users doc) no longer crashes.
 await saveCoreGrant(f.db,principal,{uid:made.uid,academyId:'main',workspaceRole:'teacher',workspaceLabel:made.label,notionTeacherPageId:rowId,academyStudents:[sid],scopes:[{studentKey:sid,subject:'영어'}]},0,assertTeacherSettingsAccess);
 f.rows.set('teacherTransfers/t1',{academyId:'main',studentKey:sid,subject:'영어',fromUids:[made.uid],toUids:['teacher'],afterUids:[made.uid,'teacher'],reason:'일정',note:'',by:'admin',at:1});
 f.rows.set('payrollRates/'+made.uid,{academyId:'main',share:40});
 f.rows.set('payrollMonths/main:2026-10',{academyId:'main',month:'2026-10',revision:1,adjust:{[made.uid]:{amount:10000,note:'교재'}}});
 // The new account: 선생님 권한 given, own 담당 already (수학), no teacher row yet.
 f.rows.set('users/new-teacher',{role:'teacher'});
 f.rows.set('teacherWorkspaceAccess/new-teacher',{academyId:'main',workspaceRole:'teacher',workspaceLabel:'',notionTeacherPageId:null,scopes:[{studentKey:sid,subject:'수학'}],assignmentRevision:2});
 await assert.rejects(linkOfflineTeacher(f.db,{uid:'teacher',admin:false,principal:false,academyId:'main'},{offlineUid:made.uid,uid:'new-teacher'}),/FORBIDDEN/,'ordinary teachers cannot link');
 await assert.rejects(linkOfflineTeacher(f.db,principal,{offlineUid:made.uid,uid:'teacher'}),/TEACHER_ALREADY_LINKED/,'an account with its own teacher row is refused');
 await assert.rejects(linkOfflineTeacher(f.db,principal,{offlineUid:made.uid,uid:'student-account'}),/TEACHER_LINK_INVALID/,'an account without 선생님 권한 is refused');
 const r=await linkOfflineTeacher(f.db,principal,{offlineUid:made.uid,uid:'new-teacher'});
 assert.deepEqual(r,{uid:'new-teacher',label:made.label,alreadyLinked:false});
 const row=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',rowId));assert.equal(row.pointer.teacherUid,'new-teacher','the teacher row points at the account');
 const account=f.rows.get('teacherWorkspaceAccess/new-teacher');
 assert.equal(account.notionTeacherPageId,rowId);assert.equal(account.workspaceLabel,made.label,'the name the academy used is kept');
 assert.deepEqual(account.scopes.map((s:any)=>s.subject).sort(),['수학','영어'],'담당 merged');assert.equal(account.assignmentRevision,3);
 const old=f.rows.get('teacherWorkspaceAccess/'+made.uid);assert.equal(old.disabled,true);assert.equal(old.linkedUid,'new-teacher');assert.equal(old.phone,'01000001234','the offline record is kept, not deleted');
 assert.ok(f.source('enrollments',eid).fields.properties['수학 담당'].relation.some((x:any)=>x.id===rowId),'the account’s own 담당 now has the teacher row on the enrollment');
 const t=f.rows.get('teacherTransfers/t1');assert.deepEqual(t.fromUids,['new-teacher']);assert.deepEqual(t.afterUids,['new-teacher','teacher']);assert.deepEqual(t.toUids,['teacher']);
 assert.equal(f.rows.get('payrollRates/new-teacher').share,40,'정산 비율 moves');assert.equal(f.rows.has('payrollRates/'+made.uid),false);
 const month=f.rows.get('payrollMonths/main:2026-10');assert.deepEqual(month.adjust,{'new-teacher':{amount:10000,note:'교재'}});assert.equal(month.revision,2);
 assert.deepEqual((await readCoreScopes(f.db,{uid:'new-teacher',academyId:'main',workspaceRole:'teacher'})).map((s:any)=>s.subject).sort(),['수학','영어'],'the account reads its students');
 const options=(await coreRegistrationOptions(f.db,f.actor)).teachers;
 assert.ok(options.some((x:any)=>x.uid==='new-teacher'),'listed for 수강 관리 / 원서 as the account');assert.ok(!options.some((x:any)=>x.uid===made.uid),'the offline record is not');
 assert.equal((await linkOfflineTeacher(f.db,principal,{offlineUid:made.uid,uid:'new-teacher'})).alreadyLinked,true,'a repeated request changes nothing');
 const other=await createOfflineTeacher(f.db,f.actor,{name:'이수진',subjects:['영어'],phone:'010-0000-5678'});
 await assert.rejects(linkOfflineTeacher(f.db,principal,{offlineUid:other.uid,uid:'new-teacher'}),/TEACHER_ALREADY_LINKED/,'one account, one teacher record');
 const fs=await import('node:fs'),reg=fs.readFileSync(new URL('../api/_lib/appStudentRegistration.ts',import.meta.url),'utf8');
 assert.match(reg,/if\(profile\?\.offline&&profile\.linkedUid\)\{teacherUid=profile\.linkedUid;/,'a 원서 saved before the link commits to the account');
});
test('명부 줄 at 선생님 권한: the new account is in 수강 관리 / 원서 once 담당 과목 is chosen; a later link to an offline teacher retires it',async()=>{
 const f=fixture();await f.setup();
 const {setAppUserRole}=await import('../api/_lib/appUsers.js');const {coreRegistrationOptions,linkOfflineTeacher}=await import('../api/_lib/academyCore.js');const {createOfflineTeacher}=await import('../api/_lib/offlineTeacher.js');
 f.rows.set('users/fresh',{role:'student',name:'정하늘',email:'f@x.kr'});
 await setAppUserRole(f.db,f.actor,{uid:'fresh',role:'teacher'});
 const p=f.rows.get('teacherWorkspaceAccess/fresh'),row=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',p.notionTeacherPageId));
 assert.equal(row.pointer.teacherUid,'fresh');assert.equal(row.autoCreated,true);assert.equal(row.fields.properties['선생님'].title[0].plain_text,'정하늘','named after the account');
 assert.equal(row.fields.properties['상태'].select.name,'재직');assert.equal(p.appTeacherRow,true);
 assert.ok((await coreRegistrationOptions(f.db,f.actor)).teachers.some((t:any)=>t.uid==='fresh'),'listed for 수강 관리 / 원서');
 const value={uid:'fresh',academyId:'main',workspaceRole:'teacher',workspaceLabel:'',notionTeacherPageId:p.notionTeacherPageId,academyStudents:[sid],scopes:[{studentKey:sid,subject:'수학'}],teacherSubjects:['수학']};
 await saveCoreGrant(f.db,f.actor,value,0,assertTeacherSettingsAccess);
 assert.deepEqual(f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',p.notionTeacherPageId)).fields.properties['담당 과목'].multi_select,[{name:'수학'}],'담당 과목 chosen in 선생님 관리');
 assert.deepEqual(f.rows.get('teacherWorkspaceAccess/fresh').subjects,['수학']);
 assert.ok(f.source('enrollments',eid).fields.properties['수학 담당'].relation.some((x:any)=>x.id===p.notionTeacherPageId));
 await setAppUserRole(f.db,f.actor,{uid:'fresh',role:'student'});await setAppUserRole(f.db,f.actor,{uid:'fresh',role:'teacher'});
 assert.equal(f.rows.get('teacherWorkspaceAccess/fresh').notionTeacherPageId,p.notionTeacherPageId,'given access again: the same row, no second one');
 const made=await createOfflineTeacher(f.db,f.actor,{name:'정하늘',subjects:['영어'],phone:'010-0000-1234'}),offRow=f.rows.get('teacherWorkspaceAccess/'+made.uid).notionTeacherPageId;
 await linkOfflineTeacher(f.db,f.actor,{offlineUid:made.uid,uid:'fresh'});
 const linked=f.rows.get('teacherWorkspaceAccess/fresh');assert.equal(linked.notionTeacherPageId,offRow,'the offline teacher’s row is kept');assert.deepEqual(linked.subjects.sort(),['수학','영어']);
 const kept=f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',offRow));assert.deepEqual(kept.fields.properties['담당 과목'].multi_select.map((s:any)=>s.name).sort(),['수학','영어'],'the kept row gets the account’s 담당 과목 too');
 assert.equal(kept.revision,2);assert.deepEqual(f.rows.get(DIRECTORY_HISTORY+'/'+directoryRowKey('teachers',offRow)+':2').after.properties['담당 과목'].multi_select.map((s:any)=>s.name).sort(),['수학','영어'],'recorded in the row history');
 const pick=(await coreRegistrationOptions(f.db,f.actor)).teachers.find((t:any)=>t.uid==='fresh');assert.deepEqual(pick.subjects.sort(),['수학','영어'],'수강 관리 / 원서 offer both subjects right after the link');
 assert.equal(f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey('teachers',p.notionTeacherPageId)).fields.archived,true,'the automatic row is retired');
 const rel=f.source('enrollments',eid).fields.properties['수학 담당'].relation.map((x:any)=>x.id);assert.ok(rel.includes(offRow)&&!rel.includes(p.notionTeacherPageId),'the enrollment moves to the kept row');
 assert.deepEqual((await readCoreScopes(f.db,{uid:'fresh',academyId:'main',workspaceRole:'teacher'})).map((s:any)=>s.subject),['수학']);
});
test('연결 제안: a new account named like a student without an account or a 앱 미연결 선생님 is offered; 연결 and 아니요 work',async()=>{
 const f=fixture();await f.setup();
 // linkStudentAccount uses tx.update, which this test double does not have: merge into the stored row (test only).
 const run=f.db.runTransaction;(f.db as any).runTransaction=(fn:any)=>run((tx:any)=>fn({...tx,update:(ref:any,patch:any)=>tx.set(ref,{...f.rows.get(ref.path),...patch})}));
 const {readLinkSuggestions,acceptLinkSuggestion,dismissLinkSuggestion}=await import('../api/_lib/linkSuggestions.js');const {createOfflineTeacher}=await import('../api/_lib/offlineTeacher.js');
 // The fixture student loses its account link; a new account with the same name signs up.
 const mk=f.rows.get('notionStudentMappings/'+hashStudentKey(sid));f.rows.set('notionStudentMappings/'+hashStudentKey(sid),{...mk,firebaseUid:null});f.rows.set('users/student-account',{role:'student'});
 f.rows.set('users/kid',{role:'student',name:'모의 학생',email:'k@x.kr'});
 const made=await createOfflineTeacher(f.db,f.actor,{name:'박민지',subjects:['영어'],phone:'010-0000-1234'});
 f.rows.set('users/pm',{role:'student',name:'박민지',email:'p@x.kr'});
 await createOfflineTeacher(f.db,f.actor,{name:'이수진',subjects:['수학'],phone:'010-0000-5678'});
 f.rows.set('users/sj',{role:'student',name:'수진',email:'s@x.kr'});
 await assert.rejects(readLinkSuggestions(f.db,{...f.actor,admin:false,principal:true}),/FORBIDDEN/,'admin only');
 let r:any=await readLinkSuggestions(f.db,f.actor);
 const kid=r.suggestions.find((s:any)=>s.uid==='kid');assert.equal(kid.kind,'student');assert.equal(kid.targetId,sid);assert.equal(kid.sameName,true);
 const pm=r.suggestions.find((s:any)=>s.uid==='pm');assert.equal(pm.kind,'teacher');assert.equal(pm.targetId,made.uid);assert.equal(pm.needsRole,true);assert.match(pm.detail,/영어 · 담당 0명/);
 const sj=r.suggestions.find((s:any)=>s.uid==='sj');assert.equal(sj.sameName,false,'given name only: flagged');
 await dismissLinkSuggestion(f.db,f.actor,{kind:sj.kind,uid:'sj',targetId:sj.targetId});
 await acceptLinkSuggestion(f.db,f.actor,{kind:'student',uid:'kid',targetId:sid});
 assert.equal(f.rows.get('users/kid').notionStudentKey,sid,'linked like 학생 관리 › 앱 계정 연결');
 await acceptLinkSuggestion(f.db,f.actor,{kind:'teacher',uid:'pm',targetId:made.uid});
 assert.equal(f.rows.get('users/pm').role,'teacher','선생님 권한 given');
 const pmProfile=f.rows.get('teacherWorkspaceAccess/pm');assert.equal(pmProfile.notionTeacherPageId,f.rows.get('teacherWorkspaceAccess/'+made.uid).notionTeacherPageId,'and linked to the offline record');
 r=await readLinkSuggestions(f.db,f.actor);assert.deepEqual(r.suggestions,[],'linked and turned-down pairs are no longer offered');
});
test('담당 시작일 is stored when a teacher starts on a subject (선생님 관리, 수강 관리, restart) and shown in 수강 관리',async()=>{
 const f=fixture();await f.setup();
 const {startId,seoulDay}=await import('../api/_lib/assignmentStarts.js');
 const start=(uid:string,subject:string)=>f.rows.get('teacherAssignmentStarts/'+startId(uid,sid,subject))?.since;
 // The fixture teacher already teaches 영어: taken off, then given the student again.
 const grant=(scopes:any[],extra:any={})=>saveCoreGrant(f.db,f.actor,{uid:'teacher',academyId:'main',workspaceRole:'teacher',workspaceLabel:'',notionTeacherPageId:tid,academyStudents:[sid],scopes,...extra},f.rows.get('teacherWorkspaceAccess/teacher').assignmentRevision||0,assertTeacherSettingsAccess);
 await grant([],{transferReason:'일정'});await grant([{studentKey:sid,subject:'영어'}]);
 assert.equal(start('teacher','영어'),seoulDay(),'선생님 관리: from today');
 f.rows.set('teacherAssignmentStarts/'+startId('teacher',sid,'영어'),{uid:'teacher',studentKey:sid,subject:'영어',since:'2026-05-11'});
 let e=await readStudentEnrollment(f.db,f.actor,sid);
 assert.equal(e.subjects.find((s:any)=>s.subject==='영어')!.teachers.find((t:any)=>t.uid==='teacher')!.since,'2026-05-11','수강 관리 shows it');
 const save=async(data:any)=>{const r=await readStudentEnrollment(f.db,f.actor,sid);await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'등록',startDate:'2026-10-01',endDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:[],...data}});};
 await save({status:'중단',endDate:'2026-10-05'});await save({status:'등록',startDate:'2026-10-12'});
 assert.equal(start('teacher','영어'),'2026-10-12','a restart starts the teacher again on the new 시작일');
 const h=(await readStudentEnrollment(f.db,f.actor,sid)).subjects.find((s:any)=>s.subject==='영어')!.history!;
 const status=h.filter((x:any)=>x.kind!=='담당 변경');assert.deepEqual(status.map((x:any)=>x.kind),['등록','중단','재시작'],'이력: 등록 → 중단 → 재시작 (same teacher)');assert.deepEqual(status.slice(1).map((x:any)=>x.date),['2026-10-05','2026-10-12']);assert.match(status[2].text,/담당 모의 선생님/);
 assert.equal(h.filter((x:any)=>x.kind==='담당 변경').length,2,'taken off and given back in 선생님 관리 show as 담당 변경');
});
test('연결 제안 with two same-name students: both offered side by side with 학교 and dates, the recent one hinted',async()=>{
 const f=fixture();await f.setup();
 const {readLinkSuggestions}=await import('../api/_lib/linkSuggestions.js');
 const mk=f.rows.get('notionStudentMappings/'+hashStudentKey(sid));f.rows.set('notionStudentMappings/'+hashStudentKey(sid),{...mk,firebaseUid:null});
 const other='66666666-6666-4666-8666-666666666666',srcKey=DIRECTORY_ROWS+'/'+directoryRowKey('students',sid),src=structuredClone(f.rows.get(srcKey));
 src.notionPageId=other;src.entityId=other;src.studentKey=other;src.fields.properties['학원 등록일']={date:{start:'2026-10-10'}};src.fields.properties['학교']={rich_text:[{plain_text:'고덕중'}]};
 const mine=f.rows.get(srcKey);mine.fields.properties['학원 등록일']={date:{start:'2025-03-04'}};f.rows.set(srcKey,mine); f.rows.set(DIRECTORY_ROWS+'/'+directoryRowKey('students',other),src);f.rows.set('academyStudentMemberships/'+other,{academyId:'main',disabled:false,internalStudentId:'other-internal'});
 f.rows.set('users/kid',{role:'student',name:'모의 학생',email:'k@x.kr',createdAt:'2026-10-12T03:00:00Z'});
 const r:any=await readLinkSuggestions(f.db,f.actor);
 const pick=r.unclear.find((u:any)=>u.uid==='kid');assert.equal(pick.reason,'same-name');assert.equal(pick.joined,'2026-10-12');
 assert.deepEqual(pick.choices.map((c:any)=>c.targetId).sort(),[sid,other].sort());
 assert.ok(pick.choices.every((c:any)=>c.sameName===true),'full name match');const recent=pick.choices.find((c:any)=>c.targetId===other);assert.equal(recent.justBefore,true);assert.equal(recent.registered,'2026-10-10');assert.match(recent.detail,/고덕중/);
 const older=pick.choices.find((c:any)=>c.targetId===sid);assert.equal(older.justBefore,false);assert.match(older.subjects,/영어 2026\.10\.1/,'과목 시작일 from the enrollment row');
});
