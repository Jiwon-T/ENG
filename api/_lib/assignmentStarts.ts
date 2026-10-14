// 담당 시작일: the day a teacher started on a student's subject — their own "등록일" for that student, which differs
// from the 학원 등록일 and from the 과목 시작일 when the student came from another teacher. Stored when a teacher is
// put on a subject (원서, 수강 관리, 선생님 관리, an account link); for assignments made before that, the latest
// 담당 변경 that added them, else the 과목 시작일. The teacher themselves, the principal and the admin may correct it.
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {subjects} from './teacherWorkspacePolicy.js';

export const ASSIGNMENT_STARTS='teacherAssignmentStarts';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const startId=(uid:string,studentKey:string,subject:string)=>createHash('sha256').update(`assignment-start:${uid}:${uuid(studentKey)}:${subject}`).digest('hex');
export const seoulDay=(at=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(at));
/** A teacher put on a subject today starts today, or on the 과목 시작일 when that is later. */
export const startDayFor=(subjectStart:string|null|undefined,at=Date.now())=>{const today=seoulDay(at);return subjectStart&&subjectStart>today?subjectStart:today;};
export function writeAssignmentStart(tx:any,db:any,v:{uid:string;studentKey:string;subject:string;since:string;by:string;at:number;source:string}){
 tx.set(db.collection(ASSIGNMENT_STARTS).doc(startId(v.uid,v.studentKey,v.subject)),{academyId:'main',uid:v.uid,studentKey:uuid(v.studentKey),subject:v.subject,since:v.since,by:v.by,at:v.at,source:v.source});
}
/** 담당 시작일 for (teacher, subject) pairs of one or more students: stored, else from 담당 변경, else 과목 시작일. */
export function resolveStarts(pairs:{uid:string;studentKey:string;subject:string;subjectStart?:string|null}[],stored:any[],transfers:any[]){
 return pairs.map(p=>{
  const key=uuid(p.studentKey),own=stored.find(s=>s.uid===p.uid&&uuid(s.studentKey)===key&&s.subject===p.subject);
  if(own?.since)return {...p,since:own.since as string,known:true};
  const added=transfers.filter(t=>uuid(t.studentKey||'')===key&&t.subject===p.subject&&(t.toUids||[]).includes(p.uid)).sort((a,b)=>b.at-a.at)[0];
  return {...p,since:added?seoulDay(added.at):p.subjectStart||null,known:false};
 });
}
/** The signed-in teacher's own 담당 시작일 per student and subject (학생 관리 summary). */
export async function myAssignmentStarts(db:any,uid:string,students:any[]){
 const pairs=students.flatMap((s:any)=>(s.subjects||[]).map((x:any)=>({uid,studentKey:s.studentKey,subject:x.subject,subjectStart:x.startDate||x.startAt||null})));
 if(!pairs.length)return new Map<string,Record<string,string>>();
 const [stored,transfers]=await Promise.all([db.collection(ASSIGNMENT_STARTS).where('uid','==',uid).limit(1001).get(),db.collection('teacherTransfers').where('toUids','array-contains',uid).limit(1001).get()]);
 const out=new Map<string,Record<string,string>>();
 for(const r of resolveStarts(pairs,stored.docs.map((d:any)=>d.data()),transfers.docs.map((d:any)=>d.data())))if(r.since)out.set(r.studentKey,{...(out.get(r.studentKey)||{}),[r.subject]:r.since});
 return out;
}
/** Correct a 담당 시작일: the teacher themselves (on their own student), the principal or the admin. */
export async function setAssignmentStart(db:any,actor:any,input:unknown){
 const v=z.object({uid:z.string().min(1).max(200),studentKey:z.string().uuid(),subject:z.enum(subjects),since:day}).strict().parse(input);
 if(actor.academyId!=='main')throw Error('FORBIDDEN');
 const key=uuid(v.studentKey),profileRef=db.collection('teacherWorkspaceAccess').doc(v.uid),ref=db.collection(ASSIGNMENT_STARTS).doc(startId(v.uid,key,v.subject));
 return db.runTransaction(async(tx:any)=>{
  const profile=(await tx.get(profileRef)).data(),old=(await tx.get(ref)).data();
  const teaches=(profile?.scopes||[]).some((s:any)=>uuid(s.studentKey)===key&&s.subject===v.subject);
  if(!profile||profile.academyId!=='main'||!teaches)throw Error('ASSIGNMENT_NOT_FOUND');
  if(!actor.admin&&!actor.principal&&actor.uid!==v.uid)throw Error('FORBIDDEN');
  const at=Date.now();
  writeAssignmentStart(tx,db,{uid:v.uid,studentKey:key,subject:v.subject,since:v.since,by:actor.uid,at,source:'edit'});
  tx.set(db.collection('teacherAssignmentStartHistory').doc(`${ref.id}:${at}`),{uid:v.uid,studentKey:key,subject:v.subject,before:old?.since??null,after:v.since,by:actor.uid,at});
  return {since:v.since};
 });
}
