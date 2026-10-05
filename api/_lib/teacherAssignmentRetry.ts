import {randomUUID} from 'node:crypto';
import {syncTeacherAssignments} from './teacherAssignmentSync.js';
export async function assignmentCheckpoint(db:any,uid:string,lease:string,patch:any) {
 return db.runTransaction(async(tx:any)=>{const ref=db.collection('teacherWorkspaceAccess').doc(uid),p=(await tx.get(ref)).data();
 if(!p||p.disabled||p.notionAssignmentLease!==lease)throw Error('DRAFT_CONFLICT');tx.update(ref,patch);});
}
export async function retryTeacherAssignment(db:any,actor:any,uid:string) {
 const lease=randomUUID(),ref=db.collection('teacherWorkspaceAccess').doc(uid);
 const p=await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();
 if(!old||old.disabled||!actor.admin&&(!actor.principal||old.academyId!==actor.academyId))throw Error('FORBIDDEN');
 if(old.notionTeacherPageId){const linked=await tx.get(db.collection('teacherWorkspaceAccess').where('notionTeacherPageId','==',old.notionTeacherPageId));if(linked.docs.some((d:any)=>d.id!==uid&&!d.data().disabled))throw Error('NOTION_TEACHER_ID_CONFLICT');}
 if(old.notionAssignmentLeaseUntil>Date.now())throw Error('PUBLISH_IN_PROGRESS');
 const keys=[...new Set([...old.scopes,...(old.previousNotionAssignment?.scopes||[])].map((s:any)=>s.studentKey))];
 const members=await Promise.all(keys.map((k:any)=>tx.get(db.collection('academyStudentMemberships').doc(k))));
 if(members.some((m:any)=>!m.exists||m.data().disabled||m.data().academyId!==old.academyId))throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
 tx.update(ref,{notionAssignmentStage:'pending',notionAssignmentLease:lease,notionAssignmentLeaseUntil:Date.now()+180000});return old;});
 try {
 await syncTeacherAssignments(p,p.previousNotionAssignment||null,undefined,()=>assignmentCheckpoint(db,uid,lease,{notionAssignmentTouched:true,notionAssignmentLeaseUntil:Date.now()+180000}));
 await assignmentCheckpoint(db,uid,lease,{notionAssignmentStage:'synced',notionAssignmentError:null,previousNotionAssignment:null,notionAssignmentTouched:false,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});
 return {ok:true};
 }catch(e:any){await assignmentCheckpoint(db,uid,lease,{notionAssignmentStage:'failed',notionAssignmentError:e.message,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});return {ok:true,syncError:e.message};}
}
