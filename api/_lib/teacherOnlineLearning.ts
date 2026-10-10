import {FieldPath,Timestamp} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {readStudentMapping} from './studentIdentity.js';
import {hashStudentKey} from './security.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {reviewSubjects} from './teacherReportReview.js';
import {encodeReportCursor,decodeReportCursor} from './parentReportPage.js';
const text=(v:any,max=1200)=>typeof v==='string'?v.slice(0,max):'';
const number=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:null;
function date(v:any){const ms=v?.toMillis?.()??(typeof v?.seconds==='number'?v.seconds*1000+Math.floor((v.nanoseconds||0)/1e6):Date.parse(v));return Number.isFinite(ms)?new Date(ms).toISOString():null;}
const empty=(reason:string,linked=false)=>({linked,studentLinked:linked,parentUrl:null,subjectOptions:['영어'],reports:[],schedules:[],academic:{records:[],subjects:[],academyScores:[]},online:{reason,evaluation:undefined as undefined|{text:string;updatedAt:string|null},sessions:[],assignments:[],progress:null,nextCursor:null}});
/** The student's own app account for this student record, after the same two-way link checks the report uses. */
async function linkedStudentAccount(db:any,key:string,deps:{readStudentMapping:typeof readStudentMapping}):Promise<{uid:string;user:any;mapping:any}|{reason:string}>{
 const mapping=await deps.readStudentMapping(db,key);if(!mapping?.firebaseUid)return {reason:'account-not-linked'};
 const user=(await db.collection('users').doc(mapping.firebaseUid).get()).data();if(!user||user.role!=='student'||user.disabled||!user.notionStudentKey)return {reason:'account-not-linked'};
 let backlink:string;try{backlink=uuid(user.notionStudentKey);}catch{const alias=await deps.readStudentMapping(db,user.notionStudentKey);if(!alias||alias.firebaseUid!==mapping.firebaseUid||alias.internalStudentId!==mapping.internalStudentId)return {reason:'account-link-mismatch'};backlink=uuid(alias.notionStudentPageId);}
 if(backlink!==key)return {reason:'account-link-mismatch'};
 return {uid:mapping.firebaseUid,user,mapping};
}
export async function loadTeacherOnlineLearning(db:any,actor:any,keyInput:unknown,subjectInput:unknown,cursorInput:unknown,deps={readStudentMapping}){
 const key=uuid(z.string().uuid().parse(keyInput)),subject=z.string().max(100).parse(subjectInput||''),cursor=z.string().max(2048).optional().parse(cursorInput||undefined);
 const allowed=reviewSubjects(actor,key);
 // The current app's word/grammar/exam activities are English learning. Missing
 // subject metadata must not grant a maths-only teacher access to this history.
 if(allowed&&!allowed.has('영어')||subject&&subject!=='영어')return empty('subject-not-available');
 const link=await linkedStudentAccount(db,key,deps);if('reason' in link)return empty(link.reason);const {user,mapping}=link;
 const uid=mapping.firebaseUid,binding=createHash('sha256').update(JSON.stringify(['online-learning',actor.uid,key,uid,subject])).digest('hex');
 let query=db.collection('studySessions').where('uid','==',uid).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
 if(cursor){const c=decodeReportCursor(cursor,binding),t=z.object({seconds:z.number().int(),nanoseconds:z.number().int().min(0).max(999999999)}).strict().parse(JSON.parse(c.date));query=query.startAfter(new Timestamp(t.seconds,t.nanoseconds),c.id);}
 const [sessions,allWords,learned,assignments,evaluation]=await Promise.all([
  query.limit(21).get(),db.collection('wordProgress').where('uid','==',uid).count().get(),db.collection('wordProgress').where('uid','==',uid).where('status','==','learned').count().get(),
  db.collection('assignments').where('studentUid','==',uid).orderBy('createdAt','desc').limit(10).get(),
  // The teacher's short evaluation (shown on the student's own 학습 리포트), with the first page only.
  cursor?Promise.resolve(null):db.collection('evaluations').doc(uid).get(),
 ]);
 const latest=await deps.readStudentMapping(db,key),latestUser=(await db.collection('users').doc(uid).get()).data();
 if(latest?.firebaseUid!==uid||latest?.internalStudentId!==mapping.internalStudentId||latestUser?.notionStudentKey!==user.notionStudentKey||latestUser?.disabled||latestUser?.role!=='student')return empty('account-link-mismatch');
 const docs=sessions.docs.slice(0,20),rows=docs.filter((d:any)=>d.data().uid===uid&&(!d.data().subject||d.data().subject==='영어')).map((d:any)=>{const r=d.data(),answers=Array.isArray(r.incorrectAnswers)?r.incorrectAnswers:[];return {
  id:d.id,wordbookTitle:text(r.wordbookTitle,450)||'단어장',type:text(r.type,50),category:text(r.category,50)||'word',wordbookType:text(r.wordbookType,100),createdAt:date(r.createdAt),duration:number(r.duration),score:number(r.score),totalItems:number(r.totalItems),dayStart:number(r.dayStart),dayEnd:number(r.dayEnd),incorrectCount:answers.length,
  incorrectAnswers:answers.slice(0,100).map((a:any)=>({word:text(a.word),meaning:text(a.meaning),userChoice:text(a.userChoice),correctAnswer:text(a.correctAnswer),quizSentence:text(a.quizSentence,3000),isReviewed:Boolean(a.isReviewed)})),
 };});
 const last=docs.at(-1),ts=last?.data().createdAt;
 const nextCursor=sessions.docs.length>20&&last&&typeof ts?.seconds==='number'?encodeReportCursor(binding,JSON.stringify({seconds:ts.seconds,nanoseconds:ts.nanoseconds||0}),last.id):null;
 const saved=evaluation?.exists?evaluation.data():null;
 return {...empty('',true),online:{reason:'',evaluation:cursor?undefined:{text:text(saved?.evaluation,1000),updatedAt:date(saved?.updatedAt)},progress:{recorded:allWords.data().count,learned:learned.data().count},sessions:rows,nextCursor,
  assignments:assignments.docs.filter((d:any)=>d.data().studentUid===uid&&(!d.data().subject||d.data().subject==='영어')).map((d:any)=>({id:d.id,content:text(d.data().content,5000),isDone:Boolean(d.data().isDone),createdAt:date(d.data().createdAt)}))}};
}

/** 학습 성취도 평가: a short note on how the student is doing in the online learning app. Same access as viewing the
 *  online report (English scope, or admin); stored where the student's 학습 리포트 already reads it (evaluations/{uid}).
 *  The write re-checks, in one transaction, the current two-way account link, the account state and the writer's live
 *  access, and refuses a stale screen: expectedUpdatedAt is required (null = no note yet), so no request can skip the
 *  check and one teacher never silently overwrites another. */
export async function saveOnlineEvaluation(db:any,actor:any,input:unknown,deps={readStudentMapping}){
 const v=z.object({studentKey:z.string().uuid(),text:z.string().max(1000),expectedUpdatedAt:z.string().max(40).nullable()}).strict().parse(input),key=uuid(v.studentKey);
 const allowed=reviewSubjects(actor,key);if(allowed&&!allowed.has('영어'))throw Error('FORBIDDEN');
 const link=await linkedStudentAccount(db,key,deps);if('reason' in link)throw Error('STUDENT_ACCOUNT_NOT_LINKED');
 // Values as they were at the link check, compared again inside the transaction.
 const uid=link.uid,internalStudentId=String(link.mapping.internalStudentId),backlink=String(link.user.notionStudentKey),mappingRef=(k:string)=>db.collection('notionStudentMappings').doc(hashStudentKey(k)),evalRef=db.collection('evaluations').doc(uid);
 return db.runTransaction(async(tx:any)=>{
  // Current link: the student record still points at this account, and the account still points back.
  let mapping=(await tx.get(mappingRef(key))).data();
  if(mapping){let canonical='';try{canonical=uuid(mapping.sourceMode==='firestore'?mapping.studentKey:mapping.notionStudentPageId);}catch{}
   if(canonical&&canonical!==key){const c=(await tx.get(mappingRef(canonical))).data();if(c)mapping=c;}}
  const user=(await tx.get(db.collection('users').doc(uid))).data();
  if(!mapping||mapping.firebaseUid!==uid||mapping.internalStudentId!==internalStudentId||!user||user.role!=='student'||user.disabled||user.notionStudentKey!==backlink)throw Error('STUDENT_ACCOUNT_NOT_LINKED');
  // Live access (the request's account, role and scopes are a snapshot from sign-in): the same account rules as
  // teacherActor, read again here. The admin is the server-configured account and is trusted as at sign-in.
  if(!actor.admin){
   const [me,profile,member]=[(await tx.get(db.collection('users').doc(actor.uid))).data(),(await tx.get(db.collection('teacherWorkspaceAccess').doc(actor.uid))).data(),(await tx.get(db.collection('academyStudentMemberships').doc(key))).data()];
   if(!['teacher','principal'].includes(me?.role)||!profile||profile.disabled||profile.academyId!=='main')throw Error('FORBIDDEN');
   const principalNow=profile.workspaceRole==='principal';
   if(me.role==='principal'&&!principalNow||actor.principal&&!principalNow)throw Error('FORBIDDEN');
   if(!member||member.disabled||member.academyId!=='main')throw Error('FORBIDDEN');
   if(!actor.principal){
    const scoped=(profile.scopes||[]).some((s:any)=>{try{return uuid(s.studentKey)===key&&s.subject==='영어';}catch{return false;}});
    if(!scoped)throw Error('FORBIDDEN');
   }
  }
  const current=(await tx.get(evalRef)).data();
  if((date(current?.updatedAt)??null)!==v.expectedUpdatedAt)throw Error('EVALUATION_CONFLICT');
  const now=Timestamp.now(),value=v.text.trim();
  tx.set(evalRef,{evaluation:value,teacherUid:actor.uid,updatedAt:now});
  return {evaluation:{text:value,updatedAt:date(now)}};
 });
}
