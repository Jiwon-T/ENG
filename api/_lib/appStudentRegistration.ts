import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {assertRegistrationAccess,studentRegistrationSchema,studentRegistrationTitle} from './teacherStudentRegistration.js';
import {registrationStudentProperties,registrationEnrollmentProperties} from './teacherStudentRegistrationNotion.js';
import {DIRECTORY_ROWS,DIRECTORY_HISTORY,directoryRowKey,directorySourceKey} from './academyDirectorySource.js';
import {hashStudentKey,generateInternalStudentId} from './security.js';
const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Finalize one saved new-student intake. No Notion dependency or account creation. */
export async function commitAppStudentRegistration(db:any,actor:any,idInput:unknown,revisionInput:unknown){
 assertRegistrationAccess(actor);if(actor.academyId!=='main')throw Error('FORBIDDEN');
 const id=z.string().regex(/^[a-f0-9]{64}$/).parse(idInput),revision=z.number().int().positive().parse(revisionInput),studentKey=randomUUID(),enrollmentId=randomUUID(),internalStudentId=generateInternalStudentId('app:main:'+studentKey),ref=db.collection('teacherStudentRegistrations').doc(id);
 return db.runTransaction(async(tx:any)=>{
  const authority=(await tx.get(db.collection('academyCoreAuthority').doc('main'))).data(),classesAuthority=(await tx.get(db.collection('academyClassAuthority').doc('main'))).data();
  if(!authority?.active||!classesAuthority?.active)throw Error('CORE_NOT_READY');
  const current=(await tx.get(ref)).data();if(!current)throw Error('REGISTRATION_NOT_FOUND');assertRegistrationAccess(actor,current);
  if(current.revision!==revision)throw Error('REGISTRATION_CONFLICT');
  if(current.sourceMode==='firestore'&&current.studentKey&&current.syncStatus==='synced')return {id,revision,syncStatus:'synced',studentKey:current.studentKey,sourceMode:'firestore',alreadySynced:true};
  if(current.notionStudentPageId||current.studentCreateAttempted||current.enrollmentCreateAttempted||current.syncLeaseUntil>Date.now()||['syncing','uncertain','synced'].includes(current.syncStatus))throw Error('REGISTRATION_SOURCE_CONFLICT');
  const value=studentRegistrationSchema.parse(current.data);if(value.purpose!=='new'||value.intakeStage==='consultation')throw Error('REGISTRATION_ENROLLMENT_REQUIRED');
  const teacherIds:Record<string,string>={},teacherUpdates=new Map<string,any>(),classUpdates=new Map<string,any>();
  for(const enrollment of value.enrollments){
   if(enrollment.teacherUid){
    const pr=db.collection('teacherWorkspaceAccess').doc(enrollment.teacherUid),profile=(await tx.get(pr)).data(),user=(await tx.get(db.collection('users').doc(enrollment.teacherUid))).data();
    if(!profile||profile.disabled||profile.academyId!=='main'||!profile.notionTeacherPageId||enrollment.teacherUid!==process.env.ADMIN_UID&&!['teacher','principal'].includes(user?.role))throw Error('INVALID_TEACHER');
    const teacher=(await tx.get(db.collection(DIRECTORY_ROWS).doc(directoryRowKey('teachers',profile.notionTeacherPageId)))).data(),p=teacher?.fields?.properties;
    if(!teacher||teacher.academyId!=='main'||teacher.fields.archived||teacher.issue||teacher.pointer?.teacherUid!==enrollment.teacherUid||(p['상태']?.select?.name||p['상태']?.status?.name)!=='재직'||!(p['담당 과목']?.multi_select||[]).some((s:any)=>s.name===enrollment.subject))throw Error('INVALID_TEACHER');
    teacherIds[enrollment.subject]=profile.notionTeacherPageId;
    const previous=teacherUpdates.get(enrollment.teacherUid)?.profile||profile,scopes=[...(previous.scopes||[]),{studentKey,subject:enrollment.subject}];teacherUpdates.set(enrollment.teacherUid,{ref:pr,profile:{...previous,scopes}});
   }
   for(const classId of enrollment.classIds){
    let found=await tx.get(db.collection('teacherClasses').doc(classId));if(!found.exists){const result=await tx.get(db.collection('teacherClasses').where('notionPageId','==',classId).limit(2));if(result.docs.length!==1)throw Error('CORE_CLASS_MIGRATION_REQUIRED');found=result.docs[0];}
    const klass=found.data();if(klass.academyId!=='main'||klass.archived||klass.status!=='진행 중'||klass.subject!==enrollment.subject||klass.sourceMode!=='firestore'||!(klass.teacherUids||[klass.ownerUid]).includes(enrollment.teacherUid))throw Error('FORBIDDEN');
    classUpdates.set(found.ref.id,{ref:found.ref,row:klass});
   }
  }
  const sr=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',studentKey)),er=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('enrollments',enrollmentId)),mr=db.collection('notionStudentMappings').doc(hashStudentKey(studentKey)),member=db.collection('academyStudentMemberships').doc(studentKey),projected=db.collection('studentEnrollments').doc(enrollmentId);
  for(const target of [sr,er,mr,member,projected])if((await tx.get(target)).exists)throw Error('REGISTRATION_ID_CONFLICT');
  const at=Date.now(),stamp=new Date(at).toISOString(),classIds=[...new Set(value.enrollments.flatMap(e=>e.classIds))],title=studentRegistrationTitle(value),pointer={internalStudentId,mappingId:mr.id};
  const make=(kind:'students'|'enrollments',entityId:string,properties:any)=>{const fields={archived:false,in_trash:false,properties};return {academyId:'main',kind,sourceKey:directorySourceKey(kind),entityId,studentKey,origin:'app',sourceMode:'firestore',notionPageId:null,databaseId:null,fields,hash:digest(fields),revision:1,appEditedAt:stamp,remoteEditedAt:null,updatedAt:at,pointer,issue:null};};
  const student=make('students',studentKey,registrationStudentProperties(id,value,classIds)),enrollment=make('enrollments',enrollmentId,registrationEnrollmentProperties(id,value,studentKey,teacherIds));
  tx.set(sr,student);tx.set(er,enrollment);
  for(const [target,row] of [[sr,student],[er,enrollment]])tx.set(db.collection(DIRECTORY_HISTORY).doc(target.id+':1'),{sourceKey:row.sourceKey,entityId:row.entityId,notionPageId:null,revision:1,before:null,after:row.fields,pointer,by:actor.uid,at,reason:'app-registration'});
  tx.set(mr,{internalStudentId,studentKey,studentDisplayName:title,notionStudentPageId:null,origin:'app',sourceMode:'firestore',firebaseUid:null,createdAt:stamp,updatedAt:stamp});
  // Per-subject 8-session prices for the tuition sheet; 수강료 on the student stays the total.
  const subjectTuition=Object.fromEntries(value.enrollments.filter(e=>typeof e.tuition==='number').map(e=>[e.subject,e.tuition]));
  if(Object.keys(subjectTuition).length)tx.set(db.collection('studentTuition').doc(studentKey),{academyId:'main',studentKey,subjects:subjectTuition,updatedAt:at,updatedBy:actor.uid,source:'registration'});
  tx.set(member,{academyId:'main',studentKey,internalStudentId,disabled:false,origin:'app',sourceMode:'firestore',createdAt:at,updatedAt:at});
  tx.set(projected,{internalStudentId,studentKey,sourceUpdatedAt:stamp,removed:false,subjects:value.enrollments.map(e=>({subject:e.subject,status:e.status,startAt:e.startDate,endAt:e.endDate})),appSource:'firestore',notionPageId:null});
  for(const update of teacherUpdates.values())tx.set(update.ref,{...update.profile,assignmentRevision:(update.profile.assignmentRevision||0)+1,assignmentSource:'firestore'});
  for(const update of classUpdates.values()){const next={...update.row,students:[...new Set([...(update.row.students||[]),studentKey])],revision:(update.row.revision||0)+1,updatedAt:at};tx.set(update.ref,next);tx.set(db.collection('academyManagedHistory').doc(`teacherClasses:${update.ref.id}:${next.revision}`),{before:update.row,after:next,by:actor.uid,at,reason:'app-registration'});}
  tx.set(ref,{...current,studentKey,appEnrollmentId:enrollmentId,internalStudentId,sourceMode:'firestore',notionStudentPageId:null,studentSaved:true,enrollmentSaved:true,syncStatus:'synced',syncError:null,updatedAt:at});
  return {id,revision,syncStatus:'synced',studentKey,sourceMode:'firestore',alreadySynced:false};
 });
}
