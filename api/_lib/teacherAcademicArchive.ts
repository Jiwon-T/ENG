import {z} from 'zod';
import {canAccessOwned,canTeach} from './teacherWorkspacePolicy.js';
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
