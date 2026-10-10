import {createHash} from 'node:crypto';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashStudentKey} from './security.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {REGISTRATION_STUDENT_DATABASE} from './teacherStudentRegistrationNotion.js';
export const DIRECTORY_ROWS='academyDirectorySources',DIRECTORY_STATE='academyDirectorySync',DIRECTORY_HISTORY='academyDirectoryHistory';
export const DIRECTORY_CORE_AUTHORITY='academyCoreAuthority';
export const directoryKinds=['students','teachers','enrollments'] as const;
export type DirectoryKind=typeof directoryKinds[number];
const databases={students:REGISTRATION_STUDENT_DATABASE,teachers:'3d274aff-32ce-4a33-870d-2689259113a6',enrollments:'3ec0d0f1-c79a-80b2-bb52-ea162888fe9a'};
const digest=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const directorySourceKey=(kind:DirectoryKind)=>digest(['main',databases[kind]]);
export const directoryRowKey=(kind:DirectoryKind,id:string)=>digest(['main',databases[kind],uuid(id)]);
export function directoryStudentReads(actor:any){return actor.academyId==='main'&&Boolean(actor.coreMode);}
function title(p:any){const t=p['학생']||p['학생 이름']||p['이름 및 일지']||Object.values(p).find((v:any)=>v.type==='title');return (t?.title||[]).map((v:any)=>v.plain_text??v.text?.content??'').join('');}
function rowsQuery(db:any,kind:DirectoryKind,cursor?:string,limit=21){let q=db.collection(DIRECTORY_ROWS).where('sourceKey','==',directorySourceKey(kind)).orderBy('notionPageId');if(cursor)q=q.startAfter(uuid(cursor));return q.limit(limit);}
function studentDTO(r:any){const p=r.fields.properties;return {studentKey:r.entityId||r.notionPageId,studentDisplayName:r.summaryOverride?.studentDisplayName||title(p)||'학생',hasGuardianContact:r.summaryOverride?.hasGuardianContact??String(p['보호자연락처']?.phone_number||'').replace(/\D/g,'').length>=9,enrollmentStatus:p['등록상태']?.status?.name||''};}
export async function readDirectoryStudents(db:any,actor:any){
 if(actor.academyId!=='main')throw Error('FORBIDDEN');if(!actor.coreMode)throw Error('CORE_NOT_READY');const ready=(await db.collection(DIRECTORY_STATE).doc(directorySourceKey('students')).get()).data();if(!ready?.ready||!ready.approved)throw Error('DIRECTORY_NOT_READY');
 if(ready.leaseUntil>Date.now())throw Error('DIRECTORY_BUSY');
 let rows:any[];
 if(actor.admin||actor.principal){const list=await rowsQuery(db,'students',undefined,501).get();if(list.docs.length>500)throw Error('DIRECTORY_PAGE_LIMIT');rows=list.docs.map((d:any)=>d.data());}
 else{const keys=[...new Set<string>((actor.scopes||[]).map((s:any)=>uuid(s.studentKey)))];if(keys.length>500)throw Error('DIRECTORY_PAGE_LIMIT');rows=(await Promise.all(keys.map(key=>db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students',key)).get()))).filter((d:any)=>d.exists).map((d:any)=>d.data());}
 for(const r of rows)if(r.sourceKey!==directorySourceKey('students')||r.academyId!=='main')throw Error('DIRECTORY_SOURCE_MISMATCH');
 // Memberships in one parallel batch (was one round trip per student).
 const live=rows.filter(r=>!(r.issue||!r.fields||r.fields.archived)),members=await Promise.all(live.map(r=>db.collection('academyStudentMemberships').doc(r.entityId||r.notionPageId).get()));
 const out=[];for(let i=0;i<live.length;i++){const r=live[i];
  const member=members[i].data();
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
