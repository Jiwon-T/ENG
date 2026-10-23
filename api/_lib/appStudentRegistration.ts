import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {assertIntakeAccess,studentRegistrationSchema,studentRegistrationTitle} from './teacherStudentRegistration.js';
import {registrationStudentProperties,registrationEnrollmentProperties} from './studentRegistrationRows.js';
import {DIRECTORY_ROWS,DIRECTORY_HISTORY,directoryRowKey,directorySourceKey} from './academyDirectorySource.js';
import {hashStudentKey,generateInternalStudentId} from './security.js';
import {writeAssignmentStart} from './assignmentStarts.js';
const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Finalize one saved new-student intake. No account creation.
 *  `mode` 'trial' (시범 수업): a 상담 intake goes on the roster as '시범' — each subject 대기 with its 담당 선생님, no 반, no
 *  수강료 — so a lesson or a 일정 can name the student; the intake stays a 상담. 등록 확정 later continues that same student
 *  (same key, so the 시범 lessons and their points stay theirs). */
export async function commitAppStudentRegistration(db:any,actor:any,idInput:unknown,revisionInput:unknown,mode:'enroll'|'trial'='enroll'){
 assertIntakeAccess(actor);if(actor.academyId!=='main')throw Error('FORBIDDEN');
 const id=z.string().regex(/^[a-f0-9]{64}$/).parse(idInput),revision=z.number().int().positive().parse(revisionInput),ref=db.collection('teacherStudentRegistrations').doc(id);
 let studentKey=randomUUID(),enrollmentId=randomUUID(),internalStudentId=generateInternalStudentId('app:main:'+studentKey);
 return db.runTransaction(async(tx:any)=>{
  const authority=(await tx.get(db.collection('academyCoreAuthority').doc('main'))).data(),classesAuthority=(await tx.get(db.collection('academyClassAuthority').doc('main'))).data();
  if(!authority?.active||!classesAuthority?.active)throw Error('CORE_NOT_READY');
  const current=(await tx.get(ref)).data();if(!current)throw Error('REGISTRATION_NOT_FOUND');assertIntakeAccess(actor,current);
  if(current.revision!==revision)throw Error('REGISTRATION_CONFLICT');
  if(current.sourceMode==='firestore'&&current.studentKey&&current.syncStatus==='synced')return {id,revision,syncStatus:'synced',studentKey:current.studentKey,sourceMode:'firestore',alreadySynced:true};
  if(current.notionStudentPageId||current.studentCreateAttempted||current.enrollmentCreateAttempted||current.syncLeaseUntil>Date.now()||['syncing','uncertain','synced'].includes(current.syncStatus))throw Error('REGISTRATION_SOURCE_CONFLICT');
  const parsed=studentRegistrationSchema.parse(current.data),trial=mode==='trial',continued=!trial&&Boolean(current.trialStudentKey);
  if(trial){
   if(current.trialStudentKey)throw Error('REGISTRATION_TRIAL_EXISTS');
   if(parsed.purpose!=='new'||parsed.intakeStage!=='consultation')throw Error('REGISTRATION_TRIAL_CONSULTATION_ONLY');
   if(parsed.enrollments.some(e=>!e.teacherUid))throw Error('REGISTRATION_TRIAL_TEACHER_REQUIRED');
  }else if(parsed.purpose!=='new'||parsed.intakeStage==='consultation')throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
  // 시범: every subject 대기 (no 반) — 등록 확정 then sets the real ones
  const value=trial?{...parsed,enrollments:parsed.enrollments.map(e=>({...e,status:'대기' as const,classIds:[],endDate:null}))}:parsed;
  // 등록 after a 시범: the same student continues
  if(continued){studentKey=current.trialStudentKey;enrollmentId=current.trialEnrollmentId;internalStudentId=current.trialInternalStudentId;}
  const teacherIds:Record<string,string>={},teacherUpdates=new Map<string,any>(),classUpdates=new Map<string,any>(),starts:{uid:string;subject:string;since:string}[]=[];
  for(const enrollment of value.enrollments){
   let teacherUid=enrollment.teacherUid;
   if(teacherUid){
    let pr=db.collection('teacherWorkspaceAccess').doc(teacherUid),profile=(await tx.get(pr)).data();
    // A draft saved before an offline teacher was linked to their account names the offline record: use the account.
    if(profile?.offline&&profile.linkedUid){teacherUid=profile.linkedUid;pr=db.collection('teacherWorkspaceAccess').doc(teacherUid);profile=(await tx.get(pr)).data();}
    const user=(await tx.get(db.collection('users').doc(teacherUid))).data();
    if(!profile||profile.disabled||profile.academyId!=='main'||!profile.notionTeacherPageId||teacherUid!==process.env.ADMIN_UID&&!profile.offline&&!['teacher','principal'].includes(user?.role))throw Error('INVALID_TEACHER');
    const teacher=(await tx.get(db.collection(DIRECTORY_ROWS).doc(directoryRowKey('teachers',profile.notionTeacherPageId)))).data(),p=teacher?.fields?.properties;
    if(!teacher||teacher.academyId!=='main'||teacher.fields.archived||teacher.issue||teacher.pointer?.teacherUid!==teacherUid||(p['상태']?.select?.name||p['상태']?.status?.name)!=='재직'||!(p['담당 과목']?.multi_select||[]).some((s:any)=>s.name===enrollment.subject))throw Error('INVALID_TEACHER');
    teacherIds[enrollment.subject]=profile.notionTeacherPageId;
    const previous=teacherUpdates.get(teacherUid)?.profile||profile,had=(previous.scopes||[]).some((s:any)=>s.studentKey===studentKey&&s.subject===enrollment.subject);
    if(!had){const scopes=[...(previous.scopes||[]),{studentKey,subject:enrollment.subject}];teacherUpdates.set(teacherUid,{ref:pr,profile:{...previous,scopes}});starts.push({uid:teacherUid,subject:enrollment.subject,since:enrollment.startDate});}
   }
   for(const classId of enrollment.classIds){
    let found=await tx.get(db.collection('teacherClasses').doc(classId));if(!found.exists){const result=await tx.get(db.collection('teacherClasses').where('notionPageId','==',classId).limit(2));if(result.docs.length!==1)throw Error('CORE_CLASS_MIGRATION_REQUIRED');found=result.docs[0];}
    const klass=found.data();if(klass.academyId!=='main'||klass.archived||klass.status!=='진행 중'||klass.subject!==enrollment.subject||klass.sourceMode!=='firestore'||!(klass.teacherUids||[klass.ownerUid]).includes(teacherUid))throw Error('FORBIDDEN');
    classUpdates.set(found.ref.id,{ref:found.ref,row:klass});
   }
  }
  const sr=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',studentKey)),er=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('enrollments',enrollmentId)),mr=db.collection('notionStudentMappings').doc(hashStudentKey(studentKey)),member=db.collection('academyStudentMemberships').doc(studentKey),projected=db.collection('studentEnrollments').doc(enrollmentId);
  const [oldStudent,oldEnrollment,oldMapping]=await Promise.all([sr,er,mr].map(t=>tx.get(t)));
  if(continued){if(!oldStudent.exists||!oldEnrollment.exists||!oldMapping.exists)throw Error('REGISTRATION_TRIAL_LINK_BROKEN');}
  else for(const target of [sr,er,mr,member,projected])if((await tx.get(target)).exists)throw Error('REGISTRATION_ID_CONFLICT');
  const at=Date.now(),stamp=new Date(at).toISOString(),classIds=[...new Set(value.enrollments.flatMap(e=>e.classIds))],title=studentRegistrationTitle(value),pointer={internalStudentId,mappingId:mr.id};
  const make=(kind:'students'|'enrollments',entityId:string,properties:any,old:any)=>{const fields={archived:false,in_trash:false,properties},revision=(old?.revision||0)+1;return {academyId:'main',kind,sourceKey:directorySourceKey(kind),entityId,studentKey,origin:'app',sourceMode:'firestore',notionPageId:null,databaseId:null,fields,hash:digest(fields),revision,appEditedAt:stamp,remoteEditedAt:null,updatedAt:at,pointer,issue:null};};
  // 시범: on the roster as '시범' (not 등록·대기), marked so; 등록 확정 later writes the real 등록상태
  const studentProps:any=registrationStudentProperties(id,value,classIds);if(trial){studentProps['등록상태']={status:{name:'시범'}};studentProps['시범 수업']={checkbox:true};}else if(continued)studentProps['시범 수업']={checkbox:true};
  const student=make('students',studentKey,studentProps,oldStudent.data()),enrollment=make('enrollments',enrollmentId,registrationEnrollmentProperties(id,value,studentKey,teacherIds),oldEnrollment.data());
  tx.set(sr,student);tx.set(er,enrollment);
  for(const [target,row,old] of [[sr,student,oldStudent.data()],[er,enrollment,oldEnrollment.data()]] as any[])tx.set(db.collection(DIRECTORY_HISTORY).doc(target.id+':'+row.revision),{sourceKey:row.sourceKey,entityId:row.entityId,notionPageId:null,revision:row.revision,before:old?.fields||null,after:row.fields,pointer,by:actor.uid,at,reason:trial?'app-trial':continued?'app-registration-after-trial':'app-registration'});
  // the mapping keeps any app account linked meanwhile
  tx.set(mr,continued?{...oldMapping.data(),studentDisplayName:title,updatedAt:stamp}:{internalStudentId,studentKey,studentDisplayName:title,notionStudentPageId:null,origin:'app',sourceMode:'firestore',firebaseUid:null,createdAt:stamp,updatedAt:stamp});
  // Per-subject 8-session prices for the tuition sheet; 수강료 on the student stays the total.
  const subjectTuition=Object.fromEntries(value.enrollments.filter(e=>typeof e.tuition==='number').map(e=>[e.subject,e.tuition]));
  if(!trial&&Object.keys(subjectTuition).length)tx.set(db.collection('studentTuition').doc(studentKey),{academyId:'main',studentKey,subjects:subjectTuition,updatedAt:at,updatedBy:actor.uid,source:'registration'});
  tx.set(member,{academyId:'main',studentKey,internalStudentId,disabled:false,origin:'app',sourceMode:'firestore',createdAt:at,updatedAt:at},{merge:true});
  tx.set(projected,{internalStudentId,studentKey,sourceUpdatedAt:stamp,removed:false,subjects:value.enrollments.map(e=>({subject:e.subject,status:e.status,startAt:e.startDate,endAt:e.endDate,campus:e.campus||null})),appSource:'firestore',notionPageId:null});
  for(const update of teacherUpdates.values())tx.set(update.ref,{...update.profile,assignmentRevision:(update.profile.assignmentRevision||0)+1,assignmentSource:'firestore'});
  for(const s of starts)writeAssignmentStart(tx,db,{...s,studentKey,by:actor.uid,at,source:'registration'}); // 담당 시작일 = 과목 시작일
  for(const update of classUpdates.values()){const next={...update.row,students:[...new Set([...(update.row.students||[]),studentKey])],revision:(update.row.revision||0)+1,updatedAt:at};tx.set(update.ref,next);tx.set(db.collection('academyManagedHistory').doc(`teacherClasses:${update.ref.id}:${next.revision}`),{before:update.row,after:next,by:actor.uid,at,reason:'app-registration'});}
  if(trial){tx.set(ref,{...current,trialStudentKey:studentKey,trialEnrollmentId:enrollmentId,trialInternalStudentId:internalStudentId,trialAt:at,trialEndedAt:null,updatedAt:at});return {id,revision,syncStatus:current.syncStatus,trialStudentKey:studentKey,sourceMode:'firestore',trial:true};}
  tx.set(ref,{...current,studentKey,appEnrollmentId:enrollmentId,internalStudentId,sourceMode:'firestore',notionStudentPageId:null,studentSaved:true,enrollmentSaved:true,syncStatus:'synced',syncError:null,updatedAt:at});
  return {id,revision,syncStatus:'synced',studentKey,sourceMode:'firestore',alreadySynced:false};
 });
}
/** 시범 끝 (등록 안 함): the 시범 student leaves the roster — 중단, no 담당 선생님 scope, the membership off — and the intake
 *  stays a 상담 (등록 확정 later still continues the same student, with the 시범 lessons). */
export async function endTrialRegistration(db:any,actor:any,idInput:unknown,revisionInput:unknown){
 assertIntakeAccess(actor);if(actor.academyId!=='main')throw Error('FORBIDDEN');
 const id=z.string().regex(/^[a-f0-9]{64}$/).parse(idInput),revision=z.number().int().positive().parse(revisionInput),ref=db.collection('teacherStudentRegistrations').doc(id);
 return db.runTransaction(async(tx:any)=>{
  const current=(await tx.get(ref)).data();if(!current)throw Error('REGISTRATION_NOT_FOUND');assertIntakeAccess(actor,current);
  if(current.revision!==revision)throw Error('REGISTRATION_CONFLICT');
  if(!current.trialStudentKey||current.trialEndedAt||current.syncStatus==='synced')throw Error('REGISTRATION_TRIAL_NOT_ACTIVE');
  const key=current.trialStudentKey,value=studentRegistrationSchema.parse(current.data),sr=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key)),member=db.collection('academyStudentMemberships').doc(key);
  // the 담당 선생님 of each subject (an offline record's linked account, as at 등록)
  const profiles=await Promise.all([...new Set(value.enrollments.map(e=>e.teacherUid).filter(Boolean) as string[])].map(async uid=>{let pr=db.collection('teacherWorkspaceAccess').doc(uid),p=(await tx.get(pr)).data();if(p?.offline&&p.linkedUid){pr=db.collection('teacherWorkspaceAccess').doc(p.linkedUid);p=(await tx.get(pr)).data();}return {pr,p};}));
  const old=(await tx.get(sr)).data();if(!old)throw Error('REGISTRATION_TRIAL_LINK_BROKEN');
  const at=Date.now(),stamp=new Date(at).toISOString(),fields={...old.fields,properties:{...old.fields.properties,'등록상태':{status:{name:'중단'}}}},next={...old,fields,hash:digest(fields),revision:(old.revision||0)+1,appEditedAt:stamp,updatedAt:at};
  tx.set(sr,next);tx.set(db.collection(DIRECTORY_HISTORY).doc(sr.id+':'+next.revision),{sourceKey:old.sourceKey,entityId:old.entityId,notionPageId:null,revision:next.revision,before:old.fields,after:fields,pointer:old.pointer,by:actor.uid,at,reason:'app-trial-end'});
  tx.set(member,{disabled:true,updatedAt:at},{merge:true});
  for(const {pr,p} of profiles)if(p&&(p.scopes||[]).some((s:any)=>s.studentKey===key))tx.set(pr,{...p,scopes:p.scopes.filter((s:any)=>s.studentKey!==key),assignmentRevision:(p.assignmentRevision||0)+1,assignmentSource:'firestore'});
  tx.set(ref,{...current,trialEndedAt:at,updatedAt:at});
  return {id,revision,trialEnded:true};
 });
}
