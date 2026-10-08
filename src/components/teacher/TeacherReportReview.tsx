import {createPortal} from 'react-dom';
import LessonRecordCard from '../reports/LessonRecordCard';
import LessonDetailPane from '../reports/LessonDetailPane';
import StudentCombobox from './StudentCombobox';
import StatusBadge from './StatusBadge';
import {ChevronLeft,ChevronRight,RefreshCw,Eye} from 'lucide-react';
import {teacherCachedRead,teacherCacheRead,teacherReadGeneration} from '../../lib/teacherReadCache';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { isCurrentStudent } from '../../lib/teacherLessonGrid';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest, reportReviewError, isReportReviewResponse } from '../../lib/teacherAuthenticatedRequest';
import AcademicPanel from '../reports/AcademicPanel';
import ReportScheduleRow from './ReportScheduleRow';
import { visibleStudentSchedules, sortParentSchedules } from '../../lib/studentReportLists';
import TeacherOnlineLearning from './TeacherOnlineLearning';
interface Props {
    students: any[];
    initialStudentKey?: string;
    showStudentPicker?: boolean;
    embedded?:boolean;
    headerTarget?:string;
}
const date = (value: string) => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
export default function TeacherReportReview({ students, initialStudentKey, showStudentPicker = true, embedded=false, headerTarget }: Props) {
    const [headerElement,setHeaderElement]=useState<HTMLElement|null>(null);
    useEffect(()=>{setHeaderElement(headerTarget?document.getElementById(headerTarget):null);},[headerTarget]);
    const [studentKey, setStudentKey] = useState(initialStudentKey || ''), [audience, setAudience] = useState<'parent' | 'student'>('student');
    const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [refresh, setRefresh] = useState(0), [page, setPage] = useState(1), [schedulePage, setSchedulePage] = useState(1), [section, setSection] = useState<'schedule'|'lessons'|'grades'|'online'>(()=>{const initial=students.find(s=>s.studentKey===initialStudentKey);return initial&&!initial.linkedFirebaseUid?'lessons':'online';}), [subject, setSubject] = useState('');
    const [onlineCursors,setOnlineCursors]=useState(['']),[onlinePage,setOnlinePage]=useState(0);
    const resetOnline=()=>{setOnlineCursors(old=>old.length===1&&old[0]===''?old:['']);setOnlinePage(0);};
    const [selectedReport,setSelectedReport]=useState('');
    const [loadedScope,setLoadedScope]=useState('');
    const scope=JSON.stringify([studentKey,audience,subject,section]);
    const lastRefresh=useRef(0);
    useEffect(()=>{setPage(1);setSchedulePage(1);resetOnline();},[studentKey]);
    useEffect(() => { if (initialStudentKey) {
        setStudentKey(initialStudentKey);
        setPage(1);
    } }, [initialStudentKey]);
    useEffect(() => {
        let live = true;const force=refresh!==lastRefresh.current;lastRefresh.current=refresh;
        const key=JSON.stringify(['report',studentKey,audience,section,page,subject,onlineCursors[onlinePage]]);
        const uid=auth.currentUser?.uid||'';const cached=section==='online'?null:teacherCachedRead(uid,key),generation=teacherReadGeneration();setData(cached||null);setLoadedScope(cached?scope:'');
        setError('');
        if (!studentKey) {
            setLoading(false);
            return;
        }
        setLoading(true);
        (async () => { const result = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'report-review', studentKey, audience,section,page,subject,cursor:section==='online'?onlineCursors[onlinePage]||undefined:undefined,force:force?'1':undefined }),
        }); if (!result.ok || !result.data?.ok)
            throw new Error(reportReviewError(result));
        if (!isReportReviewResponse(result.data)) throw new Error('리포트 응답 형식이 올바르지 않습니다. 화면을 새로고침해 주세요.'); if (live){setData(result.data);setLoadedScope(scope);if(section!=='online')teacherCacheRead(uid,key,result.data,generation);} })().catch(e => { if (live)
            setError(e.message); }).finally(() => { if (live)
            setLoading(false); });
        return () => { live = false; };
    }, [studentKey,audience,refresh,section,page,subject,onlinePage,onlineCursors]);
    const moveStudent=(direction:number)=>{const current=students.filter(s=>isCurrentStudent(s));const index=current.findIndex(s=>s.studentKey===studentKey);if(current.length)setStudentKey(current[(index+direction+current.length)%current.length].studentKey);};
    const loadAcademic = useCallback(async () => data.academic, [data]);
    const reports = (data?.reports || []).filter((r: any) => !subject || r.subject === subject);
    const selectedLesson=reports.find((r:any)=>r.reportId===selectedReport)||reports[0];
    const schedules = data ? (audience === 'student' ? visibleStudentSchedules(data.schedules, Date.now()) : sortParentSchedules(data.schedules)).filter((r: any) => !subject || r.subject === subject) : [];
    const pages = Math.max(1, data?.reportPages||1), currentPage = data?.reportPage||page;
    const schedulePages = Math.max(1, Math.ceil(schedules.length / 3)), currentSchedule = Math.min(schedulePage, schedulePages);
    const tools=<><StatusBadge kind={!data?'editing':data.studentLinked===false?'saved':'done'} text={!data?'앱 계정 확인 중':data.studentLinked===false?'앱 계정 미연결':'앱 계정 연결'}/><button type="button" className="small-button" disabled={loading||!studentKey} aria-label="리포트 새로고침" onClick={()=>{if(section==='online')resetOnline();setRefresh(n=>n+1);}}><RefreshCw size={16}/></button>{data?.parentUrl&&audience==='parent'&&<a href={data.parentUrl} target="_blank" rel="noopener noreferrer">학부모 공개 화면 열기 ↗</a>}</>;
    return <section className="panel report-review">{headerElement?createPortal(tools,headerElement):<header className="report-header-tools">{!embedded&&<strong>{students.find(s=>s.studentKey===studentKey)?.studentDisplayName}</strong>}{tools}</header>}
 {!embedded&&<div className="report-student-toolbar"><button type="button" className="small-button" aria-label="이전 재원생" onClick={()=>moveStudent(-1)}><ChevronLeft size={16}/></button>{showStudentPicker&&<StudentCombobox students={students} value={studentKey} onChange={setStudentKey} filters={[{label:'재원생',keys:students.filter(s=>isCurrentStudent(s)).map(s=>s.studentKey)},{label:'이외',keys:students.filter(s=>!isCurrentStudent(s)).map(s=>s.studentKey)}]}/>}<button type="button" className="small-button" aria-label="다음 재원생" onClick={()=>moveStudent(1)}><ChevronRight size={16}/></button></div>}
 <div className="report-teacher-tools">
 <div className="flex gap-2 items-center mb-3" role="group" aria-label="리포트 공개 대상">{([['student', '학생'], ['parent', '학부모']] as const).map(([value, label]) => <button key={value} aria-pressed={audience === value} className={audience === value ? 'primary-button' : 'small-button'} onClick={() => {setAudience(value);setSection(section==='online'&&value==='parent'?'lessons':section);setPage(1);setSchedulePage(1);resetOnline();}}>{label}</button>)}</div>
 {error && <p role="alert" className="text-sm text-rose-600 py-3">{error}</p>}{loading && <p role="status" className="text-sm text-slate-500 py-3">리포트를 불러오는 중…</p>}{!studentKey && <p className="text-sm text-slate-500 py-3">학생을 선택하면 온라인 학습과 수업·과제·일정·성적을 확인할 수 있습니다.</p>}
<select aria-label="리포트 과목" className="!w-auto !min-h-[36px] !mt-0" value={subject} onChange={e => { setSubject(e.target.value); setPage(1); setSchedulePage(1);resetOnline(); }}><option value="">전체 과목</option>{(data?.subjectOptions||Array.from(new Set<string>([...(data?.reports||[]), ...(data?.schedules||[]), ...(data?.academic?.subjects||[])].map((r: any) => r.subject || '영어')))).map((s:string) => <option key={s}>{s}</option>)}</select></div><div className="report-preview bg-slate-50 text-slate-800"><div className="report-preview-label"><Eye size={14} aria-hidden="true"/>{audience==='student'?'학생':'학부모'} 화면 미리보기</div>{data&&<>
 <div className="report-section-tabs" role="tablist" aria-label="리포트 내용 탭" onKeyDown={(e:KeyboardEvent<HTMLDivElement>)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=Array.from((e.currentTarget as HTMLDivElement).querySelectorAll('[role="tab"]')) as HTMLButtonElement[];const index=buttons.indexOf(e.target as HTMLButtonElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;e.preventDefault();buttons[next]?.focus();buttons[next]?.click();}}>{audience === 'student' && <button type="button" role="tab" aria-selected={section === 'online'} tabIndex={section==='online'?0:-1} className={section === 'online'?'primary-button':'small-button'} onClick={()=>{setSection('online');resetOnline();}}>온라인 학습 <span className="report-count">{loadedScope===scope&&section==='online'&&!loading?data.online?.sessions?.length??0:'·'}</span></button>}{([['lessons','수업 기록'],['schedule','일정'],['grades','성적 확인']] as const).map(([key,label])=><button key={key} role="tab" aria-selected={section===key} tabIndex={section===key?0:-1} className={section===key?'primary-button':'small-button'} onClick={()=>{setSection(key);setPage(1);setSchedulePage(1);}}>{label} <span className="report-count">{loadedScope===scope&&section===key&&!loading?(key==='lessons'?data.reportTotal??reports.length:key==='schedule'?schedules.length:(data.academic?.records?.length||0)+(data.academic?.academyScores?.length||0)):'·'}</span></button>)}</div>{section==='schedule'&&<><div className="review-section"><h3>일정 <span>{schedules.length}건</span></h3>{schedules.slice((currentSchedule-1)*3,currentSchedule*3).filter((s:any)=>s.status==='예정').map((s:any)=><div className="report-schedule" key={s.scheduleId}><ReportScheduleRow schedule={s} variant="teacher"/></div>)}{schedules.slice((currentSchedule-1)*3,currentSchedule*3).some((s:any)=>s.status!=='예정')&&<details className="report-past"><summary>지난 일정 및 취소 일정</summary>{schedules.slice((currentSchedule-1)*3,currentSchedule*3).filter((s:any)=>s.status!=='예정').map((s:any)=><div className={`report-schedule${s.status==='취소'?' is-cancelled':''}`} key={s.scheduleId}><ReportScheduleRow schedule={s} variant="teacher"/></div>)}</details>}{!schedules.length && <p className="text-xs text-slate-400">표시할 일정이 없습니다.</p>}{schedulePages > 1 && <div className="review-pagination"><button disabled={currentSchedule === 1} onClick={() => setSchedulePage(currentSchedule - 1)}>이전</button><span>{currentSchedule}/{schedulePages}</span><button disabled={currentSchedule === schedulePages} onClick={() => setSchedulePage(currentSchedule + 1)}>다음</button></div>}</div></>}
 {section==='lessons'&&<div className="review-section"><div className="flex justify-between gap-2 mb-2"><h3>수업 기록 <span>{data.reportTotal??reports.length}건</span></h3></div><><div className="report-lessons"><div className="report-lesson-list">{reports.map((r:any,i:number)=>{const value=r.lessonDateStart||r.lessonDate,month=value?.slice(0,7);return <div key={r.reportId}>{(i===0||month!==(reports[i-1].lessonDateStart||reports[i-1].lessonDate)?.slice(0,7))&&<h4>{month}</h4>}<LessonRecordCard date={date(value)} subject={r.subject} attendance={r.attendance||'미확인'} time={audience==='parent'?r.lessonTime:undefined} summary={audience==='parent'?`태도 ${r.attitude||'미확인'} · 단어 ${r.vocabularyScore??'—'}점`:`숙제 ${r.homework||'미확인'} · 단어 ${r.vocabularyScore??'—'}점`} selected={r===selectedLesson} onSelect={()=>setSelectedReport(r.reportId)}/></div>;})}</div>{selectedLesson&&<LessonDetailPane date={new Date(selectedLesson.lessonDateStart||selectedLesson.lessonDate).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'})} subject={selectedLesson.subject} attendance={selectedLesson.attendance||'미확인'}>{audience==='parent'&&<><div className="report-time-box">수업 시간 <strong>{selectedLesson.lessonTime||'—'}</strong></div><div className="report-evaluations">{[['태도',selectedLesson.attitude],['숙제',selectedLesson.homework],['테스트',selectedLesson.test]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value||'미확인'}</strong></div>)}</div></>}<div className="report-evaluations"><div>단어 <strong>{selectedLesson.vocabularyScore??'—'}점</strong></div><div>내신 대비 <strong>{selectedLesson.schoolExamScore??'—'}점</strong></div></div>{audience==='parent'?selectedLesson.feedback&&<div className="report-feedback"><h4>수업 내용 및 피드백</h4><p>{selectedLesson.feedback}</p></div>:selectedLesson.assignmentContent&&<div className="report-feedback"><h4>과제 · {selectedLesson.assignmentCompleted?'완료':'미완료'}</h4><p>{selectedLesson.assignmentContent}</p></div>}</LessonDetailPane>}</div>{!reports.length && <p className="text-xs text-slate-400 py-3">반영된 수업 기록이 없습니다.</p>}{pages > 1 && <div className="review-pagination"><button disabled={loading||currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage}/{pages}</span><button disabled={loading||currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div>}</></div>}{section==='grades'&&<div className="review-section"><h3>성적 확인</h3><AcademicPanel load={loadAcademic} subject={subject} variant="teacher"/></div>}</>}
 {data&&audience==='student'&&section==='online'&&<TeacherOnlineLearning data={data.online} page={onlinePage} loading={loading} onPrevious={()=>setOnlinePage(n=>Math.max(0,n-1))} onNext={()=>{if(!data.online?.nextCursor)return;setOnlineCursors(old=>[...old.slice(0,onlinePage+1),data.online.nextCursor]);setOnlinePage(n=>n+1);}}/>}
 </div></section>;
}
