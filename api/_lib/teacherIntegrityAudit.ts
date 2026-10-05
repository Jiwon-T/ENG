import {assignmentError} from '../../src/lib/teacherAssignmentStatus.js';
import {auditPendingDetails} from './teacherAuditDetails.js';
import {assertRegistrationAccess} from './teacherStudentRegistration.js';
import {registrationNotion,REGISTRATION_STUDENT_DATABASE,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {isNotionPageId,normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashStudentKey} from './security.js';
const ENROLLMENTS='3ec0d0f1-c79a-80b2-bb52-ea162888fe9a';
const CLASSES='1a554024-20f2-42c5-8837-983bd1a4f61e';
const LESSONS='ab289f5b-1cf5-4160-809e-10d268c9c385';
const TEACHERS='3d274aff-32ce-4a33-870d-2689259113a6';
const key=(v:any)=>isNotionPageId(v)?uuid(v):null;
const relations=(p:any)=>Array.isArray(p?.relation)?p.relation.map((r:any)=>key(r.id)).filter(Boolean):[];
async function pages(notion:RegistrationNotion,id:string){
 const out:any[]=[];let cursor:string|undefined;const cursors=new Set<string>();
 do{const r=await notion(`databases/${id}/query`,'POST',{page_size:100,...(cursor?{start_cursor:cursor}:{})});
 if(!Array.isArray(r.results))throw Error('NOTION_SOURCE_MISMATCH');
 for(const p of r.results){if(key(p.parent?.database_id)!==id)throw Error('NOTION_SOURCE_MISMATCH');if(!p.archived&&!p.in_trash){if(Object.values(p.properties||{}).some((v:any)=>v?.type==='relation'&&v.has_more))throw Error('NOTION_RELATION_INCOMPLETE');out.push(p);}}
 cursor=r.has_more?r.next_cursor:undefined;if(r.has_more&&(!cursor||cursors.has(cursor)))throw Error('NOTION_SOURCE_MISMATCH');if(cursor)cursors.add(cursor);
 }while(cursor);return out;
}
/** Deliberately uses raw GET/query reads: workspace readers may write mirrors. */
export async function readIntegrityAudit(db:any,actor:any,notion:RegistrationNotion=registrationNotion){
 assertRegistrationAccess(actor);
 if(actor.academyId!=='main'||key(process.env.NOTION_STUDENT_DATABASE_ID)!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
 const collections=['academyStudentMemberships','notionStudentMappings','users','studentEnrollments','reportSlugs','lessonReports','teacherLessonDrafts','teacherStudentRegistrations','teacherStudentEdits','teacherStudentEnrollmentEdits','teacherMessages','teacherWorkspaceAccess'];
 const snapshots=await Promise.all(collections.map(c=>db.collection(c).get()));
 const rows=Object.fromEntries(collections.map((c,i)=>[c,snapshots[i].docs.map((d:any)=>({ ...d.data(),id:d.id}))]));
 const members=rows.academyStudentMemberships.filter((r:any)=>r.academyId===actor.academyId&&!r.disabled);
 const keys=new Set<string>(members.map((r:any)=>key(r.studentKey||r.id)).filter(Boolean));
 // Administrators also inspect legacy students not yet assigned to a membership.
 const remote=await Promise.allSettled([REGISTRATION_STUDENT_DATABASE,ENROLLMENTS,CLASSES,TEACHERS,LESSONS].map(id=>pages(notion,id)));
 const statuses=remote.map((r,i)=>({source:['학생','수강','반','선생님','수업 일지'][i],ok:r.status==='fulfilled'}));
 const [students,enrollments,classes,teachers,lessons]=remote.map(r=>r.status==='fulfilled'?r.value:[]);
 if(actor.admin)for(const p of students){const k=key(p.id);if(k)keys.add(k);}
 const issues:any[]=[];
 const add=(code:string,message:string,k:string|null=null,id:string|null=null,severity:'error'|'warning'='error',extra:any={})=>issues.push({code,message,studentKey:k,recordId:id,severity,...extra});
 const groups=new Map<string,any[]>();
 for(const m of rows.notionStudentMappings){const k=key(m.notionStudentPageId);if(k&&keys.has(k))groups.set(k,[...(groups.get(k)||[]),m]);}
 const internal=new Map<string,string>();const effective=new Map<string,any>();
 for(const [k,ms] of groups){const canonical=ms.find(m=>m.id===hashStudentKey(k));const chosen=canonical||ms[0];effective.set(k,chosen);
 if(new Set(ms.map(m=>m.internalStudentId)).size>1)add('IDENTITY_CONFLICT','같은 노션 학생에 서로 다른 리포트 식별자가 연결돼 있습니다.',k);
 if(!canonical&&new Set(ms.map(m=>m.firebaseUid).filter(Boolean)).size>1)add('OWNER_CONFLICT','학생 계정 연결이 충돌합니다.',k);
 if(chosen.internalStudentId){const old=internal.get(chosen.internalStudentId);if(old&&old!==k)add('SHARED_IDENTITY','서로 다른 학생이 같은 리포트 식별자를 사용합니다.',k);internal.set(chosen.internalStudentId,k);}
 if(chosen.firebaseUid){const u=rows.users.find((u:any)=>u.id===chosen.firebaseUid);if(!u||u.role!=='student'||key(u.notionStudentKey)!==k)add('ACCOUNT_LINK','학생 계정 역할 또는 양방향 연결을 확인해야 합니다.',k);}
 }
 for(const k of keys){const accounts=rows.users.filter((u:any)=>key(u.notionStudentKey)===k);if(accounts.length>1)add('DUPLICATE_ACCOUNT','한 학생에 여러 앱 계정이 연결돼 있습니다.',k);if(accounts.some((u:any)=>effective.get(k)?.firebaseUid!==u.id))add('ACCOUNT_REVERSE_LINK','앱 계정의 학생 연결과 대표 매핑이 일치하지 않습니다.',k);}
 const available=new Set(students.map((p:any)=>key(p.id)));const teacherIds=new Set(teachers.map((p:any)=>key(p.id)));const classIds=new Set(classes.map((p:any)=>key(p.id)));
 for(const k of keys){if(statuses[0].ok&&!available.has(k))add('STUDENT_MISSING','소속 학생의 노션 원본을 찾을 수 없습니다.',k);
 const es=enrollments.filter((p:any)=>relations(p.properties?.['학생']).includes(k));
 if(statuses[1].ok&&es.length!==1)add('ENROLLMENT_COUNT',es.length?'노션 수강 행이 중복되어 있습니다.':'노션 수강 행이 없습니다.',k);
 for(const e of es){if(relations(e.properties?.['학생']).length!==1)add('ENROLLMENT_MULTI_STUDENT','수강 행에 여러 학생이 연결돼 있습니다.',k,e.id);
 for(const subject of ['국어','영어','수학','과학','한국사']){const p=e.properties||{};if(statuses[3].ok&&relations(p[subject+' 담당']).some((t:string)=>!teacherIds.has(t)))add('TEACHER_MISSING','수강 담당 선생님 원본을 찾을 수 없습니다.',k,e.id);const start=p[subject+' 시작일']?.date?.start,end=p[subject+' 중단일']?.date?.start;if(start&&end&&end<start)add('ENROLLMENT_DATES','수강 중단일이 시작일보다 빠릅니다.',k,e.id);}}
 const s=students.find((p:any)=>key(p.id)===k);if(s&&statuses[2].ok&&relations(s.properties?.['소속반']).some((id:string)=>!classIds.has(id)))add('CLASS_MISSING','소속반 원본을 찾을 수 없습니다.',k);
 if(s&&statuses[1].ok&&statuses[2].ok&&statuses[3].ok&&es.length===1)for(const id of relations(s.properties?.['소속반'])){const c=classes.find((p:any)=>key(p.id)===id);if(!c)continue;const subject=c.properties?.['과목']?.select?.name,p=es[0].properties||{},status=p[subject]?.status?.name;if(status==='중단')continue;if(status!=='등록'||!relations(c.properties?.['담당 선생님']).some((t:string)=>relations(p[subject+' 담당']).includes(t))){const name=(page:any)=>(Object.values(page?.properties||{}).find((v:any)=>Array.isArray(v?.title)) as any)?.title?.map((t:any)=>t.plain_text??t.text?.content??'').join('')||'이름 확인 필요';const teacherNames=(ids:string[])=>ids.length?ids.map(t=>name(teachers.find((p:any)=>key(p.id)===t))).join(', '):'미배정';add('CLASS_ASSIGNMENT_MISMATCH',`${name(c)} · ${subject||'과목 미설정'} 수강·담당 연결 불일치`,k,id,'error',{workType:'반 배정',subject:subject||null,details:[`반 상태: ${c.properties?.['상태']?.status?.name||c.properties?.['상태']?.select?.name||'미설정'}`,`학생 수강 상태: ${status||'미설정'} (반 배정에는 등록 필요)`,`반 담당: ${teacherNames(relations(c.properties?.['담당 선생님']))}`,`학생 ${subject||''} 담당: ${teacherNames(relations(p[subject+' 담당']))}`],nextAction:'학생 관리 → 수강·담당·반 변경에서 등록 상태와 담당을 확인하세요. 반 배정이 잘못됐다면 해당 반을 제외하세요.'});}}
 const m=effective.get(k);if(m){const slugs=rows.reportSlugs.filter((r:any)=>r.internalStudentId===m.internalStudentId&&r.active);if(slugs.length>1)add('ACTIVE_REPORT_DUPLICATE','활성 리포트 주소가 여러 개입니다.',k);if(slugs.some((r:any)=>key(r.studentKey)!==k))add('REPORT_STUDENT_MISMATCH','리포트 주소의 학생 식별자가 매핑과 다릅니다.',k);
 const cached=rows.studentEnrollments.filter((r:any)=>r.internalStudentId===m.internalStudentId&&!r.removed);if(cached.length>1)add('ENROLLMENT_MIRROR_DUPLICATE','앱 수강 연결이 여러 개입니다.',k,null,'warning');}
 }
 const markers=new Map<string,any[]>();for(const l of lessons){const student=relations(l.properties?.['학생']);if(student.length!==1||!keys.has(student[0]))continue;const marker=(l.properties?.['앱 기록 ID']?.rich_text||[]).map((r:any)=>r.plain_text??r.text?.content??'').join('');if(marker)markers.set(marker,[...(markers.get(marker)||[]),{id:l.id,key:student[0]}]);}
 for(const [marker,ls] of markers)if(ls.length>1)for(const l of ls)add('NOTION_LESSON_MARKER_DUPLICATE','같은 앱 기록 ID를 가진 노션 일지가 여러 개입니다.',l.key,marker);
 const reportGroups=new Map<string,any[]>();for(const r of rows.lessonReports){const k=internal.get(r.internalStudentId);if(!k||!r.teacherDraftId)continue;const identity=k+'\0'+r.teacherDraftId+'\0'+r.teacherAppRevision;reportGroups.set(identity,[...(reportGroups.get(identity)||[]),r]);}
 for(const reports of reportGroups.values())if(reports.length>1)add('LESSON_REPORT_DUPLICATE','같은 초안·수정 차수의 리포트가 여러 개입니다.',internal.get(reports[0].internalStudentId)!,reports[0].teacherDraftId);
 for(const c of ['teacherLessonDrafts','teacherStudentRegistrations','teacherStudentEdits','teacherStudentEnrollmentEdits','teacherMessages'])for(const r of rows[c]){
 if(r.academyId!==actor.academyId)continue;const k=key(r.studentKey||r.data?.studentKey||r.notionStudentPageId);if(k&&!keys.has(k))continue;
 const state=r.syncStatus||r.stage||r.status;const pending=c==='teacherLessonDrafts'?['failed','report_published_notion_pending','reflection_pending','publishing','processing','notion_saved'].includes(state):c==='teacherMessages'?['prepared','sending','uncertain'].includes(state):!['synced','completed','discarded','draft'].includes(state);
 if(pending&&!r.archived){const detail=auditPendingDetails(c,r);add('PENDING_'+c,detail.message,k,r.id,'warning',{...detail,studentName:c==='teacherStudentRegistrations'?r.data?.name||null:null});}
 }
 for(const r of rows.teacherWorkspaceAccess){if(r.academyId!==actor.academyId||r.disabled)continue;const u=rows.users.find((u:any)=>u.id===r.id);if(r.id!==process.env.ADMIN_UID&&(!u||!['teacher','principal','admin'].includes(u.role)))add('WORKSPACE_ROLE','교직원 설정과 계정 역할이 일치하지 않습니다.',null,r.id);if(['pending','failed'].includes(r.notionAssignmentStage))add('TEACHER_ASSIGNMENT_PENDING','선생님 담당 연결 · '+(r.notionAssignmentStage==='failed'?'노션 반영 실패':'노션 반영 대기'),null,r.id,'warning',{teacherName:u?.alias||u?.name||'선생님',workType:'선생님 담당 범위',details:[assignmentError(r.notionAssignmentError)],nextAction:'관리자 설정 → 선생님 담당 범위 목록에서 해당 선생님을 선택하고 저장한 범위 다시 반영을 누르세요.'});if(statuses[3].ok&&r.notionTeacherPageId&&!teacherIds.has(key(r.notionTeacherPageId)))add('WORKSPACE_TEACHER_MISSING','교직원 노션 선생님 연결을 찾을 수 없습니다.',null,r.id);}
 for(const s of statuses)if(!s.ok)add('SOURCE_UNAVAILABLE',s.source+' 원본을 읽지 못했습니다. 해당 검사는 완료되지 않았습니다.',null,null,'warning');
 let batiReady=false;try{const {batiConfig}=await import('./teacherMessages.js');batiConfig();batiReady=true;}catch{}
 const pageName=(p:any)=>(Object.values(p?.properties||{}).find((v:any)=>Array.isArray(v?.title)) as any)?.title?.map((t:any)=>t.plain_text??t.text?.content??'').join('')||null;
 for(const issue of issues){issue.studentName=issue.studentName||pageName(students.find((p:any)=>key(p.id)===issue.studentKey))||effective.get(issue.studentKey)?.studentDisplayName||null;if(!issue.nextAction)issue.nextAction=issue.code==='SOURCE_UNAVAILABLE'?'다시 점검하세요. 조회 실패가 계속되면 노션 연결 권한과 서버 설정을 확인하세요.':'노션 학생과 관련 연결을 확인하세요. 학생 계정·리포트 연결 문제는 기존 계정·리포트 관리에서 확인하세요.';}
 return {checkedAt:new Date().toISOString(),academyId:actor.academyId,studentCount:keys.size,sources:statuses,complete:statuses.every(s=>s.ok),batiConfigured:batiReady,batiContractVerified:false,issues};
}
