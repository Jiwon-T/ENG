import {migrationBatchSize} from './migrationTransport.js';
import {createHash, randomUUID} from 'node:crypto';
import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {registrationNotion, type RegistrationNotion} from './teacherStudentRegistrationNotion.js';

// This pilot owns one existing source only. Never accept an academy/DB from a browser.
export const TEMPLATE_DATABASE='ec10d0f1-c79a-8312-946b-811e86041ee2';
export const TEMPLATE_ACADEMY='main';
export const TEMPLATE_SOURCE=createHash('sha256').update(JSON.stringify([TEMPLATE_ACADEMY,TEMPLATE_DATABASE])).digest('hex');
export const TEMPLATE_COLLECTION='messageTemplateSources';
export const TEMPLATE_JOBS='messageTemplateJobs';
export const TEMPLATE_STATE='messageTemplateSync';
export const TEMPLATE_HISTORY='messageTemplateHistory';
const PAGE_SIZE=20, LEASE_MS=90_000;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const templateKey=(id:string)=>hash([TEMPLATE_ACADEMY,TEMPLATE_DATABASE,uuid(id)]);
const editSchema=z.object({title:z.string().trim().min(1).max(300),body:z.string().max(10000)}).strict();
export type TemplateValue={title:string;body:string;target:string;archived:boolean};
export function templateFirestoreReads(){return process.env.MESSAGE_TEMPLATE_READ_MODE==='firestore';}
/** Firestore reads when the verified app-only switch is on (normal path) or the legacy env override is set. */
export async function templateReadsFromApp(db:any){
 if(templateFirestoreReads())return true;
 const {templateAppActive}=await import('./messageTemplateAuthority.js');return templateAppActive(db);
}
async function assertNotAppOnly(db:any){
 // After the switch the app value is authoritative; Notion pulls would overwrite newer app edits.
 const {templateAppActive}=await import('./messageTemplateAuthority.js');if(await templateAppActive(db))throw Error('TEMPLATE_APP_ACTIVE');
}
export function assertTemplateAccess(actor:any,write=false){
 if(actor.academyId!==TEMPLATE_ACADEMY || write&& !actor.admin)throw Error('FORBIDDEN');
}
function assertStored(row:any,id?:string){
 if(!row||row.sourceKey!==TEMPLATE_SOURCE||row.academyId!==TEMPLATE_ACADEMY||row.databaseId!==TEMPLATE_DATABASE||id&&row.notionPageId!==uuid(id))throw Error('TEMPLATE_NOT_FOUND');
 return row;
}
export function templatePage(page:any):{id:string;data:TemplateValue;hash:string;editedAt:string}{
 if(uuid(page?.parent?.database_id||'')!==TEMPLATE_DATABASE)throw Error('TEMPLATE_SOURCE_MISMATCH');
 const p=page.properties||{},text=(items:any[])=>items.map(v=>v.plain_text??v.text?.content??'').join('');
 if(!Array.isArray(p['유형']?.title)||!Array.isArray(p['내용(문자본문)']?.rich_text)||p['유형'].has_more||p['내용(문자본문)'].has_more||p['대상']&&p['대상'].type&&p['대상'].type!=='select')throw Error('TEMPLATE_SCHEMA_REQUIRED');
 const data={title:text(p['유형'].title),body:text(p['내용(문자본문)'].rich_text),target:p['대상']?.select?.name||'',archived:Boolean(page.archived||page.in_trash)};
 if(data.title.length>300||data.body.length>10000||data.target.length>100||!Number.isFinite(Date.parse(page.last_edited_time)))throw Error('TEMPLATE_SCHEMA_REQUIRED');
 return {id:uuid(page.id),data,hash:hash(data),editedAt:page.last_edited_time};
}
const refFor=(db:any,id:string)=>db.collection(TEMPLATE_COLLECTION).doc(templateKey(id));
function history(tx:any,db:any,row:any,before:any,reason:string,at:number,by:string){
 tx.set(db.collection(TEMPLATE_HISTORY).doc(`${templateKey(row.notionPageId)}:${row.revision}`),{
  sourceKey:TEMPLATE_SOURCE,entityKey:templateKey(row.notionPageId),notionPageId:row.notionPageId,revision:row.revision,before:before?.data||null,after:row.data,remote:row.conflict||null,reason,by,at,
  // Advisory retention only; no TTL or automatic operational deletion is enabled.
  retainUntil:at+90*86400000,
 });
}
function dto(row:any){return {id:row.notionPageId,title:row.data.title,body:row.data.body,target:row.data.target,archived:row.data.archived,
 revision:row.revision,status:row.status,lastSuccessAt:row.lastSuccessAt||null,error:row.error||null,sourceWarning:row.sourceWarning||null,remote:row.conflict?.data||null,remoteHash:row.conflict?.hash||null};}
function pageQuery(db:any,cursor?:string,limit=PAGE_SIZE){
 let q=db.collection(TEMPLATE_COLLECTION).where('sourceKey','==',TEMPLATE_SOURCE).orderBy('notionPageId');
 if(cursor)q=q.startAfter(uuid(cursor));return q.limit(limit);
}
export async function templateManagementList(db:any,actor:any,cursor?:string){
 assertTemplateAccess(actor,true);
 const [state,snapshot]=await Promise.all([db.collection(TEMPLATE_STATE).doc(TEMPLATE_SOURCE).get(),pageQuery(db,cursor,PAGE_SIZE+1).get()]);
 const rows=snapshot.docs.slice(0,PAGE_SIZE).map((d:any)=>dto(assertStored(d.data())));
 const s=state.data()||{};
 const {templateAppActive}=await import('./messageTemplateAuthority.js');const appOnly=await templateAppActive(db);
 return {records:rows,cursor:snapshot.docs.length>PAGE_SIZE?rows.at(-1)?.id:null,readMode:appOnly||templateFirestoreReads()?'firestore':'notion',appOnly,
  sync:{ready:Boolean(s.ready),phase:s.phase||'not-started',hasMore:Boolean(s.cursor),lastSuccessAt:s.lastSuccessAt||null,error:s.error||null,reconcileHasMore:Boolean(s.reconcileCursor),lastReconcileAt:s.lastReconcileAt||null}};
}
async function requireReady(db:any){
 if(!(await db.collection(TEMPLATE_STATE).doc(TEMPLATE_SOURCE).get()).data()?.ready)throw Error('TEMPLATE_STORE_NOT_READY');
}
// Bounded compatibility list (same existing 500 template ceiling); no Notion fallback.
export async function storedMessageTemplates(db:any,actor:any){
 assertTemplateAccess(actor);await requireReady(db);
 const snapshot=await pageQuery(db,undefined,501).get();
 if(snapshot.docs.length>500)throw Error('TEMPLATE_PAGE_LIMIT');
 return snapshot.docs.map((d:any)=>assertStored(d.data())).filter((r:any)=>!r.data.archived).map((r:any)=>({id:r.notionPageId,title:r.data.title,body:r.data.body,target:r.data.target}));
}
export async function storedMessageTemplatePage(db:any,actor:any,id:string){
 assertTemplateAccess(actor);await requireReady(db);const r=assertStored((await refFor(db,id).get()).data(),id);
 if(r.data.archived)throw Error('TEMPLATE_NOT_FOUND');
 // Preserve the existing messageContext contract and recipient/variable checks.
 const chunks=(v:string)=>Array.from({length:Math.ceil(v.length/1800)},(_,i)=>({plain_text:v.slice(i*1800,(i+1)*1800)}));
 return {id:r.notionPageId,parent:{database_id:TEMPLATE_DATABASE},properties:{'유형':{title:chunks(r.data.title)},'내용(문자본문)':{rich_text:chunks(r.data.body)},'대상':{select:r.data.target?{name:r.data.target}:null}}};
}
async function sourcePage(notion:RegistrationNotion,cursor?:string,since?:number){
 const size=migrationBatchSize(notion,PAGE_SIZE);
 const result=await notion(`databases/${TEMPLATE_DATABASE}/query`,'POST',{page_size:size,sorts:[{timestamp:'last_edited_time',direction:'ascending'}],
  ...(cursor?{start_cursor:cursor}:{}),...(since?{filter:{timestamp:'last_edited_time',last_edited_time:{on_or_after:new Date(since-2000).toISOString()}}}:{})});
 if(!Array.isArray(result.results)||result.results.length>size||result.has_more&&!result.next_cursor||result.next_cursor===cursor&&result.has_more)throw Error('TEMPLATE_SOURCE_MISMATCH');
 return {pages:result.results.map(templatePage),cursor:result.has_more?String(result.next_cursor):null};
}
function safeFailure(error:any){
 const text=String(error?.message||'');return /^(NOTION_(400|401|403|404|409|429|5\d\d)|TEMPLATE_[A-Z_]+)$/.test(text)?text:text.startsWith('CONFIG_ERROR')?'CONFIG_ERROR':'SYNC_TRANSPORT_FAILED';
}
export async function dryRunTemplates(db:any,actor:any,cursor?:string,notion:RegistrationNotion=registrationNotion){
 assertTemplateAccess(actor,true);await assertNotAppOnly(db);const result=await sourcePage(notion,cursor);
 const items=[];for(const p of result.pages){const old=(await refFor(db,p.id).get()).data();
  if(old)assertStored(old,p.id);
  items.push({id:p.id,title:p.data.title,decision:!old?'new':old.dataHash===p.hash?'unchanged':old.status==='pending'||old.status==='failed'||old.status==='conflict'?'review':'update'});
 }
 return {items,cursor:result.cursor,counts:Object.fromEntries(['new','unchanged','review','update'].map(k=>[k,items.filter(i=>i.decision===k).length])),writes:0};
}
async function ingest(db:any,p:ReturnType<typeof templatePage>,at:number,by:string,lease?:{owner:string;field:string;ref:any}){
 return db.runTransaction(async(tx:any)=>{
  const ref=refFor(db,p.id),old=(await tx.get(ref)).data();
  if(lease){const s=(await tx.get(lease.ref)).data();if(s?.[lease.field]!==lease.owner||s?.[lease.field+'Until']<=at)throw Error('TEMPLATE_LEASE_LOST');}
  if(old){assertStored(old,p.id);
   const unchanged=()=>{if(old.sourceWarning)tx.set(ref,{...old,sourceWarning:null});return 'unchanged';};
   if(old.status!=='synced'){
    if(old.status==='conflict'?old.conflict?.hash===p.hash:old.syncedHash===p.hash||old.dataHash===p.hash)return unchanged();
    const next={...old,revision:old.revision+1,status:'conflict',conflict:{data:p.data,hash:p.hash,editedAt:p.editedAt},error:'TEMPLATE_CONFLICT',sourceWarning:null,updatedAt:at};
    tx.set(ref,next);history(tx,db,next,old,'remote-conflict',at,by);return 'conflict';
   }
   if(old.dataHash===p.hash)return unchanged();
  }
  const next={sourceKey:TEMPLATE_SOURCE,academyId:TEMPLATE_ACADEMY,databaseId:TEMPLATE_DATABASE,notionPageId:p.id,data:p.data,dataHash:p.hash,syncedHash:p.hash,
   revision:(old?.revision||0)+1,status:'synced',pendingJobId:null,conflict:null,error:null,remoteEditedAt:p.editedAt,lastSuccessAt:at,updatedAt:at};
  tx.set(ref,next);history(tx,db,next,old,old?'remote-update':'initial-import',at,by);return old?'updated':'created';
 });
}
// One shared source lease, one Notion page per step. Checkpoint is advanced last.
export async function importTemplateStep(db:any,actor:any,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 assertTemplateAccess(actor,true);await assertNotAppOnly(db);const ref=db.collection(TEMPLATE_STATE).doc(TEMPLATE_SOURCE),owner=randomUUID(),started=clock();
 const state=await db.runTransaction(async(tx:any)=>{
  const old=(await tx.get(ref)).data()||{};if(old.pullOwnerUntil>started)throw Error('TEMPLATE_BUSY');
  const next={...old,phase:old.phase==='initial'||old.phase==='catchup'?old.phase:'delta',runStartedAt:old.cursor?old.runStartedAt:started,pullOwner:owner,pullOwnerUntil:started+LEASE_MS,error:null};
  if(!old.phase){next.phase='initial';next.t0=started;}
  tx.set(ref,next);return next;
 });
 try{
  const result=await sourcePage(notion,state.cursor||undefined,state.phase==='initial'?undefined:state.phase==='catchup'?state.t0:state.lastSuccessAt);
  const counts={created:0,updated:0,unchanged:0,conflict:0};
  for(const p of result.pages){const decision=await ingest(db,p,clock(),actor.uid,{owner,field:'pullOwner',ref});counts[decision]++;}
  const next=await db.runTransaction(async(tx:any)=>{
   const current=(await tx.get(ref)).data();if(current?.pullOwner!==owner||current.pullOwnerUntil<=clock())throw Error('TEMPLATE_LEASE_LOST');
   const final={...current,cursor:result.cursor,pullOwner:null,pullOwnerUntil:0};
   if(!result.cursor){if(state.phase==='initial'){final.phase='catchup';}else{final.phase='idle';final.ready=true;final.lastSuccessAt=state.runStartedAt;}}
   tx.set(ref,final);return final;
  });
  return {counts,phase:next.phase,ready:Boolean(next.ready),continue: Boolean(next.cursor)||next.phase==='catchup'};
 }catch(error){await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(s?.pullOwner===owner)tx.set(ref,{...s,pullOwner:null,pullOwnerUntil:0,error:safeFailure(error)});}).catch(()=>{});throw error;}
}
const saveSchema=z.object({id:z.string().uuid(),revision:z.number().int().positive(),operationId:z.string().uuid(),data:editSchema}).strict();
export async function saveTemplate(db:any,actor:any,input:unknown,clock=Date.now){
 assertTemplateAccess(actor,true);const v=saveSchema.parse(input),id=uuid(v.id),jobId=hash([TEMPLATE_SOURCE,v.operationId]),at=clock();
 const intent=hash([actor.uid,id,v.revision,v.data]),ref=refFor(db,id),jobRef=db.collection(TEMPLATE_JOBS).doc(jobId);
 return db.runTransaction(async(tx:any)=>{
  const old=assertStored((await tx.get(ref)).data(),id),receipt=(await tx.get(jobRef)).data();
  const authority=(await tx.get(db.collection('messageTemplateAuthority').doc('main'))).data();
  const proof=authority?.active&&authority.verifiedRunId?(await tx.get(db.collection('messageTemplateVerificationRuns').doc(authority.verifiedRunId))).data():null;
  const appOnly=Boolean(authority?.active&&authority.schemaVersion===1&&proof?.verified&&proof.hash===authority.verificationHash);
  if(receipt){if(receipt.intent!==intent)throw Error('TEMPLATE_REQUEST_CONFLICT');return dto(old);}
  if(old.revision!==v.revision)throw Error('TEMPLATE_REVISION_CONFLICT');
  if(!['synced','pending','failed','app'].includes(old.status)||old.data.archived)throw Error('TEMPLATE_PENDING');
  const priorRef=old.pendingJobId?db.collection(TEMPLATE_JOBS).doc(old.pendingJobId):null,prior=priorRef?(await tx.get(priorRef)).data():null;
  if(priorRef&&(!prior||prior.sourceKey!==TEMPLATE_SOURCE))throw Error('TEMPLATE_REVISION_CONFLICT');
  if(prior?.leaseUntil>at)throw Error('TEMPLATE_BUSY');
  const data={...old.data,...v.data},dataHash=hash(data);if(dataHash===old.dataHash)return dto(old);
  if(appOnly){
   // App-only: saved and final in this transaction. The receipt keeps same-operation retries idempotent.
   const next={...old,data,dataHash,revision:old.revision+1,status:'app',pendingJobId:null,updatedAt:at,error:null};
   if(priorRef)tx.set(priorRef,{...prior,status:'not-needed',leaseOwner:null,leaseUntil:0});
   tx.set(ref,next);history(tx,db,next,old,'app-edit',at,actor.uid);
   tx.set(jobRef,{sourceKey:TEMPLATE_SOURCE,notionPageId:id,revision:next.revision,desired:data,desiredHash:dataHash,intent,status:'not-needed',appOnly:true,attempts:0,createdAt:at,ownerUid:actor.uid,leaseOwner:null,leaseUntil:0});
   return dto(next);
  }
  const next={...old,data,dataHash,revision:old.revision+1,status:'pending',pendingJobId:jobId,updatedAt:at,error:null};
  if(priorRef)tx.set(priorRef,{...prior,status:'superseded',leaseOwner:null,leaseUntil:0});
  tx.set(ref,next);history(tx,db,next,old,'app-edit',at,actor.uid);
  tx.set(jobRef,{sourceKey:TEMPLATE_SOURCE,notionPageId:id,revision:next.revision,desired:data,desiredHash:dataHash,baseHash:old.syncedHash,
   intent,status:'pending',attempts:0,nextAttemptAt:at,createdAt:at,ownerUid:actor.uid,leaseOwner:null,leaseUntil:0});
  return dto(next);
 });
}
export async function templateHistory(db:any,actor:any,id:string){
 assertTemplateAccess(actor,true);assertStored((await refFor(db,id).get()).data(),id);
 const rows=await db.collection(TEMPLATE_HISTORY).where('entityKey','==',templateKey(id)).orderBy('revision','desc').limit(10).get();
 return {records:rows.docs.map((d:any)=>{const r=d.data();return {revision:r.revision,at:r.at,reason:r.reason,data:r.after};})};
}
export async function restoreTemplate(db:any,actor:any,input:unknown){
 assertTemplateAccess(actor,true);
 const v=z.object({id:z.string().uuid(),revision:z.number().int().positive(),historyRevision:z.number().int().positive(),operationId:z.string().uuid()}).strict().parse(input);
 const old=(await db.collection(TEMPLATE_HISTORY).doc(`${templateKey(v.id)}:${v.historyRevision}`).get()).data();
 if(old?.sourceKey!==TEMPLATE_SOURCE||old?.notionPageId!==uuid(v.id)||!old.after||old.after.archived)throw Error('TEMPLATE_NOT_FOUND');
 // Selective restore of text only, through the same CAS + history + durable outbox.
 return saveTemplate(db,actor,{id:v.id,revision:v.revision,operationId:v.operationId,data:{title:old.after.title,body:old.after.body}});
}
export async function retryTemplate(db:any,actor:any,id:string,clock=Date.now){
 assertTemplateAccess(actor,true);await assertNotAppOnly(db);const ref=refFor(db,id),at=clock();
 return db.runTransaction(async(tx:any)=>{
  const old=assertStored((await tx.get(ref)).data(),id);if(!old.pendingJobId||old.status==='conflict')throw Error('TEMPLATE_PENDING');
  const jobRef=db.collection(TEMPLATE_JOBS).doc(old.pendingJobId),job=(await tx.get(jobRef)).data();
  if(!job||job.revision!==old.revision||job.sourceKey!==TEMPLATE_SOURCE)throw Error('TEMPLATE_REVISION_CONFLICT');
  if(job.leaseUntil>at)throw Error('TEMPLATE_BUSY');
  tx.set(jobRef,{...job,status:'pending',nextAttemptAt:at,attempts:0,leaseOwner:null,leaseUntil:0,error:null});
  tx.set(ref,{...old,status:'pending',error:null});return {queued:true};
 });
}
function properties(data:TemplateValue){
 const chunks=(value:string)=>Array.from({length:Math.ceil(value.length/1800)},(_,i)=>({text:{content:value.slice(i*1800,(i+1)*1800)}}));
 // Existing page only. Preserve target, unrelated fields, relations and formatting outside these edited fields.
 return {'유형':{title:chunks(data.title)},'내용(문자본문)':{rich_text:chunks(data.body)}};
}
export async function processTemplateJob(db:any,jobId:string,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 const jr=db.collection(TEMPLATE_JOBS).doc(jobId),owner=randomUUID(),at=clock();
 const {templateAppActive}=await import('./messageTemplateAuthority.js');
 if(await templateAppActive(db)){
  // No Notion copy after the switch: retire the job without any Notion call.
  await db.runTransaction(async(tx:any)=>{const old=(await tx.get(jr)).data();if(old&&['pending','retry','running'].includes(old.status)&&!(old.leaseUntil>at))tx.set(jr,{...old,status:'not-needed',leaseOwner:null,leaseUntil:0,finishedAt:at});});
  return 'skipped';
 }
 const job=await db.runTransaction(async(tx:any)=>{
  const old=(await tx.get(jr)).data();if(!old||old.sourceKey!==TEMPLATE_SOURCE||!['pending','retry','running'].includes(old.status)||old.nextAttemptAt>at||old.leaseUntil>at)return null;
  const ref=refFor(db,old.notionPageId),row=assertStored((await tx.get(ref)).data(),old.notionPageId);
  if(row.pendingJobId!==jobId||row.revision!==old.revision||row.status==='conflict'){tx.set(jr,{...old,status:'superseded',leaseUntil:0});return null;}
  const next={...old,status:'running',attempts:old.attempts+1,leaseOwner:owner,leaseUntil:at+LEASE_MS,nextAttemptAt:at+LEASE_MS};tx.set(jr,next);return next;
 });
 if(!job)return 'skipped';
 const guard=async(tx:any)=>{
  const current=(await tx.get(jr)).data(),ref=refFor(db,job.notionPageId),row=assertStored((await tx.get(ref)).data(),job.notionPageId);
  if(current?.leaseOwner!==owner||current.leaseUntil<=clock()||row.pendingJobId!==jobId||row.revision!==job.revision)throw Error('TEMPLATE_LEASE_LOST');
  return {current,row,ref};
 };
 const finish=async(remote:ReturnType<typeof templatePage>)=>db.runTransaction(async(tx:any)=>{
  const {current,row,ref}=await guard(tx);
  if(remote.hash!==job.desiredHash){const next={...row,revision:row.revision+1,status:'conflict',conflict:{data:remote.data,hash:remote.hash,editedAt:remote.editedAt},error:'TEMPLATE_CONFLICT'};
   tx.set(ref,next);history(tx,db,next,row,'publish-conflict',clock(),'worker');tx.set(jr,{...current,status:'conflict',leaseOwner:null,leaseUntil:0});return 'conflict';}
  tx.set(ref,{...row,status:'synced',syncedHash:remote.hash,remoteEditedAt:remote.editedAt,lastSuccessAt:clock(),error:null,pendingJobId:null,conflict:null});
  tx.set(jr,{...current,status:'done',leaseOwner:null,leaseUntil:0,finishedAt:clock()});return 'done';
 });
 try{
  const remote=templatePage(await notion(`pages/${job.notionPageId}`));
  if(remote.hash===job.desiredHash)return await finish(remote); // Lost response/commit: acknowledge, never recreate.
  if(remote.hash!==job.baseHash)return await finish(remote);
  await db.runTransaction(guard); // Fresh local revision/fence immediately before the remote side effect.
  const patched=templatePage(await notion(`pages/${job.notionPageId}`,'PATCH',{properties:properties(job.desired)}));
  return await finish(patched);
 }catch(error){
  const code=safeFailure(error);if(code==='TEMPLATE_LEASE_LOST')return 'skipped';
  await db.runTransaction(async(tx:any)=>{
   const {current,row,ref}=await guard(tx);
   const blocked=/NOTION_(400|401|403|404)|TEMPLATE_(SOURCE|SCHEMA)|CONFIG_ERROR/.test(code)||current.attempts>=8;
   tx.set(jr,{...current,status:blocked?'blocked':'retry',error:code,leaseOwner:null,leaseUntil:0,nextAttemptAt:clock()+Math.min(3600000,30000*2**Math.min(current.attempts,7))});
   tx.set(ref,{...row,status:'failed',error:code});
  });return 'failed';
 }
}
export async function processDueTemplates(db:any,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 const jobs=await db.collection(TEMPLATE_JOBS).where('sourceKey','==',TEMPLATE_SOURCE).where('status','in',['pending','retry','running']).where('nextAttemptAt','<=',clock()).orderBy('nextAttemptAt').limit(5).get();
 const counts={done:0,failed:0,conflict:0,skipped:0};for(const d of jobs.docs)counts[await processTemplateJob(db,d.id,notion,clock)]++;return counts;
}
export async function resolveTemplate(db:any,actor:any,input:unknown,clock=Date.now){
 assertTemplateAccess(actor,true);
 const v=z.object({id:z.string().uuid(),revision:z.number().int().positive(),remoteHash:z.string().regex(/^[a-f0-9]{64}$/),choice:z.enum(['app','notion']),operationId:z.string().uuid()}).strict().parse(input);
 const ref=refFor(db,v.id),newJobId=hash([TEMPLATE_SOURCE,v.operationId]),at=clock();
 return db.runTransaction(async(tx:any)=>{
  const old=assertStored((await tx.get(ref)).data(),v.id),newJobRef=db.collection(TEMPLATE_JOBS).doc(newJobId),receipt=(await tx.get(newJobRef)).data(),intent=hash([actor.uid,v]);
  if(receipt){if(receipt.intent!==intent)throw Error('TEMPLATE_REQUEST_CONFLICT');return dto(old);}
  if(old.revision!==v.revision||old.status!=='conflict'||old.conflict?.hash!==v.remoteHash)throw Error('TEMPLATE_REVISION_CONFLICT');
  const jr=old.pendingJobId?db.collection(TEMPLATE_JOBS).doc(old.pendingJobId):null,job=jr?(await tx.get(jr)).data():null;
  if(job?.leaseUntil>at)throw Error('TEMPLATE_BUSY');
  const remote=old.conflict,data=v.choice==='notion'?remote.data:old.data;
  if(v.choice==='app'&&remote.data.archived)throw Error('TEMPLATE_ARCHIVED');
  const next={...old,data,dataHash:hash(data),syncedHash:remote.hash,revision:old.revision+1,status:v.choice==='notion'?'synced':'pending',pendingJobId:v.choice==='notion'?null:newJobId,conflict:null,error:null,updatedAt:at};
  if(jr)tx.set(jr,{...job,status:'superseded',leaseOwner:null,leaseUntil:0});
  tx.set(ref,next);history(tx,db,next,old,'resolve-'+v.choice,at,actor.uid);
  tx.set(newJobRef,{sourceKey:TEMPLATE_SOURCE,notionPageId:uuid(v.id),revision:next.revision,desired:data,desiredHash:next.dataHash,baseHash:remote.hash,
   intent,status:v.choice==='notion'?'done':'pending',attempts:0,nextAttemptAt:at,createdAt:at,ownerUid:actor.uid,leaseOwner:null,leaseUntil:0});return dto(next);
 });
}
// Low-frequency bounded reconciliation. 403/404 is unknown, never an automatic deletion.
export async function reconcileTemplateStep(db:any,actor:any,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 assertTemplateAccess(actor,true);await assertNotAppOnly(db);const ref=db.collection(TEMPLATE_STATE).doc(TEMPLATE_SOURCE),owner=randomUUID(),at=clock();
 const state=await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data()||{};if(s.reconcileOwnerUntil>at)throw Error('TEMPLATE_BUSY');tx.set(ref,{...s,reconcileOwner:owner,reconcileOwnerUntil:at+LEASE_MS});return s;});
 try{
  const snapshot=await pageQuery(db,state.reconcileCursor||undefined,6).get(),docs=snapshot.docs.slice(0,5),counts={checked:0,unknown:0,changed:0};
  for(const d of docs){const row=assertStored(d.data());try{
   const p=templatePage(await notion(`pages/${row.notionPageId}`));if(await ingest(db,p,clock(),'reconcile',{owner,field:'reconcileOwner',ref})!=='unchanged')counts.changed++;
  }catch(e){if(!['NOTION_403','NOTION_404'].includes(safeFailure(e)))throw e;
   await db.runTransaction(async(tx:any)=>{const r=(await tx.get(d.ref)).data(),s=(await tx.get(ref)).data();if(s?.reconcileOwner!==owner||s.reconcileOwnerUntil<=clock())throw Error('TEMPLATE_LEASE_LOST');if(r&&!r.sourceWarning)tx.set(d.ref,{...r,sourceWarning:safeFailure(e)});});counts.unknown++;}counts.checked++;}
  const more=snapshot.docs.length>5;
  await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(s?.reconcileOwner!==owner||s.reconcileOwnerUntil<=clock())throw Error('TEMPLATE_LEASE_LOST');tx.set(ref,{...s,reconcileCursor:more?docs.at(-1)?.data().notionPageId:null,reconcileOwner:null,reconcileOwnerUntil:0,...(!more?{lastReconcileAt:at}:{})});});
  return {counts,continue:more};
 }catch(error){await db.runTransaction(async(tx:any)=>{const s=(await tx.get(ref)).data();if(s?.reconcileOwner===owner)tx.set(ref,{...s,reconcileOwner:null,reconcileOwnerUntil:0,error:safeFailure(error)});}).catch(()=>{});throw error;}
}
