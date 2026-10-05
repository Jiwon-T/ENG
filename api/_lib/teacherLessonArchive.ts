import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {canAccessOwned,canTeach} from './teacherWorkspacePolicy.js';
import {registrationNotion,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
/** Archive one explicitly selected draft, never match by student name/date. */
export async function archiveTeacherLesson(db:any,actor:any,idInput:unknown,revision:unknown,notion:RegistrationNotion=registrationNotion){
 const id=z.string().uuid().parse(idInput),version=z.number().int().positive().parse(revision),ref=db.collection('teacherLessonDrafts').doc(id),lease=randomUUID();
 const r=await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();
 if(!old||!canAccessOwned(actor,old.ownerUid)||!canTeach(actor,old.data.studentKey,old.data.subject))throw Error('FORBIDDEN');
 if(old.revision!==version)throw Error('DRAFT_CONFLICT');if(old.archived)return {...old,alreadyArchived:true};
 if(old.notionWrite?.leaseUntil>Date.now()||old.deleteLeaseUntil>Date.now()||old.stage==='publishing'&&Date.now()-(old.publishStartedAt||Date.now())<180000)throw Error('PUBLISH_IN_PROGRESS');
 const next={...old,deleteRequested:true,deleteLease:lease,deleteLeaseUntil:Date.now()+180000};tx.set(ref,next);return {...next,previousDeleteRequested:Boolean(old.deleteRequested)};});
 if(r.alreadyArchived)return {archived:true};
 let archiveAttempted=false;
 try{
 let pageId=r.notionPageId||r.notionWrite?.pageId;const recovered=!pageId;const database=r.notionWrite?.database;
 if(!pageId&&database){const found=await notion(`databases/${database}/query`,'POST',{filter:{property:'앱 기록 ID',rich_text:{equals:id}},page_size:2});
 if(found.has_more||!Array.isArray(found.results)||found.results.length>1)throw Error('DUPLICATE_NOTION_RECORD');
 pageId=found.results[0]?.id;
 if(!pageId&&r.notionWrite?.attempted)throw Error('NOTION_WRITE_RESULT_UNCERTAIN');}
 if(pageId){pageId=uuid(pageId);const page=await notion(`pages/${pageId}`);
 if(uuid(page.id)!==pageId||database&&uuid(page.parent?.database_id)!==uuid(database)||page.properties?.['학생']?.has_more||page.properties?.['학생']?.relation?.length!==1||uuid(page.properties['학생'].relation[0].id)!==uuid(r.data.studentKey))throw Error('NOTION_SOURCE_MISMATCH');
 if(recovered&&(page.properties?.['앱 기록 ID']?.rich_text||[]).map((t:any)=>t.plain_text??t.text?.content??'').join('')!==id)throw Error('NOTION_SOURCE_MISMATCH');
 await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.deleteLease!==lease||current.revision!==version)throw Error('DRAFT_CONFLICT');tx.update(ref,{notionPageId:pageId});});
 archiveAttempted=true;
 if(!page.archived&&!page.in_trash)await notion(`pages/${pageId}`,'PATCH',{archived:true});
 }
 await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();const reports=await tx.get(db.collection('lessonReports').where('teacherDraftId','==',id));
 const candidates=[...new Set([id,pageId,pageId?.replace(/-/g,'')].filter(Boolean))];const mirrors=await Promise.all(candidates.map(key=>tx.get(db.collection('lessonReports').doc(key))));
 if(current?.deleteLease!==lease||current.revision!==version)throw Error('DRAFT_CONFLICT');
 for(const d of [...reports.docs,...mirrors])if(d.exists){const v=d.data();if(v.teacherDraftId===id||!v.teacherDraftId&&v.studentKey&&uuid(v.studentKey)===uuid(r.data.studentKey)&&pageId&&uuid(v.notionPageId)===pageId)tx.delete(d.ref);}
 tx.set(ref,{...current,archived:true,stage:'archived',notionPageId:pageId||current.notionPageId||null,deleteLease:null,deleteLeaseUntil:0,updatedAt:Date.now()});
 });return {archived:true};
 }catch(e){await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.deleteLease===lease)tx.update(ref,{deleteLease:null,deleteLeaseUntil:0,...(!archiveAttempted?{deleteRequested:r.previousDeleteRequested}: {})});}).catch(()=>{});throw e;}
}
