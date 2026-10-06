import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canAccessOwned,canTeach,lessonDraftSchema,assertLessonComplete} from './teacherWorkspacePolicy.js';
import {registrationNotion,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
const text=(p:any)=>(p?.rich_text||p?.title||[]).map((t:any)=>t.plain_text??t.text?.content??'').join('');
const choice=(p:any)=>p?.select?.name||p?.status?.name||'미확인';
function value(p:any){if(!p)return '';if(p.rich_text||p.title)return text(p);if(p.date)return [p.date.start,p.date.end].filter(Boolean).join(' ~ ');if(p.select||p.status)return p.select?.name||p.status?.name||'';if('checkbox'in p)return p.checkbox?'있음':'없음';if('number'in p)return p.number??'';return '';}
function currentInput(p:any,original:any){
 const feedback=text(p['수업 내용']),marker=[...feedback.matchAll(/(?:^|\n)[ \t]*과제[ \t]*[:：][ \t]*/g)].at(-1);
 const time=text(p['배정 시간']||p['수업']).match(/([0-2]?\d:[0-5]\d)\s*[~–-]\s*([0-2]?\d:[0-5]\d)/),study=text(p['자습시간']).match(/([0-2]?\d:[0-5]\d)\s*[~–-]\s*([0-2]?\d:[0-5]\d)/);
 const date=(p['타임 슬롯']||p['수업 날짜'])?.date?.start?.slice(0,10)||original.date,total=p['단어']?.number??null,wrong=p['틀린 단어']?.number??null,examTotal=p['문항 수']?.number??null,examWrong=p['오답 수']?.number??null;
 return lessonDraftSchema.parse({...original,date,classSession:time?'있음':'없음',start:time?.[1]?.padStart(5,'0')||original.start,end:time?.[2]?.padStart(5,'0')||original.end,round:p['회차']?.number??null,selfStudy:p['자습']?.checkbox||study?'있음':'없음',selfStudyStart:study?.[1]?.padStart(5,'0')||original.selfStudyStart,selfStudyEnd:study?.[2]?.padStart(5,'0')||original.selfStudyEnd,selfStudyRound:(p['자습회차']||p['자습 회차'])?.number??null,content:marker?feedback.slice(0,marker.index).trimEnd():feedback,assignment:marker?feedback.slice(marker.index!+marker[0].length).trim():'',note:'',examScope:text(p['시험범위']),nextPlan:p['메모']?text(p['메모']):original.nextPlan,attendance:choice(p['출석']),attitude:choice(p['태도']),homework:choice(p['숙제']),test:choice(p['테스트']),total,wrong,correct:total!==null&&wrong!==null?total-wrong:null,examTotal,examWrong,examCorrect:examTotal!==null&&examWrong!==null?examTotal-examWrong:null,attendanceNote:text(p['앱 출결 메모']),specialNote:text(p['특이사항']||p['앱 특이사항'])});
}
async function snapshot(db:any,actor:any,idInput:unknown,notion:RegistrationNotion){
 const id=z.string().uuid().parse(idInput),ref=db.collection('teacherLessonDrafts').doc(id),r=(await ref.get()).data();
 if(!r||r.archived||r.deleteRequested||!canAccessOwned(actor,r.ownerUid,r.academyId)||!canTeach(actor,r.data.studentKey,r.data.subject))throw Error('FORBIDDEN');
 if(r.failureCode!=='NOTION_EDIT_CONFLICT'||!r.notionWrite)throw Error('DRAFT_CONFLICT');
 if(r.notionWrite.leaseUntil>Date.now()||r.stage==='publishing'&&Date.now()-(r.publishStartedAt||Date.now())<180000)throw Error('PUBLISH_IN_PROGRESS');
 let pageId=r.notionPageId||r.notionWrite.pageId;
 if(!pageId){const found=await notion(`databases/${r.notionWrite.database}/query`,'POST',{filter:{property:'앱 기록 ID',rich_text:{equals:id}},page_size:2});if(found.has_more||found.results?.length!==1)throw Error('DUPLICATE_NOTION_RECORD');pageId=found.results[0].id;}
 const page=await notion(`pages/${uuid(pageId)}`),p=page.properties;
 if(page.archived||page.in_trash||uuid(page.id)!==uuid(pageId)||uuid(page.parent?.database_id)!==uuid(r.notionWrite.database)||p?.['학생']?.has_more||p?.['학생']?.relation?.length!==1||uuid(p['학생'].relation[0].id)!==uuid(r.data.studentKey)||(p['과목']?.select?.name||r.data.subject)!==r.data.subject||text(p['앱 기록 ID'])&&text(p['앱 기록 ID'])!==id)throw Error('NOTION_SOURCE_MISMATCH');
 const token=createHash('sha256').update(JSON.stringify([id,r.revision,r.notionWrite,page.id,page.last_edited_time,p])).digest('hex');
 return {id,ref,r,page,token};
}
export async function readLessonConflict(db:any,actor:any,id:unknown,notion:RegistrationNotion=registrationNotion){
 const s=await snapshot(db,actor,id,notion),fields=Object.entries(s.r.notionWrite.properties).filter(([name])=>!['학생','구분','앱 기록 ID','학원','작성자 선생님','범주','전송 완료'].includes(name)).map(([name,p])=>({name,app:value(p),notion:value(s.page.properties[name])}));
 let canUseNotion=true;try{assertLessonComplete(currentInput(s.page.properties,s.r.data));}catch{canUseNotion=false;}
 return {id:s.id,revision:s.r.revision,token:s.token,date:s.r.data.date,subject:s.r.data.subject,pageId:uuid(s.page.id),fields,canUseNotion};
}
export async function resolveLessonConflict(db:any,actor:any,input:any,notion:RegistrationNotion=registrationNotion){
 const v=z.object({id:z.string().uuid(),revision:z.number().int().positive(),token:z.string().regex(/^[a-f0-9]{64}$/),choice:z.enum(['app','notion'])}).strict().parse(input),s=await snapshot(db,actor,v.id,notion);
 if(s.r.revision!==v.revision||s.token!==v.token)throw Error('NOTION_EDIT_CONFLICT');
 const data=v.choice==='notion'?currentInput(s.page.properties,s.r.data):s.r.data;assertLessonComplete(data);
 await db.runTransaction(async(tx:any)=>{const current=(await tx.get(s.ref)).data();if(!current||current.archived||current.deleteRequested||current.revision!==v.revision||JSON.stringify(current.notionWrite)!==JSON.stringify(s.r.notionWrite)||current.notionWrite?.leaseUntil>Date.now()||current.stage==='publishing'&&Date.now()-(current.publishStartedAt||Date.now())<180000)throw Error('DRAFT_CONFLICT');
 tx.set(s.ref,{...current,data,revision:current.revision+1,stage:'draft',notionWrite:null,notionPageId:uuid(s.page.id),notionEditedAt:s.page.last_edited_time,failureCode:null,conflictResolution:{choice:v.choice,previousRevision:current.revision,resolvedBy:actor.uid,resolvedAt:Date.now()},updatedAt:Date.now()});});
 return {id:s.id,revision:v.revision+1};
}
