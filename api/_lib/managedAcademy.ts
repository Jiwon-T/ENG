import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {subjects,timetableSlotSchema,canAccessOwned,canTeach} from './teacherWorkspacePolicy.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {registrationNotion,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {coreActive} from './academyCore.js';
import {DIRECTORY_ROWS,DIRECTORY_HISTORY,directoryRowKey} from './academyDirectorySource.js';
const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const MANAGED_STATE='academyManagedMigration',MANAGED_LINKS='academyManagedSources',MANAGED_HISTORY='academyManagedHistory',CLASS_AUTHORITY='academyClassAuthority';
type Kind='classes'|'curricula';
const kindSchema=z.enum(['classes','curricula']);
const collection=(kind:Kind)=>kind==='classes'?'teacherClasses':'teacherCurricula';
export async function classesActive(db:any,actor:any){return actor.academyId==='main'&&Boolean((await db.collection(CLASS_AUTHORITY).doc('main').get()).data()?.active);}
function admin(actor:any){if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');}
function text(p:any){return (p?.title||p?.rich_text||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');}
const choice=(p:any)=>p?.status?.name||p?.select?.name||'';
async function relations(page:any,name:string,notion:RegistrationNotion){
 const p=page.properties?.[name];if(!p)return [];if(!p.has_more)return (p.relation||[]).map((r:any)=>uuid(r.id));
 const result:string[]=[],seen=new Set();let cursor;for(let n=0;n<10;n++){const r=await notion(`pages/${page.id}/properties/${encodeURIComponent(p.id)}`+(cursor?'?start_cursor='+encodeURIComponent(cursor):''));if(!Array.isArray(r.results))throw Error('MANAGED_LINK_REQUIRED');result.push(...r.results.map((v:any)=>uuid(v.relation.id)));if(!r.has_more)return [...new Set(result)];if(!r.next_cursor||seen.has(r.next_cursor))throw Error('MANAGED_LINK_REQUIRED');cursor=r.next_cursor;seen.add(cursor);}throw Error('MANAGED_LINK_REQUIRED');
}
const classSchema=z.object({name:z.string().min(1).max(200),status:z.enum(['대기','진행 중','중단']).optional(),subject:z.enum(subjects),students:z.array(z.string().uuid()).max(100),slots:z.array(timetableSlotSchema.and(z.object({id:z.string().uuid().optional(),notionEditedAt:z.string().optional(),status:z.enum(['대기','진행 중','중단']).optional()}))).max(14),books:z.array(z.object({id:z.string().uuid().optional(),linkedPlanId:z.string().uuid().optional(),progress:z.string().max(100).optional(),notionEditedAt:z.string().optional(),title:z.string().trim().min(1).max(300),status:z.enum(['past','current','planned'])})).max(100).optional()});
const planSchema=z.object({title:z.string().min(1).max(200),subject:z.enum(subjects),content:z.string().max(30000),classId:z.string().uuid().nullable().optional()});
async function sources(db:any,actor:any){const {sourcesFor}=await import('./teacherNotionWorkspace.js');return (await sourcesFor(db,actor)).filter((s:any)=>s.academyId==='main');}
const sourceKey=(kind:Kind,s:any)=>hash(['main',kind,kind==='classes'?s.classDatabaseId:s.curriculumDatabaseId]);
/** MANAGED_PENDING_WRITE that names the class/plan and why, so the screen can say what to check. */
function managedBlocker(kind:string,id:string,row:any,reason:'running'|'deletion'|'unconfirmed'){const error:any=Error('MANAGED_PENDING_WRITE');error.managedBlocker={id,kind,title:String(row?.name||row?.title||'').replace(/[\r\n]/g,' ').slice(0,200),reason};return error;}
async function target(db:any,c:string,pageId:string,marker?:string){const matches=await db.collection(c).where('notionPageId','in',[pageId,pageId.replace(/-/g,'')]).limit(2).get();if(matches.docs.length>1)throw Error('MANAGED_LINK_REQUIRED');if(matches.docs.length)return matches.docs[0];const direct=await db.collection(c).doc(marker||pageId).get();return direct;}
async function parsed(db:any,actor:any,kind:Kind,source:any,page:any,notion:RegistrationNotion){
 const {rowSource,sourceSlots,bookStatus}=await import('./teacherNotionWorkspace.js');
 const expected=kind==='classes'?source.classDatabaseId:source.curriculumDatabaseId;if(uuid(page.parent?.database_id||'')!==uuid(expected)||page.archived||page.in_trash||!Number.isFinite(Date.parse(page.last_edited_time)))throw Error('MANAGED_LINK_REQUIRED');
 const hydrated=structuredClone(page);for(const key of ['담당 선생님','작성자 선생님'])if(hydrated.properties?.[key]?.has_more)hydrated.properties[key]={...hydrated.properties[key],has_more:false,relation:(await relations(page,key,notion)).map(id=>({id}))};
 const owner=await rowSource(hydrated,source,actor);if(!owner)return null;
 const p=page.properties,id=uuid(page.id),base={ownerUid:owner.ownerUid,assignedUids:owner.assignedUids||[],academyId:'main',subject:owner.subject,notionPageId:id,notionEditedAt:page.last_edited_time};
 if(kind==='curricula'){const ids=await relations(page,'반 관리',notion),classIds=[];for(const key of ids){const found=await target(db,'teacherClasses',key);classIds.push(found.exists?found.id:key);}return {...base,...planSchema.parse({title:text(p['교재명']),content:text(p['수업 계획']),subject:owner.subject,classId:p['공통 계획']?.checkbox?null:classIds[0]||null}),isCommon:Boolean(p['공통 계획']?.checkbox)||ids.length===0,classIds,progress:choice(p['진행도'])};}
 const students=await relations(page,'대상 학생',notion),books=[];for(const key of await relations(page,'커리큘럼',notion)){
  const found=await target(db,'teacherCurricula',key);if(!found.exists||found.data().archived||found.data().academyId!=='main'||found.data().subject!==owner.subject)throw Error('MANAGED_BOOKS_FIRST');const b=found.data();books.push({id:found.id,title:b.title,status:bookStatus(b.progress),progress:b.progress||'',...(b.isCommon?{linkedPlanId:found.id}:{} )});
 }
 const times=await notion(`databases/${source.timetableDatabaseId}/query`,'POST',{page_size:15,filter:{property:'반',relation:{contains:id}}});if(!Array.isArray(times.results)||times.has_more||times.results.length>14)throw Error('MANAGED_LINK_REQUIRED');
 const slots=times.results.map((t:any)=>{if(uuid(t.parent?.database_id||'')!==uuid(source.timetableDatabaseId)||t.archived||t.in_trash)throw Error('MANAGED_LINK_REQUIRED');const slot=sourceSlots(t);if(!slot)throw Error('MANAGED_LINK_REQUIRED');return {...slot,status:choice(p['상태'])==='중단'?'중단':choice(t.properties['상태'])||'진행 중',notionEditedAt:t.last_edited_time};});
 return {...base,...classSchema.parse({name:text(p['수업명']),subject:owner.subject,status:choice(p['상태'])||'진행 중',students,slots,books})};
}
export async function managedPlan(db:any,actor:any){admin(actor);const list=[];for(const s of await sources(db,actor))for(const kind of ['curricula','classes'] as Kind[]){const key=sourceKey(kind,s);if(list.some(r=>r.key===key))continue;const state=(await db.collection(MANAGED_STATE).doc(key).get()).data()||{};list.push({key,kind,subject:s.subject,ready:Boolean(state.ready),final:Boolean(state.final),hasCursor:Boolean(state.cursor),verifiedAt:state.verifiedAt||null,error:state.error||null});}return {sources:list,active:await classesActive(db,actor)};}
export async function importManagedStep(db:any,actor:any,input:any,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 admin(actor);const v=z.object({key:z.string().regex(/^[a-f0-9]{64}$/),kind:kindSchema,dryRun:z.boolean().default(false),cursor:z.string().max(1000).optional(),final:z.boolean().default(false),confirmed:z.literal(true).optional()}).strict().parse(input);
 if(await classesActive(db,actor))throw Error('CORE_FROZEN');if(!v.dryRun&&v.confirmed!==true)throw Error('INVALID_INPUT');
 const s=(await sources(db,actor)).find((s:any)=>sourceKey(v.kind,s)===v.key);if(!s)throw Error('MANAGED_LINK_REQUIRED');const ref=db.collection(MANAGED_STATE).doc(v.key),owner=randomUUID(),at=clock();
 const state=v.dryRun?(await ref.get()).data()||{}:await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data()||{};if(old.leaseUntil>at)throw Error('DIRECTORY_BUSY');if((await tx.get(db.collection(CLASS_AUTHORITY).doc('main'))).data()?.active)throw Error('CORE_FROZEN');const next={...old,key:v.key,kind:v.kind,final:v.final,ready:false,verifiedAt:null,startedAt:old.cursor?old.startedAt:at,leaseOwner:owner,leaseUntil:at+180000};if(old.cursor&&Boolean(old.final)!==v.final)throw Error('DIRECTORY_BUSY');tx.set(ref,next);return next;});
 try{
  const database=v.kind==='classes'?s.classDatabaseId:s.curriculumDatabaseId;
  const cursor=v.dryRun?v.cursor:state.cursor;const r=await notion(`databases/${database}/query`,'POST',{page_size:1,...(cursor?{start_cursor:cursor}:{})});if(!Array.isArray(r.results)||r.results.length>1||r.has_more&&(!r.next_cursor||r.next_cursor===cursor))throw Error('MANAGED_LINK_REQUIRED');
  let decision='empty',id:null|string=null;for(const page of r.results){const value=await parsed(db,actor,v.kind,s,page,notion);if(!value){decision='excluded';continue;}const marker=text(page.properties?.['앱 기록 ID']),found=await target(db,collection(v.kind),value.notionPageId,/^[a-f0-9-]{36}$/i.test(marker)?uuid(marker):undefined),old=found.data();id=found.id;
   // Only a running Notion write or a deletion stops the import; a pending/failed Notion write keeps the app copy (it is the newer value).
   if(old&&(old.archived||old.deleteRequested||old.notionSyncStage==='syncing'))throw managedBlocker(v.kind,found.id,old,old.notionSyncStage==='syncing'?'running':'deletion');
   if(old&&(old.ownerUid!==value.ownerUid||old.academyId!=='main'||old.subject!==value.subject||old.notionPageId&&uuid(old.notionPageId)!==value.notionPageId))throw Error('MANAGED_LINK_REQUIRED');
   const preserveApp=Boolean(old&&(old.migrationAppAuthoritative||['pending','failed'].includes(old.notionSyncStage)));
   const comparable=old?Object.fromEntries(Object.keys(value).map(k=>[k,old[k]])):null,same=preserveApp?Boolean(old.migrationAppAuthoritative):Boolean(old)&&JSON.stringify(comparable)===JSON.stringify(value);decision=preserveApp?'app-preserved':same?'unchanged':old?'update':'new';if(!v.dryRun)await db.runTransaction(async(tx:any)=>{const current=(await tx.get(found.ref)).data(),lease=(await tx.get(ref)).data(),active=(await tx.get(db.collection(CLASS_AUTHORITY).doc('main'))).data();if(active?.active||lease?.leaseOwner!==owner||lease.leaseUntil<=clock())throw Error('DIRECTORY_BUSY');if(JSON.stringify(current)!==JSON.stringify(old))throw Error('DRAFT_CONFLICT');
    const next=same?current:preserveApp?{...current,migrationAppAuthoritative:true,revision:(current?.revision||0)+1,updatedAt:clock()}:{...current,...value,revision:(current?.revision||0)+1,sourceMode:'prepared',notionSyncStage:'synced',updatedAt:clock()};if(!same)tx.set(found.ref,next);
    tx.set(db.collection(MANAGED_LINKS).doc(hash(['main',database,value.notionPageId])),{key:v.key,collection:collection(v.kind),targetId:found.id,notionPageId:value.notionPageId,remoteEditedAt:value.notionEditedAt,hash:hash(value)});
    if(!same)tx.set(db.collection(MANAGED_HISTORY).doc(`${collection(v.kind)}:${found.id}:${next.revision}`),{before:current||null,after:next,by:actor.uid,at:clock(),reason:preserveApp?'pending-write-app-preserved':'source-import'});
   });
  }
  if(!v.dryRun)await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();if(old.leaseOwner!==owner||old.leaseUntil<=clock())throw Error('DIRECTORY_BUSY');tx.set(ref,{...old,cursor:r.has_more?r.next_cursor:null,ready:!r.has_more,error:null,leaseOwner:null,leaseUntil:0,...(!r.has_more&&v.final?{verifiedAt:clock()}: {})});});
  return {id,decision,cursor:r.has_more?r.next_cursor:null,continue:Boolean(r.has_more),writes:v.dryRun?0:undefined};
 }catch(e){if(!v.dryRun)await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();if(old.leaseOwner===owner)tx.set(ref,{...old,leaseOwner:null,leaseUntil:0,error:/^(MANAGED_|CORE_|DIRECTORY_|NOTION_)/.test((e as any)?.message)?(e as any).message:'MANAGED_IMPORT_FAILED'});}).catch(()=>{});throw e;}
}
export async function activateManaged(db:any,actor:any){
 admin(actor);const plan=await managedPlan(db,actor),states=plan.sources.map(s=>db.collection(MANAGED_STATE).doc(s.key));if(!states.length)throw Error('MANAGED_LINK_REQUIRED');
 const docs=[];for(const c of ['teacherClasses','teacherCurricula']){const q=await db.collection(c).where('academyId','==','main').limit(101).get();if(q.docs.length>100)throw Error('CORE_CUTOVER_LIMIT');docs.push(...q.docs);}
 return db.runTransaction(async(tx:any)=>{const active=(await tx.get(db.collection(CLASS_AUTHORITY).doc('main'))).data();if(active?.active)return {active:true,alreadyDone:true};
  for(const r of states){const s=(await tx.get(r)).data();if(!s?.ready||s.cursor||!s.final||!s.verifiedAt||Date.now()-s.verifiedAt>900000||s.leaseUntil>Date.now()||s.error)throw Error('CORE_NOT_READY');}
  const rows=[];for(const d of docs){const r=(await tx.get(d.ref)).data();if(JSON.stringify(r)!==JSON.stringify(d.data())||r.deleteRequested||r.notionSyncStage==='syncing'||!r.migrationAppAuthoritative&&['pending','failed'].includes(r.notionSyncStage))throw managedBlocker(d.ref.path.startsWith('teacherClasses/')?'classes':'curricula',d.ref.id,r,r.deleteRequested?'deletion':r.notionSyncStage==='syncing'?'running':'unconfirmed');rows.push({ref:d.ref,row:r});}
  const classIds=new Map(rows.filter(r=>r.ref.path.startsWith('teacherClasses/')).flatMap(r=>[[r.ref.id,r.ref.id],[r.row.notionPageId,r.ref.id]])),planIds=new Set(rows.filter(r=>r.ref.path.startsWith('teacherCurricula/')).map(r=>r.ref.id));
  for(const r of rows){if(r.row.archived)continue;if(r.ref.path.startsWith('teacherClasses/')){for(const b of r.row.books||[])if(b.linkedPlanId&&!planIds.has(b.linkedPlanId))throw Error('MANAGED_LINK_REQUIRED');}else if(r.row.classId&&!classIds.has(r.row.classId))throw Error('MANAGED_LINK_REQUIRED');}
  for(const r of rows){const row={...r.row,sourceMode:'firestore',notionSyncStage:'app_saved',notionSyncRequired:false,...(r.row.classId?{classId:classIds.get(r.row.classId)}:{})};tx.set(r.ref,row);}
  tx.set(db.collection(CLASS_AUTHORITY).doc('main'),{active:true,by:actor.uid,at:Date.now(),sources:plan.sources.map(s=>s.key)});return {active:true};
 });
}
export async function readManaged(db:any,actor:any){const out:any={classes:[],curricula:[],issues:[],sources:[]};for(const kind of ['classes','curricula'] as Kind[]){const q=await db.collection(collection(kind)).where('academyId','==',actor.academyId).limit(501).get();if(q.docs.length>500)throw Error('CORE_CUTOVER_LIMIT');out[kind]=q.docs.map((d:any)=>({id:d.id,...d.data()})).filter((r:any)=>!r.archived&&(canAccessOwned(actor,r.ownerUid,r.academyId)||(r.assignedUids||[]).includes(actor.uid)));}return out;}
export async function saveManaged(db:any,actor:any,kind:Kind,input:any){
 if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
 const value=kind==='classes'?classSchema.parse(input.data):planSchema.parse(input.data),id=input.id?z.string().uuid().parse(input.id):randomUUID(),ref=db.collection(collection(kind)).doc(id);
 return db.runTransaction(async(tx:any)=>{
  if(!(await tx.get(db.collection(CLASS_AUTHORITY).doc('main'))).data()?.active)throw Error('CORE_NOT_READY');const old=(await tx.get(ref)).data();if(old?.archived||old&&!canAccessOwned(actor,old.ownerUid,old.academyId))throw Error('FORBIDDEN');if(old&&(input.revision??0)!==old.revision)throw Error('DRAFT_CONFLICT');if(old?.notionPageId&&old.subject!==value.subject)throw Error('SOURCE_IDENTITY_LOCKED');
  let prepared:any={...value};const studentChanges=[];
  if(kind==='classes'){
   const v:any=value;if(new Set(v.students).size!==v.students.length)throw Error('INVALID_INPUT');if(v.students.some((key:string)=>!canTeach(actor,key,v.subject)))throw Error('FORBIDDEN');
   const books=[];for(const b of v.books||[]){if(b.linkedPlanId){const linked=(await tx.get(db.collection('teacherCurricula').doc(b.linkedPlanId))).data();if(!linked||linked.archived||linked.academyId!==actor.academyId||linked.subject!==v.subject||!linked.isCommon)throw Error('FORBIDDEN');books.push({...b,id:b.linkedPlanId,title:linked.title});}else books.push({...b,id:b.id||randomUUID()});}if(new Set(books.map(b=>b.id)).size!==books.length)throw Error('INVALID_INPUT');
   const status=v.status||old?.status||'진행 중',slots=v.slots.map((s:any)=>({...s,id:s.id||randomUUID(),status:status==='중단'?'중단':s.status||'진행 중'}));if(new Set(slots.map((s:any)=>s.id)).size!==slots.length)throw Error('INVALID_INPUT');prepared={...v,status,slots,books};
   for(const key of [...new Set<string>([...(old?.students||[]),...v.students])]){const sr=db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key)),s=(await tx.get(sr)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();if(!s||s.issue||s.fields.archived||!member||member.academyId!==actor.academyId)throw Error('FORBIDDEN');const aliases=new Set([id,old?.notionPageId].filter(Boolean)),links=(s.fields.properties['소속반']?.relation||[]).map((v:any)=>uuid(v.id)).filter((key:string)=>!aliases.has(key));if(v.students.includes(key))links.push(id);studentChanges.push({ref:sr,old:s,links});}
  }else{const v:any=value;if(v.classId){const c=(await tx.get(db.collection('teacherClasses').doc(v.classId))).data();if(!c||c.archived||c.subject!==v.subject||!canAccessOwned(actor,c.ownerUid,c.academyId))throw Error('FORBIDDEN');}prepared={...v,isCommon:!v.classId};}
  const at=Date.now(),next={...old,...prepared,ownerUid:old?.ownerUid||actor.uid,academyId:actor.academyId,sourceMode:'firestore',notionSyncStage:'app_saved',notionSyncRequired:false,revision:(old?.revision||0)+1,updatedAt:at};tx.set(ref,next);tx.set(db.collection(MANAGED_HISTORY).doc(`${collection(kind)}:${id}:${next.revision}`),{before:old||null,after:next,by:actor.uid,at,reason:'app-edit'});
  for(const s of studentChanges){const fields={...s.old.fields,properties:{...s.old.fields.properties,'소속반':{relation:s.links.map((id:string)=>({id}))}}},row={...s.old,fields,hash:hash(fields),revision:s.old.revision+1,appEditedAt:new Date(Math.max(at,Date.parse(s.old.appEditedAt||s.old.remoteEditedAt)+1)).toISOString()};tx.set(s.ref,row);tx.set(db.collection(DIRECTORY_HISTORY).doc(`${s.ref.id}:${row.revision}`),{before:s.old.fields,after:fields,sourceKey:s.old.sourceKey,notionPageId:s.old.notionPageId,revision:row.revision,by:actor.uid,at,reason:'class-membership'});}
  return {id,revision:next.revision,record:{id,...next},sourceMode:'firestore'};
 });
}
export async function archiveManaged(db:any,actor:any,kind:Kind,id:string,revision:number){if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');const ref=db.collection(collection(kind)).doc(z.string().uuid().parse(id));return db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();if(!old||!canAccessOwned(actor,old.ownerUid,old.academyId))throw Error('FORBIDDEN');if(old.archived)return {archived:true};if(old.revision!==revision)throw Error('DRAFT_CONFLICT');const next={...old,archived:true,revision:old.revision+1,updatedAt:Date.now()};tx.set(ref,next);tx.set(db.collection(MANAGED_HISTORY).doc(`${collection(kind)}:${id}:${next.revision}`),{before:old,after:next,by:actor.uid,at:Date.now(),reason:'archive'});return {archived:true};});}

