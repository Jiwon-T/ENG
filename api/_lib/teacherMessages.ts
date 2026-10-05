import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {registrationNotion,REGISTRATION_STUDENT_DATABASE,registrationText,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {profileFromPage} from './teacherStudentProfile.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashStudentKey} from './security.js';
import {assertContactEditAllowsIssuance} from './studentContactEdit.js';
import {unresolvedMessage} from '../../src/lib/teacherMessage.js';
const TEMPLATE_DB='ec10d0f1-c79a-8312-946b-811e86041ee2';
function assertMember(actor:any,member:any){if(member?.disabled||member?.academyId&&member.academyId!==actor.academyId||!actor.admin&&(!member||member.academyId!==actor.academyId))throw Error('FORBIDDEN');}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function assertPage(page:any,key:string,db=REGISTRATION_STUDENT_DATABASE){if(page?.archived||page?.in_trash||uuid(page?.id)!==key||uuid(page.parent?.database_id)!==db)throw Error('NOTION_SOURCE_MISMATCH');}
async function access(db:any,actor:any,key:string,subject:string){
 if(actor.academyId!=='main'||uuid(process.env.NOTION_STUDENT_DATABASE_ID||'')!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
 const member=(await db.collection('academyStudentMemberships').doc(key).get()).data();
 assertMember(actor,member);
 if(!actor.admin&&!actor.principal&&!(actor.scopes||[]).some((s:any)=>uuid(s.studentKey)===key&&s.subject===subject))throw Error('FORBIDDEN');
}
async function source(db:any,actor:any,key:string,subject:string,notion:RegistrationNotion){
 await access(db,actor,key,subject);const page=await notion(`pages/${key}`);assertPage(page,key);
 const edit=(await db.collection('teacherStudentEdits').doc(hashStudentKey(key)).get()).data();assertContactEditAllowsIssuance(edit,page.last_edited_time);
 return page;
}
function publicDraft(r:any){return r?{id:r.id,studentKey:r.studentKey,subject:r.subject,body:r.body,recipient:r.recipient,templateId:r.templateId,lessonId:r.lessonId,status:r.status,createdAt:r.createdAt}:null;}
export async function readTeacherMessages(db:any,actor:any,keyInput:unknown,subjectInput:unknown,notion:RegistrationNotion=registrationNotion){
 const key=uuid(z.string().uuid().parse(keyInput)),subject=z.string().min(1).max(100).parse(subjectInput);const page=await source(db,actor,key,subject,notion);
 const templates:any[]=[];let cursor:string|undefined;
 do{const result=await notion(`databases/${TEMPLATE_DB}/query`,'POST',{page_size:100,...(cursor?{start_cursor:cursor}:{})});for(const p of result.results){assertPage(p,uuid(p.id),TEMPLATE_DB);templates.push({id:uuid(p.id),title:(p.properties['유형']?.title||[]).map((t:any)=>t.plain_text??t.text?.content??'').join(''),body:registrationText(p.properties['내용(문자본문)']),target:p.properties['대상']?.select?.name||''});}cursor=result.has_more?result.next_cursor:undefined;if(result.has_more&&!cursor)throw Error('NOTION_SOURCE_MISMATCH');}while(cursor&&templates.length<500);
 const records=await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get();
 const lessons=records.docs.map((d:any)=>({id:d.id,...d.data()})).filter((r:any)=>r.stage==='published'&&!r.archived&&r.data?.studentKey?.replace(/-/g,'')===key.replace(/-/g,'')&&r.data?.subject===subject).sort((a:any,b:any)=>b.data.date.localeCompare(a.data.date)).slice(0,30).map((r:any)=>({id:r.id,data:r.data}));
 const drafts=await db.collection('teacherMessages').where('studentKey','==',key).get();
 return {templates,profile:profileFromPage(page),lessons,records:drafts.docs.map((d:any)=>d.data()).filter((r:any)=>r.academyId===actor.academyId&&r.subject===subject&&(actor.admin||actor.principal||r.ownerUid===actor.uid)).sort((a:any,b:any)=>b.createdAt-a.createdAt).slice(0,30).map(publicDraft)};
}
export const messagePrepareSchema=z.object({action:z.literal('prepare-message'),id:z.string().uuid(),studentKey:z.string().uuid(),subject:z.string().min(1).max(100),templateId:z.string().uuid(),lessonId:z.string().uuid().nullable(),body:z.string().trim().min(1).max(5000)}).strict();
export async function prepareTeacherMessage(db:any,actor:any,input:unknown,notion:RegistrationNotion=registrationNotion){
 const v=messagePrepareSchema.parse(input),key=uuid(v.studentKey);if(unresolvedMessage(v.body))throw Error('MESSAGE_VARIABLE_REQUIRED');
 const page=await source(db,actor,key,v.subject,notion),template=await notion(`pages/${uuid(v.templateId)}`);assertPage(template,uuid(v.templateId),TEMPLATE_DB);
 const recipient=profileFromPage(page).guardianPhone;if(!/^0\d{8,10}$/.test(recipient))throw Error('MESSAGE_CONTACT_REQUIRED');
 if(v.lessonId){const lesson=(await db.collection('teacherLessonDrafts').doc(v.lessonId).get()).data();if(!lesson||lesson.academyId!==actor.academyId||lesson.stage!=='published'||lesson.archived||uuid(lesson.data.studentKey)!==key||lesson.data.subject!==v.subject)throw Error('FORBIDDEN');}
 const ref=db.collection('teacherMessages').doc(v.id),fingerprint=digest(JSON.stringify([actor.uid,key,v.subject,v.templateId,v.lessonId,v.body]));
 let r=await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data(),edit=(await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(key)))).data();assertMember(actor,member);assertContactEditAllowsIssuance(edit,page.last_edited_time);if(old){if(old.fingerprint!==fingerprint||old.ownerUid!==actor.uid)throw Error('MESSAGE_CONFLICT');return old;}const next={id:v.id,studentKey:key,subject:v.subject,templateId:uuid(v.templateId),lessonId:v.lessonId,body:v.body,recipient,ownerUid:actor.uid,academyId:actor.academyId,fingerprint,status:'prepared',createdAt:Date.now()};tx.set(ref,next);return next;});
 // Student text is a backup. Only these two properties are changed; SMS is independent.
 if(r.status==='prepared'){
  const props={'메시지템플릿선택':{relation:[{id:r.templateId}]},'완성된 문자본문':{rich_text:Array.from({length:Math.ceil(r.body.length/1800)},(_,i)=>({text:{content:r.body.slice(i*1800,(i+1)*1800)}}))}};
  // Failed backup writes can safely be repeated with the same immutable body.
  await notion(`pages/${key}`,'PATCH',{properties:props});
  await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.status==='prepared'){r={...current,status:'ready'};tx.set(ref,r);}else r=current;});
 }
 return publicDraft(r);
}
export function batiConfig(){
 const raw=process.env.BATI_WEBHOOK_URL||'',bodyKey=process.env.BATI_MESSAGE_PARAM||'';let url:URL;try{url=new URL(raw);}catch{throw Error('MESSAGE_CONFIG_REQUIRED');}
 if(url.protocol!=='https:'||url.hostname!=='app.bati.ai'||!/^\/webhook\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)||url.username||url.password||url.search||url.hash||!bodyKey.trim()||bodyKey!==bodyKey.trim()||bodyKey==='보호자연락처'||/[\u0000-\u001f\u007f]/.test(bodyKey))throw Error('MESSAGE_CONFIG_REQUIRED');
 return {url,bodyKey};
}
export async function sendTeacherMessage(db:any,actor:any,idInput:unknown,confirmed:unknown,notion:RegistrationNotion=registrationNotion,transport:typeof fetch=fetch){
 const id=z.string().uuid().parse(idInput);if(confirmed!==true)throw Error('MESSAGE_CONFIRM_REQUIRED');
 const ref=db.collection('teacherMessages').doc(id),r=(await ref.get()).data();if(!r||r.academyId!==actor.academyId||r.ownerUid!==actor.uid)throw Error('FORBIDDEN');
 const page=await source(db,actor,r.studentKey,r.subject,notion);
 if(r.recipient!==profileFromPage(page).guardianPhone)throw Error('MESSAGE_CONTACT_CHANGED');
 if(['accepted','sending','uncertain'].includes(r.status))return publicDraft(r);
 if(r.status!=='ready')throw Error('MESSAGE_NOT_READY');const {url,bodyKey}=batiConfig();
 url.searchParams.set('보호자연락처',r.recipient);url.searchParams.set(bodyKey,r.body);
 const lock=db.collection('teacherMessageSendLocks').doc(digest(r.studentKey+'\0'+r.recipient+'\0'+r.body)),attempt=randomUUID();
 const claimed=await db.runTransaction(async(tx:any)=>{
  const current=(await tx.get(ref)).data(),old=(await tx.get(lock)).data(),edit=(await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(r.studentKey)))).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(r.studentKey))).data();
  assertContactEditAllowsIssuance(edit,page.last_edited_time);assertMember(actor,member);
  if(current.status!=='ready')return false;if(old)throw Error('MESSAGE_DUPLICATE');
  tx.set(lock,{messageId:id,attempt,createdAt:Date.now()});tx.set(ref,{...current,status:'sending',attempt,attemptedAt:Date.now()});return true;
 });
 if(!claimed)return publicDraft((await ref.get()).data());
 let status='uncertain';try{const result=await transport(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000)});if(result.ok)status='accepted';}catch{}
 await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.attempt===attempt)tx.set(ref,{...current,status,finishedAt:Date.now()});});
 return publicDraft((await ref.get()).data());
}
