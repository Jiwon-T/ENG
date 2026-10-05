import {registrationNotion,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {subjects} from './teacherWorkspacePolicy.js';
const safeId=(v:any)=>{try{return uuid(v);}catch{return null;}};
const teachers='3d274aff-32ce-4a33-870d-2689259113a6',enrollments='3ec0d0f1-c79a-80b2-bb52-ea162888fe9a';
async function relations(notion:RegistrationNotion,page:any,name:string):Promise<string[]> {
 const p=page.properties?.[name];if(p?.type&&p.type!=='relation'||!Array.isArray(p?.relation))throw Error('ASSIGNMENT_SCHEMA:'+name+' (relation)');
 if(!p.has_more)return p.relation.map((r:any)=>uuid(r.id));
 let cursor:string|undefined;const out:string[]=[],seen=new Set();
 do {const r=await notion(`pages/${page.id}/properties/${encodeURIComponent(p.id)}`+(cursor?'?start_cursor='+cursor:''));
 if(!Array.isArray(r.results))throw Error('NOTION_RELATION_INCOMPLETE');out.push(...r.results.map((v:any)=>uuid(v.relation.id)));cursor=r.has_more?r.next_cursor:undefined;
 if(r.has_more&&(!cursor||seen.has(cursor)))throw Error('NOTION_RELATION_INCOMPLETE');seen.add(cursor);
 }while(cursor);return out;
}
/** Preflight all records, then modify only this teacher's relations; retry is idempotent. */
export async function syncTeacherAssignments(profile:any,previous:any,notion:RegistrationNotion=registrationNotion,beforeWrite:()=>Promise<void>=async()=>{}) {
 if(profile.academyId&&profile.academyId!=='main')throw Error('NOTION_SOURCE_NOT_CONFIGURED');
 if(!profile.notionTeacherPageId)throw Error('TEACHER_NOTION_LINK_REQUIRED');
 const teacherId=uuid(profile.notionTeacherPageId);
 const [teacher,schema,teacherSchema]=await Promise.all([notion('pages/'+teacherId),notion('databases/'+enrollments),notion('databases/'+teachers)]);
 if(safeId(teacher.parent?.database_id)!==teachers)throw Error('NOTION_SOURCE_MISMATCH');
 if(teacher.archived||teacher.in_trash||['중단','휴직'].includes(teacher.properties?.상태?.select?.name||teacher.properties?.상태?.status?.name))throw Error('TEACHER_NOT_CONFIGURED');
 if(teacherSchema.properties?.['담당 과목']?.type!=='multi_select')throw Error('ASSIGNMENT_SCHEMA:DB_선생님.담당 과목 (multi_select)');
 for(const s of subjects){const p=schema.properties?.[s+' 담당'];if(p?.type!=='relation'||safeId(p.relation?.database_id)!==teachers)throw Error('ASSIGNMENT_SCHEMA:DB_수강.'+s+' 담당 (DB_선생님 relation)');}
 const options=new Set((teacherSchema.properties['담당 과목'].multi_select?.options||[]).map((o:any)=>o.name));
 if(profile.scopes.some((s:any)=>!options.has(s.subject)))throw Error('ASSIGNMENT_SCHEMA:DB_선생님.담당 과목 선택지');
 const keys=[...new Set<string>([...profile.scopes,...(previous?.scopes||[])].map((s:any)=>s.studentKey))];
 const targets:any[]=[];
 for(const key of keys){const result=await notion('databases/'+enrollments+'/query','POST',{filter:{property:'학생',relation:{contains:key}},page_size:2});
 if(result.has_more||result.results?.length!==1)throw Error('NOTION_ENROLLMENT_REQUIRED');const page=result.results[0];
 const students=await relations(notion,page,'학생');if(page.archived||page.in_trash||safeId(page.parent?.database_id)!==enrollments||students.length!==1||students[0]!==uuid(key))throw Error('NOTION_SOURCE_MISMATCH');
 for(const s of subjects)await relations(notion,page,s+' 담당');targets.push({key,id:page.id});}
 const removed=new Set([teacherId,...(previous?.notionTeacherPageId?[uuid(previous.notionTeacherPageId)]:[])]);
 for(const target of targets){const page=await notion('pages/'+target.id),students=await relations(notion,page,'학생');
 if(page.archived||page.in_trash||safeId(page.parent?.database_id)!==enrollments||students.length!==1||students[0]!==uuid(target.key))throw Error('NOTION_SOURCE_MISMATCH');
 const properties:any={};
 for(const s of subjects){const existing=await relations(notion,page,s+' 담당'),wanted=profile.scopes.some((v:any)=>v.studentKey===target.key&&v.subject===s),next=[...new Set([...existing.filter(id=>!removed.has(id)),...(wanted?[teacherId]:[])])];
 if(JSON.stringify([...existing].sort())!==JSON.stringify([...next].sort()))properties[s+' 담당']={relation:next.map(id=>({id}))};}
 if(Object.keys(properties).length){await beforeWrite();await notion('pages/'+page.id,'PATCH',{properties});}}
 const names=[...new Set(profile.scopes.map((s:any)=>s.subject))].sort(),existing=(teacher.properties?.['담당 과목']?.multi_select||[]).map((o:any)=>o.name).sort();
 if(JSON.stringify(names)!==JSON.stringify(existing)){await beforeWrite();await notion('pages/'+teacherId,'PATCH',{properties:{'담당 과목':{multi_select:names.map(name=>({name}))}}});}
}
