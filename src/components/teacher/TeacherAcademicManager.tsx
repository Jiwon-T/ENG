import {saveAcademicBatchRow} from '../../lib/academicBatch';
import StudentCombobox from './StudentCombobox';
import AcademicBatchEditor from './AcademicBatchEditor';
import StatusBadge from './StatusBadge';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import {useTeacherPage} from '../../lib/useTeacherPage';
import WorkspaceDialog from './WorkspaceDialog';
import ExamFields from './AcademicExamFields';
import {isCurrentStudent} from '../../lib/teacherLessonGrid';
import {examPeriod,examDetail,examLabel,detailMetadata,suggestedExamTitle,withSuggestedTitle,schoolTagFrom,schoolTagOf} from '../../lib/academicExamPeriod';
import {Fragment,useEffect,useRef,useState} from 'react';
import {Plus,Users,RefreshCw,ChevronDown} from 'lucide-react';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const blank=()=>({examDetail:'1학기 중간고사',examYear:new Date().getFullYear(),semester:1,examPeriod:'중간고사',studentKey:'',subject:'영어',examType:'학교 내신',title:'',examDate:today(),deadline:null as string|null,score:null as number|null,maxScore:100 as number|null,grade:'',submissionStatus:'제출 완료',note:''});
const SUBJECTS=['영어','수학','국어','과학','한국사'];
const stageText=(stage:string)=>({draft:'저장됨',published:'반영 완료',failed:'반영 실패',notion_saved:'저장됨',publishing:'반영 중'} as any)[stage]||'반영 중';
const stageKind=(stage:string)=>stage==='published'?'done':stage==='failed'?'failed':'saved';
const pct=(d:any)=>d&&d.score!=null&&d.maxScore?d.score/d.maxScore*100:null;
export default function TeacherAcademicManager({data,busy,request,act}:{data:any;busy:boolean;request:(action?:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}) {
 const editId=useRef<string>('');
 const [value,setValue]=useState<any>(()=>({...blank(),subject:data.scopes?.[0]?.subject||'영어'})),[selected,setSelected]=useState<any>(null),[saved,setSaved]=useState<any>(null);
 const [teacher,setTeacher]=useState(''),[kind,setKind]=useState('학교 내신'),[subject,setSubject]=useState(''),[page,setPage]=useState(1);
 const [batchOpen,setBatchOpen]=useState(false),[view,setView]=useState<'exam'|'table'|'student'>('exam'),[submission,setSubmission]=useState('');
 const [dialog,setDialog]=useState(false),[search,setSearch]=useState(''),[period,setPeriod]=useState(''),[more,setMore]=useState(false),[schoolTag,setSchoolTag]=useState('');
 const editable=canEdit(selected);
 function canEdit(r:any){return !r||(!r.readOnly&&(data.admin||r.ownerUid===data.uid||r.source==='notion'));}
 const {result,loading,error,load}=useTeacherPage(data.uid,'academic-records',{page,teacher,student:'',kind,subject,period,search,submission},request);
 const [currentOnly,setCurrentOnly]=useState(false);
 // 재원생만: same rule as the student list (enrolled now); summary numbers are recounted for the filtered rows.
 const currentKeys=new Set((data.students||[]).filter((s:any)=>isCurrentStudent(s)).map((s:any)=>s.studentKey));
 const records:any[]=currentOnly?result.records.filter((r:any)=>currentKeys.has(r.data.studentKey)):result.records,loaded=!loading;

 useEffect(()=>{if(selected?.source==='notion')return;const current=result.records.find((r:any)=>r.id===selected?.id);if(current)setSelected(current);},[result.records]);
 function field(key:string,v:any){setValue((old:any)=>{const next=key==='examDetail'?({...old,examDetail:v,...detailMetadata(v)}):key==='examType'?({...old,examType:v,examDetail:'',semester:null,examPeriod:null}):({...old,[key]:v});return ['examDetail','examType','examYear'].includes(key)?withSuggestedTitle(old,next,schoolTag):next;});}
 function changeTag(tag:string){setValue((old:any)=>withSuggestedTitle(old,old,schoolTag,tag));setSchoolTag(tag);}
 // The school tag comes from the school and grade entered in student management (e.g. 세교중학교 · 중2 → 세교중2).
 async function chooseStudent(key:string){field('studentKey',key);if(!key||selected?.revision)return;try{const r=await request('read:student-school',{studentKey:key});const tag=schoolTagFrom(r.school,r.grade);if(tag){setValue((old:any)=>withSuggestedTitle(old,old,schoolTag,tag));setSchoolTag(tag);}}catch{/* The tag is only a convenience; it can be typed. */}}
 async function persist(reflect:boolean){const id=selected?.id||editId.current||(editId.current=crypto.randomUUID());let record=selected;if(!record?.revision||changed){record=await saveAcademicBatchRow(request,{id,revision:record?.revision,notionEditedAt:record?.notionEditedAt,payload:{...value,title:(value.title.trim()||suggestedExamTitle(value,schoolTag))}});if(!record)throw Error('저장 결과를 확인해야 합니다.');setSelected(record);setSaved(record.data);setValue(record.data);}if(reflect){const result=await request('publish-academic',{id:record.id,revision:record.revision});if(result.record)setSelected(result.record);}await load(true);}
 const pages=result.pages,current=result.page;
 const writableStudents=data.students.filter((s:any)=>data.admin||(data.principal?data.teachingScopes||[]:data.scopes).some((scope:any)=>scope.studentKey===s.studentKey));
 const canWrite=!data.principal||writableStudents.length>0;
 const changed=JSON.stringify(saved)!==JSON.stringify(value);
 const nameOf=(key:string)=>data.students.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생';
 const subjects=SUBJECTS.filter(subject=>data.admin||(data.principal?data.teachingScopes||[]:data.scopes).some((s:any)=>s.subject===subject&&(!value.studentKey||s.studentKey===value.studentKey)));
 function openNew(){editId.current=crypto.randomUUID();setSelected(null);setSaved(null);setMore(false);setSchoolTag('');const next={...blank(),examType:kind,examDetail:kind==='학교 내신'?'1학기 중간고사':'',semester:kind==='학교 내신'?1:null,examPeriod:kind==='학교 내신'?'중간고사':null,subject:data.scopes?.[0]?.subject||'영어'};setValue({...next,title:suggestedExamTitle(next)});setDialog(true);}
 function openRecord(r:any){const p=examPeriod(r.data);const v={...r.data,examDetail:examDetail(r.data),examYear:p?.year??r.data.examYear??(Number(r.data.examDate?.slice(0,4))||null),semester:p?.semester??r.data.semester??null,examPeriod:p?.period??r.data.examPeriod??null};setSelected(r);setSaved(r.source==='notion'?null:v);setValue(v);setSchoolTag(schoolTagOf(v.title));setMore(Boolean(v.note||v.deadline));setDialog(true);}
 // 시험별: one group per exam period across schools (e.g. "26년도 2학기 중간고사"), so a few students per school no longer make a long column.
 const periodOf=(d:any)=>{const p=examPeriod(d);return p?{key:p.key,label:p.label}:{key:(d.examType||'')+'|'+examLabel(d)+'|'+String(d.examDate||'').slice(0,7),label:examLabel(d)+(d.examDate?` · ${Number(d.examDate.slice(5,7))}월`:'')};};
 const examGroups=new Map<string,{label:string;rows:any[]}>();
 for(const r of records){const p=periodOf(r.data);if(!examGroups.has(p.key))examGroups.set(p.key,{label:p.label,rows:[]});examGroups.get(p.key)!.rows.push(r);}
 // Summary counts only the latest exam period (or the one picked in the filter) so the numbers don't pile up over the years.
 const latest=records.length?periodOf(records[0].data):null,scope=latest?records.filter((r:any)=>periodOf(r.data).key===latest.key):[];
 const stats=(()=>{const v=scope.map((r:any)=>r.data).filter((d:any)=>d.submissionStatus==='제출 완료'&&d.score!=null&&d.maxScore>0).map((d:any)=>d.score/d.maxScore*100);return {count:scope.length,average:v.length?Math.round(v.reduce((a:number,b:number)=>a+b,0)/v.length*10)/10:null,submitted:scope.filter((r:any)=>r.data.submissionStatus==='제출 완료').length,missing:scope.filter((r:any)=>r.data.submissionStatus==='미제출').length,pending:scope.filter((r:any)=>r.stage!=='published').length};})();
 const avgOf=(rows:any[])=>{const v=rows.map(r=>pct(r.data)).filter((x:any)=>x!==null) as number[];return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10:null;};
 const studentGroups=new Map<string,any[]>();for(const r of records){const k=r.data.studentKey;if(!studentGroups.has(k))studentGroups.set(k,[]);studentGroups.get(k)!.push(r);}
 const splitName=(full:string)=>{const m=full.match(/^(.*?)\s*\((.*)\)$/);return {name:m?.[1]||full,meta:m?.[2]||''};};
 const gradeText=(g:string)=>/^\d+$/.test(g)?`${g}등급`:g;
 const trendOf=(r:any)=>{const p=pct(r.data),prev=pct(r.previous);return p!==null&&prev!==null?Math.round(p-prev):null;};
 const Trend=({diff,title}:{diff:number|null;title?:string})=>diff===null?null:<span className={'rv-trend '+(diff>0?'up':diff<0?'down':'same')} title={title}>{diff>0?'▲':diff<0?'▼':'–'}{diff!==0?Math.abs(diff):''}</span>;
 const pending=selected?.revision?stageText(selected.stage):'';
 const status=value.submissionStatus,percent=pct(value);
 return <div>{batchOpen&&<AcademicBatchEditor data={data} kind={kind} onClose={()=>setBatchOpen(false)} request={request} act={act} onSaved={()=>load(true)}/>}
 <WorkspaceDialog open={dialog} title={selected?'성적 수정':'성적 입력'} onClose={()=>{if(!busy)setDialog(false);}}><section className="academic-single-editor gs">
 <p className="gs-lead">저장하면 앱에 초안으로 보관되고, 반영하면 학생·학부모 성적에 보입니다.{pending&&<> · 현재 <b>{pending}</b></>}</p>
 <fieldset disabled={busy||!canWrite||!editable}>
 <section className="gs-sec"><h3><span className="gs-num">1</span>학생·과목</h3>
  <StudentCombobox students={writableStudents} value={value.studentKey} disabled={busy||!canWrite||!editable} onChange={key=>{if(!busy&&canWrite&&editable)void chooseStudent(key);}}/>
  <div className="gs-chips" role="group" aria-label="과목">{subjects.map(s=><button key={s} type="button" className="rv-chip" aria-pressed={value.subject===s} onClick={()=>field('subject',s)}>{s}</button>)}</div></section>
 <section className="gs-sec"><h3><span className="gs-num">2</span>시험</h3><Fragment key={selected?.id||editId.current}><ExamFields value={value} onField={field} schoolTag={schoolTag} onSchoolTag={changeTag}/></Fragment></section>
 <section className="gs-sec"><h3><span className="gs-num">3</span>점수</h3>
  <div className="gs-seg" role="group" aria-label="제출 상태">{['제출 완료','미제출','제출 대상 아님'].map(k=><button key={k} type="button" aria-pressed={status===k} onClick={()=>setValue((v:any)=>({...v,submissionStatus:k,score:k==='제출 완료'?v.score:null}))}>{k==='제출 대상 아님'?'대상 아님':k}</button>)}</div>
  {status==='제출 완료'?<div className="gs-score"><input type="number" inputMode="decimal" step="any" min={0} aria-label="원점수" placeholder="점수" value={value.score??''} onChange={e=>field('score',e.target.value===''?null:Number(e.target.value))}/><span>/</span><input className="gs-max" type="number" inputMode="decimal" step="any" min={0.01} aria-label="만점" value={value.maxScore??''} onChange={e=>field('maxScore',e.target.value===''?null:Number(e.target.value))}/>{percent!==null&&<small>{Math.round(percent)}%</small>}</div>
   :status==='미제출'?<label><span className="gs-lbl">제출 기한 <span className="gs-opt">(선택)</span></span><input type="date" value={value.deadline||''} onChange={e=>field('deadline',e.target.value||null)}/></label>
   :<p className="gs-note">점수 없이 시험 기록만 남깁니다.</p>}
  {status==='제출 완료'&&<><span className="gs-lbl">예상 등급 <span className="gs-opt">(선택 · 숫자를 누르거나 직접 입력)</span></span>
   <div className="gs-grades" role="group" aria-label="예상 등급">{['1','2','3','4','5','6','7','8','9'].map(g=><button key={g} type="button" aria-pressed={value.grade===g} onClick={()=>field('grade',value.grade===g?'':g)}>{g}</button>)}</div>
   <input aria-label="예상 등급 직접 입력" value={value.grade} maxLength={50} onChange={e=>field('grade',e.target.value)} placeholder="예: A, B"/></>}
 </section>
 <button type="button" className="gs-link" aria-expanded={more} onClick={()=>setMore(!more)}><ChevronDown size={16} style={{transform:more?'rotate(180deg)':undefined}}/>추가 정보 (비고{status==='제출 완료'?'·제출 기한':''})</button>
 {more&&<>{status==='제출 완료'&&<label><span className="gs-lbl">제출 기한 <span className="gs-opt">(선택)</span></span><input type="date" value={value.deadline||''} onChange={e=>field('deadline',e.target.value||null)}/></label>}<label><span className="gs-lbl">비고 <span className="gs-opt">(선택)</span></span><textarea rows={2} value={value.note} onChange={e=>field('note',e.target.value)}/></label></>}
 <div className="gs-foot"><button type="button" className="gs-quiet" disabled={busy||!editable} onClick={()=>{if(!selected?.revision&&selected?.source==='firestore'){if(window.confirm('이 성적을 학생·학부모 화면에서 숨길까요? 원본과 이력은 앱에 보존합니다.'))void act(async()=>{await request('archive-academic',{id:selected.id,studentKey:value.studentKey,sourceEditedAt:selected.notionEditedAt});setDialog(false);await load(true);});return;}if(!selected?.revision){if(window.confirm('저장하지 않은 성적 입력을 지울까요?')){editId.current=crypto.randomUUID();setSaved(null);setSchoolTag('');const next=blank();setValue({...next,title:suggestedExamTitle(next)});}return;}if(window.confirm(`${value.title} 성적을 삭제할까요? 학생·학부모 성적에서 숨기고 앱 기록과 이력은 보존합니다.`))void act(async()=>{try{await request('archive-academic',{id:selected.id,revision:selected.revision});setDialog(false);setSelected(null);setSaved(null);setValue(blank());}finally{await load(true);}});}}>{!selected?.revision&&selected?.source!=='firestore'?'입력 지우기':selected?.deleteRequested?'삭제 결과 확인·재시도':'성적 삭제'}</button>
  {selected?.deleteRequested&&!selected?.deleteAttempted&&<button type="button" className="gs-quiet" onClick={()=>act(async()=>{await request('cancel-academic-delete',{id:selected.id,revision:selected.revision});await load(true);})}>삭제 요청 취소</button>}
  {selected&&<button type="button" className="gs-quiet" onClick={openNew}>새 성적</button>}
  <span className="gs-grow"/><button type="button" className="small-button" onClick={()=>act(()=>persist(false))}>저장</button><button type="button" className="primary-button" disabled={busy||selected?.deleteRequested||selected?.stage==='published'&&!changed} onClick={()=>act(()=>persist(true))}>{selected?.stage==='published'&&!changed?'반영 완료':'학생·학부모에게 반영'}</button></div>
 </fieldset>{!selected?.deleteRequested && canRetryPublication(selected) && editable && <div><p className="gs-note">저장한 성적 입력으로 반영 결과를 확인합니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{const result=await request('publish-academic',{id:selected.id});if(result.record){setSelected(result.record);setSaved(result.record.data);setValue(result.record.data);}}finally{const records=await load(true);const current=records.find((r:any)=>r.id===selected.id);if(current)setSelected(current);}})}>저장 결과 확인·재시도</button></div>}</section></WorkspaceDialog>
 <section className="panel rv">
  <div className="rv-head"><h2>성적 관리<small>{result.total}건</small></h2><div className="rv-actions">{canWrite&&<><button className="small-button" disabled={busy} onClick={()=>setBatchOpen(true)}><Users size={16} aria-hidden="true"/>여러 학생 입력</button><button className="primary-button" disabled={busy} onClick={openNew}><Plus size={16} aria-hidden="true"/>성적 입력</button></>}<button type="button" className="rv-icon" aria-label="새로고침" title="새로고침" disabled={busy} onClick={()=>act(()=>load(true))}><RefreshCw size={16}/></button></div></div>
  <div className="rv-head"><div className="rv-seg" role="group" aria-label="시험 종류">{['학교 내신','학력평가'].map(k=><button key={k} type="button" aria-pressed={kind===k} onClick={()=>{setKind(k);setPage(1);setPeriod('');}}>{k==='학교 내신'?'내신':k}</button>)}</div><button type="button" className="rv-chip" aria-pressed={currentOnly} onClick={()=>setCurrentOnly(v=>!v)}>재원생만{currentOnly?` · ${currentKeys.size}명`:''}</button><span style={{flex:1}}/><div className="rv-seg" role="group" aria-label="보기">{([['exam','시험별'],['table','표'],['student','학생별']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={view===k} onClick={()=>setView(k)}>{l}</button>)}</div></div>
  <div className="rv-filters">{kind==='학교 내신'&&<select aria-label="학기·고사" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="">전체 학기·고사</option>{(result.periods||[]).sort((a:any,b:any)=>b.key.localeCompare(a.key)).map((p:any)=><option key={p.key} value={p.key}>{p.label}</option>)}</select>}<select aria-label="과목 필터" value={subject} onChange={e=>{setSubject(e.target.value);setPage(1);}}><option value="">전체 과목</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>{(data.admin||data.principal)&&<select aria-label="성적 선생님 필터" value={teacher} onChange={e=>{setTeacher(e.target.value);setPage(1);}}><option value="">전체 선생님</option>{(result.teachers||[]).map((uid:string)=><option key={uid} value={uid}>{data.staff?.find((s:any)=>s.uid===uid)?.name || (uid===data.uid?'나':'연결되지 않은 작성자')}</option>)}</select>}<input type="search" aria-label="성적 검색" placeholder="학생·시험명 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
  {latest&&!submission&&<p className="rv-day">이번 시험 기간 · {latest.label}<span>{scope.length}건 기준</span></p>}{stats&&<div className="rv-stats"><div className="rv-stat"><b>{stats.average??'—'}</b><span>평균 (100점 기준)</span></div><div className="rv-stat"><b>{stats.submitted}/{stats.count}</b><span>제출 완료</span></div><button type="button" className="rv-stat warn" aria-pressed={submission==='미제출'} onClick={()=>{setSubmission(submission?'':'미제출');setPage(1);}}><b>{stats.missing}</b><span>미제출{submission?' · 보는 중':''}</span></button><div className="rv-stat"><b>{stats.pending}</b><span>반영 대기</span></div></div>}
  {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}{!loaded&&!error&&<p role="status" className="text-sm text-slate-500">성적을 불러오는 중…</p>}
  {view==='exam'&&[...examGroups.values()].map(g=>{const avg=avgOf(g.rows);return <div key={g.label} className="rv-group"><p className="rv-day">{g.label}<span>{g.rows.length}명{avg!==null?` · 평균 ${avg}`:''}</span></p>
   <div className="academic-cards gr-cards">{g.rows.map(r=>{const d=r.data,{name,meta}=splitName(nameOf(d.studentKey)),diff=trendOf(r),scored=d.submissionStatus==='제출 완료'&&d.score!=null;return <button key={r.id} type="button" className="academic-card gr-card" aria-label={`${nameOf(d.studentKey)} ${d.title} 성적 보기`} onClick={()=>openRecord(r)}>
    <span className="gr-name"><strong>{name}</strong>{r.stage!=='published'&&<i className={'gr-dot '+stageKind(r.stage)} title={stageText(r.stage)} aria-label={stageText(r.stage)}/>}</span>
    <span className="gr-meta">{[meta,d.subject!=='영어'?d.subject:'',d.grade?gradeText(d.grade):''].filter(Boolean).join(' · ')||d.title}</span>
    {scored?<span className="gr-score"><b>{d.score}</b>{d.maxScore!==100&&<small>/{d.maxScore}</small>}<Trend diff={diff} title={r.previous?`지난 시험: ${r.previous.title}`:undefined}/></span>:<span className={d.submissionStatus==='미제출'?'gr-missing':'gr-muted'}>{d.submissionStatus}{d.submissionStatus==='미제출'&&d.deadline?` · ~${d.deadline.slice(5).replace('-','/')}`:''}</span>}
   </button>;})}</div></div>;})}
  {view==='table'&&records.length>0&&<div className="gr-table" role="table" aria-label="성적 표">
   <div className="gr-tr gr-th" role="row"><span role="columnheader">학생</span><span role="columnheader">시험</span><span role="columnheader">점수</span><span role="columnheader">등급</span><span role="columnheader">변화</span><span role="columnheader">상태</span></div>
   {records.map(r=>{const d=r.data,p=pct(d),diff=trendOf(r),scored=d.submissionStatus==='제출 완료'&&d.score!=null;return <button key={r.id} type="button" role="row" className="gr-tr" onClick={()=>openRecord(r)} aria-label={`${nameOf(d.studentKey)} ${d.title} 성적 보기`}>
    <span role="cell" className="gr-strong">{nameOf(d.studentKey)}</span><span role="cell" className="gr-sub">{d.title}{d.subject!=='영어'?` · ${d.subject}`:''}</span>
    <span role="cell" className="gr-bar-cell">{scored?<><b>{d.score}{d.maxScore!==100?<small>/{d.maxScore}</small>:null}</b><span className="rv-bar" aria-hidden="true"><span style={{width:Math.min(100,Math.max(0,p||0))+'%'}}/></span></>:<span className={d.submissionStatus==='미제출'?'gr-missing':'gr-muted'}>{d.submissionStatus}</span>}</span>
    <span role="cell">{d.grade?gradeText(d.grade):'—'}</span><span role="cell"><Trend diff={diff}/></span><span role="cell"><StatusBadge kind={stageKind(r.stage) as any} text={stageText(r.stage)} compact/></span>
   </button>;})}</div>}
  {view==='student'&&records.length>0&&<div className="gr-students">{[...studentGroups.entries()].map(([key,rows])=>{const sorted=[...rows].sort((x,y)=>String(x.data.examDate).localeCompare(String(y.data.examDate))),points=sorted.map(r=>pct(r.data)).filter((x:any)=>x!==null) as number[],last=sorted[sorted.length-1],{name,meta}=splitName(nameOf(key)),diff=points.length>1?Math.round(points[points.length-1]-points[points.length-2]):trendOf(last);
   // Scaled to this student's own range (at least 10 points tall) so small changes are visible.
   const w=120,h=32,lo=Math.min(...points,100),hi=Math.max(...points,0),mid=(lo+hi)/2,span=Math.max(10,hi-lo),top=mid+span/2,xs=points.map((_,i)=>points.length>1?6+i*(w-12)/(points.length-1):w/2),ys=points.map(v=>4+(top-v)/span*(h-8));
   return <div key={key} className="gr-student"><span className="gr-name"><strong>{name}</strong><small>{meta}{meta?' · ':''}시험 {rows.length}번</small></span>
    {points.length>0?<svg className="gr-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`점수 흐름 ${points.map(v=>Math.round(v)).join(', ')}`}><polyline points={xs.map((x,i)=>`${x},${ys[i]}`).join(' ')} fill="none" stroke="var(--workspace-brand-dot)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3.5" fill="var(--workspace-brand-fg)"/></svg>:<span className="gr-muted">점수 없음</span>}
    <span className="gr-score">{last.data.submissionStatus==='제출 완료'&&last.data.score!=null?<b>{last.data.score}</b>:<span className="gr-muted">{last.data.submissionStatus}</span>}<Trend diff={diff}/></span>
    <span className="gr-chips">{[...sorted].reverse().map(r=><button key={r.id} type="button" className="rv-chip" onClick={()=>openRecord(r)} title={r.data.title}>{r.data.title.replace(/^.*?-(?=[12])/,'')} {r.data.score??r.data.submissionStatus}</button>)}</span>
   </div>;})}</div>}
  {loaded&&!records.length&&<p className="rv-empty">{submission?'미제출 성적이 없습니다.':'해당하는 성적이 없습니다.'}</p>}
  {pages>1&&<div className="review-pagination"><button disabled={loading||current===1} onClick={()=>setPage(current-1)}>이전</button><span>{current} / {pages}</span><button disabled={loading||current===pages} onClick={()=>setPage(current+1)}>다음</button></div>}
 </section>
 </div>;
}
