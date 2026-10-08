import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashStudentKey} from './security.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {registrationNotion,REGISTRATION_STUDENT_DATABASE,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
export const DIRECTORY_ROWS='academyDirectorySources',DIRECTORY_STATE='academyDirectorySync',DIRECTORY_HISTORY='academyDirectoryHistory';
export const DIRECTORY_CORE_AUTHORITY='academyCoreAuthority';
export const directoryKinds=['students','teachers','enrollments'] as const;
export type DirectoryKind=typeof directoryKinds[number];
const databases={students:REGISTRATION_STUDENT_DATABASE,teachers:'3d274aff-32ce-4a33-870d-2689259113a6',enrollments:'3ec0d0f1-c79a-80b2-bb52-ea162888fe9a'};
const digest=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const directorySourceKey=(kind:DirectoryKind)=>digest(['main',databases[kind]]);
export const directoryRowKey=(kind:DirectoryKind,id:string)=>digest(['main',databases[kind],uuid(id)]);
const keySchema=z.string().uuid(),kindSchema=z.enum(directoryKinds),LIMIT=10,LEASE=180000;
function sourceReady(kind:DirectoryKind){if(kind==='students'&&uuid(process.env.NOTION_STUDENT_DATABASE_ID||'')!==databases.students)throw Error('DIRECTORY_SOURCE_REQUIRED');}
function assertAdmin(actor:any){if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');}
export function directoryStudentReads(actor:any){return actor.academyId==='main'&&(actor.coreMode||process.env.ACADEMY_DIRECTORY_READ_MODE==='firestore');}
function title(p:any){const t=p['학생']||p['학생 이름']||p['이름 및 일지']||Object.values(p).find((v:any)=>v.type==='title');return (t?.title||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');}
function choice(p:any){return p?.status?.name||p?.select?.name||'';}
const allowed:Record<DirectoryKind,string[]>={
 students:['학생','학생 이름','이름 및 일지','학교','학년','학생연락처','보호자연락처','보호자이름','학생 호칭','수강료','납부기한','등록상태','강의명','수강시작일','소속반'],
 teachers:['선생님','선생님 이름','이름','상태','담당 과목'],
 enrollments:['수강 내역','학생',...subjects.flatMap(s=>[s,s+' 시작일',s+' 중단일',s+' 담당'])],
};
async function projection(kind:DirectoryKind,page:any,notion:RegistrationNotion){
 if(uuid(page?.parent?.database_id||'')!==databases[kind]||!Number.isFinite(Date.parse(page.last_edited_time)))throw Error('DIRECTORY_SOURCE_MISMATCH');
 const source=page.properties||{},properties:any={};
 const extraTitle=Object.keys(source).find(k=>source[k]?.type==='title');
 for(const name of [...new Set([...allowed[kind],...(extraTitle?[extraTitle]:[])])]){
  if(!source[name])continue;const prop=structuredClone(source[name]);
  if(prop.has_more){
   if(prop.type!=='relation'||!prop.id)throw Error('DIRECTORY_FIELD_INCOMPLETE');
   const ids:string[]=[],seen=new Set<string>();let cursor:string|undefined;
   for(let n=0;n<10;n++){
    const r=await notion(`pages/${uuid(page.id)}/properties/${encodeURIComponent(prop.id)}`+(cursor?'?start_cursor='+encodeURIComponent(cursor):''));
    if(!Array.isArray(r.results))throw Error('DIRECTORY_FIELD_INCOMPLETE');
    ids.push(...r.results.map((v:any)=>uuid(v.relation.id)));if(!r.has_more){prop.relation=[...new Set(ids)].map(id=>({id}));prop.has_more=false;break;}
    if(!r.next_cursor||seen.has(r.next_cursor)||n===9)throw Error('DIRECTORY_FIELD_INCOMPLETE');cursor=r.next_cursor;seen.add(cursor!);
   }
  }
  if(prop.relation)prop.relation=prop.relation.map((v:any)=>({id:uuid(v.id)}));
  properties[name]=prop;
 }
 const fields={properties,archived:Boolean(page.archived||page.in_trash)};
 if(Buffer.byteLength(JSON.stringify(fields),'utf8')>200000)throw Error('DIRECTORY_FIELD_INCOMPLETE');
 const students=properties['학생']?.relation?.map((v:any)=>v.id)||[];
 if(kind==='enrollments'&&students.length!==1)throw Error('DIRECTORY_STUDENT_LINK_REQUIRED');
 return {kind,id:uuid(page.id),studentKey:kind==='students'?uuid(page.id):kind==='enrollments'?students[0]:null,fields,hash:digest(fields),remoteEditedAt:page.last_edited_time};
}
type Projected=Awaited<ReturnType<typeof projection>>;
async function linkage(db:any,p:Projected){
 if(p.kind==='teachers'){
  const refs=(await db.collection('teacherWorkspaceAccess').where('notionTeacherPageId','in',[p.id,p.id.replace(/-/g,'')]).limit(3).get()).docs;
  if(refs.length!==1||refs[0].data().academyId!=='main')return {issue:'TEACHER_LINK_REVIEW',refs,memberRef:null,mappingRefs:[],pointer:null};
  return {issue:null,refs,memberRef:null,mappingRefs:[],pointer:{teacherUid:refs[0].id}};
 }
 const memberRef=db.collection('academyStudentMemberships').doc(p.studentKey);
 const canonical=db.collection('notionStudentMappings').doc(hashStudentKey(p.studentKey!));
 const mappings=(await db.collection('notionStudentMappings').where('notionStudentPageId','in',[p.studentKey,p.studentKey!.replace(/-/g,'')]).limit(4).get()).docs;
 const duplicates=p.kind==='enrollments'?(await db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey('enrollments')).where('studentKey','==',p.studentKey).limit(2).get()).docs.filter((d:any)=>d.data().notionPageId!==p.id&&!d.data().fields?.archived):[];
 return {issue:duplicates.length?'DUPLICATE_ENROLLMENT_REVIEW':null,refs:[],memberRef,mappingRefs:[canonical,...mappings.filter((d:any)=>d.id!==canonical.id).map((d:any)=>d.ref)],pointer:null};
}
async function inspect(tx:any,db:any,p:Projected,links:Awaited<ReturnType<typeof linkage>>){
 if(p.kind==='teachers'){
  const profiles=await Promise.all(links.refs.map((d:any)=>tx.get(d.ref)));
  if(profiles.length!==1||profiles[0].data()?.academyId!=='main'||uuid(profiles[0].data()?.notionTeacherPageId||'')!==p.id)return {issue:'TEACHER_LINK_REVIEW',pointer:null};
  return {issue:null,pointer:{teacherUid:profiles[0].id}};
 }
 const member=(await tx.get(links.memberRef)).data();
 if(!member||member.academyId!=='main')return {issue:'ACADEMY_LINK_REVIEW',pointer:null};
 if(links.issue)return {issue:links.issue,pointer:null};
 const mapped=await Promise.all(links.mappingRefs.map((r:any)=>tx.get(r))),canonical=mapped[0];
 const values=canonical.exists?[canonical]:mapped.filter((d:any)=>d.exists);
 if(!values.length)return {issue:'STUDENT_IDENTITY_REVIEW',pointer:null};
 const ids=new Set(values.map((d:any)=>d.data().internalStudentId)),owners=new Set(values.map((d:any)=>d.data().firebaseUid).filter(Boolean));
 if(ids.size!==1||owners.size>1||!values[0].data().internalStudentId||values.some((d:any)=>uuid(d.data().notionStudentPageId||'')!==p.studentKey))return {issue:'STUDENT_IDENTITY_REVIEW',pointer:null};
 const identity=values.find((d:any)=>d.data().firebaseUid)||values[0];
 if(member.internalStudentId&&member.internalStudentId!==identity.data().internalStudentId)return {issue:'STUDENT_IDENTITY_REVIEW',pointer:null};
 const edits=await Promise.all(['teacherStudentEdits','teacherStudentEnrollmentEdits'].map(c=>tx.get(db.collection(c).doc(hashStudentKey(p.studentKey!)))));
 if(edits.some((d:any)=>d.exists&&!['synced','discarded'].includes(d.data().status)))return {issue:'PENDING_APP_EDIT',pointer:null};
 const sourceTimes=edits.filter((d:any)=>d.data()?.status==='synced').flatMap((d:any)=>[d.data().remoteEditedAt,...(d.data().steps||[]).filter((s:any)=>s.id&&uuid(s.id)===p.id&&s.database&&uuid(s.database)===databases[p.kind]).map((s:any)=>s.confirmedEditedAt)]).filter(Boolean).map(Date.parse);
 if(sourceTimes.some(time=>time>Date.parse(p.remoteEditedAt)))return {issue:'STALE_REMOTE',pointer:null};
 let projectionId:string|null=null;
 if(p.kind==='enrollments'){
  const stored=(await tx.get(db.collection('studentEnrollments').doc(p.id))).data();
  if(stored?.internalStudentId&&stored.internalStudentId!==identity.data().internalStudentId)return {issue:'STUDENT_IDENTITY_REVIEW',pointer:null};
  if(stored)projectionId=p.id;
 }
 return {issue:null,pointer:{internalStudentId:identity.data().internalStudentId,mappingId:identity.id,...(p.kind==='enrollments'?{projectionId}:{} )}};
}
function failure(e:any){return /^(DIRECTORY_[A-Z_]+|NOTION_\d{3})$/.test(e?.message||'')?e.message:'DIRECTORY_SYNC_FAILED';}
async function ingest(db:any,p:Projected,by:string,at:number,lease?:{ref:any;owner:string}){
 const links=await linkage(db,p),ref=db.collection(DIRECTORY_ROWS).doc(directoryRowKey(p.kind,p.id));
 return db.runTransaction(async(tx:any)=>{
  if((await tx.get(db.collection(DIRECTORY_CORE_AUTHORITY).doc('main'))).data()?.active)throw Error('CORE_FROZEN');
  const old=(await tx.get(ref)).data();
  if(lease){const s=(await tx.get(lease.ref)).data();if(s?.leaseOwner!==lease.owner||s.leaseUntil<=at)throw Error('DIRECTORY_BUSY');}
  const checked=await inspect(tx,db,p,links);
  if(old?.pointer&&old.studentKey&&old.studentKey!==p.studentKey)checked.issue='SOURCE_RELATION_REVIEW';
  if(old&&Date.parse(old.remoteEditedAt)>Date.parse(p.remoteEditedAt))return 'unchanged';
  if(old?.hash===p.hash&&old?.issue===checked.issue&&!old?.summaryOverride&&JSON.stringify(old.pointer)===JSON.stringify(checked.pointer))return checked.issue?'review':'unchanged';
  const next={sourceKey:directorySourceKey(p.kind),kind:p.kind,academyId:'main',databaseId:databases[p.kind],notionPageId:p.id,studentKey:p.studentKey,
   fields:checked.issue?old?.fields||null:p.fields,hash:checked.issue?old?.hash||null:p.hash,pointer:checked.pointer,issue:checked.issue,verified:!checked.issue,
   remoteEditedAt:checked.issue?old?.remoteEditedAt||null:p.remoteEditedAt,revision:(old?.revision||0)+1,updatedAt:at,summaryOverride:checked.issue?old?.summaryOverride||null:null};
  tx.set(ref,next);
  // Contacts stay server-only. Snapshot history is a role-distinct recovery copy,
  // never used to grant access or authenticate a parent/student.
  tx.set(db.collection(DIRECTORY_HISTORY).doc(`${directoryRowKey(p.kind,p.id)}:${next.revision}`),{sourceKey:next.sourceKey,notionPageId:p.id,revision:next.revision,before:old?.fields||null,after:next.fields,pointer:next.pointer,issue:next.issue,by,at});
  return checked.issue?'review':old?'updated':'created';
 });
}
async function remotePage(kind:DirectoryKind,notion:RegistrationNotion,cursor?:string,since?:number){
 const r=await notion(`databases/${databases[kind]}/query`,'POST',{page_size:LIMIT,sorts:[{timestamp:'last_edited_time',direction:'ascending'}],...(cursor?{start_cursor:cursor}:{}),...(since?{filter:{timestamp:'last_edited_time',last_edited_time:{on_or_after:new Date(since-2000).toISOString()}}}:{})});
 if(!Array.isArray(r.results)||r.results.length>LIMIT||r.has_more&&(!r.next_cursor||r.next_cursor===cursor))throw Error('DIRECTORY_FIELD_INCOMPLETE');
 const pages=[];for(const p of r.results)pages.push(await projection(kind,p,notion));return {pages,cursor:r.has_more?r.next_cursor:null};
}
export async function dryRunDirectory(db:any,actor:any,kindInput:unknown,cursor?:string,notion:RegistrationNotion=registrationNotion){
 assertAdmin(actor);
 if((await db.collection(DIRECTORY_CORE_AUTHORITY).doc('main').get()).data()?.active)throw Error('CORE_FROZEN');
 assertAdmin(actor);const kind=kindSchema.parse(kindInput);sourceReady(kind);const result=await remotePage(kind,notion,cursor),items=[];
 for(const p of result.pages){const links=await linkage(db,p);const checked=await db.runTransaction((tx:any)=>inspect(tx,db,p,links));const old=(await db.collection(DIRECTORY_ROWS).doc(directoryRowKey(kind,p.id)).get()).data();
  items.push({id:p.id,decision:checked.issue?'review':old?.hash===p.hash?'unchanged':old?'update':'new',issue:checked.issue,linked:Boolean(checked.pointer),reusesProjection:kind==='enrollments'&&Boolean((checked.pointer as any)?.projectionId)});
 }
 return {items,cursor:result.cursor,writes:0};
}
export async function importDirectoryStep(db:any,actor:any,kindInput:unknown,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 assertAdmin(actor);const kind=kindSchema.parse(kindInput);if((await db.collection(DIRECTORY_CORE_AUTHORITY).doc('main').get()).data()?.active)throw Error('CORE_FROZEN');sourceReady(kind);const ref=db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind)),owner=randomUUID(),at=clock();
 const state=await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data()||{};if(s.leaseUntil>at)throw Error('DIRECTORY_BUSY');
  const next={...s,sourceKey:directorySourceKey(kind),kind,runVersion:(s.runVersion||0)+1,phase:['initial','catchup'].includes(s.phase)?s.phase:'delta',runStartedAt:s.cursor?s.runStartedAt:at,leaseOwner:owner,leaseUntil:at+LEASE,error:null};if(!s.phase){next.phase='initial';next.t0=at;}tx.set(ref,next);return next;});
 try{
  const batch=await remotePage(kind,notion,state.cursor||undefined,state.phase==='initial'?undefined:state.phase==='catchup'?state.t0:state.lastSuccessAt);
  const counts={created:0,updated:0,unchanged:0,review:0};for(const p of batch.pages)counts[await ingest(db,p,actor.uid,clock(),{ref,owner})]++;
  const next=await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(s?.leaseOwner!==owner||s.leaseUntil<=clock())throw Error('DIRECTORY_BUSY');const n={...s,cursor:batch.cursor,leaseOwner:null,leaseUntil:0};
   if(counts.review)n.approved=false;
   if(!batch.cursor){if(state.phase==='initial')n.phase='catchup';else{n.phase='idle';n.ready=true;n.lastSuccessAt=state.runStartedAt;}}tx.set(ref,n);return n;});
  return {kind,counts,ready:Boolean(next.ready),continue:Boolean(next.cursor)||next.phase==='catchup'};
 }catch(e){await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(s?.leaseOwner===owner)tx.set(ref,{...s,leaseOwner:null,leaseUntil:0,error:failure(e)});}).catch(()=>{});throw e;}
}
function rowsQuery(db:any,kind:DirectoryKind,cursor?:string,limit=21){let q=db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey(kind)).orderBy('notionPageId');if(cursor)q=q.startAfter(uuid(cursor));return q.limit(limit);}
export async function directoryManagement(db:any,actor:any,kindInput:unknown,cursor?:string){
 assertAdmin(actor);const kind=kindSchema.parse(kindInput);sourceReady(kind);const [state,rows]=await Promise.all([db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind)).get(),rowsQuery(db,kind,cursor).get()]);
 const records=rows.docs.slice(0,20).map((d:any)=>{const r=d.data();return {id:r.notionPageId,revision:r.revision,issue:r.issue,linked:Boolean(r.pointer),archived:Boolean(r.fields?.archived),updatedAt:r.updatedAt};});
 const s=state.data()||{};return {records,cursor:rows.docs.length>20?records.at(-1)?.id:null,sync:{ready:Boolean(s.ready),approved:Boolean(s.approved),phase:s.phase||'not-started',lastSuccessAt:s.lastSuccessAt||null,error:s.error||null}};
}
export async function reconcileDirectoryStep(db:any,actor:any,kindInput:unknown,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 assertAdmin(actor);
 if((await db.collection(DIRECTORY_CORE_AUTHORITY).doc('main').get()).data()?.active)throw Error('CORE_FROZEN');
 assertAdmin(actor);const kind=kindSchema.parse(kindInput);sourceReady(kind);const sr=db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind)),owner=randomUUID(),at=clock();
 const state=await db.runTransaction(async(tx:any)=>{const s=(await tx.get(sr)).data()||{};if(s.leaseUntil>at)throw Error('DIRECTORY_BUSY');tx.set(sr,{...s,leaseOwner:owner,leaseUntil:at+LEASE});return s;});
 try{const rows=await rowsQuery(db,kind,state.reconcileCursor||undefined,4).get(),docs=rows.docs.slice(0,3),counts={checked:0,review:0};
  for(const d of docs){const old=d.data();try{const p=await projection(kind,await notion(`pages/${old.notionPageId}`),notion);if(await ingest(db,p,actor.uid,clock(),{ref:sr,owner})==='review')counts.review++;}
   catch(e){if(!['NOTION_403','NOTION_404'].includes(failure(e)))throw e;await db.runTransaction(async(tx:any)=>{const r=(await tx.get(d.ref)).data(),s=(await tx.get(sr)).data();if(s?.leaseOwner!==owner||s.leaseUntil<=clock())throw Error('DIRECTORY_BUSY');if(r.issue!==failure(e))tx.set(d.ref,{...r,verified:false,issue:failure(e)});});counts.review++;}counts.checked++;}
  const more=rows.docs.length>3;await db.runTransaction(async(tx:any)=>{const s=(await tx.get(sr)).data();if(s?.leaseOwner!==owner||s.leaseUntil<=clock())throw Error('DIRECTORY_BUSY');tx.set(sr,{...s,reconcileCursor:more?docs.at(-1)?.data().notionPageId:null,leaseOwner:null,leaseUntil:0,...(counts.review?{approved:false}:{}),...(!more?{lastReconcileAt:at}:{})});});return {kind,counts,continue:more};
 }catch(e){await db.runTransaction(async(tx:any)=>{const s=(await tx.get(sr)).data();if(s?.leaseOwner===owner)tx.set(sr,{...s,leaseOwner:null,leaseUntil:0,error:failure(e)});}).catch(()=>{});throw e;}
}
function studentDTO(r:any){const p=r.fields.properties;return {studentKey:r.entityId||r.notionPageId,studentDisplayName:r.summaryOverride?.studentDisplayName||title(p)||'학생',hasGuardianContact:r.summaryOverride?.hasGuardianContact??String(p['보호자연락처']?.phone_number||'').replace(/\D/g,'').length>=9,enrollmentStatus:p['등록상태']?.status?.name||''};}
export async function readDirectoryStudents(db:any,actor:any){
 if(actor.academyId!=='main')throw Error('FORBIDDEN');if(!actor.coreMode)sourceReady('students');const ready=(await db.collection(DIRECTORY_STATE).doc(directorySourceKey('students')).get()).data();if(!ready?.ready||!ready.approved)throw Error('DIRECTORY_NOT_READY');
 if(ready.leaseUntil>Date.now())throw Error('DIRECTORY_BUSY');
 let rows:any[];
 if(actor.admin||actor.principal){const list=await rowsQuery(db,'students',undefined,501).get();if(list.docs.length>500)throw Error('DIRECTORY_PAGE_LIMIT');rows=list.docs.map((d:any)=>d.data());}
 else{const keys=[...new Set<string>((actor.scopes||[]).map((s:any)=>uuid(s.studentKey)))];if(keys.length>500)throw Error('DIRECTORY_PAGE_LIMIT');rows=[];for(const key of keys){const d=await db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key)).get();if(d.exists)rows.push(d.data());}}
 const out=[];for(const r of rows){
  if(r.sourceKey!==directorySourceKey('students')||r.academyId!=='main')throw Error('DIRECTORY_SOURCE_MISMATCH');
  if(r.issue||!r.fields||r.fields.archived)continue;
  const member=(await db.collection('academyStudentMemberships').doc(r.entityId||r.notionPageId).get()).data();
  if(!member||member.academyId!==actor.academyId||!actor.admin&&member.disabled)continue;
  if(!actor.admin&&!actor.principal&&!actor.scopes.some((s:any)=>uuid(s.studentKey)===(r.entityId||r.notionPageId)))continue;
  out.push(studentDTO(r));
 }
 const latest=(await db.collection(DIRECTORY_STATE).doc(directorySourceKey('students')).get()).data();if(!latest?.approved||latest.runVersion!==ready.runVersion||latest.leaseUntil>Date.now())throw Error('DIRECTORY_BUSY');
 return out.sort((a,b)=>a.studentDisplayName.localeCompare(b.studentDisplayName,'ko'));
}
// Save response remains unchanged. This display-only overlay is applied after the
// existing contact/PIN transaction succeeds; old source arrivals cannot erase it.
export async function applyDirectoryStudentSummary(db:any,actor:any,key:string,result:any){
 if(actor.coreMode)return;
 if(!directoryStudentReads(actor)||result.status!=='synced'||!result.profile)return;
 const ref=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key));
 await db.runTransaction(async(tx:any)=>{const r=(await tx.get(ref)).data(),edit=(await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(uuid(key))))).data();
  if(!r||r.academyId!==actor.academyId||edit?.status!=='synced'||!edit.remoteEditedAt)return;
  if(Date.parse(r.remoteEditedAt)>Date.parse(edit.remoteEditedAt))return;
  tx.set(ref,{...r,summaryOverride:{studentDisplayName:result.profile.displayName,hasGuardianContact:Boolean(result.profile.guardianPhone)},remoteEditedAt:edit.remoteEditedAt,...(r.issue==='PENDING_APP_EDIT'?{issue:null,verified:true}:{})});
 });
}
export async function directoryAction(db:any,actor:any,body:any){
 const {action,...input}=body;const v=z.object({kind:kindSchema,cursor:z.string().max(1000).optional(),confirmed:z.literal(true).optional()}).strict().parse(input);
 if(action==='directory-list')return directoryManagement(db,actor,v.kind,v.cursor);
 if(action==='directory-dry-run')return dryRunDirectory(db,actor,v.kind,v.cursor);
 if(v.confirmed!==true)throw Error('INVALID_INPUT');
 if(action==='directory-cutover'){const {cutoverCore}=await import('./academyCore.js');return cutoverCore(db,actor);}
 if(action==='directory-approve')return approveDirectory(db,actor,v.kind);
 if(action==='directory-import-step')return importDirectoryStep(db,actor,v.kind);
 if(action==='directory-reconcile-step')return reconcileDirectoryStep(db,actor,v.kind);
 throw Error('INVALID_INPUT');
}
export async function approveDirectory(db:any,actor:any,kindInput:unknown,clock=Date.now){
 assertAdmin(actor);const kind=kindSchema.parse(kindInput),ref=db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind));sourceReady(kind);
 return db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(!s?.ready||s.phase!=='idle'||s.leaseUntil>clock())throw Error('DIRECTORY_NOT_READY');
  const issues=await tx.get(db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey(kind)).where('verified','==',false).limit(1));
  if(issues.docs.length)throw Error('DIRECTORY_REVIEW_REQUIRED');tx.set(ref,{...s,approved:true,approvedBy:actor.uid,approvedAt:clock()});return {approved:true};
 });
}
export function authorizeDirectoryWorker(secret:unknown){
 const expected=process.env.MESSAGE_TEMPLATE_WORKER_SECRET;
 if(process.env.ACADEMY_DIRECTORY_SYNC_ENABLED!=='true'||!expected||expected.length<32||expected.length>256)throw Error('DIRECTORY_WORKER_DISABLED');
 if(typeof secret!=='string'||secret.length>256)throw Error('FORBIDDEN');const a=Buffer.from(secret),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('FORBIDDEN');
}
export async function runDirectoryWorker(db:any,input:unknown,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 const v=z.object({mode:z.enum(['directory-pull','directory-reconcile','directory-resume']),kind:kindSchema.optional()}).strict().parse(input),actor={uid:'directory-worker',admin:true,academyId:'main'};
 if((await db.collection(DIRECTORY_CORE_AUTHORITY).doc('main').get()).data()?.active)return {skipped:true,reason:'CORE_FROZEN'};
 if(v.mode==='directory-resume'){
  const results=[];for(const kind of directoryKinds){const s=(await db.collection(DIRECTORY_STATE).doc(directorySourceKey(kind)).get()).data();
   if(s?.leaseUntil>clock())continue;
   if(['initial','catchup','delta'].includes(s?.phase))results.push(await importDirectoryStep(db,actor,kind,notion,clock));
   else if(s?.reconcileCursor)results.push(await reconcileDirectoryStep(db,actor,kind,notion,clock));
  }return {results};
 }
 if(!v.kind)throw Error('INVALID_INPUT');
 let result:any;for(let n=0;n<2;n++){result=v.mode==='directory-pull'?await importDirectoryStep(db,actor,v.kind,notion,clock):await reconcileDirectoryStep(db,actor,v.kind,notion,clock);if(!result.continue)break;}return result;
}
