import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {GRADE_DATABASE} from './academic.js';
import {gradeNotion} from './teacherAcademicNotion.js';
import {canAccessOwned,canTeach} from './teacherWorkspacePolicy.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {readStudentMapping} from './studentIdentity.js';
/** Keep the source row and app tombstone. Retries reconcile an uncertain archive. */
export async function archiveTeacherAcademic(db:any,actor:any,idInput:unknown,revision:unknown,notion=gradeNotion){
 const id=z.string().uuid().parse(idInput),version=z.number().int().positive().parse(revision),ref=db.collection('teacherAcademicDrafts').doc(id),lease=randomUUID();
 const record=await db.runTransaction(async(tx:any)=>{
  const old=(await tx.get(ref)).data();
  if(!old||!canAccessOwned(actor,old.ownerUid)||!canTeach(actor,old.data.studentKey,old.data.subject)||!actor.admin&&old.academyId!==actor.academyId)throw Error('FORBIDDEN');
  if(old.revision!==version)throw Error('DRAFT_CONFLICT');
  if(old.archived)return {...old,alreadyArchived:true};
  if(old.notionWrite?.leaseUntil>Date.now()||old.deleteLeaseUntil>Date.now()||['publishing','notion_saved'].includes(old.stage)&&Date.now()-(old.publishStartedAt||Date.now())<180000)throw Error('PUBLISH_IN_PROGRESS');
  tx.update(ref,{deleteRequested:true,deleteLease:lease,deleteLeaseUntil:Date.now()+180000});return old;
 });
 if(record.alreadyArchived)return {archived:true};
 async function checkpoint(patch:any){await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.deleteLease!==lease||current.revision!==version)throw Error('DRAFT_CONFLICT');tx.update(ref,patch);});}
 try{
  let pageId=record.notionPageId||record.notionWrite?.pageId;
  if(!pageId&&record.notionWrite){
   const found=await notion(`databases/${GRADE_DATABASE}/query`,'POST',{filter:{property:'앱 기록 ID',rich_text:{equals:id}},page_size:2});
   if(found.has_more||!Array.isArray(found.results)||found.results.length>1)throw Error('DUPLICATE_NOTION_RECORD');
   pageId=found.results[0]?.id;
   if(!pageId&&record.notionWrite.attempted)throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
  }
  if(pageId){
   pageId=uuid(pageId);const page=await notion(`pages/${pageId}`),p=page.properties||{};
   if(uuid(page.id)!==pageId||uuid(page.parent?.database_id||'')!==GRADE_DATABASE||p['학생']?.has_more||p['학생']?.relation?.length!==1||uuid(p['학생'].relation[0].id)!==uuid(record.data.studentKey))throw Error('NOTION_SOURCE_MISMATCH');
   const marker=(p['앱 기록 ID']?.rich_text||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');
   if(marker&&marker!==id)throw Error('NOTION_SOURCE_MISMATCH');
   if(!page.archived&&!page.in_trash&&record.notionEditedAt&&page.last_edited_time!==record.notionEditedAt)throw Error('NOTION_EDIT_CONFLICT');
   await checkpoint({notionPageId:pageId,deleteAttempted:true});
   if(!page.archived&&!page.in_trash)await notion(`pages/${pageId}`,'PATCH',{archived:true});
   const confirmed=await notion(`pages/${pageId}`);
   if(uuid(confirmed.id)!==pageId||!confirmed.archived&&!confirmed.in_trash)throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
  }
  const mapping=pageId?await readStudentMapping(db,record.data.studentKey):null;
  await db.runTransaction(async(tx:any)=>{
   const current=(await tx.get(ref)).data();
   const targets=pageId?[db.collection('academicRecords').doc(pageId),db.collection('academicRecords').doc(pageId.replace(/-/g,'')),db.collection('examResults').doc(pageId),db.collection('examResults').doc(pageId.replace(/-/g,''))]:[];
   const snapshots=await Promise.all(targets.map(target=>tx.get(target)));
   if(current?.deleteLease!==lease||current.revision!==version)throw Error('DRAFT_CONFLICT');
   for(let i=0;i<snapshots.length;i++)if(snapshots[i].exists){const value=snapshots[i].data();if(value.teacherDraftId&&value.teacherDraftId!==id||!mapping||value.internalStudentId!==mapping.internalStudentId)throw Error('SOURCE_IDENTITY_LOCKED');}
   for(let i=0;i<snapshots.length;i++)if(snapshots[i].exists)tx.set(targets[i],{...snapshots[i].data(),removed:true,archived:true,teacherDraftId:id,teacherAppRevision:version});
   tx.update(ref,{archived:true,stage:'archived',failureCode:null,deleteLease:null,deleteLeaseUntil:0,updatedAt:Date.now()});
  });return {archived:true};
 }catch(error:any){await checkpoint({deleteLease:null,deleteLeaseUntil:0,failureCode:error.message}).catch(()=>{});throw error;}
}

export async function cancelAcademicArchive(db:any,actor:any,idInput:unknown,revision:unknown){
 const id=z.string().uuid().parse(idInput),version=z.number().int().positive().parse(revision),ref=db.collection('teacherAcademicDrafts').doc(id);
 await db.runTransaction(async(tx:any)=>{const r=(await tx.get(ref)).data();
  if(!r||r.archived||!canAccessOwned(actor,r.ownerUid,r.academyId)||!canTeach(actor,r.data.studentKey,r.data.subject))throw Error('FORBIDDEN');
  if(r.revision!==version)throw Error('DRAFT_CONFLICT');
  if(r.deleteLeaseUntil>Date.now())throw Error('PUBLISH_IN_PROGRESS');
  if(r.deleteAttempted)throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
  tx.update(ref,{deleteRequested:false,deleteLease:null,deleteLeaseUntil:0,failureCode:null});
 });return {cancelled:true};
}
