// Teachers without an app account (가입 전, or keeping logs in Excel): the principal and admin add them so they can
// be assigned students and counted in 정산. Same shape as other teachers — a teacher directory row (name, 재직,
// 담당 과목) and a teacherWorkspaceAccess profile — except the profile id is "offline-<uuid>" (no login) and it keeps
// a phone number and an optional memo. Linking a later app account to this record is a separate step.
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {DIRECTORY_ROWS,DIRECTORY_HISTORY,directoryRowKey,directorySourceKey} from './academyDirectorySource.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {offlineTeacherLabel} from '../../src/lib/teacherName.js';

const digest=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const OFFLINE_TEACHER_PREFIX='offline-';
export const isOfflineTeacherId=(uid:string)=>typeof uid==='string'&&uid.startsWith(OFFLINE_TEACHER_PREFIX);
export const offlinePhone=z.string().trim().max(30).transform(v=>v.replace(/[\s()-]/g,'')).refine(v=>/^0\d{8,10}$/.test(v),'연락처를 확인해 주세요.');
export const offlineSubjects=z.array(z.enum(subjects)).min(1).max(subjects.length).refine(v=>new Set(v).size===v.length);
export const offlineTeacherSchema=z.object({name:z.string().trim().min(1).max(40),subjects:offlineSubjects,phone:offlinePhone,memo:z.string().trim().max(200).default('')}).strict();

export async function createOfflineTeacher(db:any,actor:any,input:unknown){
 if(actor.academyId!=='main'||!(actor.admin||actor.principal))throw Error('FORBIDDEN');
 const v=offlineTeacherSchema.parse(input),uid=OFFLINE_TEACHER_PREFIX+randomUUID(),rowId=randomUUID(),at=Date.now(),stamp=new Date(at).toISOString();
 const label=offlineTeacherLabel(v.name,v.subjects);
 const fields={archived:false,in_trash:false,properties:{'선생님':{title:[{plain_text:label,text:{content:label}}]},'상태':{select:{name:'재직'}},'담당 과목':{multi_select:v.subjects.map(name=>({name}))}}};
 const rowRef=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('teachers',rowId)),profileRef=db.collection('teacherWorkspaceAccess').doc(uid);
 await db.runTransaction(async(tx:any)=>{
  if((await tx.get(rowRef)).exists||(await tx.get(profileRef)).exists)throw Error('REGISTRATION_ID_CONFLICT');
  const row={academyId:'main',kind:'teachers',sourceKey:directorySourceKey('teachers'),entityId:rowId,notionPageId:null,databaseId:null,origin:'app',sourceMode:'firestore',fields,hash:digest(fields),revision:1,appEditedAt:stamp,remoteEditedAt:null,updatedAt:at,pointer:{teacherUid:uid},issue:null,summaryOverride:null};
  tx.set(rowRef,row);
  tx.set(db.collection(DIRECTORY_HISTORY).doc(rowRef.id+':1'),{sourceKey:row.sourceKey,entityId:rowId,notionPageId:null,revision:1,before:null,after:fields,pointer:row.pointer,by:actor.uid,at,reason:'offline-teacher'});
  tx.set(profileRef,{academyId:'main',workspaceRole:'teacher',workspaceLabel:label,notionTeacherPageId:rowId,offline:true,phone:v.phone,memo:v.memo,subjects:v.subjects,scopes:[],assignmentRevision:0,assignmentSource:'firestore',disabled:false,createdAt:at,createdBy:actor.uid});
 });
 return {uid,label};
}

/** 명부 줄 for an account given 선생님 권한 (or saved in 선생님 관리 before that existed): without it the teacher could be
 *  given students but never picked in 수강 관리 or 원서. Same shape as the offline row; `autoCreated` lets a later link
 *  to an offline teacher's record retire it. Written inside the caller's transaction (after its reads). */
export function writeAppTeacherRow(tx:any,db:any,{uid,label,subjects:list,by,at}:{uid:string;label:string;subjects:string[];by:string;at:number}){
 const rowId=randomUUID(),stamp=new Date(at).toISOString(),name=label.trim()||'선생님';
 const fields={archived:false,in_trash:false,properties:{'선생님':{title:[{plain_text:name,text:{content:name}}]},'상태':{select:{name:'재직'}},'담당 과목':{multi_select:list.map(name=>({name}))}}};
 const rowRef=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('teachers',rowId));
 const row={academyId:'main',kind:'teachers',sourceKey:directorySourceKey('teachers'),entityId:rowId,notionPageId:null,databaseId:null,origin:'app',sourceMode:'firestore',fields,hash:digest(fields),revision:1,appEditedAt:stamp,remoteEditedAt:null,updatedAt:at,pointer:{teacherUid:uid},issue:null,summaryOverride:null,autoCreated:true};
 tx.set(rowRef,row);
 tx.set(db.collection(DIRECTORY_HISTORY).doc(rowRef.id+':1'),{sourceKey:row.sourceKey,entityId:rowId,notionPageId:null,revision:1,before:null,after:fields,pointer:row.pointer,by,at,reason:'teacher-approval'});
 return {rowId};
}
