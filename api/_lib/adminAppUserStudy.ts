import {FieldPath,Timestamp} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {encodeReportCursor,decodeReportCursor} from './parentReportPage.js';
import {onlineSessionRow} from './teacherOnlineLearning.js';
import {petViewOf,partyOf} from './teacherPetParty.js';
import {QUESTION_ATTEMPTS} from './questionAttempts.js';
import {teacherRow} from './teacherQuestionAttempts.js';
import {PASSAGES,PASSAGE_VIEWS} from './passage.js';
import {WORKBOOK_HISTORY} from './teacherWorkbook.js';

// 관리자 설정 › 앱 사용자 › 학습 기록: what a student account not linked to the 학생 명부 yet did in the app — the same
// online learning, 출석 체크, pet, party, 변형 문제, 지문 분석 and 워크북 a linked student's page shows, read only. Admin only, and only for an account
// that is not linked (a linked one is seen in 학생 관리, with the usual link checks). Nothing here links or changes anything.
const text=(v:any,max=1200)=>typeof v==='string'?v.slice(0,max):'';
function date(v:any){const ms=v?.toMillis?.()??(typeof v?.seconds==='number'?v.seconds*1000+Math.floor((v.nanoseconds||0)/1e6):Date.parse(v));return Number.isFinite(ms)?new Date(ms).toISOString():null;}

/** The account is a student account not linked to a student (re-read on every call). */
async function unlinkedStudent(db:any,actor:any,uidInput:unknown){
 if(!actor?.admin||actor.academyId!=='main')throw Error('FORBIDDEN');
 const uid=z.string().min(1).max(200).parse(uidInput);
 const user=(await db.collection('users').doc(uid).get()).data();
 if(!user)throw Error('APP_USER_NOT_FOUND');
 if(uid===process.env.ADMIN_UID||(user.role&&user.role!=='student')||user.notionStudentKey)throw Error('FORBIDDEN');
 return uid;
}

/** 온라인 학습 (20 a page, newest first; the first page also has 단어 counts, the app's own 과제 and 출석 체크). */
export async function readAppUserStudy(db:any,actor:any,uidInput:unknown,cursorInput?:unknown){
 const uid=await unlinkedStudent(db,actor,uidInput),cursor=z.string().max(2048).optional().parse(cursorInput||undefined);
 const binding=createHash('sha256').update(JSON.stringify(['app-user-study',actor.uid,uid])).digest('hex');
 let query=db.collection('studySessions').where('uid','==',uid).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
 if(cursor){const c=decodeReportCursor(cursor,binding),t=z.object({seconds:z.number().int(),nanoseconds:z.number().int().min(0).max(999999999)}).strict().parse(JSON.parse(c.date));query=query.startAfter(new Timestamp(t.seconds,t.nanoseconds),c.id);}
 const [sessions,allWords,learned,assignments,attendance]=await Promise.all([
  query.limit(21).get(),db.collection('wordProgress').where('uid','==',uid).count().get(),db.collection('wordProgress').where('uid','==',uid).where('status','==','learned').count().get(),
  cursor?Promise.resolve({docs:[]}):db.collection('assignments').where('studentUid','==',uid).orderBy('createdAt','desc').limit(10).get(),
  cursor?Promise.resolve(null):db.collection('attendance').where('studentId','==',uid).get(),
 ]);
 const docs=sessions.docs.slice(0,20),rows=docs.filter((d:any)=>d.data().uid===uid).map(onlineSessionRow);
 const last=docs.at(-1),ts=last?.data().createdAt;
 const nextCursor=sessions.docs.length>20&&last&&typeof ts?.seconds==='number'?encodeReportCursor(binding,JSON.stringify({seconds:ts.seconds,nanoseconds:ts.nanoseconds||0}),last.id):null;
 const tasks=cursor?undefined:assignments.docs.filter((d:any)=>d.data().studentUid===uid).map((d:any)=>({id:d.id,content:text(d.data().content,5000),isDone:Boolean(d.data().isDone),createdAt:date(d.data().createdAt)}));
 // 출석 체크: the days the student checked in (present), newest first
 const days=attendance?[...new Set(attendance.docs.map((d:any)=>d.data()).filter((a:any)=>a.studentId===uid&&a.status==='present'&&/^\d{4}-\d{2}-\d{2}$/.test(String(a.date||''))).map((a:any)=>String(a.date)))].sort().reverse():undefined;
 return {online:{reason:'',progress:{recorded:allWords.data().count,learned:learned.data().count},sessions:rows,nextCursor,assignments:tasks},...(days?{attendance:{days:days.slice(0,400)}}:{})};
}
export async function readAppUserPet(db:any,actor:any,uidInput:unknown,now=Date.now()){return petViewOf(db,await unlinkedStudent(db,actor,uidInput),now);}
export async function readAppUserParty(db:any,actor:any,uidInput:unknown,now=Date.now()){return partyOf(db,actor.academyId,await unlinkedStudent(db,actor,uidInput),now);}
/** 변형 문제: the newest 20 attempts (own sets and sets a teacher gave), as the student page shows them. */
export async function readAppUserQuestions(db:any,actor:any,uidInput:unknown){
 const uid=await unlinkedStudent(db,actor,uidInput),mine=db.collection(QUESTION_ATTEMPTS).where('uid','==',uid);
 // index uid + updatedAt desc; until it exists, up to 300 read and sorted here (as the student page does)
 const snap=await mine.orderBy('updatedAt','desc').limit(20).get().catch((error:any)=>{if(error?.code!==9&&!/FAILED_PRECONDITION|index/i.test(String(error?.message||'')))throw error;return mine.limit(300).get();});
 const rows=snap.docs.map((d:any)=>d.data()).filter((x:any)=>x.uid===uid).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,20);
 return {attempts:rows.map(teacherRow)};
}
/** 지문 분석 (the passages the student opened) and 워크북 (each passage's versions made), newest first. */
export async function readAppUserMaterials(db:any,actor:any,uidInput:unknown){
 const uid=await unlinkedStudent(db,actor,uidInput);
 const [views,books]=await Promise.all([db.collection(PASSAGE_VIEWS).where('uid','==',uid).limit(300).get(),db.collection(WORKBOOK_HISTORY).where('ownerUid','==',uid).limit(300).get()]);
 const seen=views.docs.map((d:any)=>d.data()).filter((v:any)=>v.uid===uid&&v.passageId).sort((a:any,b:any)=>(b.at||0)-(a.at||0)).slice(0,100);
 const passages=(await Promise.all(seen.map(async(v:any)=>{const p=(await db.collection(PASSAGES).doc(String(v.passageId).slice(0,64)).get()).data();
  return p?{id:String(v.passageId),title:text(p.title,120),examInfo:text(p.examInfo,120),first:text(String(p.sentences?.[0]||''),120),openedAt:Number(v.at)||null}:null;}))).filter(Boolean);
 const workbooks=books.docs.map((d:any)=>d.data()).filter((b:any)=>b.ownerUid===uid).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,100)
  .map((b:any)=>({key:text(b.key,200),title:text(b.title,120),versions:(Array.isArray(b.versions)?b.versions:[]).map((v:any)=>({version:Number(v.version)||0,at:Number(v.at)||null,sentences:Number(v.sentences)||0})),updatedAt:Number(b.updatedAt)||null}));
 return {passages,workbooks};
}
