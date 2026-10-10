import {createHash} from 'node:crypto';
import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';

// Templates were imported once from one Notion database; its ID stays part of every stored template's key. Never accept an academy/DB from a browser.
export const TEMPLATE_DATABASE='ec10d0f1-c79a-8312-946b-811e86041ee2';
export const TEMPLATE_ACADEMY='main';
export const TEMPLATE_SOURCE=createHash('sha256').update(JSON.stringify([TEMPLATE_ACADEMY,TEMPLATE_DATABASE])).digest('hex');
export const TEMPLATE_COLLECTION='messageTemplateSources';
export const TEMPLATE_JOBS='messageTemplateJobs';
export const TEMPLATE_STATE='messageTemplateSync';
export const TEMPLATE_HISTORY='messageTemplateHistory';
const PAGE_SIZE=20;
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
export function assertTemplateAccess(actor:any,write=false){
 if(actor.academyId!==TEMPLATE_ACADEMY || write&& !actor.admin)throw Error('FORBIDDEN');
}
function assertStored(row:any,id?:string){
 if(!row||row.sourceKey!==TEMPLATE_SOURCE||row.academyId!==TEMPLATE_ACADEMY||row.databaseId!==TEMPLATE_DATABASE||id&&row.notionPageId!==uuid(id))throw Error('TEMPLATE_NOT_FOUND');
 return row;
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
  // Templates are app-only; there is no Notion write to queue any more.
  throw Error('TEMPLATE_APP_REQUIRED');
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
