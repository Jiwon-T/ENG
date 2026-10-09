import {createHash} from 'node:crypto';
import {z} from 'zod';
import {DIRECTORY_ROWS,DIRECTORY_STATE,DIRECTORY_HISTORY,DIRECTORY_CORE_AUTHORITY,directoryKinds,directoryRowKey,directorySourceKey} from './academyDirectorySource.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashPin,hashStudentKey} from './security.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {workspaceInflightRead} from './workspaceInflightRead.js';
export const CORE_AUTHORITY=DIRECTORY_CORE_AUTHORITY,CORE_COMMANDS='academyCoreCommands';
const digest=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stateRef=(db:any)=>db.collection(CORE_AUTHORITY).doc('main');
export async function coreActive(db:any,actor:any){
 if(actor.academyId!=='main')return false;
 const active=(await workspaceInflightRead<any>(db,'core-authority:main',()=>stateRef(db).get())).data()?.active;if(active)return true;
 if(process.env.ACADEMY_CORE_MODE==='firestore')throw Error('CORE_NOT_READY');return false;
}
function manage(actor:any){if(actor.academyId!=='main'||!actor.admin&&!actor.principal)throw Error('FORBIDDEN');}
const refFor=(db:any,kind:any,id:string)=>db.collection(DIRECTORY_ROWS).doc(directoryRowKey(kind,uuid(id)));
function valid(row:any,kind:string){if(!row||row.kind!==kind||row.academyId!=='main'||!row.fields||row.fields.archived||row.issue)throw Error('CORE_LINK_REQUIRED');return row;}
function stamp(row:any){return row.appEditedAt||row.remoteEditedAt;}
function text(p:any){return (p?.title||p?.rich_text||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');}
function name(row:any){return Object.values(row.fields.properties).map((p:any)=>p.title?text(p):'').filter(Boolean).join('')||'이름 확인 필요';}
function members(p:any){return (p?.relation||[]).map((v:any)=>uuid(v.id));}
function choice(p:any){return p?.status?.name||p?.select?.name||'';}
const rich=(v:string)=>({rich_text:v?[{text:{content:v}}]:[]});
async function member(tx:any,db:any,actor:any,key:string){const m=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();if(!m||m.academyId!==actor.academyId||!actor.admin&&m.disabled)throw Error('FORBIDDEN');return m;}
async function guard(tx:any,db:any){if(!(await tx.get(stateRef(db))).data()?.active)throw Error('CORE_NOT_READY');}
function changed(tx:any,db:any,ref:any,old:any,properties:any,by:string,at:number){
 const when=new Date(Math.max(at,Date.parse(stamp(old))+1)).toISOString(),fields={...old.fields,properties};
 const next={...old,fields,revision:old.revision+1,appEditedAt:when,hash:digest(fields),summaryOverride:null,updatedAt:at};
 tx.set(ref,next);tx.set(db.collection(DIRECTORY_HISTORY).doc(`${ref.id}:${next.revision}`),{sourceKey:old.sourceKey,notionPageId:old.notionPageId,entityId:old.entityId||old.notionPageId,revision:next.revision,before:old.fields,after:fields,pointer:old.pointer,by,at,reason:'app-edit'});return next;
}
export async function readCoreScopes(db:any,profile:any){
 if(profile.academyId!=='main')throw Error('FORBIDDEN');await guard({get:(r:any)=>r.get()},db);
 const live=(await db.collection('teacherWorkspaceAccess').doc(profile.uid).get()).data();
 if(live){if(live.disabled||live.academyId!=='main'||live.workspaceRole!==profile.workspaceRole)throw Error('TEACHER_NOT_CONFIGURED');profile={...live,uid:profile.uid};}
 else if(profile.uid!==process.env.ADMIN_UID)throw Error('TEACHER_NOT_CONFIGURED');
 if(profile.notionTeacherPageId){const row=valid((await refFor(db,'teachers',profile.notionTeacherPageId).get()).data(),'teachers');if(row.pointer?.teacherUid!==profile.uid)throw Error('CORE_LINK_REQUIRED');if(['중단','휴직'].includes(choice(row.fields.properties['상태'])))throw Error('TEACHER_NOT_CONFIGURED');}
 // One parallel batch instead of one round trip per assigned student (this runs on every request).
 const scopes=(profile.scopes||[]).map((s:any)=>{if(!subjects.includes(s.subject))throw Error('CORE_LINK_REQUIRED');return {...s,studentKey:uuid(s.studentKey)};});
 const keys=[...new Set<string>(scopes.map((s:any)=>s.studentKey))],docs=await Promise.all(keys.map(key=>db.collection('academyStudentMemberships').doc(key).get()));
 const ok=new Set(keys.filter((_,i)=>{const m=docs[i].data();return m?.academyId==='main'&&!m.disabled;}));
 return scopes.filter((s:any)=>ok.has(s.studentKey));
}
/** Stop or resume one teacher's workspace access (admin, after the switch). Assignments are kept for a later resume. */
export async function setCoreTeacherAccess(db:any,actor:any,input:any){
 if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');
 const v=z.object({uid:z.string().min(1).max(200),disabled:z.boolean()}).strict().parse(input);
 if(v.uid===process.env.ADMIN_UID||v.uid===actor.uid)throw Error('FORBIDDEN');
 const ref=db.collection('teacherWorkspaceAccess').doc(v.uid);
 return db.runTransaction(async(tx:any)=>{await guard(tx,db);const old=(await tx.get(ref)).data();if(!old||old.academyId!=='main')throw Error('INVALID_TEACHER');
  if(Boolean(old.disabled)===v.disabled)return {uid:v.uid,disabled:v.disabled,alreadySaved:true};
  tx.set(ref,{...old,disabled:v.disabled,accessChangedAt:Date.now(),accessChangedBy:actor.uid,assignmentRevision:(old.assignmentRevision||0)+1});return {uid:v.uid,disabled:v.disabled};});
}
export async function readCoreProfile(db:any,actor:any,keyInput:any,decode:(page:any)=>any){
 manage(actor);const key=uuid(z.string().uuid().parse(keyInput));await member({get:(r:any)=>r.get()},db,actor,key);
 const r=valid((await refFor(db,'students',key).get()).data(),'students');return {studentKey:key,data:decode({properties:r.fields.properties}),editedAt:stamp(r),pending:null};
}
// Trusted server bridge used by existing report/contact consumers. It creates no
// account and changes no authorization; callers retain their existing checks.
export async function coreStudentPage(db:any,key:string){const id=uuid(key),r=valid((await refFor(db,'students',id).get()).data(),'students');return {id,parent:{database_id:r.databaseId},last_edited_time:stamp(r),properties:r.fields.properties,origin:r.origin||'notion'};}
export async function coreStudentIdentity(db:any,key:string,requireContact=true){
 const page=await coreStudentPage(db,key),digits=String(page.properties['보호자연락처']?.phone_number||'').replace(/\D/g,'');
 if(requireContact&&digits.length<9)throw Error('GUARDIAN_CONTACT_MISSING_OR_INVALID');
 const display=Object.values(page.properties).filter((p:any)=>p.title).map(text).join('')||'학생';
 return {notionStudentPageId:page.origin==='app'?null:page.id,studentKey:page.id,studentDisplayName:display,sourceUpdatedAt:page.last_edited_time,parentPhonePinHash:digits.length>=9?hashPin(digits.slice(-4)):''};
}
export async function saveCoreProfile(db:any,actor:any,keyInput:any,operation:any,expected:any,input:any,parse:(v:any)=>any,decode:(p:any)=>any,makeProperties:(data:any,base:any)=>any){
 manage(actor);const key=uuid(z.string().uuid().parse(keyInput)),op=z.string().uuid().parse(operation),time=z.string().datetime().parse(expected),data=parse(input);
 const ref=refFor(db,'students',key),receipt=db.collection(CORE_COMMANDS).doc(digest(['profile',actor.uid,op])),fingerprint=digest([key,time,data]);
 return db.runTransaction(async(tx:any)=>{
  await guard(tx,db);await member(tx,db,actor,key);const old=valid((await tx.get(ref)).data(),'students'),command=(await tx.get(receipt)).data();
  if(command){if(command.fingerprint!==fingerprint)throw Error('STUDENT_PROFILE_REQUEST_CONFLICT');return {...command.result,alreadySaved:true,profile:decode({properties:old.fields.properties})};}
  if(stamp(old)!==time)throw Error('NOTION_EDIT_CONFLICT');
  const base=decode({properties:old.fields.properties}),properties={...old.fields.properties,...makeProperties(data,base)};
  const mappingRef=db.collection('notionStudentMappings').doc(old.pointer.mappingId),mapping=(await tx.get(mappingRef)).data();
  if(!mapping||mapping.internalStudentId!==old.pointer.internalStudentId||uuid(mapping.sourceMode==='firestore'?mapping.studentKey:mapping.notionStudentPageId)!==key)throw Error('STUDENT_MAPPING_CONFLICT');
  const slugs=await tx.get(db.collection('reportSlugs').where('internalStudentId','==',mapping.internalStudentId));
  const reportRef=db.collection('studentReportMappings').doc(mapping.internalStudentId),report=(await tx.get(reportRef)).data();
  const contactChanged=data.guardianPhone!==base.guardianPhone,pin=contactChanged&&data.guardianPhone?hashPin(data.guardianPhone.slice(-4)):null,at=Date.now();
  const next=changed(tx,db,ref,old,properties,actor.uid,at);
  tx.set(db.collection('teacherStudentEdits').doc(hashStudentKey(key)),{studentKey:key,academyId:'main',ownerUid:actor.uid,operationId:op,expectedEditedAt:time,data,contactChanged,status:'synced',sourceMode:'firestore',remoteEditedAt:stamp(next),updatedAt:at});
  tx.set(mappingRef,{...mapping,studentDisplayName:data.displayName,updatedAt:new Date(at).toISOString()});
  if(report)tx.set(reportRef,{...report,studentKey:key,updatedAt:new Date(at).toISOString()});
  for(const d of slugs.docs){const s=d.data();tx.set(d.ref,{...s,studentDisplayName:data.displayName,studentKey:key,...(contactChanged?{parentPhonePinHash:pin||'',authVersion:(s.authVersion||1)+1,contactUpdateOperationId:null,failedAttempts:0,lockedUntil:null}:{}),updatedAt:new Date(at).toISOString()});}
  const result={studentKey:key,status:'synced',alreadySaved:false,profile:data,sourceMode:'firestore'};tx.set(receipt,{fingerprint,targetKey:key,originRevision:old.revision,result,at});return result;
 });
}
async function enrollmentRow(db:any,key:string){const q=await db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey('enrollments')).where('studentKey','==',key).limit(2).get();if(q.docs.length!==1)throw Error('NOTION_DUPLICATE_ENROLLMENT');return {ref:q.docs[0].ref,row:valid(q.docs[0].data(),'enrollments')};}
async function classRecord(db:any,id:string,allowArchived=false){
 let d=await db.collection('teacherClasses').doc(id).get();if(!d.exists){const q=await db.collection('teacherClasses').where('notionPageId','==',id).limit(2).get();if(q.docs.length!==1)throw Error('CORE_CLASS_MIGRATION_REQUIRED');d=q.docs[0];}
 const r=d.data();if(r.academyId!=='main'||r.archived&&!allowArchived)throw Error('CORE_CLASS_MIGRATION_REQUIRED');return {ref:d.ref,row:r};
}
export async function readCoreEnrollment(db:any,actor:any,keyInput:any){
 manage(actor);const key=uuid(z.string().uuid().parse(keyInput));await member({get:(r:any)=>r.get()},db,actor,key);
 const s=valid((await refFor(db,'students',key).get()).data(),'students'),e=(await enrollmentRow(db,key)).row,classes=[];
 for(const id of members(s.fields.properties['소속반']))classes.push({id,...await classRecord(db,id,true)});
 const entries=[];for(const subject of subjects){const p=e.fields.properties,teachers=[];
  for(const id of members(p[subject+' 담당'])){const t=valid((await refFor(db,'teachers',id).get()).data(),'teachers');teachers.push({id,name:name(t)});}
  entries.push({subject,status:choice(p[subject]),startDate:p[subject+' 시작일']?.date?.start||null,endDate:p[subject+' 중단일']?.date?.start||null,teachers,
   classes:classes.filter(c=>c.row.subject===subject).map(c=>({id:c.id,name:c.row.name,withdrawalReview:!c.row.archived&&c.row.status==='진행 중'&&c.row.students?.length===1&&uuid(c.row.students[0])===key}))});
 }return {studentKey:key,enrollmentId:e.entityId||e.notionPageId,studentEditedAt:stamp(s),enrollmentEditedAt:stamp(e),subjects:entries,pending:null};
}
export async function readCoreEnrollmentSummaries(db:any,actor:any){
 const q=await db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey('enrollments')).limit(501).get();if(q.docs.length>500)throw Error('DIRECTORY_PAGE_LIMIT');
 const result=new Map<string,any[]>();for(const d of q.docs){const r=d.data();if(r.fields?.archived)continue;valid(r,'enrollments');if(result.has(r.studentKey))throw Error('NOTION_DUPLICATE_ENROLLMENT');
  if(!actor.admin&&!actor.scopes.some((s:any)=>uuid(s.studentKey)===r.studentKey))continue;
  result.set(r.studentKey,subjects.filter(subject=>choice(r.fields.properties[subject])).map(subject=>({subject,status:choice(r.fields.properties[subject]),startDate:r.fields.properties[subject+' 시작일']?.date?.start||null,endDate:r.fields.properties[subject+' 중단일']?.date?.start||null})));
 }return result;
}
export async function coreRegistrationOptions(db:any,actor:any){
 manage(actor);const profiles=(await db.collection('teacherWorkspaceAccess').where('academyId','==','main').limit(101).get()).docs;if(profiles.length>100)throw Error('CORE_CUTOVER_LIMIT');
 const teachers=[];for(const d of profiles){const p=d.data();if(p.disabled||!p.notionTeacherPageId)continue;const u=(await db.collection('users').doc(d.id).get()).data();if(d.id!==process.env.ADMIN_UID&&!['teacher','principal'].includes(u?.role))continue;
  const r=valid((await refFor(db,'teachers',p.notionTeacherPageId).get()).data(),'teachers');if(r.pointer.teacherUid!==d.id||choice(r.fields.properties['상태'])!=='재직')continue;
  teachers.push({uid:d.id,name:name(r),subjects:(r.fields.properties['담당 과목']?.multi_select||[]).map((v:any)=>v.name)});
 }
 const source=(await db.collection('teacherClasses').where('academyId','==','main').limit(501).get()).docs;if(source.length>500)throw Error('CORE_CUTOVER_LIMIT');
 const classes=source.map((d:any)=>({id:d.data().notionPageId||d.id,...d.data()})).filter((r:any)=>!r.archived&&r.status==='진행 중').map((r:any)=>({id:r.id,name:r.name,subject:r.subject,teacherUids:(r.teacherUids||[r.ownerUid]).filter((uid:string)=>teachers.some(t=>t.uid===uid)),students:r.students||[]}));
 return {teachers,classes};
}
export async function saveCoreEnrollment(db:any,actor:any,keyInput:any,request:any,parse:(v:any)=>any){
 manage(actor);const key=uuid(z.string().uuid().parse(keyInput)),op=z.string().uuid().parse(request.operationId),input=parse(request.data),studentTime=z.string().datetime().parse(request.studentEditedAt),enrollmentTime=z.string().datetime().parse(request.enrollmentEditedAt);
 const enrollment=await enrollmentRow(db,key),sr=refFor(db,'students',key),cr=db.collection(CORE_COMMANDS).doc(digest(['enrollment',actor.uid,op])),fingerprint=digest([key,studentTime,enrollmentTime,input]);
 return db.runTransaction(async(tx:any)=>{
  await guard(tx,db);await member(tx,db,actor,key);const s=valid((await tx.get(sr)).data(),'students'),e=valid((await tx.get(enrollment.ref)).data(),'enrollments'),command=(await tx.get(cr)).data();
  if(command){if(command.fingerprint!==fingerprint)throw Error('STUDENT_ENROLLMENT_REQUEST_CONFLICT');return {...command.result,alreadySaved:true};}
  if(stamp(s)!==studentTime||stamp(e)!==enrollmentTime)throw Error('NOTION_EDIT_CONFLICT');
  const classIds=members(s.fields.properties['소속반']),classes=[];
  for(const id of [...new Set([...classIds,...input.classIds])]){const found=await classRecord(db,id);const r=(await tx.get(found.ref)).data();if(r.academyId!=='main'||r.archived)throw Error('CORE_CLASS_MIGRATION_REQUIRED');classes.push({id,ref:found.ref,row:r});}
  if(input.classIds.some((id:string)=>!classes.some(c=>c.id===id&&c.row.subject===input.subject)))throw Error('FORBIDDEN');
  if(input.status==='중단'&&input.classIds.some((id:string)=>!classIds.includes(id)))throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
  const teachers=members(e.fields.properties[input.subject+' 담당']).filter(id=>!input.removeTeacherIds.includes(id));
  const profiles=(await tx.get(db.collection('teacherWorkspaceAccess').where('academyId','==','main').limit(101))).docs;if(profiles.length>100)throw Error('CORE_CUTOVER_LIMIT');
  if(input.addTeacherUid){const target=profiles.find((d:any)=>d.id===input.addTeacherUid)?.data();if(!target||target.disabled||!target.notionTeacherPageId)throw Error('INVALID_TEACHER');if(!teachers.includes(uuid(target.notionTeacherPageId)))teachers.push(uuid(target.notionTeacherPageId));}
  const teacherUids=[];for(const id of teachers){const teacher=valid((await tx.get(refFor(db,'teachers',id))).data(),'teachers');if(['중단','휴직'].includes(choice(teacher.fields.properties['상태'])))throw Error('INVALID_TEACHER');
   if(input.addTeacherUid===teacher.pointer.teacherUid&&(choice(teacher.fields.properties['상태'])!=='재직'||!(teacher.fields.properties['담당 과목']?.multi_select||[]).some((v:any)=>v.name===input.subject)))throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');teacherUids.push(teacher.pointer.teacherUid);}
  if(input.status!=='중단'&&input.classIds.some((id:string)=>{const r=classes.find(c=>c.id===id)!.row;return r.status!=='진행 중'||!(r.teacherUids||[r.ownerUid]).some((uid:string)=>teacherUids.includes(uid));}))throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
  const projectedRef=db.collection('studentEnrollments').doc(e.entityId||e.notionPageId),projected=(await tx.get(projectedRef)).data();
  if(projected?.internalStudentId&&projected.internalStudentId!==s.pointer.internalStudentId)throw Error('STUDENT_MAPPING_CONFLICT');
  const retained=classes.filter(c=>classIds.includes(c.id)&&c.row.subject!==input.subject).map(c=>c.id),at=Date.now(),p={...e.fields.properties,[input.subject]:{status:{name:input.status}},[input.subject+' 시작일']:{date:{start:input.startDate}},[input.subject+' 중단일']:{date:input.endDate?{start:input.endDate}:null},[input.subject+' 담당']:{relation:teachers.map(id=>({id}))}};
  const next=changed(tx,db,enrollment.ref,e,p,actor.uid,at);
  const starts=subjects.map(subject=>p[subject+' 시작일']?.date?.start).filter(Boolean).sort();
  changed(tx,db,sr,s,{...s.fields.properties,'소속반':{relation:[...retained,...input.classIds].map(id=>({id}))},'등록상태':{status:{name:subjects.some(subject=>choice(p[subject])==='등록')?'등록':subjects.some(subject=>choice(p[subject])==='대기')?'대기':'중단'}},'강의명':{multi_select:subjects.filter(subject=>choice(p[subject])==='등록').map(name=>({name}))},'수강시작일':{date:starts.length?{start:starts[0]}:null}},actor.uid,at);
  for(const c of classes)if(c.row.subject===input.subject){const wanted=input.classIds.includes(c.id),keys=(c.row.students||[]).filter((id:string)=>uuid(id)!==key);if(wanted)keys.push(key);if(JSON.stringify([...keys].sort())!==JSON.stringify([...(c.row.students||[])].sort()))tx.set(c.ref,{...c.row,students:keys,revision:(c.row.revision||0)+1,updatedAt:at});}
  for(const d of profiles){const profile=d.data();if(!profile.notionTeacherPageId)continue;const id=uuid(profile.notionTeacherPageId),scopes=(profile.scopes||[]).filter((v:any)=>uuid(v.studentKey)!==key||v.subject!==input.subject);if(teachers.includes(id))scopes.push({studentKey:key,subject:input.subject});
   const keys=(items:any[])=>items.map(v=>uuid(v.studentKey)+':'+v.subject).sort();if(JSON.stringify(keys(scopes))!==JSON.stringify(keys(profile.scopes||[])))tx.set(d.ref,{...profile,scopes,assignmentRevision:(profile.assignmentRevision||0)+1,assignmentSource:'firestore'});}
  tx.set(projectedRef,{...projected,internalStudentId:s.pointer.internalStudentId,studentKey:key,sourceUpdatedAt:stamp(next),removed:false,subjects:subjects.filter(subject=>choice(p[subject])).map(subject=>({subject,status:choice(p[subject]),startAt:p[subject+' 시작일']?.date?.start||null,endAt:p[subject+' 중단일']?.date?.start||null})),appSource:'firestore'});
  const result={status:'synced',alreadySaved:false,sourceMode:'firestore'};tx.set(cr,{fingerprint,result,at});return result;
 });
}
export async function cutoverCore(db:any,actor:any){
 if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');
 const {profileFromPage}=await import('./teacherStudentProfile.js');
 const rows:any[]=[];for(const kind of directoryKinds){const q=await db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey(kind)).limit(101).get();if(q.docs.length>100)throw Error('CORE_CUTOVER_LIMIT');rows.push(...q.docs.filter((d:any)=>!d.data().excluded));}
 if(Buffer.byteLength(JSON.stringify(rows.map(d=>d.data())))>6000000)throw Error('CORE_CUTOVER_LIMIT');
 return db.runTransaction(async(tx:any)=>{
  const active=(await tx.get(stateRef(db))).data();if(active?.active)return {active:true,alreadyDone:true};
  const registrations=await tx.get(db.collection('teacherStudentRegistrations').where('academyId','==','main').limit(101));if(registrations.docs.length>100)throw Error('CORE_CUTOVER_LIMIT');
  if(registrations.docs.some((d:any)=>{const r=d.data();return r.syncStatus!=='synced'&&(r.syncStatus==='syncing'||r.syncStatus==='uncertain'||r.studentCreateAttempted||r.enrollmentCreateAttempted||r.notionStudentPageId||r.notionEnrollmentPageId||r.studentSaved||r.enrollmentSaved);}))throw Error('CORE_REGISTRATION_IN_PROGRESS');
  for(const kind of directoryKinds){const state=(await tx.get(db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind)))).data();if(!state?.ready||!state.approved||state.phase!=='idle'||state.leaseUntil>Date.now()||Date.now()-state.lastSuccessAt>900000)throw Error('CORE_NOT_READY');}
  const current=[];for(const d of rows){const r=(await tx.get(d.ref)).data();if(r?.revision!==d.data().revision||r.issue||!r.fields)throw Error('CORE_LINK_REQUIRED');current.push(r);}
  const profiles=(await tx.get(db.collection('teacherWorkspaceAccess').where('academyId','==','main'))).docs;if(profiles.length>100)throw Error('CORE_CUTOVER_LIMIT');
  const academyMembers=(await tx.get(db.collection('academyStudentMemberships').where('academyId','==','main').limit(101))).docs;if(academyMembers.length>100)throw Error('CORE_CUTOVER_LIMIT');
  if(academyMembers.some((d:any)=>!d.data().disabled&&!current.some(r=>r.kind==='students'&&r.notionPageId===d.id&&!r.fields.archived)))throw Error('CORE_LINK_REQUIRED');
  const assignments=new Map<string,any[]>(),studentKeys=new Set<string>(),projections:any[]=[];
  for(const r of current.filter(r=>r.kind==='enrollments'&&!r.fields.archived)){
   if(studentKeys.has(r.studentKey))throw Error('NOTION_DUPLICATE_ENROLLMENT');studentKeys.add(r.studentKey);
   await member(tx,db,actor,r.studentKey);for(const subject of subjects)for(const id of members(r.fields.properties[subject+' 담당']))assignments.set(id,[...(assignments.get(id)||[]),{studentKey:r.studentKey,subject}]);
   const ref=db.collection('studentEnrollments').doc(r.notionPageId),old=(await tx.get(ref)).data();if(old?.internalStudentId&&old.internalStudentId!==r.pointer.internalStudentId||old?.sourceUpdatedAt&&Date.parse(old.sourceUpdatedAt)>Date.parse(r.remoteEditedAt))throw Error('CORE_LINK_REQUIRED');
   projections.push({ref,data:{...old,internalStudentId:r.pointer.internalStudentId,studentKey:r.studentKey,sourceUpdatedAt:r.remoteEditedAt,removed:false,subjects:subjects.filter(subject=>choice(r.fields.properties[subject])).map(subject=>({subject,status:choice(r.fields.properties[subject]),startAt:r.fields.properties[subject+' 시작일']?.date?.start||null,endAt:r.fields.properties[subject+' 중단일']?.date?.start||null})),appSource:'firestore'}});
  }
  for(const r of current.filter(r=>r.kind==='students'&&!r.fields.archived)){
   profileFromPage({properties:r.fields.properties});
   const pending=await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(r.notionPageId)));if(pending.exists&&!['synced','discarded'].includes(pending.data().status))throw Error('PUBLISH_IN_PROGRESS');
   const ep=await tx.get(db.collection('teacherStudentEnrollmentEdits').doc(hashStudentKey(r.notionPageId)));if(ep.exists&&!['synced','discarded'].includes(ep.data().status))throw Error('PUBLISH_IN_PROGRESS');
   for(const id of members(r.fields.properties['소속반']))await classRecord(db,id);
  }
  if(current.some(r=>r.kind==='students'&&!r.fields.archived&&members(r.fields.properties['소속반']).length)){
   if(!(await tx.get(db.collection('academyClassAuthority').doc('main'))).data()?.active)throw Error('CORE_CLASS_MIGRATION_REQUIRED');
  }
  for(const d of profiles){const p=d.data();if(p.notionAssignmentLeaseUntil>Date.now()||['pending','failed'].includes(p.notionAssignmentStage))throw Error('PUBLISH_IN_PROGRESS');if(p.notionTeacherPageId&&!current.some(r=>r.kind==='teachers'&&r.notionPageId===uuid(p.notionTeacherPageId)&&r.pointer?.teacherUid===d.id))throw Error('CORE_LINK_REQUIRED');}
  for(const p of projections)tx.set(p.ref,p.data);
  for(const d of profiles){const p=d.data();tx.set(d.ref,{...p,scopes:p.notionTeacherPageId?assignments.get(uuid(p.notionTeacherPageId))||[]:p.scopes||[],assignmentSource:'firestore',assignmentRevision:(p.assignmentRevision||0)+1});}
  tx.set(stateRef(db),{active:true,by:actor.uid,at:Date.now(),sourceMode:'firestore',notionSyncRequired:false});return {active:true};
 });
}
export async function restoreCoreProfile(db:any,actor:any,input:any,parse:(v:any)=>any,decode:(p:any)=>any,makeProperties:(v:any,b:any)=>any){
 if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');
 const v=z.object({id:z.string().uuid(),revision:z.number().int().positive(),historyRevision:z.number().int().positive(),operationId:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(input);
 const row=valid((await refFor(db,'students',v.id).get()).data(),'students'),history=(await db.collection(DIRECTORY_HISTORY).doc(`${directoryRowKey('students',v.id)}:${v.historyRevision}`).get()).data();
 if(history?.sourceKey!==directorySourceKey('students')||(history?.entityId||history?.notionPageId)!==uuid(v.id)||!history.after||history.after.archived)throw Error('CORE_LINK_REQUIRED');
 const desired=decode({properties:history.after.properties}),receipt=(await db.collection(CORE_COMMANDS).doc(digest(['profile',actor.uid,v.operationId])).get()).data();
 if(receipt){if(receipt.targetKey!==uuid(v.id)||receipt.originRevision!==v.revision||JSON.stringify(receipt.result.profile)!==JSON.stringify(desired))throw Error('STUDENT_PROFILE_REQUEST_CONFLICT');return {...receipt.result,alreadySaved:true,profile:decode({properties:row.fields.properties})};}
 if(row.revision!==v.revision)throw Error('DRAFT_CONFLICT');
 return saveCoreProfile(db,actor,v.id,v.operationId,stamp(row),desired,parse,decode,makeProperties);
}
export async function saveCoreGrant(db:any,actor:any,value:any,expected:number,policy:(...args:any[])=>void){
 manage(actor);if(value.academyId!=='main')throw Error('FORBIDDEN');
 const ref=db.collection('teacherWorkspaceAccess').doc(value.uid),ur=db.collection('users').doc(value.uid),intent=digest([value,expected]);
 return db.runTransaction(async(tx:any)=>{
  await guard(tx,db);const saved=(await tx.get(ref)).data(),user=(await tx.get(ur)).data();
  // After the switch the admin can register a teacher account that has no workspace record yet (no Notion page needed).
  const old=saved||(actor.admin&&['teacher','principal'].includes(user?.role)&&!value.notionTeacherPageId?{academyId:'main',scopes:[],assignmentRevision:0,notionTeacherPageId:null,workspaceRole:value.workspaceRole,createdAt:Date.now(),createdBy:actor.uid}:null);
  if(!old||old.academyId!=='main'||value.uid!==process.env.ADMIN_UID&&!['teacher','principal'].includes(user?.role))throw Error('INVALID_TEACHER');
  if(old.lastCoreGrantIntent===intent)return {sourceMode:'firestore',alreadySaved:true};
  if((old.assignmentRevision||0)!==expected)throw Error('DRAFT_CONFLICT');
  if((value.notionTeacherPageId||null)!==(old.notionTeacherPageId||null))throw Error('SOURCE_IDENTITY_LOCKED');
  const keys=[...new Set<string>([...value.academyStudents,...value.scopes.map((s:any)=>uuid(s.studentKey)),...(old.scopes||[]).map((s:any)=>uuid(s.studentKey))])];if(keys.length>100)throw Error('CORE_CUTOVER_LIMIT');
  const memberships=[];for(const key of keys)memberships.push(await member(tx,db,actor,key));policy(actor,value,old,user,memberships);
  const enrollments=[];for(const key of keys){const found=await enrollmentRow(db,key),row=valid((await tx.get(found.ref)).data(),'enrollments');enrollments.push({key,ref:found.ref,row});}
  if(old.notionTeacherPageId){const teacher=valid((await tx.get(refFor(db,'teachers',old.notionTeacherPageId))).data(),'teachers');if(teacher.pointer?.teacherUid!==value.uid||['중단','휴직'].includes(choice(teacher.fields.properties['상태'])))throw Error('INVALID_TEACHER');}
  // Without a Notion teacher page the app record alone holds the assignment (the app is the only store now).
  if(!actor.admin&&JSON.stringify(value.notionSources||[])!==JSON.stringify(old.notionSources||[]))throw Error('FORBIDDEN');
  const teacherId=old.notionTeacherPageId?uuid(old.notionTeacherPageId):null,at=Date.now();
  for(const e of enrollments){const p={...e.row.fields.properties};for(const subject of subjects){const ids=members(p[subject+' 담당']).filter(id=>id!==teacherId);if(teacherId&&value.scopes.some((s:any)=>uuid(s.studentKey)===e.key&&s.subject===subject))ids.push(teacherId);p[subject+' 담당']={relation:ids.map(id=>({id}))};}changed(tx,db,e.ref,e.row,p,actor.uid,at);}
  tx.set(ref,{...old,scopes:value.scopes,workspaceLabel:value.workspaceLabel||old.workspaceLabel||'',workspaceRole:value.workspaceRole,disabled:false,assignmentRevision:(old.assignmentRevision||0)+1,assignmentSource:'firestore',notionAssignmentStage:'synced',notionSyncRequired:false,lastCoreGrantIntent:intent,...(actor.admin&&value.notionSources?{notionSources:value.notionSources}:{})});
  if(actor.admin&&value.uid!==process.env.ADMIN_UID)tx.set(ur,{...user,role:value.workspaceRole==='principal'?'principal':'teacher'});
  for(let i=0;i<keys.length;i++)if(value.academyStudents.includes(keys[i])||value.scopes.some((s:any)=>uuid(s.studentKey)===keys[i]))tx.set(db.collection('academyStudentMemberships').doc(keys[i]),{...memberships[i],disabled:false});
  return {sourceMode:'firestore',alreadySaved:false};
 });
}
