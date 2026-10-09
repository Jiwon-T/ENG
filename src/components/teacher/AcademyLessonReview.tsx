import LessonReviewActions,{canManageLessonReview} from './LessonReviewActions';
import WorkspaceDialog from './WorkspaceDialog';
import {downloadLessonExcel} from '../../lib/lessonExcel';
import LessonConflictReview from './LessonConflictReview';
import {useTeacherPage} from '../../lib/useTeacherPage';
import {useEffect,useRef,useState} from 'react';
import StudentCombobox from './StudentCombobox';
import StatusBadge from './StatusBadge';
import {Download,RefreshCw,ChevronRight,StickyNote} from 'lucide-react';
const kstDay=(offset=0)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+offset*86400000));
const reviewPeriods=[{value:'7',label:'최근 1주'},{value:'31',label:'1개월'},{value:'92',label:'3개월'},{value:'all',label:'전체'}];
const statusFilters=[{value:'',label:'전체',tone:''},{value:'done',label:'반영 완료',tone:''},{value:'saved',label:'저장만 됨',tone:'warn'},{value:'failed',label:'반영 실패',tone:'bad'}] as const;
const reviewStatus=(stage:string)=>stage==='published'||stage==='report_published_notion_pending'?'done':stage==='draft'?'saved':stage==='failed'?'failed':'processing';
const statusText:Record<string,string>={done:'반영 완료',saved:'저장만 됨',failed:'반영 실패',processing:'반영 중'};
const attendanceTone=(v:string)=>/결석/.test(v)?'absent':/지각|조퇴/.test(v)?'late':/출석/.test(v)?'ok':'';
const dayHeading=(day:string)=>{const d=new Date(day+'T00:00:00Z');return Number.isNaN(d.getTime())?day:`${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 (${'일월화수목금토'[d.getUTCDay()]})`;};
export default function AcademyLessonReview({data,request,act,busy,onEdit,refreshVersion=0}:{data:any;request:(action?:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;busy:boolean;onEdit?:(record:any)=>void;refreshVersion?:number}) {
 const [selected,setSelected]=useState<any>(null);
 const [day,setDay]=useState(''),[student,setStudent]=useState(''),[page,setPage]=useState(1),[teacher,setTeacher]=useState(''),[period,setPeriod]=useState('7'),[status,setStatus]=useState(''),[picking,setPicking]=useState(false);
 // Without a chosen date only a recent period is read; '전체' keeps the previous full list.
 const {result,loading,error,load}=useTeacherPage(data.uid,'academy-lessons',{page,teacher,day,student,period,status},request);
 // Export defaults to today (Korea time) unless a date is chosen.
 const today=kstDay(),yesterday=kstDay(-1),exportDay=day||today;
 const otherDay=Boolean(day&&day!==today&&day!==yesterday);
 const rangeLabel=day===today?'오늘':day===yesterday?'어제':day?dayHeading(day):reviewPeriods.find(p=>p.value===period)?.label||'';
 const previousRefresh=useRef(refreshVersion);
 useEffect(()=>{if(previousRefresh.current===refreshVersion)return;previousRefresh.current=refreshVersion;void load(true).catch(()=>{});},[refreshVersion]);
 const visible:any[]=result.records,pages=result.pages,current=result.page,counts=result.statusCounts;
 const nameOf=(key:string)=>data.students.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생';
 const pickDay=(value:string)=>{setDay(value);setPage(1);};
 const pickPeriod=(value:string)=>{setDay('');setPicking(false);setPeriod(value);setPage(1);};
 const groups:[string,any[]][]=[];for(const r of visible){const last=groups.at(-1);if(last&&last[0]===r.data.date)last[1].push(r);else groups.push([r.data.date,[r]]);}
 return <section className="panel rv"><div className="rv-head"><h2>일지 조회<small>{rangeLabel} · {result.total}건</small></h2><div className="rv-actions"><button className="small-button" disabled={busy} aria-label={`엑셀 내보내기 ${exportDay}`} title="엑셀 내보내기" onClick={()=>act(async()=>{const result=await request('read:academy-lessons-export',{day:exportDay,teacher:teacher||data.uid,student,force:'1'});await downloadLessonExcel(result);})}><Download size={16} aria-hidden="true"/>엑셀 · {day&&day!==today?exportDay.slice(5).replace('-','/'):'오늘'}</button><button type="button" className="rv-icon" aria-label="새로고침" title="새로고침" disabled={busy} onClick={()=>act(()=>load(true))}><RefreshCw size={16}/></button></div></div>
 <div className="rv-chips" role="group" aria-label="기간"><button type="button" className="rv-chip" aria-pressed={day===today} onClick={()=>{setPicking(false);pickDay(today);}}>오늘</button><button type="button" className="rv-chip" aria-pressed={day===yesterday} onClick={()=>{setPicking(false);pickDay(yesterday);}}>어제</button>{reviewPeriods.map(p=><button key={p.value} type="button" className="rv-chip" aria-pressed={!day&&!picking&&period===p.value} onClick={()=>pickPeriod(p.value)}>{p.label}</button>)}<button type="button" className="rv-chip" aria-pressed={picking||otherDay} onClick={()=>setPicking(true)}>날짜 선택</button>{(picking||otherDay)&&<input type="date" aria-label="수업 날짜" value={day} onChange={e=>e.target.value?pickDay(e.target.value):pickPeriod(period)}/>}</div>
 <div className="rv-filters">{(data.admin||data.principal)&&<select aria-label="작성자 선생님" value={teacher} onChange={e=>{setTeacher(e.target.value);setPage(1);}}><option value="">전체 선생님</option>{(result.teachers||[]).map(({uid,name}:any)=><option key={uid} value={uid}>{name}</option>)}</select>}<div><StudentCombobox students={data.students} value={student} onChange={key=>{setStudent(key);setPage(1);}}/>{student&&<button type="button" className="rv-clear" onClick={()=>{setStudent('');setPage(1);}}>전체 학생 보기</button>}</div></div>
 <p className="lesson-export-help gs-note">선생님을 선택하지 않으면 본인 일지를 내보내며, 학생 선택 조건도 적용됩니다.</p>
 {counts&&<div className="rv-stats" role="group" aria-label="상태로 거르기">{statusFilters.map(f=><button key={f.value} type="button" className={'rv-stat '+f.tone} aria-pressed={status===f.value} onClick={()=>{setStatus(f.value);setPage(1);}}><b>{f.value?counts[f.value]:counts.all}</b><span>{f.label}</span></button>)}</div>}
 {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
 {loading&&<p role="status" className="text-sm text-slate-500 py-3">일지 기록을 불러오는 중…</p>}
 <div className="rv-list rv">{groups.map(([date,rows])=><div key={date} className="rv-group"><p className="rv-day">{dayHeading(date)}<span>{rows.length}건</span></p>{rows.map(r=>{const d=r.data,state=reviewStatus(r.stage),body=[d.content,d.note&&`피드백: ${d.note}`].filter(Boolean).join('\n'),extra=[d.assignment&&`과제: ${d.assignment}`,d.examScope&&`시험범위: ${d.examScope}`,d.total>0&&`단어 ${d.correct}/${d.total}`,d.examTotal>0&&`내신 대비 ${d.examCorrect}/${d.examTotal}`].filter(Boolean).join(' · ');return <button key={r.id} type="button" className="lesson-review-open" aria-label={`${d.date} ${nameOf(d.studentKey)} 일지 열기`} onClick={()=>setSelected(r)}>
  <div><div className="rv-who">{nameOf(d.studentKey)}<span className="rv-pill">{d.subject}</span>{(data.admin||data.principal)&&<span className="rv-sub">{r.teacherName}</span>}</div><div className="rv-meta">{d.classSession!=='없음'&&d.start?<span className="rv-pill">{d.start}–{d.end}{d.round!=null?` · ${d.round}회`:''}</span>:d.classSession==='없음'&&<span className="rv-pill">수업 없는 날</span>}{d.selfStudy==='있음'&&<span className="rv-pill">자습 {d.selfStudyStart}–{d.selfStudyEnd}</span>}{d.attendance&&<span className={'rv-pill '+attendanceTone(d.attendance)}>{d.attendance}{d.attendanceNote?` · ${d.attendanceNote}`:''}</span>}{d.specialNote&&<span className="rv-pill" title={d.specialNote}><StickyNote size={12} aria-hidden="true"/>특이사항</span>}</div></div>
  <div className="rv-side"><StatusBadge kind={state==='done'?'done':state==='failed'?'failed':state==='saved'?'saved':'editing'} text={statusText[state]}/><ChevronRight size={16} aria-hidden="true"/></div>
  {body&&<p className="rv-body">{body}</p>}{extra&&<p className="rv-hw">{extra}</p>}
 </button>;})}</div>)}</div>
 {!loading&&!visible.length&&!error&&<p className="rv-empty">{status?`${statusText[status]} 일지가 없습니다.`:'이 기간에 작성된 일지가 없습니다.'}{!day&&period!=='all'&&<> <button type="button" className="rv-clear" onClick={()=>pickPeriod('all')}>전체 기간 보기</button></>}</p>}
 {pages>1&&<div className="review-pagination"><button disabled={loading||current===1} onClick={()=>setPage(current-1)}>이전</button><span>{current} / {pages}</span><button disabled={loading||current===pages} onClick={()=>setPage(current+1)}>다음</button></div>}
 <WorkspaceDialog open={Boolean(selected)} title="수업 일지 상세" onClose={()=>setSelected(null)}>{selected&&<>
 <p className="font-bold lesson-review-summary">{selected.data.date} · {data.students.find((s:any)=>s.studentKey===selected.data.studentKey)?.studentDisplayName||'학생'} · {selected.data.subject}</p>
 <p className="text-sm text-slate-500 mt-2">작성자 {selected.teacherName} · {selected.stage==='published'?'반영 완료':selected.stage==='report_published_notion_pending'?'앱 리포트 반영 완료 · Notion 저장 대기':selected.stage==='draft'?'저장됨':selected.stage==='failed'?'반영 실패':'반영 중'}</p>
 <LessonReviewActions allowed={canManageLessonReview(data,selected)} busy={busy} onEdit={onEdit?()=>void act(async()=>{const record=selected.source==='notion'&&!selected.revision?(await request('import-source-record',{id:selected.id,kind:'lesson'})).record:selected;setSelected(null);onEdit(record);}):undefined} onDelete={()=>{if(!window.confirm(`${selected.data.date} ${selected.data.subject} 일지를 삭제할까요?\n선택한 일지와 해당 리포트만 숨기며, 연결된 노션 일지는 휴지통으로 옮깁니다.`))return;const target=selected;void act(async()=>{const record=target.source==='notion'&&!target.revision?(await request('import-source-record',{id:target.id,kind:'lesson'})).record:target;await request('archive-lesson',{id:record.id,revision:record.revision});setSelected(null);await load(true);});}}/>
 <dl className="lesson-review-detail">{[
 ['수업 시간',selected.data.classSession==='없음'?'없는 날':`${selected.data.start}–${selected.data.end} (${selected.data.round??'미입력'}회)`],
 ['자습 시간',selected.data.selfStudy==='있음'?`${selected.data.selfStudyStart}–${selected.data.selfStudyEnd} (${selected.data.selfStudyRound??'미입력'}회)`:selected.data.selfStudy==='없음'?'없는 날':'미확인'],
 ['출결',`${selected.data.attendance||''} ${selected.data.attendanceNote||''}`],['태도',selected.data.attitude],['숙제',selected.data.homework],['테스트',selected.data.test],
 ['수업 내용',selected.data.content],['과제',selected.data.assignment],['시험범위',selected.data.examScope],['특이사항',selected.data.specialNote],['기존 피드백',selected.data.note],['다음 수업 메모',selected.data.nextPlan],
 ['일반 테스트',selected.data.total>0?`${selected.data.correct}/${selected.data.total}`:''],['내신 대비 테스트',selected.data.examTotal>0?`${selected.data.examCorrect}/${selected.data.examTotal}`:'']
 ].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value||'—'}</dd></div>)}</dl>
 <LessonConflictReview key={selected.id+':'+selected.revision} record={selected} request={request} act={act} busy={busy} refresh={async()=>{const result=await load(true);setSelected(result.find((r:any)=>r.id===selected.id)||null);}}/>
 </>}</WorkspaceDialog>
 </section>;
}



