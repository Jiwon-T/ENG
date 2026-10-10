import {batiConfig,batiRequest,batiAccepted,batiReadiness} from './batiTransport.js';
import {templateReadsFromApp,storedMessageTemplates,storedMessageTemplatePage} from './messageTemplateStore.js';
import {coreActive,coreStudentPage} from './academyCore.js';
export {batiConfig} from './batiTransport.js';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {REGISTRATION_STUDENT_DATABASE,registrationText} from './teacherStudentRegistrationNotion.js';
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
 if(actor.academyId!=='main')throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
 // Students live in the app since the core switch; there is no Notion student source to fall back to.
 if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
 const member=(await db.collection('academyStudentMemberships').doc(key).get()).data();
 assertMember(actor,member);
 if(!actor.admin&&!actor.principal&&!(actor.scopes||[]).some((s:any)=>uuid(s.studentKey)===key&&s.subject===subject))throw Error('FORBIDDEN');
}
async function source(db:any,actor:any,key:string,subject:string){
 await access(db,actor,key,subject);const page=await coreStudentPage(db,key);
 // App-registered students have no Notion page or database; identity is the app record. Migrated ones keep their source identity.
 if(page.origin==='app'){if(uuid(page.id)!==key)throw Error('NOTION_SOURCE_MISMATCH');}else assertPage(page,key);
 const edit=(await db.collection('teacherStudentEdits').doc(hashStudentKey(key)).get()).data();assertContactEditAllowsIssuance(edit,page.last_edited_time);
 return page;
}
function publicDraft(r:any){return r?{id:r.id,studentKey:r.studentKey,subject:r.subject,body:r.body,recipient:r.recipient,context:r.context||null,templateId:r.templateId,lessonId:r.lessonId,status:r.status,httpStatus:r.httpStatus??null,outcomeCode:r.outcomeCode||null,createdAt:r.createdAt}:null;}
function messageContext(page:any,template:any){
 const p=page.properties,profile=profileFromPage(page);
 return {'메시지템플릿선택':registrationText(template.properties['유형']),'학생 호칭':profile.studentSalutation,'강의명':(p['강의명']?.multi_select||[]).map((v:any)=>v.name).join(', '),'수강료':profile.tuition===null?'':String(profile.tuition),'납부기한':profile.paymentDeadline,'등록상태':p['등록상태']?.status?.name||p['등록상태']?.select?.name||'','수강시작일':p['수강시작일']?.date?.start||'','학년':profile.grade,'학생연락처':profile.studentPhone,'보호자이름':profile.guardianName};
}
export async function readTeacherMessages(db:any,actor:any,keyInput:unknown,subjectInput:unknown){
 const key=uuid(z.string().uuid().parse(keyInput)),subject=z.string().min(1).max(100).parse(subjectInput);const page=await source(db,actor,key,subject);
 // Templates are app-only.
 if(!await templateReadsFromApp(db))throw Error('TEMPLATE_APP_REQUIRED');
 const templates:any[]=await storedMessageTemplates(db,actor);
 // Only this student's lessons (both ID spellings), not the whole academy.
 const records=await db.collection('teacherLessonDrafts').where('data.studentKey','in',[...new Set([key,key.replace(/-/g,'')])]).get();
 const lessons=records.docs.map((d:any)=>({id:d.id,...d.data()})).filter((r:any)=>r.academyId===actor.academyId&&r.stage==='published'&&!r.archived&&r.data?.studentKey?.replace(/-/g,'')===key.replace(/-/g,'')&&r.data?.subject===subject).sort((a:any,b:any)=>b.data.date.localeCompare(a.data.date)).slice(0,30).map((r:any)=>({id:r.id,data:r.data}));
 const drafts=await db.collection('teacherMessages').where('studentKey','==',key).get();
 // 수강료 is for the admin and principal only.
 const profile=profileFromPage(page);if(!actor.admin&&!actor.principal)profile.tuition=null;
 return {delivery:batiReadiness(),templates,profile,lessons,records:drafts.docs.map((d:any)=>d.data()).filter((r:any)=>r.academyId===actor.academyId&&r.subject===subject&&(actor.admin||actor.principal||r.ownerUid===actor.uid)).sort((a:any,b:any)=>b.createdAt-a.createdAt).slice(0,30).map(publicDraft)};
}
export const messagePrepareSchema=z.object({action:z.literal('prepare-message'),id:z.string().uuid(),studentKey:z.string().uuid(),subject:z.string().min(1).max(100),templateId:z.string().uuid(),lessonId:z.string().uuid().nullable(),body:z.string().trim().min(1).max(5000)}).strict();
export async function prepareTeacherMessage(db:any,actor:any,input:unknown){
 const v=messagePrepareSchema.parse(input),key=uuid(v.studentKey);if(unresolvedMessage(v.body))throw Error('MESSAGE_VARIABLE_REQUIRED');
 if(!await templateReadsFromApp(db))throw Error('TEMPLATE_APP_REQUIRED');
 const page=await source(db,actor,key,v.subject),template=await storedMessageTemplatePage(db,actor,v.templateId);assertPage(template,uuid(v.templateId),TEMPLATE_DB);
 const recipient=profileFromPage(page).guardianPhone;if(!/^0\d{8,10}$/.test(recipient))throw Error('MESSAGE_CONTACT_REQUIRED');
 if(v.lessonId){const lesson=(await db.collection('teacherLessonDrafts').doc(v.lessonId).get()).data();if(!lesson||lesson.academyId!==actor.academyId||lesson.stage!=='published'||lesson.archived||uuid(lesson.data.studentKey)!==key||lesson.data.subject!==v.subject)throw Error('FORBIDDEN');}
 const ref=db.collection('teacherMessages').doc(v.id),context=messageContext(page,template),fingerprint=digest(JSON.stringify([actor.uid,key,v.subject,v.templateId,v.lessonId,v.body]));
 let r=await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data(),edit=(await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(key)))).data();assertMember(actor,member);assertContactEditAllowsIssuance(edit,page.last_edited_time);if(old){if(old.fingerprint!==fingerprint||old.ownerUid!==actor.uid)throw Error('MESSAGE_CONFLICT');return old;}const next={id:v.id,studentKey:key,subject:v.subject,templateId:uuid(v.templateId),lessonId:v.lessonId,body:v.body,recipient,context,ownerUid:actor.uid,academyId:actor.academyId,fingerprint,status:'prepared',createdAt:Date.now()};tx.set(ref,next);return next;});
 // Student text is a backup. Only these two properties are changed; SMS is independent.
 if(r.status==='prepared'){
  // The app record is authoritative and the body is stored here; there is no Notion backup copy any more.
  await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.status==='prepared'){r={...current,status:'ready'};tx.set(ref,r);}else r=current;});
 }
 return publicDraft(r);
}
export async function sendTeacherMessage(db:any,actor:any,idInput:unknown,confirmed:unknown,transport:typeof fetch=fetch){
 const id=z.string().uuid().parse(idInput);if(confirmed!==true)throw Error('MESSAGE_CONFIRM_REQUIRED');
 const ref=db.collection('teacherMessages').doc(id),r=(await ref.get()).data();if(!r||r.academyId!==actor.academyId||r.ownerUid!==actor.uid)throw Error('FORBIDDEN');
 const page=await source(db,actor,r.studentKey,r.subject);
 if(r.recipient!==profileFromPage(page).guardianPhone)throw Error('MESSAGE_CONTACT_CHANGED');
 if(['accepted','sending','uncertain'].includes(r.status))return publicDraft(r);
 if(r.status!=='ready')throw Error('MESSAGE_NOT_READY');const config=batiConfig(),request=batiRequest(config,r.recipient,r.body,r.context);
 const lock=db.collection('teacherMessageSendLocks').doc(digest(r.studentKey+'\0'+r.recipient+'\0'+r.body)),attempt=randomUUID();
 const claimed=await db.runTransaction(async(tx:any)=>{
  const current=(await tx.get(ref)).data(),old=(await tx.get(lock)).data(),edit=(await tx.get(db.collection('teacherStudentEdits').doc(hashStudentKey(r.studentKey)))).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(r.studentKey))).data();
  assertContactEditAllowsIssuance(edit,page.last_edited_time);assertMember(actor,member);
  if(current.status!=='ready')return false;if(old)throw Error('MESSAGE_DUPLICATE');
  tx.set(lock,{messageId:id,attempt,createdAt:Date.now()});tx.set(ref,{...current,status:'sending',attempt,attemptedAt:Date.now()});return true;
 });
 if(!claimed)return publicDraft((await ref.get()).data());
 let status='uncertain',httpStatus:number|null=null,outcomeCode='transport-failure';try{const result=await transport(request.url,request.options);httpStatus=Number.isInteger(result.status)?result.status:null;outcomeCode='response-unconfirmed';if(await batiAccepted(result,config.response)){status='accepted';outcomeCode='accepted-rule';}}catch{}
 await db.runTransaction(async(tx:any)=>{const current=(await tx.get(ref)).data();if(current?.attempt===attempt)tx.set(ref,{...current,status,httpStatus,outcomeCode,finishedAt:Date.now()});});
 return publicDraft((await ref.get()).data());
}


