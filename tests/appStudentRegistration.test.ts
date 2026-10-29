import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
import {STUDENT_SOURCE_ID} from '../api/_lib/studentRegistrationRows.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {templateFirestore} from './helpers/templateFirestore.js';
import {commitAppStudentRegistration,endTrialRegistration} from '../api/_lib/appStudentRegistration.js';
import {saveStudentRegistration,convertRegistrationToResident} from '../api/_lib/teacherStudentRegistration.js';
import {emptyRegistration} from '../src/lib/studentRegistration.js';
import {directoryRowKey,directorySourceKey,readDirectoryStudents} from '../api/_lib/academyDirectorySource.js';
import {readCoreProfile,readCoreEnrollment,saveCoreProfile,readCoreAdmission,saveCoreAdmission} from '../api/_lib/academyCore.js';
import {profileFromPage,profileProperties,studentProfileSchema} from '../api/_lib/teacherStudentProfile.js';
import {readStudentMapping,lookupStudentIdentity} from '../api/_lib/studentIdentity.js';
import {hashStudentKey} from '../api/_lib/security.js';
process.env.PHONE_PIN_PEPPER='p'.repeat(64);
const teacher='teacher',teacherId='22222222-2222-4222-8222-222222222222',klassId='33333333-3333-4333-8333-333333333333';
async function fixture(){const f=templateFirestore(),actor={uid:'admin',admin:true,academyId:'main',coreMode:true};f.rows.set('academyCoreAuthority/main',{active:true});f.rows.set('academyClassAuthority/main',{active:true});f.rows.set('academyDirectorySync/'+directorySourceKey('students'),{ready:true,approved:true,runVersion:1});f.rows.set('users/'+teacher,{role:'teacher'});f.rows.set('teacherWorkspaceAccess/'+teacher,{academyId:'main',workspaceRole:'teacher',notionTeacherPageId:teacherId,scopes:[{studentKey:'44444444-4444-4444-8444-444444444444',subject:'영어'}]});f.rows.set('academyDirectorySources/'+directoryRowKey('teachers',teacherId),{kind:'teachers',academyId:'main',fields:{archived:false,properties:{'상태':{select:{name:'재직'}},'담당 과목':{multi_select:[{name:'영어'}]}}},pointer:{teacherUid:teacher}});f.rows.set('teacherClasses/'+klassId,{academyId:'main',subject:'영어',ownerUid:teacher,teacherUids:[teacher],students:['44444444-4444-4444-8444-444444444444'],status:'진행 중',sourceMode:'firestore',revision:1});f.rows.set('reportSlugs/existing',{internalStudentId:'stable-existing',parentPhonePinHash:'keep',authVersion:4});const input={...emptyRegistration(),name:'모의 신규 학생',guardianPhone:'01012345678',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-08',endDate:null,teacherUid:teacher,classIds:[klassId]}]};const saved=await saveStudentRegistration(f.db,actor,input,randomUUID(),undefined,randomUUID());return {...f,actor,input,saved};}
test('app registration atomically creates native identities, directory, enrollment, class and scopes; retries preserve IDs',async()=>{const f=await fixture(),before=structuredClone(f.rows.get('reportSlugs/existing'));const [a,b]=await Promise.all([commitAppStudentRegistration(f.db,f.actor,f.saved.id,1),commitAppStudentRegistration(f.db,f.actor,f.saved.id,1)]);assert.equal(a.studentKey,b.studentKey);assert.equal(b.alreadySynced,true);assert.equal([...f.rows.keys()].filter(k=>k.startsWith('notionStudentMappings/')).length,1);const mapping=await readStudentMapping(f.db as any,a.studentKey);assert.equal(mapping?.notionStudentPageId,null);assert.equal(mapping?.origin,'app');assert.equal(mapping?.firebaseUid,null);assert.equal(f.rows.get('teacherClasses/'+klassId).students.length,2);assert.equal(f.rows.get('teacherWorkspaceAccess/'+teacher).scopes.length,2);assert.deepEqual(f.rows.get('reportSlugs/existing'),before);const students=await readDirectoryStudents(f.db,f.actor);assert.equal(students[0].studentKey,a.studentKey);const p=await readCoreProfile(f.db,f.actor,a.studentKey,profileFromPage);assert.equal(p.data.displayName,'모의 신규 학생');const e=await readCoreEnrollment(f.db,f.actor,a.studentKey);assert.equal(e.subjects[0].status,'등록');const identity=await lookupStudentIdentity(f.db as any,a.studentKey);assert.equal(identity.studentKey,a.studentKey);assert.equal(identity.notionStudentPageId,null);await convertRegistrationToResident(f.db,f.actor,f.saved.id,1);assert.ok(f.rows.get('teacherStudentRegistrations/'+f.saved.id).residentAt);});
test('failed commit writes none of the live connections and retry creates only one student',async()=>{const f=await fixture(),before=structuredClone([...f.rows]);f.failNextCommit();await assert.rejects(commitAppStudentRegistration(f.db,f.actor,f.saved.id,1),/FIRESTORE_UNAVAILABLE/);assert.deepEqual([...f.rows],before);await commitAppStudentRegistration(f.db,f.actor,f.saved.id,1);assert.equal([...f.rows.keys()].filter(k=>k.startsWith('notionStudentMappings/')).length,1);});
test('revoked teacher, foreign class, stale intake, missing cutover, foreign actor and uncertain Notion work fail closed',async()=>{for(const change of ['teacher','class','revision','authority','actor','uncertain']){const f=await fixture();if(change==='teacher')f.rows.get('teacherWorkspaceAccess/'+teacher).disabled=true;if(change==='class')f.rows.get('teacherClasses/'+klassId).academyId='other';if(change==='authority')f.rows.get('academyClassAuthority/main').active=false;if(change==='uncertain')f.rows.get('teacherStudentRegistrations/'+f.saved.id).syncStatus='uncertain';const before=structuredClone([...f.rows]);await assert.rejects(commitAppStudentRegistration(f.db,change==='actor'?{...f.actor,admin:false,uid:'another-teacher'}:f.actor,f.saved.id,change==='revision'?2:1));assert.deepEqual([...f.rows],before);}});
test('new app profile edits preserve app provenance and existing URLs/PINs, and inactive core never falls back to Notion',async()=>{const f=await fixture(),r=await commitAppStudentRegistration(f.db,f.actor,f.saved.id,1),before=structuredClone(f.rows.get('reportSlugs/existing')),profile=await readCoreProfile(f.db,f.actor,r.studentKey,profileFromPage);await saveCoreProfile(f.db,f.actor,r.studentKey,randomUUID(),profile.editedAt,{...profile.data,school:'모의학교'},v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);const mapping=await readStudentMapping(f.db as any,r.studentKey);assert.equal(mapping?.origin,'app');assert.equal(mapping?.notionStudentPageId,null);assert.deepEqual(f.rows.get('reportSlugs/existing'),before);f.rows.set('academyCoreAuthority/main',{active:false});await assert.rejects(lookupStudentIdentity(f.db as any,r.studentKey),/CORE_NOT_READY/);});



test('registration transition errors have bounded recovery messages without raw server details',()=>{for(const code of ['CORE_REGISTRATION_IN_PROGRESS','REGISTRATION_SOURCE_CONFLICT','REGISTRATION_ID_CONFLICT']){const result=workspaceError(Error(code),'student-registration-sync');assert.equal(result.body.error,code);assert.equal(result.status,409);assert.ok(result.body.message);assert.ok(!result.body.message.includes('undefined'));}});
test('학원 등록일: the 원서 date is saved on the student (today by default), and 학생 정보 offers the earliest 과목 시작일',async()=>{const f=await fixture();assert.match(String(f.input.academyStartDate),/^\d{4}-\d{2}-\d{2}$/,'today by default');const r=await commitAppStudentRegistration(f.db,f.actor,f.saved.id,1);const p=await readCoreProfile(f.db,f.actor,r.studentKey,profileFromPage);assert.equal(p.data.academyStartDate,f.input.academyStartDate);assert.equal((p as any).firstSubjectStart,'2026-10-08');const {startId}=await import('../api/_lib/assignmentStarts.js');assert.equal(f.rows.get('teacherAssignmentStarts/'+startId(teacher,r.studentKey,'영어'))?.since,'2026-10-08','the 원서 teacher starts on the 과목 시작일');});

test("시범 수업: saving the 상담 원서 again keeps the 시범 student linked",async()=>{
 const f=await fixture(),request=randomUUID(),consult=await saveStudentRegistration(f.db,f.actor,{...f.input,intakeStage:'consultation'},request,undefined,randomUUID()),regPath='teacherStudentRegistrations/'+consult.id;
 const t=await commitAppStudentRegistration(f.db,f.actor,consult.id,1,'trial') as any;
 await saveStudentRegistration(f.db,f.actor,{...f.input,intakeStage:'consultation',school:'바뀐고'},request,1,randomUUID());
 const reg=f.rows.get(regPath);assert.equal(reg.revision,2);assert.equal(reg.trialStudentKey,t.trialStudentKey);assert.ok(reg.trialEnrollmentId&&reg.trialInternalStudentId);
 await assert.rejects(commitAppStudentRegistration(f.db,f.actor,consult.id,2,'trial'),/REGISTRATION_TRIAL_EXISTS/,'no second 시범 student');
});
test('시범 수업: a 상담 intake goes on the roster as 시범 (대기, 담당 scope, no 반 or 수강료), ends without 등록, and 등록 확정 later continues the same student',async()=>{
 const f=await fixture(),consult=await saveStudentRegistration(f.db,f.actor,{...f.input,intakeStage:'consultation'},randomUUID(),undefined,randomUUID()),regPath='teacherStudentRegistrations/'+consult.id;
 await assert.rejects(commitAppStudentRegistration(f.db,f.actor,consult.id,1),/REGISTRATION_ENROLLMENT_REQUIRED/,'a 상담 is not 등록 확정');
 const t=await commitAppStudentRegistration(f.db,f.actor,consult.id,1,'trial') as any,key=t.trialStudentKey;
 const row=()=>f.rows.get('academyDirectorySources/'+directoryRowKey('students',key)),scoped=()=>(f.rows.get('teacherWorkspaceAccess/'+teacher).scopes||[]).some((s:any)=>s.studentKey===key);
 assert.equal(row().fields.properties['등록상태'].status.name,'시범');assert.equal(row().fields.properties['시범 수업'].checkbox,true);
 assert.equal(f.rows.get('academyStudentMemberships/'+key).disabled,false);assert.ok(scoped(),'the 담당 선생님 can pick the student');
 assert.ok(!f.rows.get('teacherClasses/'+klassId).students.includes(key),'no 반');assert.equal(f.rows.get('studentTuition/'+key),undefined,'no 수강료');
 assert.equal(f.rows.get(regPath).data.intakeStage,'consultation');assert.notEqual(f.rows.get(regPath).syncStatus,'synced');
 await assert.rejects(commitAppStudentRegistration(f.db,f.actor,consult.id,1,'trial'),/REGISTRATION_TRIAL_EXISTS/);
 await endTrialRegistration(f.db,f.actor,consult.id,1);
 assert.equal(row().fields.properties['등록상태'].status.name,'중단');assert.equal(f.rows.get('academyStudentMemberships/'+key).disabled,true);assert.ok(!scoped(),'out of the teacher list');
 await assert.rejects(endTrialRegistration(f.db,f.actor,consult.id,1),/REGISTRATION_TRIAL_NOT_ACTIVE/);
 // the family comes back: the intake becomes an 등록 원서 and 등록 확정 continues the same student
 f.rows.set(regPath,{...f.rows.get(regPath),data:{...f.rows.get(regPath).data,intakeStage:'new'}});
 const r=await commitAppStudentRegistration(f.db,f.actor,consult.id,1) as any;
 assert.equal(r.studentKey,key,'the same student (the 시범 lessons stay theirs)');
 assert.equal(row().fields.properties['등록상태'].status.name,'등록');assert.equal(f.rows.get('academyStudentMemberships/'+key).disabled,false);assert.ok(scoped());
 assert.ok(f.rows.get('teacherClasses/'+klassId).students.includes(key),'the 반 now');
 assert.equal((f.rows.get('teacherWorkspaceAccess/'+teacher).scopes||[]).filter((s:any)=>s.studentKey===key).length,1,'one scope');
});
test('원서 수정 after 등록: the teacher who wrote (or co-writes) the 원서 reads and saves the student’s 입학·상담 정보 through it; others not',async()=>{
 const f=await fixture(),r=await commitAppStudentRegistration(f.db,f.actor,f.saved.id,1) as any,regPath='teacherStudentRegistrations/'+f.saved.id,key=r.studentKey;
 f.rows.set(regPath,{...f.rows.get(regPath),ownerUid:teacher,coWriters:['co']});
 const t={uid:teacher,admin:false,principal:false,academyId:'main',coreMode:true};
 await assert.rejects(readCoreAdmission(f.db,t,key),/FORBIDDEN/,'without the 원서: 원장님·관리자 only');
 const read=await readCoreAdmission(f.db,t,key,f.saved.id) as any;
 const saved=await saveCoreAdmission(f.db,t,key,randomUUID(),read.editedAt,read.data,f.saved.id) as any;assert.equal(saved.studentKey,key);
 assert.ok(await readCoreAdmission(f.db,{...t,uid:'co'},key,f.saved.id),'a co-writer too');
 await assert.rejects(readCoreAdmission(f.db,{...t,uid:'other'},key,f.saved.id),/FORBIDDEN/,'another teacher');
 await assert.rejects(readCoreAdmission(f.db,t,'55555555-5555-4555-8555-555555555555',f.saved.id),/FORBIDDEN/,'another student');
 f.rows.set(regPath,{...f.rows.get(regPath),syncStatus:'pending'});
 await assert.rejects(readCoreAdmission(f.db,t,key,f.saved.id),/FORBIDDEN/,'a 원서 not registered');
 assert.ok(await readCoreAdmission(f.db,f.actor,key),'the admin as before');
});
