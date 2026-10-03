import LessonAcademyFields from './LessonAcademyFields';
import TeacherWeeklyCalendar from './TeacherWeeklyCalendar';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/firebase';
import { safeFetchJson } from '../../lib/safeFetchJson';
import { BookOpen, CalendarDays, ClipboardList, Users, Settings, ArrowRight, Plus } from 'lucide-react';
const TeacherAcademicManager = lazy(() => import('./TeacherAcademicManager'));
const AcademyLessonReview = lazy(() => import('./AcademyLessonReview'));
const WordbookManager = lazy(() => import('./WordbookManager'));
import './teacherWorkspace.css';
import TeacherReportReview from './TeacherReportReview';
import TeacherLessonGrid from './TeacherLessonGrid';
import TeacherScheduleEditor from './TeacherScheduleEditor';
const subjects = ['영어', '수학', '국어', '과학', '한국사'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const emptyLesson = () => ({ studentKey: '', subject: '영어', date: today(), start: '14:00', end: '15:30', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', correct: null, total: null, round: null, classSession: '있음', selfStudy: '미확인', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, attendanceNote: '', specialNote: '' });
const stageLabel: any = { draft: '저장됨', publishing: '반영 준비 중', notion_saved: 'Notion 저장됨', processing: '반영 중', published: '반영 완료', failed: '반영 실패' };
const errors: any = { UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.', TEACHER_NOTION_LINK_REQUIRED: '관리자 설정에서 Notion 선생님 페이지를 연결해 주세요.', TEACHER_NOT_CONFIGURED: '관리자가 담당 학생과 과목을 연결하면 사용할 수 있습니다.', SOURCE_IDENTITY_LOCKED: '반영된 기록의 학생·과목은 바꿀 수 없습니다. 새 수업으로 작성해 주세요.', INVALID_INPUT: '입력한 날짜, 시간, 점수와 필수 항목을 확인해 주세요.', FORBIDDEN: '이 자료에 접근할 권한이 없습니다.', DRAFT_CONFLICT: '다른 화면에서 수정되었습니다. 새로고침 후 확인해 주세요.', PUBLISH_IN_PROGRESS: '반영 중입니다. 잠시 후 새로고침해 주세요.', NOTION_SCHEMA_SETUP_REQUIRED: '관리자 설정에서 수업 일지 연결을 준비해 주세요.', MAKE_SUBJECT_NOT_CONFIGURED: '이 과목은 아직 반영 연결이 준비되지 않았습니다.', MAKE_TRIGGER_NOT_CONFIGURED: '수업 일지의 반영 연결을 확인해야 합니다.' };
export default function TeacherWorkspace({ onNavigate, onAccounts }: {
    onNavigate?: (view: any) => void;
    onAccounts?: () => void;
}) {
    const [lessonMode, setLessonMode] = useState<'single' | 'grid'>('single'), [reviewStudentKey, setReviewStudentKey] = useState('');
    const [data, setData] = useState<any>(null), [tab, setTab] = useState('lesson'), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const [lesson, setLesson] = useState<any>(emptyLesson), [draftId, setDraftId] = useState<string | null>(null), [revision, setRevision] = useState<number | undefined>();
    const [search, setSearch] = useState(''), [status, setStatus] = useState('등록'), [page, setPage] = useState(1), [subjectFilter, setSubjectFilter] = useState('');
    const [curriculum, setCurriculum] = useState({ title: '', subject: '영어', content: '' }), [curriculumId, setCurriculumId] = useState<string | null>(null);
    const [scheduleSelection, setScheduleSelection] = useState<{
        date: string;
        record?: any;
        nonce: number;
    } | undefined>(), [scheduleDirty, setScheduleDirty] = useState(false);
    const scheduleEditorRef = useRef<HTMLDivElement>(null), regularRef = useRef<HTMLDivElement>(null);
    function openSchedule(date: string, record?: any) { if (busy)
        return; if (scheduleDirty && !window.confirm('저장하지 않은 일정 변경을 취소하고 다른 일정을 열까요?'))
        return; setScheduleSelection(previous => ({ date, record, nonce: (previous?.nonce || 0) + 1 })); setScheduleDirty(false); requestAnimationFrame(() => scheduleEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }
    const [classForm, setClassForm] = useState<any>({ name: '', subject: '영어', students: [], slots: [{ weekday: 1, start: '14:00', end: '15:30' }] }), [classId, setClassId] = useState<string | null>(null);
    const [setCategory, setSetCategory] = useState<'word' | 'grammar' | 'exam'>('word');
    const [notionTeacherPageId, setNotionTeacherPageId] = useState('');
    const [workspaceRole,setWorkspaceRole] = useState('teacher'), [academyId,setAcademyId] = useState('main');
    const [staffUid, setStaffUid] = useState(''), [scopes, setScopes] = useState<any[]>([]);
    async function request(action?: string, body: any = {}) {
        await auth.authStateReady();
        if (!auth.currentUser) throw new Error(errors.UNAUTHORIZED);
        const reading = action?.startsWith('read:');
        const posting = Boolean(action && !reading);
        const endpoint = '/api/teacher/workspace' + (reading ? `?action=${encodeURIComponent(action!.slice(5))}` : '');
        let token = await auth.currentUser.getIdToken();
        let result = await safeFetchJson<any>(endpoint, { headers: { Authorization: `Bearer ${token}`, ...(posting ? { 'Content-Type': 'application/json' } : {}) }, ...(posting ? { method: 'POST', body: JSON.stringify({ action, ...body }) } : {}) });
        if (result.status === 401 && result.data?.error === 'UNAUTHORIZED') {
            token = await auth.currentUser.getIdToken(true);
            result = await safeFetchJson<any>(endpoint, {headers: {Authorization: `Bearer ${token}`, ...(posting ? {'Content-Type': 'application/json'} : {})}, ...(posting ? {method:'POST',body:JSON.stringify({action,...body})} : {})});
        }
        if (!result.ok || !result.data?.ok)
            throw new Error(`${errors[result.data?.error] || result.data?.message || result.userMessage || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`);
        return result.data;
    }
    async function refresh() { setData(await request()); }
    useEffect(() => {
        let live = true;
        request().then(d => {
            if (live)
                setData(d);
        }).catch(e => {
            if (live)
                setMessage(e.message);
        });
        return () => { live = false; };
    }, []);
    async function act(callback: () => Promise<any>) {
        setBusy(true);
        setMessage('');
        try {
            await callback();
        }
        catch (e) {
            setMessage(e instanceof Error ? e.message : '처리 오류');
        }
        finally {
            setBusy(false);
        }
    }
    function setField(key: string, value: any) { setLesson((d: any) => ({ ...d, [key]: value })); }
    function openDraft(d: any) { setLesson(d.data); setDraftId(d.id); setRevision(d.revision); setTab('lesson'); }
    const students = data?.students || [];
    const filtered = students.filter((s: any) => {
        const active = s.subjects?.length ? s.subjects.some((x: any) => (!status || x.status === status) && (!subjectFilter || x.subject === subjectFilter)) : s.enrollmentStatus === status && !subjectFilter;
        return ((!status && !subjectFilter) || active) && `${s.studentDisplayName}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
    const myClasses = data?.classes || [];
    const dateWeekday = new Date(`${lesson.date}T12:00:00+09:00`).getUTCDay();
    const currentDraft = data?.drafts?.find((d: any) => d.id === draftId);
    return <div className="teacher-workspace max-w-6xl mx-auto px-4 py-5 md:p-8">
  <header className="mb-5"><p className="text-xs font-bold text-pastel-pink-500 mb-1">지원T · TEACHER ROOM</p><h1 className="text-2xl font-black text-slate-800">나의 선생님방</h1><p className="text-sm text-slate-500 mt-1">오늘 수업을 기록하고, 다음 수업을 준비해요.</p></header>
  <nav aria-label="선생님방 메뉴" className="flex flex-wrap gap-2 mb-5">
   {[['lesson', '수업 일지 작성', ClipboardList], ['schedule', '시간표·일정', CalendarDays], ['academic', '성적 관리', BookOpen], ...(data?.admin || data?.principal ? [['academy', '학원 수업 기록', ClipboardList]] : []), ['review', '학습 리포트', BookOpen], ['students', '학생 관리', Users], ['curriculum', '커리큘럼', BookOpen], ['word', '학습 세트', BookOpen], ...(data?.admin ? [['settings', '관리자 설정', Settings]] : [])].map(([id, label, Icon]: any) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold ${tab === id ? 'bg-pastel-pink-500 text-white' : 'bg-white border border-pastel-pink-100 text-slate-600'}`}><Icon size={16}/>{label}</button>)}
  </nav>
  {message && <p role="status" className="p-3 mb-4 rounded-xl bg-rose-50 text-sm text-rose-700">{message}</p>}
  {!data ? <div className="panel text-sm text-slate-500">{message ? <><p>위 안내를 확인한 뒤 다시 시도해 주세요.</p><button className="small-button mt-3" disabled={busy} onClick={() => act(refresh)}>다시 불러오기</button>{auth.currentUser?.email === 'lizzieshere1@gmail.com' && <button className="small-button mt-3 ml-2" onClick={onAccounts}>기존 계정·리포트 관리</button>}</> : '선생님방을 불러오는 중…'}</div> : <>
  <div hidden={tab !== 'lesson'}><div className="flex gap-2 mb-3">{([['single', '한 학생 작성'], ['grid', '여러 학생 작성']] as const).map(([value, label]) => <button key={value} aria-pressed={lessonMode === value} className={lessonMode === value ? 'primary-button' : 'small-button'} onClick={() => setLessonMode(value)}>{label}</button>)}</div><div hidden={lessonMode !== 'grid'}><TeacherLessonGrid data={data} busy={busy} request={request} refresh={refresh} act={act}/></div></div>
  {tab === 'review' && <TeacherReportReview students={students} initialStudentKey={reviewStudentKey}/>}
  {tab === 'lesson' && lessonMode === 'single' && <div className="grid lg:grid-cols-[240px_1fr] gap-4">
   <aside className="space-y-3"><section className="panel"><h2>오늘 수업</h2><input aria-label="수업 날짜" type="date" value={lesson.date} onChange={e => setField('date', e.target.value)}/>{myClasses.filter((c: any) => c.ownerUid === data.uid && c.slots.some((s: any) => s.weekday === dateWeekday)).map((c: any) => <div key={c.id} className="mt-3"><p className="font-bold text-sm">{c.name}</p>{c.students.map((key: string) => <button key={key} className="w-full text-left text-sm min-h-[44px]" onClick={() => { const slot = c.slots.find((s: any) => s.weekday === dateWeekday); setLesson({ ...emptyLesson(), date: lesson.date, studentKey: key, subject: c.subject, start: slot.start, end: slot.end }); setDraftId(null); setRevision(undefined); }}>{students.find((s: any) => s.studentKey === key)?.studentDisplayName || '학생'} <ArrowRight size={12} className="inline"/></button>)}</div>)}{!myClasses.length && <p className="text-xs text-slate-500 mt-2">시간표를 등록하면 오늘 수업이 표시됩니다.</p>}</section>
    <section className="panel"><h2>저장한 기록</h2><button onClick={() => { setLesson(emptyLesson()); setDraftId(null); setRevision(undefined); }} className="small-button">+ 새 수업</button>{data.drafts.filter((d: any) => d.ownerUid === data.uid).sort((a: any, b: any) => b.updatedAt - a.updatedAt).slice(0, 20).map((d: any) => <button key={d.id} className="block w-full text-left min-h-[44px] border-b border-pastel-pink-50 py-2 text-xs" onClick={() => openDraft(d)}>{students.find((s: any) => s.studentKey === d.data.studentKey)?.studentDisplayName} · {d.data.date}<span className="block text-pastel-pink-500">{stageLabel[d.stage]}</span></button>)}</section>
   </aside>
   <section className="panel"><h2>수업 일지</h2><div className="grid sm:grid-cols-2 gap-3">
    <label>학생<select value={lesson.studentKey} onChange={e => { setField('studentKey', e.target.value); }}><option value="">학생 선택</option>{students.map((s: any) => <option key={s.studentKey} value={s.studentKey}>{s.studentDisplayName}</option>)}</select></label>
    <label>과목<select value={lesson.subject} onChange={e => setField('subject', e.target.value)}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
    <label>시작<input type="time" disabled={lesson.classSession === '없음'} value={lesson.start} onChange={e => setField('start', e.target.value)}/></label><label>종료<input type="time" disabled={lesson.classSession === '없음'} value={lesson.end} onChange={e => setField('end', e.target.value)}/></label>
   </div>
   <div className="flex flex-wrap gap-2 my-3"><button disabled={busy || !lesson.studentKey} className="small-button" onClick={() => act(async () => { const previous = await request('previous-lesson', { studentKey: lesson.studentKey, subject: lesson.subject }); setLesson((d: any) => ({ ...d, ...previous.data })); })}>지난 수업 이어가기</button><button className="small-button" onClick={() => setLesson((d: any) => ({ ...d, attendance: '출석', attitude: '상', homework: '상' }))}>출석 · 태도 상 · 숙제 상</button></div>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['attendance', '출결', ['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']], ['attitude', '태도', ['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']], ['homework', '숙제', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']], ['test', '테스트', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']]].map(([key, label, options]: any) => <label key={key}>{label}<select value={lesson[key]} onChange={e => setField(key, e.target.value)}>{options.map((x: string) => <option key={x}>{x}</option>)}</select></label>)}</div>
   <div className="grid grid-cols-3 gap-3 mt-3">{[['correct', '정답 수'], ['total', '만점'], ['round', '수업 회차 · 필수']].map(([key, label]) => <label key={key}>{label}<input type="number" step={key === 'round' ? 'any' : 1} disabled={key === 'round' && lesson.classSession === '없음'} required={key === 'round' && lesson.classSession !== '없음'} min={0} value={lesson[key] ?? ''} onChange={e => setField(key, e.target.value === '' ? null : Number(e.target.value))}/></label>)}</div>
   <LessonAcademyFields value={lesson} onChange={setField}/>
   {lesson.total > 0 && lesson.correct !== null && <p className="text-sm text-pastel-pink-600 mt-2">환산 점수 {Math.round(lesson.correct / lesson.total * 10000) / 100} / 100</p>}
   {[['content', '수업 내용'], ['assignment', '과제 · 반영 시 학생 리포트에 표시'], ['note', '개인 피드백'], ['nextPlan', '다음 수업 메모']].map(([key, label]) => <label key={key} className="block mt-3">{label}<textarea rows={key === 'content' ? 4 : 2} value={lesson[key]} onChange={e => setField(key, e.target.value)}/></label>)}
   <div className="flex flex-wrap gap-2 mt-4"><button disabled={busy} className="primary-button" onClick={() => act(async () => { const result = await request('save-draft', { id: draftId, revision, data: lesson }); setDraftId(result.id); const fresh = await request(); setData(fresh); const savedDraft = fresh.drafts.find((d: any) => d.id === result.id); setRevision(savedDraft?.revision); if(savedDraft) setLesson(savedDraft.data); setMessage('초안을 저장했습니다.'); })}>저장</button><button disabled={busy || !draftId || ['publishing', 'processing', 'published'].includes(currentDraft?.stage) || JSON.stringify(currentDraft?.data) !== JSON.stringify(lesson)} className="small-button" onClick={() => act(async () => {
                    if (!window.confirm('저장된 내용을 Notion과 리포트에 반영할까요?'))
                        return;
                    await request('publish', { id: draftId });
                    await refresh();
                    setMessage('반영을 요청했습니다. 완료 여부는 새로고침으로 확인해 주세요.');
                })}>반영</button><button disabled={busy} className="small-button" onClick={() => act(refresh)}>새로고침</button><span className="self-center text-xs text-slate-500">{stageLabel[currentDraft?.stage] || '작성 중'}</span></div>
   </section>
  </div>}
  <div hidden={tab !== 'schedule'}><TeacherWeeklyCalendar data={data} busy={busy} onAdd={date => openSchedule(date)} onEdit={record => openSchedule(record.data.date, record)} onRegular={record => { setClassForm({ name: record.name, subject: record.subject, students: record.students, slots: record.slots }); setClassId(record.id); regularRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}/><div ref={scheduleEditorRef}>{scheduleSelection && <TeacherScheduleEditor data={data} busy={busy} request={request} refresh={refresh} act={act} selection={scheduleSelection} onDirty={setScheduleDirty} onClose={() => { if (!scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) {
            setScheduleSelection(undefined);
            setScheduleDirty(false);
        } }}/>}</div><div ref={regularRef} className="grid md:grid-cols-2 gap-4 mt-4"><section className="panel"><h2>반·정규 시간표</h2><label>반 이름<input value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })}/></label><label className="block mt-3">과목<select value={classForm.subject} onChange={e => setClassForm({ ...classForm, subject: e.target.value, students: [] })}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><div className="my-3 max-h-52 overflow-auto">{students.map((s: any) => <label key={s.studentKey} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" checked={classForm.students.includes(s.studentKey)} onChange={e => setClassForm({ ...classForm, students: e.target.checked ? [...classForm.students, s.studentKey] : classForm.students.filter((k: string) => k !== s.studentKey) })}/>{s.studentDisplayName}</label>)}</div>{classForm.slots.map((slot: any, i: number) => <div key={i} className="grid grid-cols-3 gap-2 mb-2"><select aria-label="요일" value={slot.weekday} onChange={e => setClassForm({ ...classForm, slots: classForm.slots.map((s: any, j: number) => i === j ? { ...s, weekday: Number(e.target.value) } : s) })}>{['일', '월', '화', '수', '목', '금', '토'].map((d, j) => <option key={d} value={j}>{d}</option>)}</select>{['start', 'end'].map(k => <input key={k} aria-label={k === 'start' ? '시작 시간' : '종료 시간'} type="time" value={slot[k]} onChange={e => setClassForm({ ...classForm, slots: classForm.slots.map((s: any, j: number) => i === j ? { ...s, [k]: e.target.value } : s) })}/>)}</div>)}<button className="small-button" onClick={() => setClassForm({ ...classForm, slots: [...classForm.slots, { weekday: 4, start: '14:00', end: '15:30' }] })}>+ 요일 추가</button><button disabled={busy} className="primary-button ml-2" onClick={() => act(async () => { await request('save-class', { id: classId, data: classForm }); await refresh(); setMessage('시간표를 저장했습니다.'); })}>저장</button></section><section className="panel"><h2>내 시간표</h2>{myClasses.map((c: any) => <button className="block w-full text-left min-h-[44px] py-3 border-b border-pastel-pink-100" key={c.id} onClick={() => { setClassForm({ name: c.name, subject: c.subject, students: c.students, slots: c.slots }); setClassId(c.id); }}><span className="font-bold text-sm">{c.name} · {c.subject}</span><span className="block text-xs text-slate-500">{c.slots.map((s: any) => `${['일', '월', '화', '수', '목', '금', '토'][s.weekday]} ${s.start}–${s.end}`).join(' / ')}</span></button>)}<button className="small-button mt-3" onClick={() => { setClassId(null); setClassForm({ name: '', subject: '영어', students: [], slots: [{ weekday: 1, start: '14:00', end: '15:30' }] }); }}>+ 새 반</button></section></div></div>
  {tab === 'academic' && <Suspense fallback={<p className="text-sm text-slate-500">성적 관리 준비 중…</p>}><TeacherAcademicManager data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'academy' && (data.admin || data.principal) && <Suspense fallback={<p className="text-sm text-slate-500">학원 기록 준비 중…</p>}><AcademyLessonReview data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'students' && <section className="panel"><h2>학생 관리 <span className="text-xs font-normal text-slate-400">{filtered.length}명</span></h2><div className="grid sm:grid-cols-3 gap-2 mb-4"><input aria-label="학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/><select aria-label="수강 상태" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">전체 상태</option>{['등록', '대기', '중단'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="과목 필터" value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setPage(1); }}><option value="">전체 과목</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></div><div className="grid md:grid-cols-2 gap-3">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((s: any) => <div key={s.studentKey} className="p-3 rounded-xl border border-pastel-pink-100 bg-pastel-pink-50/30"><p className="font-bold text-sm">{s.studentDisplayName}</p><div className="flex flex-wrap gap-1 mt-2">{s.subjects.map((x: any) => <span key={x.subject} className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-100">{x.subject} · {x.status}</span>)}</div><p className="text-xs text-slate-500 mt-2">{s.linkedFirebaseUid ? '앱 계정 연결됨' : '앱 계정 미연결'} · {s.hasGuardianContact ? '보호자 연락처 등록됨' : '연락처 확인 필요'}</p><button className="small-button mt-2" onClick={() => { setLesson({ ...emptyLesson(), studentKey: s.studentKey }); setDraftId(null); setRevision(undefined); setTab('lesson'); }}>수업 작성</button><button className="small-button mt-2 ml-2" onClick={() => { setReviewStudentKey(s.studentKey); setTab('review'); }}>리포트 확인</button></div>)}</div>{!filtered.length && <p className="text-sm text-slate-500 py-5">해당하는 학생이 없습니다.</p>}<div className="flex justify-center items-center gap-3 mt-4"><button className="small-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span className="text-xs">{currentPage} / {pages}</span><button className="small-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></section>}
  {tab === 'curriculum' && <div className="grid md:grid-cols-2 gap-4"><section className="panel"><h2>커리큘럼 작성</h2><label>제목<input value={curriculum.title} onChange={e => setCurriculum({ ...curriculum, title: e.target.value })}/></label><label className="block mt-3">과목<select value={curriculum.subject} onChange={e => setCurriculum({ ...curriculum, subject: e.target.value })}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><label className="block mt-3">교재·진도·수업 계획<textarea rows={12} value={curriculum.content} onChange={e => setCurriculum({ ...curriculum, content: e.target.value })}/></label><button className="primary-button mt-3" disabled={busy} onClick={() => act(async () => { const r = await request('save-curriculum', { id: curriculumId, data: curriculum }); setCurriculumId(r.id); await refresh(); setMessage('커리큘럼을 저장했습니다.'); })}>저장</button><button className="small-button ml-2" onClick={() => { setCurriculumId(null); setCurriculum({ title: '', subject: '영어', content: '' }); }}>새로 작성</button></section><section className="panel"><h2>{data.admin ? '커리큘럼 목록' : '내 커리큘럼'}</h2>{data.curricula.map((c: any) => <button key={c.id} className="w-full min-h-[44px] text-left py-3 border-b border-pastel-pink-100" onClick={() => { setCurriculumId(c.id); setCurriculum({ title: c.title, subject: c.subject, content: c.content }); }}><span className="text-sm font-bold">{c.title}</span><span className="block text-xs text-slate-400">{c.subject}</span></button>)}</section></div>}
  {tab === 'word' && <section className="panel"><div className="flex flex-wrap gap-2 mb-4">{[['vocab', '단어 세트 이용'], ['grammar', '문법 세트 이용'], ['exam', '시험기간 이용']].map(([view, label]) => <button key={view} className="small-button" onClick={() => onNavigate?.(view)}>{label}</button>)}</div><h2>내 학습 세트 관리</h2><div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="관리할 세트 종류">{([['word', '단어장'], ['grammar', '문법 세트'], ['exam', '시험기간']] as const).map(([value, label]) => <button key={value} className={setCategory === value ? 'primary-button' : 'small-button'} aria-pressed={setCategory === value} onClick={() => setSetCategory(value)}>{label}</button>)}</div><Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager key={setCategory} category={setCategory}/></Suspense></section>}
  {tab === 'settings' && data.admin && <section className="panel"><h2>선생님 담당 범위</h2><select aria-label="선생님 선택" value={staffUid} onChange={e => { setStaffUid(e.target.value); setWorkspaceRole(data.access.find((a:any)=>a.uid===e.target.value)?.workspaceRole || 'teacher'); setAcademyId(data.access.find((a:any)=>a.uid===e.target.value)?.academyId || 'main'); setNotionTeacherPageId(data.access.find((a: any) => a.uid === e.target.value)?.notionTeacherPageId || ''); setScopes(data.access.find((a: any) => a.uid === e.target.value)?.scopes || []); }}><option value="">선생님 선택</option>{data.staff.map((s: any) => <option key={s.uid} value={s.uid}>{s.name}</option>)}</select><div className="grid sm:grid-cols-2 gap-3 mt-3"><label>직책<select value={workspaceRole} onChange={e=>setWorkspaceRole(e.target.value)}><option value="teacher">선생님</option><option value="principal">원장 선생님</option></select></label><label>학원 ID<input value={academyId} onChange={e=>setAcademyId(e.target.value.trim())} placeholder="예: main"/></label></div><p className="text-xs text-slate-500 mt-2">원장 조회 범위는 아래 선택한 학생을 이 학원에 연결해 지정합니다.</p><label className="block mt-3">Notion 선생님 페이지 ID<input value={notionTeacherPageId} onChange={e => setNotionTeacherPageId(e.target.value.trim())} placeholder="일정의 담당 선생님 연결"/></label><div className="my-3 max-h-96 overflow-auto">{students.map((s: any) => <div key={s.studentKey} className="py-2 border-b border-pastel-pink-100"><p className="text-sm font-bold">{s.studentDisplayName}</p><div className="flex flex-wrap gap-3">{subjects.map(subject => <label key={subject} className="flex items-center gap-1"><input type="checkbox" checked={scopes.some((x: any) => x.studentKey === s.studentKey && x.subject === subject)} onChange={e => setScopes(e.target.checked ? [...scopes, { studentKey: s.studentKey, subject }] : scopes.filter((x: any) => !(x.studentKey === s.studentKey && x.subject === subject)))}/>{subject}</label>)}</div></div>)}</div><button className="primary-button" disabled={busy || !staffUid} onClick={() => act(async () => { await request('grant', { uid: staffUid, scopes, academyId, workspaceRole, academyStudents: [...new Set(scopes.map((s:any)=>s.studentKey))], notionTeacherPageId: notionTeacherPageId || null }); await refresh(); setMessage('담당 범위를 저장했습니다.'); })}>담당 범위 저장</button><div className="flex flex-wrap gap-2 mt-5"><button className="small-button" onClick={onAccounts}>기존 계정·리포트 관리</button><button className="small-button" disabled={busy} onClick={() => act(async () => { await request('prepare-notion'); setMessage('수업 일지·성적·일정 연결 속성을 준비했습니다.'); })}>Notion 입력 연결 준비</button></div></section>}
  </>}
 </div>;
}
