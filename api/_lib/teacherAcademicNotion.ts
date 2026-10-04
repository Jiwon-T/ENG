import type { Firestore } from 'firebase-admin/firestore';
import { GRADE_DATABASE, syncAcademicPage } from './academic.js';
import { normalizeNotionPageId } from './notionPageId.js';
import { academicDraftSchema } from './teacherAcademicPolicy.js';
export async function gradeNotion(path:string, method='GET', body?:unknown) {
 const token=process.env.NOTION_INTEGRATION_TOKEN;
 if(!token) throw new Error('CONFIG_ERROR');
 let response:Response;
 for(let attempt=0;attempt<4;attempt++){
  response=await fetch(`https://api.notion.com/v1/${path}`, {method,headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(15000)});
  if(response.status!==429||attempt===3)break;
  const delay=Math.min(10000,Math.max(1000,Number(response.headers?.get('retry-after')||1)*1000));await new Promise(resolve=>setTimeout(resolve,delay));
 }
 if(!response!.ok) throw new Error(`NOTION_${response!.status}`);
 return response.json();
}
const rich=(text:string)=>({rich_text:text.match(/[\s\S]{1,1900}/g)?.map(content=>({text:{content}}))||[]});
const text=(p:any)=>(p?.title||p?.rich_text||[]).map((v:any)=>v.plain_text||v.text?.content||'').join('');
export function gradeFromPage(page:any) {
 const p=page.properties;
 return {examYear:p['시험 연도']?.number??null,semester:Number(p['학기']?.select?.name?.[0])||null,examPeriod:p['고사 구분']?.select?.name||null,studentKey:normalizeNotionPageId(p['학생']?.relation?.[0]?.id||''),subject:p['과목']?.select?.name,examType:p['시험 종류']?.select?.name==='모의고사'?'학력평가':p['시험 종류']?.select?.name,title:text(p['시험명']),examDate:p['시험일']?.date?.start?.slice(0,10)||'',deadline:p['제출 기한']?.date?.start?.slice(0,10)||null,score:p['원점수']?.number??null,maxScore:p['만점']?.number??null,grade:text(p['예상 등급']),submissionStatus:p['제출 상태']?.select?.name||'미제출',note:text(p['비고'])};
}
export function canReadNotionGrade(actor:any, profile:any, page:any) {
 if(normalizeNotionPageId(page.parent?.database_id||'') !== GRADE_DATABASE || page.archived || page.in_trash || page.properties?.['학생']?.relation?.length !== 1) return false;
 const value=gradeFromPage(page);
 if(actor.admin) return true;
 if(actor.principal) return actor.scopes.some((s:any)=>s.studentKey===value.studentKey);
 return Boolean(profile?.notionTeacherPageId && page.properties['담당 선생님']?.relation?.some((r:any)=>normalizeNotionPageId(r.id)===normalizeNotionPageId(profile.notionTeacherPageId)));
}
export async function listTeacherNotionGrades(db:Firestore,actor:any) {
 const profile=(await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()).data();
 const profiles=(actor.admin||actor.principal)?(await (actor.admin?db.collection('teacherWorkspaceAccess'):db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId)).get()).docs.map(d=>({uid:d.id,...d.data()})): [{uid:actor.uid,...profile}];
 if(!actor.admin && !actor.principal && !profile?.notionTeacherPageId) return [];
 const filter=!actor.admin && !actor.principal ? {property:'담당 선생님',relation:{contains:profile!.notionTeacherPageId}} : undefined;
 const records:any[]=[];let cursor:string|undefined;
 do {const result=await gradeNotion(`databases/${GRADE_DATABASE}/query`,'POST',{page_size:100,...(filter?{filter}:{}),...(cursor?{start_cursor:cursor}:{}),sorts:[{property:'시험일',direction:'descending'}]});
  for(const page of result.results) if(canReadNotionGrade(actor,profile,page)){const saved=(await db.collection('academicRecords').doc(normalizeNotionPageId(page.id)).get()).data();if(saved?.sourceUpdatedAt!==page.last_edited_time)await syncAcademicPage(db,page);const teachers=(page.properties['담당 선생님']?.relation||[]).map((r:any)=>normalizeNotionPageId(r.id));const owners=profiles.filter((p:any)=>p.notionTeacherPageId&&teachers.includes(normalizeNotionPageId(p.notionTeacherPageId))).map((p:any)=>p.uid);records.push({ownerUid:owners.length===1?owners[0]:null,teacherUids:owners,id:page.id,notionPageId:page.id,notionEditedAt:page.last_edited_time,data:gradeFromPage(page),stage:'published',source:'notion',readOnly:actor.principal});}
  cursor=result.has_more ? result.next_cursor : undefined;
 }while(cursor);
 return records;
}
export async function publishTeacherGrade(db:Firestore,id:string,record:any, deps = {syncAcademicPage}) {
 const d=academicDraftSchema.parse(record.data);
 const profile=(await db.collection('teacherWorkspaceAccess').doc(record.ownerUid).get()).data();
 const teacherPage=profile?.notionTeacherPageId || (record.ownerUid===process.env.ADMIN_UID?'3ec0d0f1-c79a-8108-b714-c1d6fc390ba2':null);
 if(!teacherPage) throw new Error('TEACHER_NOTION_LINK_REQUIRED');
 const schema=await gradeNotion(`databases/${GRADE_DATABASE}`);
 if(!schema.properties['앱 기록 ID']) throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
 const extra:any={}; for(const [name,type] of [['시험 연도','number'],['학기','select'],['고사 구분','select']])if(!schema.properties[name])extra[name]={[type]:{}};if(Object.keys(extra).length)await gradeNotion(`databases/${GRADE_DATABASE}`,'PATCH',{properties:extra});
 let pageId=record.notionPageId;
 if(!pageId){const matches=await gradeNotion(`databases/${GRADE_DATABASE}/query`,'POST',{filter:{property:'앱 기록 ID',rich_text:{equals:id}},page_size:2});if(matches.results.length>1)throw new Error('DUPLICATE_NOTION_RECORD');pageId=matches.results[0]?.id;}
 const properties:any={'시험명':{title:[{text:{content:d.title}}]},'학생':{relation:[{id:d.studentKey}]},'담당 선생님':{relation:[{id:teacherPage}]},'과목':{select:{name:d.subject}},'시험 종류':{select:{name:d.examType}},'시험일':{date:{start:d.examDate}},'제출 기한':{date:d.deadline?{start:d.deadline}:null},'원점수':{number:d.score},'만점':{number:d.maxScore},'예상 등급':rich(d.grade),'제출 상태':{select:{name:d.submissionStatus}},'비고':rich(d.note),'앱 기록 ID':rich(id)};
 Object.assign(properties,{'시험 연도':{number:d.examYear??null},'학기':{select:d.semester?{name:`${d.semester}학기`}:null},'고사 구분':{select:d.examPeriod?{name:d.examPeriod}:null}});
 const page=pageId ? await gradeNotion(`pages/${pageId}`,'PATCH',{properties}) : await gradeNotion('pages','POST',{parent:{database_id:GRADE_DATABASE},properties});
 await db.collection('teacherAcademicDrafts').doc(id).update({notionPageId:page.id,stage:'notion_saved'});
 // Reuse the existing authoritative Notion->report projection. No client score payload enters reports directly.
 const fresh=await gradeNotion(`pages/${page.id}`);
 if(fresh.archived || fresh.in_trash) throw new Error('NOTION_SOURCE_REMOVED');
 await deps.syncAcademicPage(db,fresh);
 await gradeNotion(`pages/${page.id}`,'PATCH',{properties:{'앱 반영 결과':rich('앱 반영 완료')}});
 await db.collection('teacherAcademicDrafts').doc(id).update({stage:'published',lastSubmittedRevision:record.revision,updatedAt:Date.now()});
 return page.id;
}
