import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {hashStudentKey,hashPin} from '../api/_lib/security.js';
import {importDirectoryStep,approveDirectory,dryRunDirectory,readDirectoryStudents,directoryRowKey,directorySourceKey,DIRECTORY_ROWS,DIRECTORY_STATE,runDirectoryWorker} from '../api/_lib/academyDirectorySource.js';
import {CORE_AUTHORITY,cutoverCore,readCoreScopes,saveCoreGrant,restoreCoreProfile} from '../api/_lib/academyCore.js';
import {registrationAssignmentOptions} from '../api/_lib/teacherRegistrationAssignments.js';
import {lookupStudentIdentity} from '../api/_lib/studentIdentity.js';
import {syncAcademicPage} from '../api/_lib/academic.js';
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
 const setup=async()=>{for(const kind of ['students','teachers','enrollments'] as const){let r:any;do{r=await importDirectoryStep(f.db,actor,kind,notion);}while(r.continue);await approveDirectory(f.db,actor,kind);}};
 const deny:any=async()=>{throw Error('NOTION_ACCESS_BLOCKED');};
 return {...f,actor,notion,deny,student,teacher,enrollment,pages,setup,get queries(){return queries;},get gets(){return gets;},source:(kind:any,id:string)=>f.rows.get(DIRECTORY_ROWS+'/'+directoryRowKey(kind,id))};
}
test('dry-run does not create accounts/PINs or public duplicates; source links reuse existing internal/report identities',async()=>{
 const f=fixture(),before=structuredClone([...f.rows]);f.resetMetrics();const dry=await dryRunDirectory(f.db,f.actor,'enrollments',undefined,f.notion);assert.equal(dry.writes,0);assert.equal(f.metrics.writes,0);assert.equal(dry.items[0].reusesProjection,true);assert.deepEqual([...f.rows],before);
 await f.setup();for(const [key,value] of before)assert.deepEqual(f.rows.get(key),value);assert.equal(f.source('students',sid).pointer.internalStudentId,'stable-internal');
});
test('cutover seeds exact assigned scopes, freezes imports and does not change account/PIN/URL',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);assert.deepEqual(f.rows.get('teacherWorkspaceAccess/teacher').scopes,[{studentKey:sid,subject:'영어'}]);
 assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,4);assert.equal(f.rows.get('users/student-account').notionStudentKey,sid);
 await assert.rejects(importDirectoryStep(f.db,f.actor,'students',f.deny),/CORE_FROZEN/);assert.deepEqual(await runDirectoryWorker(f.db,{mode:'directory-pull',kind:'students'},f.deny),{skipped:true,reason:'CORE_FROZEN'});
});
test('Notion blocked: student read/write succeeds; stale/replayed writes preserve latest data and identities',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const read=await readStudentProfile(f.db,f.actor,sid,f.deny),op=randomUUID();
 const input={...read.data,displayName:'새 이름'};await saveStudentProfile(f.db,f.actor,sid,op,read.editedAt,input,f.deny);
 const latest=await readStudentProfile(f.db,f.actor,sid,f.deny);assert.equal(latest.data.displayName,'새 이름');assert.equal(f.rows.get('reportSlugs/stable-url').parentPhonePinHash,'original-pin-hash');assert.equal(f.rows.get('reportSlugs/stable-url').lockedUntil,'kept');
 await assert.rejects(saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input,f.deny),/NOTION_EDIT_CONFLICT/);
 await saveStudentProfile(f.db,f.actor,sid,op,read.editedAt,input,f.deny);assert.equal(f.rows.get('users/student-account').notionStudentKey,sid);
 const list=await readDirectoryStudents(f.db,{...f.actor,admin:false,uid:'teacher',scopes:[{studentKey:sid,subject:'영어'}]});assert.equal(list[0].studentDisplayName,'새 이름');assert.ok(!JSON.stringify(list).includes('phone_number'));
});
test('Notion blocked: contact change rotates PIN/auth version atomically; failed commit cannot change either',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const read=await readStudentProfile(f.db,f.actor,sid,f.deny),input={...read.data,guardianPhone:'0'+'2'.repeat(10)};
 f.failNextCommit();await assert.rejects(saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input,f.deny),/FIRESTORE_UNAVAILABLE/);assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,4);
 await saveStudentProfile(f.db,f.actor,sid,randomUUID(),read.editedAt,input,f.deny);const slug=f.rows.get('reportSlugs/stable-url');assert.equal(slug.authVersion,5);assert.equal(slug.slug,'stable-url');assert.equal(slug.parentPhonePinHash,hashPin('2222'));assert.equal(slug.failedAttempts,0);
});
test('Notion blocked: enrollment status and teacher removal commit with public projection and immediate scope revocation',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const r=await readStudentEnrollment(f.db,f.actor,sid,f.deny);
 await saveStudentEnrollment(f.db,f.actor,sid,{operationId:randomUUID(),studentEditedAt:r.studentEditedAt,enrollmentEditedAt:r.enrollmentEditedAt,data:{subject:'영어',status:'중단',startDate:'2026-10-01',endDate:'2026-10-08',addTeacherUid:null,removeTeacherIds:[tid],classIds:[]}},f.deny);
 const next=await readStudentEnrollment(f.db,f.actor,sid,f.deny);assert.equal(next.subjects[0].status,'중단');assert.equal(next.subjects[0].teachers.length,0);assert.equal(f.rows.get('studentEnrollments/'+eid).subjects[0].status,'중단');
 const p=f.rows.get('teacherWorkspaceAccess/teacher');assert.deepEqual(await readCoreScopes(f.db,{...p,uid:'teacher'}),[]);
});
test('Notion blocked: explicit assignment grant is CAS/idempotent and reflects enrollment relations without account recreation',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const p=f.rows.get('teacherWorkspaceAccess/teacher');
 const value={uid:'teacher',academyId:'main',workspaceRole:'teacher',workspaceLabel:'담당',notionTeacherPageId:tid,academyStudents:[],scopes:[]};
 await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);await saveCoreGrant(f.db,f.actor,value,p.assignmentRevision,assertTeacherSettingsAccess);
 assert.deepEqual(f.source('enrollments',eid).fields.properties['영어 담당'].relation,[]);assert.equal(f.rows.get('users/teacher').role,'teacher');
 await assert.rejects(saveCoreGrant(f.db,f.actor,{...value,scopes:[{studentKey:sid,subject:'영어'}]},p.assignmentRevision,assertTeacherSettingsAccess),/DRAFT_CONFLICT/);
});
test('revoked membership and foreign academy never regain access from imported data',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);f.rows.set('academyStudentMemberships/'+sid,{academyId:'other'});
 assert.deepEqual(await readDirectoryStudents(f.db,{...f.actor,admin:false,scopes:[{studentKey:sid,subject:'영어'}]}),[]);
 await assert.rejects(readStudentProfile(f.db,{...f.actor,admin:false,principal:true},sid,f.deny),/FORBIDDEN/);
});
test('unresolved mapping is held for review and cannot be approved/cut over',async()=>{
 const f=fixture();f.rows.delete('notionStudentMappings/'+hashStudentKey(sid));let r:any;do{r=await importDirectoryStep(f.db,f.actor,'students',f.notion);}while(r.continue);assert.equal(f.source('students',sid).issue,'STUDENT_IDENTITY_REVIEW');
 await assert.rejects(approveDirectory(f.db,f.actor,'students'),/DIRECTORY_REVIEW_REQUIRED/);assert.equal(f.rows.has(CORE_AUTHORITY+'/main'),false);
});
test('final cutover refuses missing class authority, preserving old paths until related kind is ready',async()=>{
 const f=fixture(),id='44444444-4444-4444-8444-444444444444';f.student.properties['소속반'].relation=[{id}];f.rows.set('teacherClasses/'+id,{academyId:'main',subject:'영어',students:[sid],name:'모의 반'});await f.setup();
 await assert.rejects(cutoverCore(f.db,f.actor),/CORE_CLASS_MIGRATION_REQUIRED/);assert.equal(f.rows.has(CORE_AUTHORITY+'/main'),false);
});
test('actual workspace actor uses signed account checks and Firestore scopes with all network access blocked',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const original=globalThis.fetch,admin=process.env.ADMIN_UID;process.env.ADMIN_UID='admin';let calls=0;
 globalThis.fetch=(async()=>{calls++;throw Error('NOTION_ACCESS_BLOCKED');}) as any;
 try{const req:any={headers:{authorization:'Bearer mock-signed-token'}},initialize:any=()=>({db:f.db,auth:{verifyIdToken:async(_token:string,revoked:boolean)=>{assert.equal(revoked,true);return {uid:'teacher'};}}});
  const actor=await teacherActor(req,initialize);assert.equal(actor.coreMode,true);assert.deepEqual(actor.scopes,[{studentKey:sid,subject:'영어'}]);assert.equal(calls,0);
  f.rows.set('academyStudentMemberships/'+sid,{academyId:'main',disabled:true});assert.deepEqual((await teacherActor(req,initialize)).scopes,[]);assert.equal(calls,0);
 }finally{globalThis.fetch=original;admin===undefined?delete process.env.ADMIN_UID:process.env.ADMIN_UID=admin;}
});
test('Notion blocked: enrollment option loader and existing report identity lookup use current Firestore values',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const options=await registrationAssignmentOptions(f.db,f.actor,f.deny);assert.equal(options.teachers[0].uid,'teacher');
 const old=await readStudentProfile(f.db,f.actor,sid,f.deny);await saveStudentProfile(f.db,f.actor,sid,randomUUID(),old.editedAt,{...old.data,displayName:'현재 이름',guardianPhone:'0'+'3'.repeat(10)},f.deny);
 const current=await lookupStudentIdentity(f.db as any,sid);assert.equal(current.studentDisplayName,'현재 이름');assert.equal(current.parentPhonePinHash,hashPin('3333'));
 // After the core cutover the whole enrollment source is app-authoritative (checked before the per-record guard).
 assert.deepEqual(await syncAcademicPage(f.db as any,f.enrollment,f.deny),{applied:false,reason:'APP_AUTHORITY',kind:'studentEnrollments'});
});
test('selective restore keeps account/report identity, advances app version, and replays without rotating PIN twice',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const r=await readStudentProfile(f.db,f.actor,sid,f.deny);await saveStudentProfile(f.db,f.actor,sid,randomUUID(),r.editedAt,{...r.data,displayName:'수정 이름',guardianPhone:'0'+'4'.repeat(10)},f.deny);
 const row=f.source('students',sid),input={id:sid,revision:row.revision,historyRevision:1,operationId:randomUUID(),confirmed:true};
 await restoreCoreProfile(f.db,f.actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);const current=f.source('students',sid);assert.equal(current.revision,row.revision+1);assert.equal((await readStudentProfile(f.db,f.actor,sid,f.deny)).data.displayName,'모의 학생');assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,6);
 await restoreCoreProfile(f.db,f.actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);assert.equal(f.rows.get('reportSlugs/stable-url').authVersion,6);assert.equal(f.rows.get('users/student-account').notionStudentKey,sid);
});
test('directory pagination and checkpoint replay never duplicates existing student identities',async()=>{
 const f=fixture(),pages=[];for(let n=1;n<=12;n++){const id=`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`,p=structuredClone(f.student);p.id=id;pages.push(p);f.rows.set('academyStudentMemberships/'+id,{academyId:'main',internalStudentId:'internal-'+n});f.rows.set('notionStudentMappings/'+hashStudentKey(id),{notionStudentPageId:id,internalStudentId:'internal-'+n,firebaseUid:null});}
 const notion:any=async(_path:string,_method:string,body:any)=>{const candidates=body.filter?[]:pages,start=body.start_cursor?Number(body.start_cursor):0;return {results:candidates.slice(start,start+10),has_more:start+10<candidates.length,next_cursor:start+10<candidates.length?String(start+10):null};};
 const first=await importDirectoryStep(f.db,f.actor,'students',notion);assert.equal(first.ready,false);assert.equal(first.counts.created,10);const second=await importDirectoryStep(f.db,f.actor,'students',notion);assert.equal(second.continue,true);await importDirectoryStep(f.db,f.actor,'students',notion);await approveDirectory(f.db,f.actor,'students');assert.equal((await readDirectoryStudents(f.db,f.actor)).length,12);
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('notionStudentMappings/')).length,13); // Original + 12 pre-existing mappings, no new accounts.
});
test('an account snapshot captured before assignment removal cannot restore stale permissions',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);const stale={...structuredClone(f.rows.get('teacherWorkspaceAccess/teacher')),uid:'teacher'};
 await saveCoreGrant(f.db,f.actor,{uid:'teacher',academyId:'main',workspaceRole:'teacher',notionTeacherPageId:tid,academyStudents:[],scopes:[]},stale.assignmentRevision,assertTeacherSettingsAccess);
 assert.deepEqual(await readCoreScopes(f.db,stale),[]);
 f.rows.set('teacherWorkspaceAccess/teacher',{...f.rows.get('teacherWorkspaceAccess/teacher'),disabled:true});await assert.rejects(readCoreScopes(f.db,stale),/TEACHER_NOT_CONFIGURED/);
});
test('cutover cannot silently omit an existing active academy member',async()=>{
 const f=fixture();await f.setup();f.rows.set('academyStudentMemberships/77777777-7777-4777-8777-777777777777',{academyId:'main',disabled:false});
 await assert.rejects(cutoverCore(f.db,f.actor),/CORE_LINK_REQUIRED/);assert.equal(f.rows.has(CORE_AUTHORITY+'/main'),false);
});

import {excludeDirectoryRow} from '../api/_lib/academyDirectorySource.js';
test('a test teacher page without an app account can be left out; approval and the switch then proceed, and later syncs keep it out',async()=>{
 const f=fixture(),testPage='44444444-4444-4444-8444-444444444444';
 f.pages.get(teacherDB)!.push({...structuredClone(f.teacher),id:testPage,properties:{...f.teacher.properties,'선생님':{type:'title',title:[{plain_text:'테스트'}]}}});
 for(const kind of ['students','teachers','enrollments'] as const){let r:any;do{r=await importDirectoryStep(f.db,f.actor,kind,f.notion);}while(r.continue);}
 assert.equal(f.source('teachers',testPage).issue,'TEACHER_LINK_REVIEW');
 await assert.rejects(approveDirectory(f.db,f.actor,'teachers'),/DIRECTORY_REVIEW_REQUIRED/);
 await assert.rejects(excludeDirectoryRow(f.db,f.actor,'teachers',tid),/DIRECTORY_REVIEW_REQUIRED/,'a linked row cannot be excluded');
 const r=await excludeDirectoryRow(f.db,f.actor,'teachers',testPage);assert.equal(r.excluded,true);
 const row=f.source('teachers',testPage);assert.equal(row.excluded,true);assert.equal(row.excludedIssue,'TEACHER_LINK_REVIEW');assert.equal(row.issue,null);
 assert.ok([...f.rows.values()].some((v:any)=>v.reason==='admin-excluded'));
 // A later sync leaves the excluded row as is.
 f.pages.get(teacherDB)!.find((p:any)=>p.id===testPage).last_edited_time=new Date().toISOString();
 let step:any;do{step=await importDirectoryStep(f.db,f.actor,'teachers',f.notion);}while(step.continue);
 assert.equal(f.source('teachers',testPage).excluded,true);
 for(const kind of ['students','teachers','enrollments'] as const)await approveDirectory(f.db,f.actor,kind);
 const done=await cutoverCore(f.db,f.actor);assert.equal(done.active,true);
});

import {setCoreTeacherAccess} from '../api/_lib/academyCore.js';
test('after the switch the admin registers a new teacher without a Notion page, assigns students, and can stop and resume access',async()=>{
 const f=fixture();await f.setup();await cutoverCore(f.db,f.actor);
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
