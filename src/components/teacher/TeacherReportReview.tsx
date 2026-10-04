import { useCallback, useEffect, useState } from 'react';
import { isCurrentStudent } from '../../lib/teacherLessonGrid';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest, reportReviewError, isReportReviewResponse } from '../../lib/teacherAuthenticatedRequest';
import AcademicPanel from '../reports/AcademicPanel';
import ReportScheduleRow from './ReportScheduleRow';
import { visibleStudentSchedules, sortParentSchedules } from '../../lib/studentReportLists';
interface Props {
    students: any[];
    initialStudentKey?: string;
    showStudentPicker?: boolean;
}
const date = (value: string) => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
export default function TeacherReportReview({ students, initialStudentKey, showStudentPicker = true }: Props) {
    const [studentGroup, setStudentGroup] = useState<'current' | 'other'>('current'), [search, setSearch] = useState(''), [studentPage, setStudentPage] = useState(1);
    const [studentKey, setStudentKey] = useState(initialStudentKey || ''), [audience, setAudience] = useState<'parent' | 'student'>('parent');
    const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [refresh, setRefresh] = useState(0), [page, setPage] = useState(1), [schedulePage, setSchedulePage] = useState(1), [showScores, setShowScores] = useState(false), [subject, setSubject] = useState('');
    useEffect(() => { if (initialStudentKey) {
        setStudentKey(initialStudentKey);
        setStudentGroup(isCurrentStudent(students.find(s => s.studentKey === initialStudentKey) || {}) ? 'current' : 'other');
        setPage(1);
    } }, [initialStudentKey]);
    useEffect(() => {
        let live = true;
        setData(null);
        setError('');
        setPage(1);
        setSchedulePage(1);
        setShowScores(false);
        setSubject('');
        if (!studentKey) {
            setLoading(false);
            return;
        }
        setLoading(true);
        (async () => { const result = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'report-review', studentKey, audience }),
        }); if (!result.ok || !result.data?.ok)
            throw new Error(reportReviewError(result));
        if (!isReportReviewResponse(result.data)) throw new Error('리포트 응답 형식이 올바르지 않습니다. 화면을 새로고침해 주세요.'); if (live)
            setData(result.data); })().catch(e => { if (live)
            setError(e.message); }).finally(() => { if (live)
            setLoading(false); });
        return () => { live = false; };
    }, [studentKey, audience, refresh]);
    const availableStudents = students.filter(s => isCurrentStudent(s) === (studentGroup === 'current') && s.studentDisplayName.toLowerCase().includes(search.trim().toLowerCase()));
    const studentPages = Math.max(1, Math.ceil(availableStudents.length / 10)), currentStudentPage = Math.min(studentPage, studentPages);
    const loadAcademic = useCallback(async () => data.academic, [data]);
    const reports = (data?.reports || []).filter((r: any) => !subject || r.subject === subject);
    const schedules = data ? (audience === 'student' ? visibleStudentSchedules(data.schedules, Date.now()) : sortParentSchedules(data.schedules)).filter((r: any) => !subject || r.subject === subject) : [];
    const pages = Math.max(1, Math.ceil(reports.length / 10)), currentPage = Math.min(page, pages);
    const schedulePages = Math.max(1, Math.ceil(schedules.length / 3)), currentSchedule = Math.min(schedulePage, schedulePages);
    return <section className="panel report-review"><header className="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 className="!mb-0">학습 리포트 확인</h2><button className="small-button" disabled={loading || !studentKey} onClick={() => setRefresh(n => n + 1)}>새로고침</button></header>
 {showStudentPicker && <div className="review-section mb-3"><div className="flex flex-wrap gap-2 items-center mb-2" role="group" aria-label="학생 수강 상태">{([['current', '재원생'], ['other', '이외']] as const).map(([value, label]) => <button key={value} aria-pressed={studentGroup === value} className={studentGroup === value ? 'primary-button' : 'small-button'} onClick={() => { setStudentGroup(value); setStudentPage(1); setStudentKey(''); }}>{label} · {students.filter(s => isCurrentStudent(s) === (value === 'current')).length}</button>)}<input className="!w-auto flex-1 !mt-0" aria-label="리포트 학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => { setSearch(e.target.value); setStudentPage(1); }}/></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-1">{availableStudents.slice((currentStudentPage - 1) * 10, currentStudentPage * 10).map(s => <button key={s.studentKey} aria-pressed={studentKey === s.studentKey} className={studentKey === s.studentKey ? 'primary-button' : 'small-button'} onClick={() => setStudentKey(s.studentKey)}>{s.studentDisplayName}</button>)}</div>{!availableStudents.length && <p className="text-xs text-slate-400 py-2">해당하는 학생이 없습니다.</p>}{studentPages > 1 && <div className="review-pagination"><button disabled={currentStudentPage === 1} onClick={() => setStudentPage(currentStudentPage - 1)}>이전</button><span>{currentStudentPage}/{studentPages}</span><button disabled={currentStudentPage === studentPages} onClick={() => setStudentPage(currentStudentPage + 1)}>다음</button></div>}</div>}
 {!showStudentPicker && <p className="font-bold text-sm mb-3">{students.find(s=>s.studentKey===studentKey)?.studentDisplayName}</p>}
 <div className="flex gap-2 items-center mb-3" role="group" aria-label="리포트 공개 대상">{([['parent', '학부모'], ['student', '학생']] as const).map(([value, label]) => <button key={value} aria-pressed={audience === value} className={audience === value ? 'primary-button' : 'small-button'} onClick={() => setAudience(value)}>{label}</button>)}</div>
 {error && <p role="alert" className="text-sm text-rose-600 py-3">{error}</p>}{loading && <p role="status" className="text-sm text-slate-500 py-3">리포트를 불러오는 중…</p>}{!studentKey && <p className="text-sm text-slate-500 py-3">학생을 선택하면 반영된 수업·과제·일정·성적을 확인할 수 있습니다.</p>}
 {data && <><div className="flex flex-wrap gap-2 items-center mb-3"><span className="text-xs text-slate-500">{data.linked ? '앱 저장 자료' : '아직 반영된 자료가 없습니다.'}{audience === 'student' && !data.studentLinked ? ' · 학생 앱 계정 미연결' : ''}</span>{data.parentUrl && audience === 'parent' && <a className="text-xs text-pink-600 underline" href={data.parentUrl} target="_blank" rel="noopener noreferrer">학부모 공개 화면 열기 ↗</a>}<select aria-label="리포트 과목" className="!w-auto !min-h-[36px] !mt-0" value={subject} onChange={e => { setSubject(e.target.value); setPage(1); setSchedulePage(1); }}><option value="">전체 과목</option>{Array.from(new Set<string>([...data.reports, ...data.schedules, ...data.academic.subjects].map((r: any) => r.subject || '영어'))).map(s => <option key={s}>{s}</option>)}</select></div>
 <div className="grid lg:grid-cols-[1fr_2fr] gap-3"><aside><div className="review-section"><h3>일정 <span>{schedules.length}건</span></h3>{schedules.slice((currentSchedule - 1) * 3, currentSchedule * 3).map((s: any) => <div key={s.scheduleId}><ReportScheduleRow schedule={s}/></div>)}{!schedules.length && <p className="text-xs text-slate-400">표시할 일정이 없습니다.</p>}{schedulePages > 1 && <div className="review-pagination"><button disabled={currentSchedule === 1} onClick={() => setSchedulePage(currentSchedule - 1)}>이전</button><span>{currentSchedule}/{schedulePages}</span><button disabled={currentSchedule === schedulePages} onClick={() => setSchedulePage(currentSchedule + 1)}>다음</button></div>}</div></aside>
 <div className="review-section"><div className="flex justify-between gap-2 mb-2"><h3>수업 기록 <span>{reports.length}건</span></h3><button className="text-xs text-pink-600" onClick={() => setShowScores(v => !v)}>{showScores ? '수업 보기' : '📈 성적 보기'}</button></div>{showScores ? <AcademicPanel load={loadAcademic} subject={subject}/> : <>{reports.slice((currentPage - 1) * 10, currentPage * 10).map((r: any) => <article key={r.reportId} className="review-row"><div className="flex flex-wrap gap-x-3 gap-y-1"><strong>{date(r.lessonDateStart || r.lessonDate)} · {r.subject}</strong><span>{r.attendance || '미확인'} · 숙제 {r.homework || '미확인'}</span>{r.vocabularyScore !== null && <span>단어 {r.vocabularyScore}점</span>}{r.schoolExamScore !== null && <span>내신 대비 {r.schoolExamScore}점</span>}</div>{audience === 'parent' ? <><p className="text-slate-500">{r.lessonTime} · 태도 {r.attitude || '미확인'} · 테스트 {r.test || '미확인'}</p>{r.feedback && <p className="whitespace-pre-wrap mt-1">{r.feedback}</p>}</> : r.assignmentContent && <p className="whitespace-pre-wrap mt-1">과제: {r.assignmentContent} <span className="text-pink-600">{r.assignmentCompleted ? '완료' : '미완료'}</span></p>}</article>)}{!reports.length && <p className="text-xs text-slate-400 py-3">반영된 수업 기록이 없습니다.</p>}{pages > 1 && <div className="review-pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage}/{pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div>}</>}</div></div></>}
 </section>;
}
