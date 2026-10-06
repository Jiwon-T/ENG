import {isNotionPageId,normalizeNotionPageId as uuid} from './notionPageId.js';
const key=(value:any)=>isNotionPageId(value)?uuid(value):null;
const text=(property:any)=>(property?.rich_text||[]).map((r:any)=>r.plain_text??r.text?.content??'').join('');
/** Identity-based checks only. Same names/dates are never grounds for merging. */
export function auditTeachingRecords(rows:any,remote:{lessons:any[];grades:any[];schedules:any[]},keys:Set<string>,internal:Map<string,string>,add:any,includeUnlinked=false){
 const kinds=[{name:'수업 일지',code:'LESSON',pages:remote.lessons,relation:'학생',drafts:rows.teacherLessonDrafts,date:'수업 날짜'},
  {name:'성적',code:'ACADEMIC',pages:remote.grades,relation:'학생',drafts:rows.teacherAcademicDrafts,date:'시험일'},
  {name:'일정',code:'SCHEDULE',pages:remote.schedules,relation:'대상 학생',drafts:rows.teacherSchedules,date:'날짜 및 시간'}];
 for(const kind of kinds){
  const markers=new Map<string,any[]>();
  const unlinked=new Map<string,any[]>();
  for(const page of kind.pages){
   const p=page.properties||{},studentIds=(p[kind.relation]?.relation||[]).map((r:any)=>key(r.id)).filter(Boolean),marker=text(p['앱 기록 ID']);
   const draft=kind.drafts.find((r:any)=>r.id===marker||Boolean(key(page.id)&&key(r.notionPageId||r.notionWrite?.pageId)===key(page.id)));
   const expected=draft?(draft.data?.students||[draft.data?.studentKey]).map(key).filter(Boolean):[];
   const visible=[...new Set<string>([...studentIds,...expected].filter(k=>keys.has(k)))];
   if(!visible.length){
    if(includeUnlinked&&!studentIds.length&&!(kind.code==='SCHEDULE'&&p['일정 상태']?.select?.name==='취소')){
     const label=p['구분']?.select?.name||'학생 연결 미확인';unlinked.set(label,[...(unlinked.get(label)||[]),page]);
    }
    continue;
   }
   const extra={workType:kind.name,date:p[kind.date]?.date?.start?.slice(0,10)||null,subject:p['과목']?.select?.name||draft?.data?.subject||null,
    nextAction:`${kind.name} 원본과 학생 연결을 확인하세요. 삭제·병합 전 보존할 원본 ID와 앱 기록을 정하고 승인받으세요.`};
   if(kind.code!=='SCHEDULE'&&studentIds.length!==1)for(const k of visible)add(`${kind.code}_STUDENT_RELATION`,`${kind.name} 원본에 학생이 정확히 한 명 연결되지 않았습니다.`,k,page.id,'error',extra);
   if(draft&&(!expected.every((k:string)=>studentIds.includes(k))||studentIds.some((k:string)=>!expected.includes(k))))for(const k of visible)add(`${kind.code}_DRAFT_STUDENT_MISMATCH`,`${kind.name} 원본과 앱 요청의 학생 연결이 다릅니다.`,k,page.id,'error',extra);
   if((draft?.archived||draft?.deleteRequested)&&!(kind.code==='SCHEDULE'&&p['일정 상태']?.select?.name==='취소'))for(const k of visible)add(`${kind.code}_DELETE_PENDING`,`${kind.name} 삭제·취소 요청의 원본 상태를 확인해야 합니다.`,k,page.id,'warning',extra);
   if(marker)markers.set(marker,[...(markers.get(marker)||[]),{page,visible,extra}]);
  }
  for(const [marker,group] of markers)if(group.length>1)for(const item of group)for(const k of item.visible)add(`NOTION_${kind.code}_MARKER_DUPLICATE`,`같은 앱 기록 ID의 ${kind.name} 원본이 여러 개입니다.`,k,item.page.id,'error',{...item.extra,details:[`앱 기록 ID: ${marker}`,`원본 ID: ${group.map(v=>v.page.id).join(', ')}`]});
  for(const [label,group] of unlinked)add(`${kind.code}_UNLINKED_HISTORY`,`${kind.name} ${group.length}건의 학생 관계가 비어 있습니다. 과거 표기만으로 연결을 추정하지 않습니다.`,null,group[0].id,'warning',{studentName:label,workType:kind.name,details:[`확인 대상: ${group.length}건`,`대표 원본 ID: ${group[0].id}`],nextAction:'과거 기록의 원래 학생과 개인 리포트 연결을 읽기로 확인하세요. 이름만으로 학생을 연결하거나 삭제·병합하지 마세요.'});
 }
 for(const [collection,kind,sourceField] of [['academicRecords','성적','id'],['studentSchedules','일정','notionScheduleId']] as const){
  const groups=new Map<string,any[]>();
  for(const r of rows[collection]){
   const k=internal.get(r.internalStudentId);if(!k||r.removed||r.archived)continue;
   const source=key(r[sourceField]);
   const page=(collection==='academicRecords'?remote.grades:remote.schedules).find(p=>source&&key(p.id)===source);
   const relation=page?.properties?.[collection==='academicRecords'?'학생':'대상 학생'];
   if(page&&r.status!=='취소'&&!(relation?.relation||[]).some((v:any)=>key(v.id)===k))add('REPORT_SOURCE_STUDENT_MISMATCH',`${kind} 앱 기록과 Notion 원본의 학생 연결이 다릅니다.`,k,r.id,'error',{workType:kind,nextAction:'앱 대표 매핑·원본 학생 관계·리포트 연결을 비교하세요. 이름으로 자동 재배정하지 않습니다.'});
   if(r.studentKey&&key(r.studentKey)!==k)add('REPORT_RECORD_STUDENT_MISMATCH',`${kind} 앱 기록의 학생 연결이 대표 매핑과 다릅니다.`,k,r.id,'error',{workType:kind,nextAction:'앱 학생 매핑과 원본 학생 관계를 확인하세요. 기존 리포트 주소와 원본 ID를 보존한 뒤 수정 대상을 승인받으세요.'});
   // Canceled schedules are retained history, not duplicate visible schedules.
   if(!source||r.status==='취소')continue;
   const identity=`${source}\0${r.internalStudentId}`;groups.set(identity,[...(groups.get(identity)||[]),r]);
  }
  for(const group of groups.values())if(group.length>1)add('REPORT_RECORD_DUPLICATE',`같은 원본·학생의 ${kind} 앱 기록이 여러 개입니다.`,internal.get(group[0].internalStudentId),group[0].id,'error',{workType:kind,details:group.map(r=>`앱 기록 ID: ${r.id}`),nextAction:'같은 원본의 중복 표시를 확인하고 보존할 공개 ID를 정하세요. 자동 삭제·병합은 수행하지 않습니다.'});
 }
}

