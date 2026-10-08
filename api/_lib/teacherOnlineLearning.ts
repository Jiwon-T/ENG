import {FieldPath,Timestamp} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {readStudentMapping} from './studentIdentity.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {reviewSubjects} from './teacherReportReview.js';
import {encodeReportCursor,decodeReportCursor} from './parentReportPage.js';
const text=(v:any,max=1200)=>typeof v==='string'?v.slice(0,max):'';
const number=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:null;
function date(v:any){const ms=v?.toMillis?.()??(typeof v?.seconds==='number'?v.seconds*1000+Math.floor((v.nanoseconds||0)/1e6):Date.parse(v));return Number.isFinite(ms)?new Date(ms).toISOString():null;}
const empty=(reason:string,linked=false)=>({linked,studentLinked:linked,parentUrl:null,subjectOptions:['영어'],reports:[],schedules:[],academic:{records:[],subjects:[],academyScores:[]},online:{reason,sessions:[],assignments:[],progress:null,nextCursor:null}});
export async function loadTeacherOnlineLearning(db:any,actor:any,keyInput:unknown,subjectInput:unknown,cursorInput:unknown,deps={readStudentMapping}){
 const key=uuid(z.string().uuid().parse(keyInput)),subject=z.string().max(100).parse(subjectInput||''),cursor=z.string().max(2048).optional().parse(cursorInput||undefined);
 const allowed=reviewSubjects(actor,key);
 // The current app's word/grammar/exam activities are English learning. Missing
 // subject metadata must not grant a maths-only teacher access to this history.
 if(allowed&&!allowed.has('영어')||subject&&subject!=='영어')return empty('subject-not-available');
 const mapping=await deps.readStudentMapping(db,key);if(!mapping?.firebaseUid)return empty('account-not-linked');
 const user=(await db.collection('users').doc(mapping.firebaseUid).get()).data();if(!user||user.role!=='student'||user.disabled||!user.notionStudentKey)return empty('account-not-linked');
 let backlink:string;try{backlink=uuid(user.notionStudentKey);}catch{const alias=await deps.readStudentMapping(db,user.notionStudentKey);if(!alias||alias.firebaseUid!==mapping.firebaseUid||alias.internalStudentId!==mapping.internalStudentId)return empty('account-link-mismatch');backlink=uuid(alias.notionStudentPageId);}
 if(backlink!==key)return empty('account-link-mismatch');
 const uid=mapping.firebaseUid,binding=createHash('sha256').update(JSON.stringify(['online-learning',actor.uid,key,uid,subject])).digest('hex');
 let query=db.collection('studySessions').where('uid','==',uid).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
 if(cursor){const c=decodeReportCursor(cursor,binding),t=z.object({seconds:z.number().int(),nanoseconds:z.number().int().min(0).max(999999999)}).strict().parse(JSON.parse(c.date));query=query.startAfter(new Timestamp(t.seconds,t.nanoseconds),c.id);}
 const [sessions,allWords,learned,assignments]=await Promise.all([
  query.limit(21).get(),db.collection('wordProgress').where('uid','==',uid).count().get(),db.collection('wordProgress').where('uid','==',uid).where('status','==','learned').count().get(),
  db.collection('assignments').where('studentUid','==',uid).orderBy('createdAt','desc').limit(10).get(),
 ]);
 const latest=await deps.readStudentMapping(db,key),latestUser=(await db.collection('users').doc(uid).get()).data();
 if(latest?.firebaseUid!==uid||latest?.internalStudentId!==mapping.internalStudentId||latestUser?.notionStudentKey!==user.notionStudentKey||latestUser?.disabled||latestUser?.role!=='student')return empty('account-link-mismatch');
 const docs=sessions.docs.slice(0,20),rows=docs.filter((d:any)=>d.data().uid===uid&&(!d.data().subject||d.data().subject==='영어')).map((d:any)=>{const r=d.data(),answers=Array.isArray(r.incorrectAnswers)?r.incorrectAnswers:[];return {
  id:d.id,wordbookTitle:text(r.wordbookTitle,450)||'단어장',type:text(r.type,50),category:text(r.category,50)||'word',wordbookType:text(r.wordbookType,100),createdAt:date(r.createdAt),duration:number(r.duration),score:number(r.score),totalItems:number(r.totalItems),dayStart:number(r.dayStart),dayEnd:number(r.dayEnd),incorrectCount:answers.length,
  incorrectAnswers:answers.slice(0,100).map((a:any)=>({word:text(a.word),meaning:text(a.meaning),userChoice:text(a.userChoice),correctAnswer:text(a.correctAnswer),quizSentence:text(a.quizSentence,3000),isReviewed:Boolean(a.isReviewed)})),
 };});
 const last=docs.at(-1),ts=last?.data().createdAt;
 const nextCursor=sessions.docs.length>20&&last&&typeof ts?.seconds==='number'?encodeReportCursor(binding,JSON.stringify({seconds:ts.seconds,nanoseconds:ts.nanoseconds||0}),last.id):null;
 return {...empty('',true),online:{reason:'',progress:{recorded:allWords.data().count,learned:learned.data().count},sessions:rows,nextCursor,
  assignments:assignments.docs.filter((d:any)=>d.data().studentUid===uid&&(!d.data().subject||d.data().subject==='영어')).map((d:any)=>({id:d.id,content:text(d.data().content,5000),isDone:Boolean(d.data().isDone),createdAt:date(d.data().createdAt)}))}};
}
