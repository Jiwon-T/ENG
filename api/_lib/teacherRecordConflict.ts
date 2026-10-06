import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canAccessOwned,canTeach,teacherScheduleSchema} from './teacherWorkspacePolicy.js';
import {academicDraftSchema} from './teacherAcademicPolicy.js';
import {gradeFromPage,gradeNotion} from './teacherAcademicNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
type Kind='academic'|'schedule';
const text=(p:any)=>(p?.rich_text||p?.title||[]).map((t:any)=>t.plain_text??t.text?.content??'').join('');
const choice=(p:any)=>p?.select?.name||p?.status?.name||'';
const collection=(kind:Kind)=>kind==='academic'?'teacherAcademicDrafts':'teacherSchedules';
const students=(kind:Kind,data:any)=>kind==='academic'?[data.studentKey]:data.students;
function sourceData(kind:Kind,page:any){
 if(kind==='academic')return academicDraftSchema.parse(gradeFromPage(page));
 const p=page.properties,t=p['날짜 및 시간']?.date;
 const time=(s:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s));
 return teacherScheduleSchema.parse({title:text(p['일정명']),subject:choice(p['과목']),students:p['대상 학생'].relation.map((r:any)=>uuid(r.id)),date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(t.start)),start:time(t.start),end:time(t.end),kind:choice(p['일정 종류']),status:choice(p['일정 상태']),place:choice(p['장소']),note:text(p['안내 내용'])});
}
async function snapshot(db:any,actor:any,kind:Kind,input:unknown,notion:any){
 const id=z.string().uuid().parse(input),ref=db.collection(collection(kind)).doc(id),r=(await ref.get()).data();
 if(!r||r.archived||r.deleteRequested||!canAccessOwned(actor,r.ownerUid,r.academyId)||students(kind,r.data).some((key:string)=>!canTeach(actor,key,r.data.subject)))throw Error('FORBIDDEN');
 if(r.failureCode!=='NOTION_EDIT_CONFLICT'||!r.notionWrite)throw Error('DRAFT_CONFLICT');
 if(r.notionWrite.leaseUntil>Date.now()||r.stage==='publishing'&&Date.now()-(r.publishStartedAt||Date.now())<180000)throw Error('PUBLISH_IN_PROGRESS');
 let pageId=r.notionPageId||r.notionWrite.pageId;
 if(!pageId){const found=await notion(`databases/${r.notionWrite.database}/query`,'POST',{filter:{property:'앱 기록 ID',rich_text:{equals:id}},page_size:2});if(found.has_more||found.results?.length!==1)throw Error('DUPLICATE_NOTION_RECORD');pageId=found.results[0].id;}
 const page=await notion(`pages/${uuid(pageId)}`),p=page.properties,relation=p?.[kind==='academic'?'학생':'대상 학생'];
 const expected=r.notionWrite.properties?.[kind==='academic'?'학생':'대상 학생']?.relation||students(kind,r.data).map((id:string)=>({id}));
 const ids=(rows:any[])=>rows.map(v=>uuid(v.id)).sort().join(',');
 if(page.archived||page.in_trash||uuid(page.id)!==uuid(pageId)||uuid(page.parent?.database_id)!==uuid(r.notionWrite.database)||relation?.has_more||!relation?.relation||ids(relation.relation)!==ids(expected)||choice(p['과목'])!==r.data.subject||text(p['앱 기록 ID'])&&text(p['앱 기록 ID'])!==id)throw Error('NOTION_SOURCE_MISMATCH');
 const token=createHash('sha256').update(JSON.stringify([id,r.revision,r.notionWrite,page.id,page.last_edited_time,p])).digest('hex');
 return {id,ref,r,page,token};
}
function display(p:any){if(!p)return '';if(p.title||p.rich_text)return text(p);if(p.date)return [p.date.start,p.date.end].filter(Boolean).join(' ~ ');if('number'in p)return p.number??'';return choice(p);}
export async function readRecordConflict(db:any,actor:any,kind:Kind,id:unknown,notion:any=gradeNotion){
 const s=await snapshot(db,actor,kind,id,notion);let canUseNotion=true;try{sourceData(kind,s.page);}catch{canUseNotion=false;}
 return {id:s.id,revision:s.r.revision,token:s.token,date:s.r.data.examDate||s.r.data.date,subject:s.r.data.subject,canUseNotion,fields:Object.entries(s.r.notionWrite.properties).filter(([name])=>!['학생','대상 학생','앱 기록 ID','담당 선생님','반영 상태','앱 반영 결과'].includes(name)).map(([name,p])=>({name,app:display(p),notion:display(s.page.properties[name])}))};
}
export async function resolveRecordConflict(db:any,actor:any,kind:Kind,input:any,notion:any=gradeNotion){
 const v=z.object({id:z.string().uuid(),revision:z.number().int().positive(),token:z.string().regex(/^[a-f0-9]{64}$/),choice:z.enum(['app','notion'])}).strict().parse(input),s=await snapshot(db,actor,kind,v.id,notion);
 if(v.revision!==s.r.revision||v.token!==s.token)throw Error('NOTION_EDIT_CONFLICT');
 const data=v.choice==='notion'?sourceData(kind,s.page):s.r.data;
 (kind==='academic'?academicDraftSchema:teacherScheduleSchema).parse(data);
 await db.runTransaction(async(tx:any)=>{
  const current=(await tx.get(s.ref)).data();
  for(const key of students(kind,data)){const member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();if(!member||member.disabled||member.academyId!==s.r.academyId||!canTeach(actor,key,data.subject))throw Error('FORBIDDEN');}
  if(!current||current.archived||current.deleteRequested||current.revision!==v.revision||JSON.stringify(current.notionWrite)!==JSON.stringify(s.r.notionWrite)||current.notionWrite?.leaseUntil>Date.now()||current.stage==='publishing'&&Date.now()-(current.publishStartedAt||Date.now())<180000)throw Error('DRAFT_CONFLICT');
  tx.set(s.ref,{...current,data,revision:v.revision+1,stage:'draft',notionWrite:null,notionPageId:uuid(s.page.id),notionEditedAt:s.page.last_edited_time,failureCode:null,updatedAt:Date.now(),conflictResolution:{choice:v.choice,previousRevision:v.revision,resolvedBy:actor.uid,resolvedAt:Date.now()}});
 });return {id:s.id,revision:v.revision+1};
}
