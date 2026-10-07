import { readLessonSpecialNote } from './lessonSpecialNote.js';
import {notionReadFilter} from './notionReadFilter.js';
import {teacherReadCache,teacherReadKey} from './teacherReadCache.js';
import {workspaceInflightRead} from './workspaceInflightRead.js';
import {readMirroredPages,workspaceSourceFilter} from './teacherNotionMirror.js';
import {scheduleRange,type ScheduleRange} from './teacherScheduleRange.js';
import {addCalendarDays} from '../../src/lib/teacherWeekCalendar.js';
import { sharedRecordAccess, sharedRecordOwner } from './sharedNotionPolicy.js';
import {syncAcademicPage} from './academic.js';
import {gradeNotion as notion} from './teacherAcademicNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {subjects} from './teacherWorkspacePolicy.js';
import {extractAssignmentFromFeedback} from './assignmentExtractor.js';
import {randomUUID} from 'node:crypto';
export const DEFAULT_SOURCE={subject:'영어',classDatabaseId:'1a554024-20f2-42c5-8837-983bd1a4f61e',curriculumDatabaseId:'3390d0f1-c79a-80f5-96b0-e7dfe294b8f3',timetableDatabaseId:'5553cc9c-0182-4f0d-a661-3f3c1c83dc39',lessonDatabaseId:'ab289f5b-1cf5-4160-809e-10d268c9c385'};
const ENROLLMENT='3ec0d0f1-c79a-80b2-bb52-ea162888fe9a',TEACHERS='3d274aff-32ce-4a33-870d-2689259113a6';
export const text=(p:any)=>(p?.title||p?.rich_text||[]).map((t:any)=>t.plain_text??t.text?.content??'').join('');
const rich=(value:string)=>({rich_text:value.match(/[\s\S]{1,1900}/g)?.map(content=>({text:{content}}))||[]});
const title=(value:string)=>({title:[{text:{content:value}}]});
const relation=(ids:string[])=>({relation:ids.map(id=>({id}))});
const choice=(p:any)=>p?.status?.name||p?.select?.name||'';
const days=['일','월','화','수','목','금','토'];
export async function allPages(database:string,filter?:any){const rows:any[]=[];let cursor;do{const r=await notion(`databases/${database}/query`,'POST',{page_size:100,...(filter?{filter}:{}),...(cursor?{start_cursor:cursor}:{})});rows.push(...r.results);cursor=r.has_more?r.next_cursor:null;}while(cursor);return rows;}
export async function ids(page:any,key:string){const p=page.properties?.[key];if(!p?.has_more)return (p?.relation||[]).map((r:any)=>uuid(r.id));const out:string[]=[];let cursor;do{const r=await notion(`pages/${page.id}/properties/${encodeURIComponent(p.id)}`+(cursor?`?start_cursor=${cursor}`:''));out.push(...r.results.map((v:any)=>uuid(v.relation.id)));cursor=r.has_more?r.next_cursor:null;}while(cursor);return out;}
export function sourceSlots(page:any){const p=page.properties||{},name=text(p['時間대']||p['시간대']);const times=[...name.matchAll(/(?:[01]?\d|2[0-3]):[0-5]\d/g)].map(m=>m[0].padStart(5,'0'));const weekday=days.indexOf(choice(p['요일']));return weekday>=0&&times.length===2&&times[0]<times[1]?{id:uuid(page.id),weekday,...(choice(p['상태'])?{status:choice(p['상태'])}:{}),start:times[0],end:times[1]}:null;}
export function bookStatus(progress:string){return progress==='완료'?'past':['시작 전','시작 중'].includes(progress)?'planned':'current';}
export async function sourcesFor(db:any,actor:any){
 const ownProfile=Object.hasOwn(actor,'workspaceProfile')?actor.workspaceProfile:(await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()).data();
 const academyId=actor.academyId||ownProfile?.academyId||(actor.admin?'main':null);
 const shared=academyId?(await db.collection('academyNotionConfig').doc(academyId).get()).data():null;
 if(shared?.mode==='shared') {
  const profiles=(await db.collection('teacherWorkspaceAccess').where('academyId','==',academyId).get()).docs.map((d:any)=>({uid:d.id,...d.data()}));
  if(process.env.ADMIN_UID && academyId==='main' && !profiles.some((p:any)=>p.uid===process.env.ADMIN_UID))profiles.push({uid:process.env.ADMIN_UID,academyId,notionTeacherPageId:'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'});
  for(const profile of profiles)if(profile.uid===process.env.ADMIN_UID&&academyId==='main'&&!profile.notionTeacherPageId)profile.notionTeacherPageId='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2';
  const duplicate=new Set<string>();for(const profile of profiles){if(!profile.notionTeacherPageId)continue;const id=uuid(profile.notionTeacherPageId);if(duplicate.has(id))throw new Error('NOTION_TEACHER_ID_CONFLICT');duplicate.add(id);}
  return [{...DEFAULT_SOURCE,...shared,shared:true,academyId,profiles,ownerUid:actor.uid,teacherPageId:ownProfile?.notionTeacherPageId||(actor.uid===process.env.ADMIN_UID?'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2':null)}];
 }
 const profiles=actor.admin?(await db.collection('teacherWorkspaceAccess').get()).docs:actor.principal?(await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs:[Object.hasOwn(actor,'workspaceProfile')?{id:actor.uid,exists:Boolean(ownProfile),data:()=>ownProfile}:await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()];
 const map=new Map(profiles.filter((d:any)=>d.exists&&!d.data().disabled).map((d:any)=>[d.id,d.data()]));
 if(actor.admin&&!map.has(actor.uid))map.set(actor.uid,{academyId:actor.academyId});
 if(actor.principal&&actor.academyId==='main'&&process.env.ADMIN_UID&&!map.has(process.env.ADMIN_UID)){const adminProfile=(await db.collection('teacherWorkspaceAccess').doc(process.env.ADMIN_UID).get()).data();if(!adminProfile||(!adminProfile.disabled&&adminProfile.academyId==='main'))map.set(process.env.ADMIN_UID,adminProfile||{academyId:'main'});}
 const result:any[]=[];
 for(const [uid,profile] of map as Map<string,any>){const sources=profile.notionSources?.length?profile.notionSources:uid===process.env.ADMIN_UID?[DEFAULT_SOURCE]:[];for(const source of sources)result.push({...source,ownerUid:uid,academyId:profile.academyId||actor.academyId,teacherPageId:profile.notionTeacherPageId||(uid===process.env.ADMIN_UID?'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2':null)});}
 const owners=new Map<string,string>();for(const source of result)for(const key of ['classDatabaseId','curriculumDatabaseId']){const id=source[key];if(!id)throw new Error('NOTION_SOURCE_NOT_CONFIGURED');if(owners.has(id)&&owners.get(id)!==source.ownerUid)throw new Error('NOTION_SOURCE_OWNER_CONFLICT');owners.set(id,source.ownerUid);}
 return result;
}
export async function rowSource(page:any,source:any,actor:any) {
 if(!source.shared)return source;
 let assigned=await ids(page,'담당 선생님');const authors=await ids(page,'작성자 선생님');
 const legacyEnglishSchedule=source.legacySchedule&&source.academyId==='main'&&source.subject==='영어'&&!choice(page.properties['과목'])&&page.parent?.database_id&&uuid(page.parent.database_id)==='3430f1a4-9dde-4b4c-a5cf-0d11b913b38c'&&assigned.length===1&&assigned[0]==='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'&&(!authors.length||authors.length===1&&authors[0]===assigned[0]);
 const legacyLesson=source.legacyLesson && source.academyId==='main' && !text(page.properties['학원']) && (!choice(page.properties['과목'])||choice(page.properties['과목'])==='영어');
 const legacySchedule=source.legacySchedule && source.academyId==='main' && !text(page.properties['학원']) && (subjects.includes(choice(page.properties['과목']) as any)||legacyEnglishSchedule);
 const legacy=legacyLesson||legacySchedule;
 const academy=text(page.properties['학원'])||(legacy?'main':'');if(academy!==source.academyId)return null;
 const subject=choice(page.properties['과목'])||(legacy?'영어':'');if(!subjects.includes(subject as any))return null;
 if(legacyLesson&&!assigned.length)assigned=['3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'];
 const profiles=new Map<string,string>((source.profiles||[]).filter((p:any)=>p.notionTeacherPageId).map((p:any)=>[uuid(p.notionTeacherPageId),p.uid]));
 const ownerUid=sharedRecordOwner(authors,assigned,profiles);
 const assignedUids=assigned.map((id:string)=>profiles.get(id)).filter(Boolean);
 if(!sharedRecordAccess(actor,academy,assignedUids,ownerUid))return null;
 return {...source,subject,ownerUid,assignedUids};
}
export async function enableSharedWorkspace(db:any,actor:any) {
 if(!actor.admin)throw new Error('FORBIDDEN');
 const academyId=actor.academyId||'main';if(academyId!=='main')throw new Error('NOTION_SOURCE_NOT_CONFIGURED');
 // Preserve IDs and relations; reject unsafe legacy mappings before activation.
 const profiles=(await db.collection('teacherWorkspaceAccess').where('academyId','==',academyId).get()).docs;
 for(const profile of profiles)for(const connection of profile.data().notionSources||[])if(uuid(connection.classDatabaseId)!==uuid(DEFAULT_SOURCE.classDatabaseId)||uuid(connection.curriculumDatabaseId)!==uuid(DEFAULT_SOURCE.curriculumDatabaseId))throw new Error('NOTION_LEGACY_MIGRATION_REQUIRED');
 for(const [database,titleKey] of [[DEFAULT_SOURCE.classDatabaseId,'수업명'],[DEFAULT_SOURCE.curriculumDatabaseId,'교재명']]) {
  const schema=await notion(`databases/${database}`);
  for(const key of [titleKey,'담당 선생님','과목','학원'])if(!schema.properties[key])throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
  const pages=await allPages(database);
  for(const page of pages)if(text(page.properties['학원'])!==academyId||!choice(page.properties['과목'])||!(await ids(page,'담당 선생님')).length)throw new Error('NOTION_SHARED_DATA_REQUIRED');
 }
 await db.collection('academyNotionConfig').doc(academyId).set({...DEFAULT_SOURCE,mode:'shared',enabledAt:Date.now(),enabledBy:actor.uid});
 return {mode:'shared',academyId};
}
async function mirroredPages(db:any,actor:any,database:string,filter?:any,force=false) {
 const schema=filter?await teacherReadCache.get(teacherReadKey(actor,'schema:'+database),()=>notion(`databases/${database}`),force):null;
 const adapted=schema?notionReadFilter(filter,schema.properties||{}):true;
 if(adapted===false)return [];
 filter=adapted===true?undefined:adapted;
 const properties=new Set<string>();
 const visit=(f:any)=>{if(!f)return;if(f.relation)properties.add(f.property);for(const child of [...(f.and||[]),...(f.or||[])])visit(child);};visit(filter);
 return readMirroredPages(db,actor,database,filter,async query=>{
  const pages=await allPages(database,query);
  await Promise.all(pages.map(async page=>{for(const key of properties)if(page.properties?.[key]?.has_more){const relation=await ids(page,key);page.properties[key]={...page.properties[key],has_more:false,relation:relation.map(id=>({id}))};}}));
  return pages;
 },force);
}
export async function readNotionWorkspace(db:any,actor:any,section:'classes'|'all'='all',force=false){
 const classes:any[]=[],curricula:any[]=[],issues:string[]=[];const sources=await sourcesFor(db,actor);
 if(!sources.length)issues.push('이 선생님의 노션 반·커리큘럼 DB 연결이 필요합니다. 관리자 설정에서 과목별 DB를 연결해 주세요.');
 for(const source of sources){try{
  const filter=workspaceSourceFilter(source,actor);
  const [classPages,bookPages]=await Promise.all([mirroredPages(db,actor,source.classDatabaseId,filter,force),section==='all'?mirroredPages(db,actor,source.curriculumDatabaseId,filter,force):Promise.resolve([])]);
  const visibleClasses=await Promise.all(classPages.map(async page=>await rowSource(page,source,actor)?page:null));
  const classIds=visibleClasses.filter(Boolean).map(p=>uuid(p.id));
  const timePages=(await Promise.all(Array.from({length:Math.ceil(classIds.length/90)},(_,i)=>mirroredPages(db,actor,source.timetableDatabaseId,{or:classIds.slice(i*90,i*90+90).map(id=>({property:'반',relation:{contains:id}}))},force)))).flat();
  const knownClasses=new Map(classPages.map(p=>[uuid(p.id),p]));
  const times=await Promise.all(timePages.map(async page=>({...sourceSlots(page),classIds:await ids(page,'반'),source:page})));
  for(const page of classPages){const row=await rowSource(page,source,actor);if(!row)continue;const studentIds=await ids(page,'대상 학생');const id=uuid(page.id);const bookIds=await ids(page,'커리큘럼');const books=bookPages.filter(p=>bookIds.includes(uuid(p.id))).map(p=>({id:uuid(p.id),title:text(p.properties['교재명']),...(p.properties['공통 계획']?.checkbox?{linkedPlanId:uuid(p.id)}:{}),status:bookStatus(choice(p.properties['진행도'])),progress:choice(p.properties['진행도']),notionEditedAt:p.last_edited_time}));classes.push({id,status:choice(page.properties['상태'])||'진행 중',name:text(page.properties['수업명']),subject:row.subject,students:studentIds,slots:times.filter(t=>t.id&&t.classIds.includes(id)).map(({id,weekday,start,end,source})=>({id,weekday,start,end,status:choice(page.properties['상태'])==='중단'?'중단':choice(source.properties['상태'])||'진행 중',notionEditedAt:source.last_edited_time})),books,ownerUid:row.ownerUid,assignedUids:row.assignedUids||[],academyId:source.academyId,notionPageId:id,notionEditedAt:page.last_edited_time,source:'notion',revision:0});}
  for(const page of bookPages){const row=await rowSource(page,source,actor);if(!row)continue;const classIds=await ids(page,'반 관리');const known=classIds.filter(id=>knownClasses.has(id));curricula.push({id:uuid(page.id),title:text(page.properties['교재명']),subject:row.subject,content:text(page.properties['수업 계획']),classId:page.properties['공통 계획']?.checkbox?null:known[0]||null,isCommon:Boolean(page.properties['공통 계획']?.checkbox)||classIds.length===0,classIds:known,progress:choice(page.properties['진행도']),ownerUid:row.ownerUid,assignedUids:row.assignedUids||[],academyId:source.academyId,notionPageId:uuid(page.id),notionEditedAt:page.last_edited_time,source:'notion',revision:0});}
  for(const t of times)if(!t.id)issues.push(`${source.subject}: 읽을 수 없는 정규 시간 표기가 있습니다. DB_시간표의 시간대를 '월 14:00-15:30'처럼 확인해 주세요.`);
 }catch(e:any){issues.push(`${source.subject}: 노션 반·교재·시간표를 불러오지 못했습니다 (${e.message}). 연결 DB의 공유 권한을 확인해 주세요.`);}}
 return {classes,curricula,issues,sources};
}
export function mergeNotionRows(local:any[],remote:any[]){
 local=local.map(r=>r.notionSyncStage==='syncing'&&Date.now()-(r.notionSyncStartedAt||0)>=900000?{...r,notionSyncStage:'failed',notionSyncError:'반영 처리가 중단되었습니다. 다시 반영해 주세요.'}:r);
 const normalize=(id:any)=>{try{return uuid(id);}catch{return '';}};
 const markers=new Map<string,number>();for(const r of remote)if(normalize(r.appRecordId))markers.set(normalize(r.appRecordId),(markers.get(normalize(r.appRecordId))||0)+1);
 const used=new Set<any>(),result:any[]=[];
 for(const source of remote){
  const page=normalize(source.notionPageId);
  const cached=local.find(r=>page&&normalize(r.notionPageId)===page)||local.find(r=>!r.notionPageId&&markers.get(normalize(source.appRecordId))===1&&normalize(r.id)===normalize(source.appRecordId)&&r.ownerUid===source.ownerUid&&r.academyId===source.academyId&&r.data&&source.data&&normalize(r.data.studentKey)===normalize(source.data.studentKey)&&r.data.subject===source.data.subject);
  if(cached)used.add(cached);if(cached?.archived)continue;
  const pending=['pending','failed','syncing'].includes(cached?.notionSyncStage)||(cached?.data&&['draft','failed','publishing','processing','notion_saved','report_published_notion_pending','reflection_pending'].includes(cached.stage)&&cached.revision>0)||Boolean(cached?.notionWrite&&cached?.stage==='published');
  result.push(pending?{...cached,notionPageId:source.notionPageId,appRecordId:source.appRecordId}:cached?{...cached,...source,id:cached.id,revision:cached.revision,ownerUid:cached.ownerUid,academyId:cached.academyId,notionSyncStage:'synced'}:source);
 }
 for(const r of local)if(!used.has(r)&&!r.archived&&(!r.notionPageId||['failed','pending','syncing'].includes(r.notionSyncStage)||r.data&&r.revision>0))result.push(r);
 return result;
}
async function prepare(database:string,extra:any){const schema=await notion(`databases/${database}`);const properties:any={};for(const [name,type] of Object.entries({'앱 기록 ID':{rich_text:{}},...extra}))if(!schema.properties[name])properties[name]=type;if(Object.keys(properties).length)await notion(`databases/${database}`,'PATCH',{properties});}
async function upsert(database:string,appId:string,pageId:string|undefined,properties:any,editedAt?:string){
 if(pageId){const old=await notion(`pages/${pageId}`);if(uuid(old.parent?.database_id||'')!==uuid(database)||old.archived||old.in_trash)throw new Error('NOTION_SOURCE_MISMATCH');if(editedAt&&old.last_edited_time!==editedAt)throw new Error('NOTION_EDIT_CONFLICT');}
 else{const matches=await allPages(database,{property:'앱 기록 ID',rich_text:{equals:appId}});if(matches.length>1)throw new Error('DUPLICATE_NOTION_RECORD');pageId=matches[0]?.id;}
 return pageId?notion(`pages/${pageId}`,'PATCH',{properties}):notion('pages','POST',{parent:{database_id:database},properties:{...properties,'앱 기록 ID':rich(appId)}});
}
async function currentSource(db:any,ownerUid:string,subject:string){const sources=await sourcesFor(db,{uid:ownerUid,admin:ownerUid===process.env.ADMIN_UID,principal:false});const source=sources.find(s=>s.shared||s.subject===subject);if(!source){if(ownerUid===process.env.ADMIN_UID&&subject==='영어')return {...DEFAULT_SOURCE,ownerUid,teacherPageId:'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2'};throw new Error('NOTION_SOURCE_NOT_CONFIGURED');}return source;}
export async function syncManagedRecord(db:any,collection:string,id:string){
 const ref=db.collection(collection).doc(id),record=(await ref.get()).data();if(!record)throw new Error('FORBIDDEN');if(record.notionPageId&&!record.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
 const source=await currentSource(db,record.ownerUid,record.subject);if(source.shared&&!source.teacherPageId)throw new Error('TEACHER_NOTION_LINK_REQUIRED');const isClass=collection==='teacherClasses';const database=isClass?source.classDatabaseId:source.curriculumDatabaseId;

 let phase=isClass?'반 상태 반영':'교재·계획 반영';
 // Lock local revision while making remote writes. No untrusted page ID is accepted here.
 await db.runTransaction(async(t:any)=>{const fresh=(await t.get(ref)).data();if(fresh.revision!==record.revision||fresh.notionSyncStage==='syncing'&&Date.now()-(fresh.notionSyncStartedAt||0)<900000)throw new Error('DRAFT_CONFLICT');t.update(ref,{notionSyncStage:'syncing',notionSyncStartedAt:Date.now(),notionSyncDiagnostic:null});});
 try{
 if(isClass&&record.notionStatusOnly&&!record.deleteRequested){
  const parent=await notion(`pages/${record.notionPageId}`);
  if(uuid(parent.parent?.database_id||'')!==uuid(database)||parent.archived||parent.in_trash)throw new Error('NOTION_SOURCE_MISMATCH');
  if(parent.last_edited_time!==record.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
  const targets=(record.slots||[]).filter((slot:any)=>(record.notionStatusSlotIds||[]).includes(slot.id));
  const pages=await Promise.all(targets.map((slot:any)=>notion(`pages/${slot.id}`)));
  for(const [index,page] of pages.entries()){
   if(uuid(page.parent?.database_id||'')!==uuid(source.timetableDatabaseId)||page.archived||page.in_trash)throw new Error('NOTION_SOURCE_MISMATCH');
   if(page.last_edited_time!==targets[index].notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
   const links=await ids(page,'반');if(links.length!==1||links[0]!==uuid(record.notionPageId))throw new Error('NOTION_SHARED_TIMETABLE');
  }
  if(choice(parent.properties['상태'])!==record.status){const saved=await notion(`pages/${record.notionPageId}`,'PATCH',{properties:{'상태':{status:{name:record.status}}}});await ref.update({notionEditedAt:saved.last_edited_time});}
  for(const [index,slot] of targets.entries()){
   const status=record.status==='중단'?'중단':slot.status||'진행 중';
   if(choice(pages[index].properties['상태'])!==status){const saved=await notion(`pages/${slot.id}`,'PATCH',{properties:{'상태':{status:{name:status}}}});record.slots=record.slots.map((s:any)=>s.id===slot.id?{...s,notionEditedAt:saved.last_edited_time}:s);await ref.update({slots:record.slots});}
  }
  const final=await notion(`pages/${record.notionPageId}`);await ref.update({notionEditedAt:final.last_edited_time,notionSyncStage:'synced',notionStatusOnly:false,notionStatusSlotIds:[]});return;
 }
 if(isClass){record.slots=(record.slots||[]).map((s:any)=>({...s,id:s.id||randomUUID()}));record.books=(record.books||[]).map((b:any)=>({...b,id:b.id||randomUUID()}));await ref.update({slots:record.slots,books:record.books});}
 phase=isClass?'반 DB 준비':'교재 DB 준비';
 await prepare(database,{...(isClass?{}:{'수업 계획':{rich_text:{}},'공통 계획':{checkbox:{}}}),...(source.shared?{'작성자 선생님':{relation:{database_id:TEACHERS}}}:{})});
 if(record.deleteRequested){if(record.notionPageId){const page=await notion(`pages/${record.notionPageId}`);if(uuid(page.parent.database_id)!==uuid(database))throw new Error('NOTION_SOURCE_MISMATCH');await notion(`pages/${record.notionPageId}`,'PATCH',{archived:true});}if(isClass){const times=await allPages(source.timetableDatabaseId,{property:'반',relation:{contains:record.notionPageId||id}});for(const page of times){const linked=await ids(page,'반');const remaining=linked.filter(key=>key!==uuid(record.notionPageId||id));await notion(`pages/${page.id}`,'PATCH',remaining.length?{properties:{'반':relation(remaining)}}:{archived:true});}}await ref.update({archived:true,notionSyncStage:'synced'});return;}
 if(!isClass){let classPage:string|undefined;if(record.classId){const linked=(await db.collection('teacherClasses').doc(record.classId).get()).data();classPage=linked?.notionPageId||record.classId;const page=await notion(`pages/${classPage}`);if(uuid(page.parent.database_id)!==uuid(source.classDatabaseId))throw new Error('NOTION_SOURCE_MISMATCH');}
 const old=record.notionPageId?await notion(`pages/${record.notionPageId}`):null;const relations=old?await ids(old,'반 관리'):[];
 const props:any={...(source.shared?{'담당 선생님':relation([...new Set([...(old?await ids(old,'담당 선생님'):[]),source.teacherPageId])]),'작성자 선생님':relation(source.teacherPageId?[source.teacherPageId]:[]),'과목':{select:{name:record.subject}},'학원':rich(source.academyId)}:{}),'공통 계획':{checkbox:!record.classId},'교재명':title(record.title),'수업 계획':rich(record.content),'반 관리':relation([...new Set([...relations.filter(k=>k!==record.previousClassPageId),...(classPage?[classPage]:[])])])};
 if(!old)props['진행도']={status:{name:'시작 전'}};
 if(record.notionPageId) {
  for(const child of [...(record.slots||[]),...(record.books||[])]) {
   if(!child.notionEditedAt)continue;
   const current=await notion(`pages/${child.id}`);
   if(current.last_edited_time!==child.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
  }
 }
 const page=await upsert(database,id,record.notionPageId,props,record.notionEditedAt);await ref.update({notionPageId:uuid(page.id),notionEditedAt:page.last_edited_time,notionSyncStage:'synced',previousClassPageId:classPage||null});return;}
 phase='반 정보 반영';
 const page=await upsert(database,id,record.notionPageId,{...(source.shared?{'작성자 선생님':relation([source.teacherPageId]),'담당 선생님':relation(record.notionPageId? [...new Set([...(await ids(await notion(`pages/${record.notionPageId}`),'담당 선생님')),source.teacherPageId])] : [source.teacherPageId]),'과목':{select:{name:record.subject}},'학원':rich(source.academyId)}:{}),'상태':{status:{name:record.status||'진행 중'}},'수업명':title(record.name),'대상 학생':relation(record.students),'요일':{multi_select:[...new Set(record.slots.map((s:any)=>days[s.weekday]))].map(name=>({name}))}},record.notionEditedAt);
 // Persist parent identity before child writes so retry cannot duplicate the class.
 await ref.update({notionPageId:uuid(page.id),notionEditedAt:page.last_edited_time});
 phase='시간표·교재 DB 준비';
 await prepare(source.timetableDatabaseId,{});await prepare(source.curriculumDatabaseId,{'공통 계획':{checkbox:{}}});
 const existingTimes=await allPages(source.timetableDatabaseId,{property:'반',relation:{contains:page.id}});
 const savedSlots:any[]=[];
 phase='정규 시간표 반영';
 for(const [index,slot] of record.slots.entries()){
  const old=slot.id?existingTimes.find(t=>uuid(t.id)===uuid(slot.id)):null;
  const links=old?await ids(old,'반'):[];
  if(old&&slot.notionEditedAt&&old.last_edited_time!==slot.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
  if(old&&links.some(key=>key!==uuid(page.id)))throw new Error('NOTION_SHARED_TIMETABLE');
  const slotId=slot.id||randomUUID();const row=await upsert(source.timetableDatabaseId,`${id}:slot:${slotId}`,old?.id,{'상태':{status:{name:record.status==='중단'?'중단':slot.status||'진행 중'}},'시간대':title(`${days[slot.weekday]} ${slot.start}-${slot.end}`),'요일':{select:{name:days[slot.weekday]}},'반':relation([page.id]),...(source.teacherPageId?{'담당 선생님':relation([source.teacherPageId])}:{})});savedSlots.push({...slot,id:uuid(row.id),notionEditedAt:row.last_edited_time});
  await ref.update({slots:[...savedSlots,...record.slots.slice(index+1)]});
 }
 for(const old of existingTimes)if(!savedSlots.some(s=>s.id===uuid(old.id))){const remain=(await ids(old,'반')).filter(key=>key!==uuid(page.id));await notion(`pages/${old.id}`,'PATCH',remain.length?{properties:{'반':relation(remain)}}:{archived:true});}
 phase='교재 반영';
 const oldClass=await notion(`pages/${page.id}`),oldBookIds=await ids(oldClass,'커리큘럼');const savedBooks:any[]=[];
 for(const [index,book] of (record.books||[]).entries()){
  if(book.linkedPlanId){
   const linked=await notion(`pages/${book.id}`);
   if(uuid(linked.parent?.database_id||'')!==uuid(source.curriculumDatabaseId)||linked.archived||linked.in_trash)throw new Error('NOTION_SOURCE_MISMATCH');
   const scoped=await rowSource(linked,source,{uid:record.ownerUid,academyId:record.academyId,admin:record.ownerUid===process.env.ADMIN_UID});
   if(!scoped||scoped.subject!==record.subject)throw new Error('FORBIDDEN');
   const links=await ids(linked,'반 관리');
   if(!linked.properties['공통 계획']?.checkbox&&links.length&&!links.includes(uuid(page.id)))throw new Error('FORBIDDEN');
   const alreadyLinked=Boolean(linked.properties['공통 계획']?.checkbox&&links.includes(uuid(page.id)));
   if(!alreadyLinked&&book.notionEditedAt&&linked.last_edited_time!==book.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
   const saved=alreadyLinked?linked:await notion(`pages/${book.id}`,'PATCH',{properties:{'공통 계획':{checkbox:true},'반 관리':relation([...new Set([...links,uuid(page.id)])])}});
   savedBooks.push({...book,id:uuid(saved.id),title:text(linked.properties['교재명']),status:bookStatus(choice(linked.properties['진행도'])),progress:choice(linked.properties['진행도']),notionEditedAt:saved.last_edited_time});
   await notion(`pages/${page.id}`,'PATCH',{properties:{'커리큘럼':relation([...new Set([...oldBookIds,...savedBooks.map(b=>b.id)])])}});
   await ref.update({books:[...savedBooks,...record.books.slice(index+1)]});
   continue;
  }

  const old=book.id&&oldBookIds.includes(uuid(book.id))?await notion(`pages/${book.id}`):null;
  
  if(old&&source.shared){const owner=await rowSource(old,source,{uid:record.ownerUid,academyId:record.academyId});if(!owner||owner.ownerUid!==record.ownerUid){if(text(old.properties['교재명'])!==book.title||bookStatus(choice(old.properties['진행도']))!==book.status)throw new Error('FORBIDDEN');savedBooks.push({...book,id:uuid(old.id),progress:choice(old.properties['진행도'])});continue;}}
  const links=old?await ids(old,'반 관리'):[];const progress=old?choice(old.properties['진행도']):'';const next=progress&&bookStatus(progress)===book.status?progress:({past:'완료',current:'진행 중',planned:'시작 전'} as any)[book.status];
  const row=await upsert(source.curriculumDatabaseId,`${id}:book:${book.id}`,old?.id,{...(source.shared?{'담당 선생님':relation([...new Set([...(old?await ids(old,'담당 선생님'):[]),source.teacherPageId])]),'작성자 선생님':relation(old?(await ids(old,'작성자 선생님')).length?await ids(old,'작성자 선생님'):[source.teacherPageId]:[source.teacherPageId]),'과목':{select:{name:record.subject}},'학원':rich(source.academyId)}:{}),'교재명':title(book.title),'진행도':{status:{name:next}},'반 관리':relation([...new Set([...links,page.id])])});savedBooks.push({...book,id:uuid(row.id),progress:next,notionEditedAt:row.last_edited_time});
  // Record identity on the class immediately, before the next child write.
  await notion(`pages/${page.id}`,'PATCH',{properties:{'커리큘럼':relation([...new Set([...oldBookIds,...savedBooks.map(b=>b.id)])])}});await ref.update({books:[...savedBooks,...record.books.slice(index+1)]});
 }
 // Removing a book detaches the class relation, preserving its historical page and other classes.
 phase='교재 연결 정리';
 for(const removed of oldBookIds.filter(id=>!savedBooks.some(b=>b.id===id))){const book=await notion(`pages/${removed}`);const links=(await ids(book,'반 관리')).filter(key=>key!==uuid(page.id));await notion(`pages/${removed}`,'PATCH',{properties:{'반 관리':relation(links)}});}
 await notion(`pages/${page.id}`,'PATCH',{properties:{'커리큘럼':relation(savedBooks.map(b=>b.id))}});
 const final=await notion(`pages/${page.id}`);await ref.update({slots:savedSlots,books:savedBooks,notionEditedAt:final.last_edited_time,notionSyncStage:'synced'});
 }catch(e:any){if(record.notionPageId&&e.message!=='NOTION_EDIT_CONFLICT'){const latest=await notion(`pages/${record.notionPageId}`).catch(()=>null);if(latest)await ref.update({notionEditedAt:latest.last_edited_time});}await ref.update({notionSyncStage:'failed',notionSyncError:e.message,notionSyncDiagnostic:{phase,...(e.notionDiagnostic||{})}});throw e;}
}
export async function readSourceEnrollments(db?:any,actor?:any,force=false){
 const keys=[...new Set((actor?.scopes||[]).map((s:any)=>s.studentKey))];
 const pages=!db||!actor?await allPages(ENROLLMENT):actor.admin?await mirroredPages(db,actor,ENROLLMENT,undefined,force):(await Promise.all(Array.from({length:Math.ceil(keys.length/90)},(_,i)=>mirroredPages(db,actor,ENROLLMENT,{or:keys.slice(i*90,i*90+90).map(key=>({property:'학생',relation:{contains:key}}))},force)))).flat();const map=new Map<string,any[]>();for(const p of pages){const students=await ids(p,'학생');if(students.length!==1)continue;if(map.has(students[0]))throw new Error('NOTION_DUPLICATE_ENROLLMENT');if(db&&actor&&(actor.admin||actor.scopes.some((s:any)=>s.studentKey===students[0]))){const saved=(await db.collection('studentEnrollments').doc(uuid(p.id)).get()).data();if(saved?.sourceUpdatedAt!==p.last_edited_time)await syncAcademicPage(db,p);}
 map.set(students[0],subjects.filter(s=>choice(p.properties[s])).map(subject=>({subject,status:choice(p.properties[subject]),startDate:p.properties[`${subject} 시작일`]?.date?.start||null,endDate:p.properties[`${subject} 중단일`]?.date?.start||null})));}return map;}
export {syncTeacherAssignments} from './teacherAssignmentSync.js';
export async function lessonSource(db:any,ownerUid:string,subject:string){const list=await sourcesFor(db,{uid:ownerUid,admin:ownerUid===process.env.ADMIN_UID,principal:false,academyId:'main'});return list.find(s=>(s.shared||s.ownerUid===ownerUid&&s.subject===subject)&&s.lessonDatabaseId);}
export async function readSourceLessons(db:any,actor:any,force=false){
 const out:any[]=[];const sourceList=await sourcesFor(db,actor);
 for(const source of sourceList){if(!source.lessonDatabaseId)continue;
 const scoped=workspaceSourceFilter(source,actor);
 const ownership=source.shared&&source.lessonDatabaseId===DEFAULT_SOURCE.lessonDatabaseId?{or:[scoped,{and:[{property:'학원',rich_text:{is_empty:true}},{or:[{property:'과목',select:{equals:'영어'}},{property:'과목',select:{is_empty:true}}]}]}]}:scoped;
 // Unlinked historical rows were always excluded below; do not download them.
 const filter={and:[...(ownership?[ownership]:[]),{property:'학생',relation:{is_not_empty:true}}]};
 const pages=await mirroredPages(db,actor,source.lessonDatabaseId,filter,force);
 for(const page of pages){const row=await rowSource(page,{...source,legacyLesson:source.lessonDatabaseId===DEFAULT_SOURCE.lessonDatabaseId},actor);if(!row)continue;const p=page.properties,studentIds=await ids(page,'학생');if(studentIds.length!==1)continue;const key=studentIds[0];const subject=choice(p['과목'])||source.subject;
 if(!key||(!source.shared&&subject!==source.subject)||(!actor.admin&&!actor.scopes.some((s:any)=>s.studentKey===key&&s.subject===subject)))continue;
 if(!source.shared&&p['담당 선생님']&&!(await ids(page,'담당 선생님')).includes(source.teacherPageId))continue;
 const date=p['타임 슬롯']?.date||p['수업 날짜']?.date;const range=text(p['배정 시간']||p['수업']).match(/([0-2]?\d:[0-5]\d)\s*[~–-]\s*([0-2]?\d:[0-5]\d)/);const study=text(p['자습시간']).match(/([0-2]?\d:[0-5]\d)\s*[~–-]\s*([0-2]?\d:[0-5]\d)/);
 const total=p['단어']?.number??null,wrong=p['틀린 단어']?.number??null,examTotal=p['문항 수']?.number??null,examWrong=p['오답 수']?.number??null;
 const feedback=text(p['수업 내용']);const marker=[...feedback.matchAll(/(?:^|\n)[ \t]*과제[ \t]*[:：][ \t]*/g)].at(-1);
 const data={studentKey:key,subject,date:date?.start?.slice(0,10)||'',classSession:range?'있음':'없음',start:range?.[1]?.padStart(5,'0')||'',end:range?.[2]?.padStart(5,'0')||'',round:p['회차']?.number??null,selfStudy:p['자습']?.checkbox||study?'있음':'없음',selfStudyStart:study?.[1]?.padStart(5,'0')||'',selfStudyEnd:study?.[2]?.padStart(5,'0')||'',selfStudyRound:p['자습회차']?.number??p['자습 회차']?.number??null,attendance:choice(p['출석'])||'미확인',attitude:choice(p['태도'])||'미확인',homework:choice(p['숙제'])||'미확인',test:choice(p['테스트'])||'미확인',content:marker?feedback.slice(0,marker.index).trimEnd():feedback,assignment:extractAssignmentFromFeedback(feedback)||'',note:'',nextPlan:text(p['메모']),examScope:text(p['시험범위']),attendanceNote:text(p['앱 출결 메모']),specialNote:readLessonSpecialNote(p),correct:total!==null&&wrong!==null?total-wrong:null,total:wrong!==null?total:null,examCorrect:examTotal!==null&&examWrong!==null?examTotal-examWrong:null,examTotal:examWrong!==null?examTotal:null};
 out.push({id:uuid(page.id),appRecordId:text(p['앱 기록 ID']),data,ownerUid:row.ownerUid,academyId:source.academyId,notionPageId:uuid(page.id),sourceDatabaseId:source.lessonDatabaseId,notionEditedAt:page.last_edited_time,stage:choice(p['전송 완료'])==='완료'?'published':'draft',revision:0,source:'notion',updatedAt:Date.parse(page.last_edited_time)});
 }}return out;
}
export async function readSourceSchedules(db:any,actor:any,range?:ScheduleRange,force=false){
 const database='3430f1a4-9dde-4b4c-a5cf-0d11b913b38c';
 const list=await sourcesFor(db,actor);if(!list.length)return [];
 const scopes=list.map(source=>source.shared&&source.academyId==='main'?{or:[workspaceSourceFilter(source,actor),{property:'학원',rich_text:{is_empty:true}}]}:workspaceSourceFilter(source,actor));
 const filters=[...(scopes.every(Boolean)?[{or:scopes}]:[]),...(range?[{property:'날짜 및 시간',date:{on_or_after:range.from+'T00:00:00+09:00'}},{property:'날짜 및 시간',date:{before:addCalendarDays(range.to,1)+'T00:00:00+09:00'}}]:[])];
 const filter=filters.length?{and:filters}:undefined;
 const pages=await mirroredPages(db,actor,database,filter,force);const out:any[]=[];
 for(const page of pages){const p=page.properties,teachers=await ids(page,'담당 선생님');const source=list.find(s=>s.shared||teachers.includes(s.teacherPageId));if(!source)continue;const row=await rowSource(page,{...source,legacySchedule:true},actor);if(!row)continue;const students=await ids(page,'대상 학생'),subject=choice(p['과목'])||source.subject;
 if(!actor.admin&&students.some(key=>!actor.scopes.some((s:any)=>s.studentKey===key&&s.subject===subject)))continue;
 const time=p['날짜 및 시간']?.date;if(!time?.start||!time.end)continue;
 const ktime=(s:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(time.start));
 out.push({id:uuid(page.id),data:{title:text(p['일정명']),subject,students,date,start:ktime(time.start),end:ktime(time.end),kind:choice(p['일정 종류'])||'기타',status:choice(p['일정 상태'])||'예정',place:choice(p['장소']),note:text(p['안내 내용'])},ownerUid:row.ownerUid,academyId:source.academyId,notionPageId:uuid(page.id),notionEditedAt:page.last_edited_time,source:'notion',revision:0,stage:choice(p['반영 상태'])==='반영 완료'?'published':'draft',updatedAt:Date.parse(page.last_edited_time)});
 }return out;
}
// In-flight only: completed requests never leave cached permissions behind.
const scopeReads=new WeakMap<object,Map<string,Promise<any[]>>>();
async function readScopeAssignments(db:any,profile:any) {
 let pending=scopeReads.get(db);if(!pending){pending=new Map();scopeReads.set(db,pending);}
 const key=JSON.stringify([profile.notionTeacherPageId,profile.academyId]);
 let read=pending.get(key);
 if(!read){
  read=(async()=>{
   const page=await notion(`pages/${profile.notionTeacherPageId}`);
   if(uuid(page.parent?.database_id||'')!==uuid(TEACHERS)||page.archived||page.in_trash||['중단','휴직'].includes(choice(page.properties['상태'])))throw new Error('TEACHER_NOT_CONFIGURED');
   const pages=await allPages(ENROLLMENT,{or:subjects.map(subject=>({property:`${subject} 담당`,relation:{contains:profile.notionTeacherPageId}}))});
   return Promise.all(pages.map(async row=>{
    const [students,...assigned]=await Promise.all([ids(row,'학생'),...subjects.map(subject=>ids(row,`${subject} 담당`))]);
    return students.length===1?subjects.flatMap((subject,i)=>assigned[i].includes(uuid(profile.notionTeacherPageId))?[{studentKey:students[0],subject}]:[]):[];
   })).then(rows=>rows.flat());
  })();
  pending.set(key,read);
  const cleanup=()=>{if(pending!.get(key)===read)pending!.delete(key);};
  read.then(cleanup,cleanup);
 }
 return read;
}
export async function notionTeachingScopes(db:any,profile:any){
 if(!profile.notionTeacherPageId)return profile.scopes||[];
 const assignments=await readScopeAssignments(db,profile);
 const keys=[...new Set(assignments.map(s=>s.studentKey))];
 const membership=new Map<string,any>();
 // Keep every request's membership check fresh; batch up to 100 references.
 for(let offset=0;offset<keys.length;offset+=100){
  const chunk=keys.slice(offset,offset+100);
  const refs=chunk.map(key=>db.collection('academyStudentMemberships').doc(key));
  const docs=await workspaceInflightRead<any[]>(db,'scope-members:'+JSON.stringify(chunk),()=>typeof db.getAll==='function'?db.getAll(...refs):Promise.all(refs.map(ref=>ref.get())));
  docs.forEach((doc:any,i:number)=>membership.set(chunk[i],doc.data()));
 }
 return assignments.filter(s=>{const member=membership.get(s.studentKey);return member&&!member.disabled&&member.academyId===profile.academyId;});
}
