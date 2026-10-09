import AcademicMigrationPanel from './AcademicMigrationPanel';
import {saveAcademicBatchRow} from '../../lib/academicBatch';
import StudentCombobox from './StudentCombobox';
import AcademicBatchEditor from './AcademicBatchEditor';
import LessonConflictReview from './LessonConflictReview';
import StatusBadge from './StatusBadge';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import {useTeacherPage} from '../../lib/useTeacherPage';
import WorkspaceDialog from './WorkspaceDialog';
import ExamFields from './AcademicExamFields';
import {examPeriod,examDetail,examLabel,detailMetadata,suggestedExamTitle,withSuggestedTitle,schoolTagFrom,schoolTagOf} from '../../lib/academicExamPeriod';
import {Fragment,useEffect,useRef,useState} from 'react';
import {Plus,Users,RefreshCw,TrendingUp,TrendingDown,Minus,AlertCircle,ChevronDown} from 'lucide-react';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const blank=()=>({examDetail:'1학기 중간고사',examYear:new Date().getFullYear(),semester:1,examPeriod:'중간고사',studentKey:'',subject:'영어',examType:'학교 내신',title:'',examDate:today(),deadline:null as string|null,score:null as number|null,maxScore:100 as number|null,grade:'',submissionStatus:'제출 완료',note:''});
const SUBJECTS=['영어','수학','국어','과학','한국사'];
const stageText=(stage:string)=>({draft:'저장됨',published:'반영 완료',failed:'반영 실패',notion_saved:'Notion 저장됨',publishing:'반영 중'} as any)[stage]||'반영 중';
const stageKind=(stage:string)=>stage==='published'?'done':stage==='failed'?'failed':'saved';
const pct=(d:any)=>d&&d.score!=null&&d.maxScore?d.score/d.maxScore*100:null;
export default function TeacherAcademicManager({data,busy,request,act}:{data:any;busy:boolean;request:(action?:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}) {
 const editId=useRef<string>('');
 const [value,setValue]=useState<any>(()=>({...blank(),subject:data.scopes?.[0]?.subject||'영어'})),[selected,setSelected]=useState<any>(null),[saved,setSaved]=useState<any>(null);
 const [teacher,setTeacher]=useState(''),[kind,setKind]=useState('학교 내신'),[subject,setSubject]=useState(''),[page,setPage]=useState(1);
 const [batchOpen,setBatchOpen]=useState(false),[view,setView]=useState<'exam'|'student'>('exam'),[submission,setSubmission]=useState('');
 const [dialog,setDialog]=useState(false),[search,setSearch]=useState(''),[period,setPeriod]=useState(''),[more,setMore]=useState(false),[schoolTag,setSchoolTag]=useState('');
 const editable=canEdit(selected);
 function canEdit(r:any){return !r||(!r.readOnly&&(data.admin||r.ownerUid===data.uid||r.source==='notion'));}
 const {result,loading,error,load}=useTeacherPage(data.uid,'academic-records',{page,teacher,student:'',kind,subject,period,search,submission},request);
 const records:any[]=result.records,loaded=!loading,stats=result.stats;
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
 const groups=new Map<string,{title:string;sub:string;rows:any[]}>();
 for(const r of records){const k=view==='exam'?[r.data.title,r.data.subject,r.data.examDate].join('|'):r.data.studentKey;if(!groups.has(k))groups.set(k,view==='exam'?{title:`${r.data.title} · ${r.data.subject}`,sub:r.data.examDate?`시험일 ${r.data.examDate}`:'시험일 미등록',rows:[]}:{title:nameOf(r.data.studentKey),sub:'',rows:[]});groups.get(k)!.rows.push(r);}
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
 </fieldset><LessonConflictReview kind="academic" record={selected} request={request} act={act} busy={busy} refresh={()=>load(true)}/>{!selected?.deleteRequested && canRetryPublication(selected) && editable && <div><p className="gs-note">저장한 성적 입력으로 반영 결과를 확인합니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{const result=await request('publish-academic',{id:selected.id});if(result.record){setSelected(result.record);setSaved(result.record.data);setValue(result.record.data);}}finally{const records=await load(true);const current=records.find((r:any)=>r.id===selected.id);if(current)setSelected(current);}})}>저장 결과 확인·재시도</button></div>}</section></WorkspaceDialog>
 <section className="panel rv">
  <div className="rv-head"><h2>성적 관리<small>{result.total}건</small></h2><div className="rv-actions">{canWrite&&<><button className="small-button" disabled={busy} onClick={()=>setBatchOpen(true)}><Users size={16} aria-hidden="true"/>여러 학생 입력</button><button className="primary-button" disabled={busy} onClick={openNew}><Plus size={16} aria-hidden="true"/>성적 입력</button></>}<button type="button" className="rv-icon" aria-label="새로고침" title="새로고침" disabled={busy} onClick={()=>act(()=>load(true))}><RefreshCw size={16}/></button></div></div>
  <div className="rv-head"><div className="rv-seg" role="group" aria-label="시험 종류">{['학교 내신','학력평가'].map(k=><button key={k} type="button" aria-pressed={kind===k} onClick={()=>{setKind(k);setPage(1);setPeriod('');}}>{k==='학교 내신'?'내신':k}</button>)}</div><div className="rv-seg" role="group" aria-label="보기">{([['exam','시험별'],['student','학생별']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={view===k} onClick={()=>setView(k)}>{l}</button>)}</div></div>
  <div className="rv-filters">{kind==='학교 내신'&&<select aria-label="학기·고사" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="">전체 학기·고사</option>{(result.periods||[]).sort((a:any,b:any)=>b.key.localeCompare(a.key)).map((p:any)=><option key={p.key} value={p.key}>{p.label}</option>)}</select>}<select aria-label="과목 필터" value={subject} onChange={e=>{setSubject(e.target.value);setPage(1);}}><option value="">전체 과목</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>{(data.admin||data.principal)&&<select aria-label="성적 선생님 필터" value={teacher} onChange={e=>{setTeacher(e.target.value);setPage(1);}}><option value="">전체 선생님</option>{(result.teachers||[]).map((uid:string)=><option key={uid} value={uid}>{data.staff?.find((s:any)=>s.uid===uid)?.name || (uid===data.uid?'나':'연결되지 않은 작성자')}</option>)}</select>}<input type="search" aria-label="성적 검색" placeholder="학생·시험명 검색" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
  {stats&&<div className="rv-stats"><div className="rv-stat"><b>{stats.average??'—'}</b><span>평균 (100점 기준)</span></div><div className="rv-stat"><b>{stats.submitted}/{stats.count}</b><span>제출 완료</span></div><button type="button" className="rv-stat warn" aria-pressed={submission==='미제출'} onClick={()=>{setSubmission(submission?'':'미제출');setPage(1);}}><b>{stats.missing}</b><span>미제출{submission?' · 보는 중':''}</span></button><div className="rv-stat"><b>{stats.pending}</b><span>반영 대기</span></div></div>}
  {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}{!loaded&&!error&&<p role="status" className="text-sm text-slate-500">성적을 불러오는 중…</p>}
  {[...groups.values()].map(g=><div key={g.title+g.sub} className="rv-group"><p className="rv-day">{g.title}{g.sub&&<span>{g.sub}</span>}</p><div className="academic-cards rv-cards">{g.rows.map(r=>{const d=r.data,p=pct(d),prev=pct(r.previous),diff=p!==null&&prev!==null?Math.round(p-prev):null;return <button key={r.id} type="button" className="academic-card rv-card" aria-label={`${nameOf(d.studentKey)} ${d.title} 성적 보기`} onClick={()=>openRecord(r)}>
   <span className="rv-card-top"><strong className="rv-who academic-card-student" title={view==='exam'?nameOf(d.studentKey):d.title}>{view==='exam'?nameOf(d.studentKey):d.title}</strong>{d.grade&&<span className="rv-grade">{/^\d+$/.test(d.grade)?`${d.grade}등급`:d.grade}</span>}</span>
   {view==='student'&&<span className="rv-sub">{examLabel(d)} · {d.subject} · {d.examDate||'시험일 미등록'}</span>}
   {d.submissionStatus==='제출 완료'&&d.score!=null?<><span className="rv-score"><b>{d.score}</b><span>/ {d.maxScore??'—'}</span>{diff!==null&&<span className={'rv-trend '+(diff>0?'up':diff<0?'down':'same')} title={`지난 시험: ${r.previous.title}`}>{diff>0?<TrendingUp size={14}/>:diff<0?<TrendingDown size={14}/>:<Minus size={14}/>}{diff>0?'+':''}{diff}점 지난 시험 대비</span>}</span>{p!==null&&<span className="rv-bar" aria-hidden="true"><span style={{width:Math.min(100,Math.max(0,p))+'%'}}/></span>}</>
    :d.submissionStatus==='미제출'?<span className="rv-missing"><AlertCircle size={16} aria-hidden="true"/>미제출{d.deadline?` · 기한 ${d.deadline.slice(5).replace('-','/')}`:''}</span>:<span className="rv-muted">{d.submissionStatus}</span>}
   <StatusBadge kind={stageKind(r.stage) as any} text={stageText(r.stage)}/>
  </button>;})}</div></div>)}
  {loaded&&!records.length&&<p className="rv-empty">{submission?'미제출 성적이 없습니다.':'해당하는 성적이 없습니다.'}</p>}
  {pages>1&&<div className="review-pagination"><button disabled={loading||current===1} onClick={()=>setPage(current-1)}>이전</button><span>{current} / {pages}</span><button disabled={loading||current===pages} onClick={()=>setPage(current+1)}>다음</button></div>}
  {data.admin&&data.academyId==='main'&&<details className="rv-admin"><summary>관리자 도구 · 과거 Notion 성적 이전과 성적 앱 전환</summary><p className="text-xs text-slate-500 my-2">앱에 저장된 성적을 표시합니다. 아직 Notion에만 있는 과거 자료는 별도 이전 후 표시됩니다.</p><AcademicMigrationPanel request={request} act={act} onImported={()=>load(true)}/></details>}
 </section>
 </div>;
}
