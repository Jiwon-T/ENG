import WorkspaceDialog from './WorkspaceDialog';
import WorkspaceSyncPanel from './WorkspaceSyncPanel';
import LessonTests from './LessonTests';
import TeacherClassManager from './TeacherClassManager';
import { compactLessonInput } from '../../lib/lessonInput';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import LessonAcademyFields from './LessonAcademyFields';
import TeacherWeeklyCalendar from './TeacherWeeklyCalendar';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { auth } from '../../lib/firebase';
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
const emptyLesson = () => ({ studentKey: '', subject: '영어', date: today(), start: '14:00', end: '15:30', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', correct: null, total: null, examCorrect: null, examTotal: null, round: null, classSession: '있음', selfStudy: '미확인', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, attendanceNote: '', specialNote: '' });
const stageLabel: any = { draft: '저장됨', publishing: '반영 준비 중', notion_saved: 'Notion 저장됨', processing: '반영 중', published: '반영 완료', failed: '반영 실패' };
const errors: any = { UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.', TEACHER_NOTION_LINK_REQUIRED: '관리자 설정에서 Notion 선생님 페이지를 연결해 주세요.', TEACHER_NOT_CONFIGURED: '관리자가 담당 학생과 과목을 연결하면 사용할 수 있습니다.', SOURCE_IDENTITY_LOCKED: '반영된 기록의 학생·과목은 바꿀 수 없습니다. 새 수업으로 작성해 주세요.', INVALID_INPUT: '입력한 날짜, 시간, 점수와 필수 항목을 확인해 주세요.', FORBIDDEN: '이 자료에 접근할 권한이 없습니다.', DRAFT_CONFLICT: '다른 화면에서 수정되었습니다. 새로고침 후 확인해 주세요.', PUBLISH_IN_PROGRESS: '반영 중입니다. 잠시 후 새로고침해 주세요.', NOTION_SCHEMA_SETUP_REQUIRED: '관리자 설정에서 수업 일지 연결을 준비해 주세요.', MAKE_SUBJECT_NOT_CONFIGURED: '이 과목은 아직 반영 연결이 준비되지 않았습니다.', MAKE_TRIGGER_NOT_CONFIGURED: '수업 일지의 반영 연결을 확인해야 합니다.' };
export default function TeacherWorkspace({ onNavigate, onAccounts }: {
    onNavigate?: (view: any) => void;
    onAccounts?: () => void;
}) {
    const [lessonDay,setLessonDay]=useState(today);
    const [lessonDialogOpen,setLessonDialogOpen]=useState(false);
    const [lessonMode, setLessonMode] = useState<'single' | 'grid'>('single'), [reviewStudentKey, setReviewStudentKey] = useState('');
    const [data, setData] = useState<any>(null), [tab, setTab] = useState('lesson'), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const [lesson, setLesson] = useState<any>(emptyLesson), [draftId, setDraftId] = useState<string | null>(null), [revision, setRevision] = useState<number | undefined>();
    const [search, setSearch] = useState(''), [status, setStatus] = useState('등록'), [page, setPage] = useState(1), [subjectFilter, setSubjectFilter] = useState('');
    const [scheduleSelection, setScheduleSelection] = useState<{
        date: string;
        record?: any;
        nonce: number;
    } | undefined>(), [scheduleDirty, setScheduleDirty] = useState(false);
    const reportRef=useRef<HTMLDivElement>(null), studentListRef=useRef<HTMLElement>(null);
    const scheduleEditorRef = useRef<HTMLDivElement>(null), regularRef = useRef<HTMLDivElement>(null);
    function openSchedule(date: string, record?: any) { if (busy)
        return; if (scheduleDirty && !window.confirm('저장하지 않은 일정 변경을 취소하고 다른 일정을 열까요?'))
        return; setScheduleSelection(previous => ({ date, record, nonce: (previous?.nonce || 0) + 1 })); setScheduleDirty(false);  }
    const [setCategory, setSetCategory] = useState<'word' | 'grammar' | 'exam'>('word');
    const [notionTeacherPageId, setNotionTeacherPageId] = useState('');
    const [workspaceRole,setWorkspaceRole] = useState('teacher'), [academyId,setAcademyId] = useState('main'),[workspaceLabel,setWorkspaceLabel]=useState('');
    const [staffUid, setStaffUid] = useState(''), [scopes, setScopes] = useState<any[]>([]);
    async function request(action?: string, body: any = {}) {
        const reading = action?.startsWith('read:');
        const posting = Boolean(action && !reading);
        const endpoint = '/api/teacher/workspace' + (reading ? `?action=${encodeURIComponent(action!.slice(5))}` : '');
        const result = await teacherAuthenticatedRequest<any>(auth, endpoint, posting ? {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }),
        } : {});
        if (!result.ok || !result.data?.ok)
            throw new Error(`${errors[result.data?.error] || result.data?.message || result.userMessage || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`);
        return result.data;
    }
    async function refresh() { setData(await request()); }
    useEffect(() => {
        let live = true;
        request('read:bootstrap-fast').then(async d => {
            if (!live)return;setData(d);
            try {const fresh=await request();if(live)setData(fresh);}catch(e){if(live)setMessage('노션 새 자료를 가져오지 못했습니다. 앱 저장 자료를 표시합니다. '+(e instanceof Error?e.message:''));}
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
    function openDraft(d: any) { setLesson(compactLessonInput({ ...emptyLesson(), ...d.data })); setDraftId(d.id); setRevision(d.revision); setLessonMode('single'); setLessonDialogOpen(true); }
    const students = data?.students || [];
    const filtered = students.filter((s: any) => {
        const active = s.subjects?.length ? s.subjects.some((x: any) => (!status || x.status === status) && (!subjectFilter || x.subject === subjectFilter)) : s.enrollmentStatus === status && !subjectFilter;
        return ((!status && !subjectFilter) || active) && `${s.studentDisplayName}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
    const myClasses = data?.classes || [];
    const dateWeekday = new Date(`${lessonDay}T12:00:00+09:00`).getUTCDay();
    const currentDraft = data?.drafts?.find((d: any) => d.id === draftId);
    return <div className="teacher-workspace max-w-6xl mx-auto px-4 py-5 md:p-8">
  <header className="mb-5"><p className="text-xs font-bold text-pastel-pink-500 mb-1">지원T · TEACHER ROOM</p><h1 className="text-2xl font-black text-slate-800">나의 선생님방</h1><p className="text-sm text-slate-500 mt-1">오늘 수업을 기록하고, 다음 수업을 준비해요.</p></header>
  <nav aria-label="선생님방 메뉴" className="flex flex-wrap gap-2 mb-5">
   {[['lesson', '수업 일지 작성', ClipboardList], ['schedule', '시간표·일정', CalendarDays], ['students', '학생 관리', Users], ['academic', '성적 관리', BookOpen], ['academy', '일지 조회', ClipboardList], ['curriculum', '커리큘럼', BookOpen], ['word', '학습 세트', BookOpen], ...(data?.admin || data?.principal ? [['settings', '관리자 설정', Settings]] : [])].map(([id, label, Icon]: any) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold ${tab === id ? 'bg-pastel-pink-500 text-white' : 'bg-white border border-pastel-pink-100 text-slate-600'}`}><Icon size={16}/>{label}</button>)}
  </nav>
  {message && <p role="status" className="p-3 mb-4 rounded-xl bg-rose-50 text-sm text-rose-700">{message}</p>}
  {!data ? <div className="panel text-sm text-slate-500">{message ? <><p>위 안내를 확인한 뒤 다시 시도해 주세요.</p><button className="small-button mt-3" disabled={busy} onClick={() => act(refresh)}>다시 불러오기</button>{auth.currentUser?.email === 'lizzieshere1@gmail.com' && <button className="small-button mt-3 ml-2" onClick={onAccounts}>기존 계정·리포트 관리</button>}</> : '선생님방을 불러오는 중…'}</div> : <>
  <div hidden={tab !== 'lesson'}><div className="flex gap-2 mb-3">{([['single', '한 학생 작성'], ['grid', '여러 학생 작성']] as const).map(([value, label]) => <button key={value} aria-pressed={lessonMode === value} className={lessonMode === value ? 'primary-button' : 'small-button'} onClick={() => setLessonMode(value)}>{label}</button>)}</div><div hidden={lessonMode !== 'grid'}><TeacherLessonGrid active={tab==='lesson'&&lessonMode==='grid'} data={data} busy={busy} request={request} refresh={refresh} act={act}/></div></div>
  
  {((tab === 'lesson' && lessonMode === 'single') || lessonDialogOpen) && <div className="grid lg:grid-cols-[240px_1fr] gap-4">
   <aside hidden={lessonDialogOpen} className="space-y-3"><section className="panel"><div className="flex justify-between gap-2"><h2>{lessonDay===today()?'오늘 수업':'선택한 날짜의 수업'}</h2><button className="small-button" onClick={()=>setLessonDay(today())}>오늘</button></div><input aria-label="수업 목록 날짜" type="date" value={lessonDay} onChange={e=>{if(e.target.value)setLessonDay(e.target.value);}}/>{myClasses.filter((c: any) => c.status !== '중단' && c.ownerUid === data.uid && c.slots.some((s: any) => s.status !== '중단' && s.weekday === dateWeekday)).sort((a:any,b:any)=>a.slots.filter((s:any)=>s.status!=='중단'&&s.weekday===dateWeekday).map((s:any)=>s.start).sort()[0].localeCompare(b.slots.filter((s:any)=>s.status!=='중단'&&s.weekday===dateWeekday).map((s:any)=>s.start).sort()[0])).map((c: any) => <div key={c.id} className="mt-3"><p className="font-bold text-sm">{c.name}</p>{c.students.map((key: string) => <button key={key} className="w-full text-left text-sm min-h-[44px]" onClick={() => { const slot = c.slots.filter((s:any)=>s.status!=='중단'&&s.weekday===dateWeekday).slice().sort((a:any,b:any)=>a.start.localeCompare(b.start))[0]; setLesson({ ...emptyLesson(), date: lessonDay, studentKey: key, subject: c.subject, start: slot.start, end: slot.end }); setDraftId(null); setRevision(undefined); }}>{students.find((s: any) => s.studentKey === key)?.studentDisplayName || '학생'} <ArrowRight size={12} className="inline"/></button>)}</div>)}{!myClasses.length && <p className="text-xs text-slate-500 mt-2">시간표를 등록하면 오늘 수업이 표시됩니다.</p>}</section>
    <section className="panel"><h2>저장한 기록</h2><button onClick={() => { setLesson(emptyLesson()); setDraftId(null); setRevision(undefined); }} className="small-button">+ 새 수업</button>{data.drafts.filter((d: any) => d.ownerUid === data.uid).sort((a: any, b: any) => b.updatedAt - a.updatedAt).slice(0, 20).map((d: any) => <button key={d.id} className="block w-full text-left min-h-[44px] border-b border-pastel-pink-50 py-2 text-xs" onClick={() => openDraft(d)}>{students.find((s: any) => s.studentKey === d.data.studentKey)?.studentDisplayName} · {d.data.date}<span className="block text-pastel-pink-500">{stageLabel[d.stage]}</span></button>)}</section>
   </aside>
   <LessonEditorContainer modal={lessonDialogOpen} busy={busy} onClose={()=>setLessonDialogOpen(false)}><section className="panel"><h2>수업 일지</h2><label>날짜<input type="date" value={lesson.date} onChange={e=>setField('date',e.target.value)}/></label><div className="grid sm:grid-cols-2 gap-3">
    <label>학생<select value={lesson.studentKey} onChange={e => { setField('studentKey', e.target.value); }}><option value="">학생 선택</option>{students.map((s: any) => <option key={s.studentKey} value={s.studentKey}>{s.studentDisplayName}</option>)}</select></label>
    <label>과목<select value={lesson.subject} onChange={e => setField('subject', e.target.value)}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
   </div>
   <LessonAcademyFields value={lesson} onChange={setField}/>
   <div className="flex flex-wrap gap-2 my-3"><button disabled={busy || !lesson.studentKey} className="small-button" onClick={() => act(async () => { const previous = await request('previous-lesson', { studentKey: lesson.studentKey, subject: lesson.subject }); setLesson((d: any) => ({ ...d, ...previous.data })); })}>지난 수업 이어가기</button><button className="small-button" onClick={() => setLesson((d: any) => ({ ...d, attendance: '출석', attitude: '상', homework: '상' }))}>출석·태도·숙제 일괄 상</button></div>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['attendance', '출결', ['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']], ['attitude', '태도', ['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']], ['homework', '숙제', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']], ['test', '테스트', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']]].map(([key, label, options]: any) => <label key={key}>{label}<select value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}>{options.map((x: string) => <option key={x}>{x}</option>)}</select></label>)}</div>
   <LessonTests value={lesson} onChange={setField}/>
   {[['content', '수업 내용'], ['specialNote', '특이 사항'], ['assignment', '과제']].map(([key, label]) => <label key={key} className="block mt-3">{label}<textarea rows={key === 'content' ? 4 : 2} value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}/></label>)}
   {(lesson.note || lesson.nextPlan) && <details className="mt-3 text-xs text-slate-500"><summary>기존 기록 메모</summary>{lesson.note && <p className="whitespace-pre-wrap mt-2">기존 개인 피드백: {lesson.note}</p>}{lesson.nextPlan && <p className="whitespace-pre-wrap mt-2">기존 다음 수업 메모: {lesson.nextPlan}</p>}</details>}
   <div className="flex flex-wrap gap-2 mt-4"><button disabled={busy} className="primary-button" onClick={() => act(async () => { const result = await request('save-draft', { id: draftId, revision, data: lesson }); setDraftId(result.id); const fresh = await request(); setData(fresh); const savedDraft = fresh.drafts.find((d: any) => d.id === result.id); setRevision(savedDraft?.revision); if(savedDraft) setLesson(compactLessonInput(savedDraft.data)); setMessage('초안을 저장했습니다.'); })}>저장</button><button disabled={busy || !draftId || ['publishing', 'processing', 'published'].includes(currentDraft?.stage) || JSON.stringify(currentDraft?.data) !== JSON.stringify(lesson)} className="small-button" onClick={() => act(async () => {
                    if (!window.confirm('저장된 내용을 Notion과 리포트에 반영할까요?'))
                        return;
                    await request('publish', { id: draftId });
                    await refresh();
                    setMessage('반영을 요청했습니다. 완료 여부는 새로고침으로 확인해 주세요.');
                })}>반영</button><button disabled={busy} className="small-button" onClick={() => act(refresh)}>새로고침</button><span className="self-center text-xs text-slate-500">{stageLabel[currentDraft?.stage] || '작성 중'}</span></div>
   </section></LessonEditorContainer>
  </div>}
  <div hidden={tab !== 'schedule'}><TeacherWeeklyCalendar data={data} busy={busy} onAdd={date => openSchedule(date)} onEdit={record => {if(record.source==='notion'&&!record.data.title){void act(async()=>{const result=await request('import-source-record',{id:record.id,kind:'schedule'});openSchedule(result.record.data.date,result.record);});}else openSchedule(record.data.date,record);}} onRegular={() => {}}/><div ref={scheduleEditorRef}><WorkspaceDialog open={Boolean(scheduleSelection) && tab==='schedule'} title="일정 추가·수정" onClose={() => { if (!busy && (!scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?'))) { setScheduleSelection(undefined); setScheduleDirty(false); } }}>{scheduleSelection && <TeacherScheduleEditor data={data} busy={busy} request={request} refresh={refresh} act={act} selection={scheduleSelection} onDirty={setScheduleDirty} onClose={() => { if (!scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) {
            setScheduleSelection(undefined);
            setScheduleDirty(false);
        } }}/>}</WorkspaceDialog></div><div ref={regularRef} className="mt-4"><TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} active={tab==='schedule'} mode="schedule"/></div></div>
  {tab === 'academic' && <Suspense fallback={<p className="text-sm text-slate-500">성적 관리 준비 중…</p>}><TeacherAcademicManager data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'academy' && <Suspense fallback={<p className="text-sm text-slate-500">학원 기록 준비 중…</p>}><AcademyLessonReview onEdit={openDraft} data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'students' && <section ref={studentListRef} className="panel"><h2>학생 관리 <span className="text-xs font-normal text-slate-400">{filtered.length}명</span></h2><div className="workspace-filters mb-4"><input aria-label="학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/><select aria-label="수강 상태" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">전체 상태</option>{['등록', '대기', '중단'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="과목 필터" value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setPage(1); }}><option value="">전체 과목</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></div><div className="grid md:grid-cols-2 gap-3">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((s: any) => <div key={s.studentKey} className="p-3 rounded-xl border border-pastel-pink-100 bg-pastel-pink-50/30"><p className="font-bold text-sm">{s.studentDisplayName}</p><div className="flex flex-wrap gap-1 mt-2">{s.subjects.map((x: any) => <span key={x.subject} className="text-[11px] px-2 py-1 rounded-full bg-white border border-slate-100">{x.subject} · {x.status}</span>)}</div><p className="text-xs text-slate-500 mt-2">{s.linkedFirebaseUid ? '앱 계정 연결됨' : '앱 계정 미연결'} · {s.hasGuardianContact ? '보호자 연락처 등록됨' : '연락처 확인 필요'}</p><button className="small-button mt-2" onClick={() => { setLesson({ ...emptyLesson(), studentKey: s.studentKey }); setDraftId(null); setRevision(undefined); setTab('lesson'); }}>수업 작성</button><button className="small-button mt-2 ml-2" onClick={() => { setReviewStudentKey(s.studentKey); setTab('students'); requestAnimationFrame(()=>reportRef.current?.scrollIntoView({behavior:'smooth',block:'start'})); }}>리포트 확인</button></div>)}</div>{!filtered.length && <p className="text-sm text-slate-500 py-5">해당하는 학생이 없습니다.</p>}<div className="flex justify-center items-center gap-3 mt-4"><button className="small-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span className="text-xs">{currentPage} / {pages}</span><button className="small-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></section>}
  {tab === 'students' && reviewStudentKey && <div ref={reportRef} className="mt-4"><button className="small-button mb-2" onClick={()=>{setReviewStudentKey('');studentListRef.current?.scrollIntoView({behavior:'smooth'});}}>학생 목록으로</button><TeacherReportReview students={students} initialStudentKey={reviewStudentKey} showStudentPicker={false}/></div>}
  {tab === 'curriculum' && <TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} mode="curriculum"/>}
  {tab === 'word' && <section className="panel"><h2>내 학습 세트 관리</h2><div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="관리할 세트 종류">{([['word', '단어장'], ['grammar', '문법 세트'], ['exam', '시험기간']] as const).map(([value, label]) => <button key={value} className={setCategory === value ? 'primary-button' : 'small-button'} aria-pressed={setCategory === value} onClick={() => setSetCategory(value)}>{label}</button>)}</div><Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager key={setCategory} category={setCategory}/></Suspense></section>}
  {tab === 'settings' && (data.admin || data.principal) && <WorkspaceSyncPanel data={data} busy={busy} request={request} refresh={refresh} act={act}/>}
  {tab === 'settings' && (data.admin || data.principal) && <section className="panel"><h2>선생님 담당 범위</h2><select aria-label="선생님 선택" value={staffUid} onChange={e => { setStaffUid(e.target.value); setWorkspaceLabel(data.access.find((a:any)=>a.uid===e.target.value)?.workspaceLabel || ''); setWorkspaceRole(data.access.find((a:any)=>a.uid===e.target.value)?.workspaceRole || 'teacher'); setAcademyId(data.access.find((a:any)=>a.uid===e.target.value)?.academyId || data.academyId || 'main'); setNotionTeacherPageId(data.access.find((a: any) => a.uid === e.target.value)?.notionTeacherPageId || ''); setScopes(data.access.find((a: any) => a.uid === e.target.value)?.scopes || []); }}><option value="">선생님 선택</option>{data.staff.map((s: any) => <option key={s.uid} value={s.uid}>{s.name}</option>)}</select><div className="grid sm:grid-cols-2 gap-3 mt-3"><label>직책<select disabled={!data.admin} value={workspaceRole} onChange={e=>setWorkspaceRole(e.target.value)}><option value="teacher">선생님</option><option value="principal">원장 선생님</option></select></label><label>과목·선생님 이름<input value={workspaceLabel} onChange={e=>setWorkspaceLabel(e.target.value)} placeholder="예: 영어 이지원T"/></label></div><label className="block mt-3">'DB_선생님'의 선생님 페이지 연결<input value={notionTeacherPageId} onChange={e => setNotionTeacherPageId(e.target.value.trim())} placeholder="선생님 페이지 URL의 32자리 ID (하이픈 포함 가능)"/></label><div className="my-3 max-h-96 overflow-auto">{students.map((s: any) => <div key={s.studentKey} className="py-2 border-b border-pastel-pink-100"><p className="text-sm font-bold">{s.studentDisplayName}</p><div className="flex flex-wrap gap-3">{subjects.map(subject => <label key={subject} className="flex items-center gap-1"><input type="checkbox" checked={scopes.some((x: any) => x.studentKey === s.studentKey && x.subject === subject)} onChange={e => setScopes(e.target.checked ? [...scopes, { studentKey: s.studentKey, subject }] : scopes.filter((x: any) => !(x.studentKey === s.studentKey && x.subject === subject)))}/>{subject}</label>)}</div></div>)}</div><button className="primary-button" disabled={busy || !staffUid} onClick={() => act(async () => { const saved = await request('grant', { uid: staffUid, scopes, workspaceLabel, academyId: data.admin ? academyId : data.academyId, workspaceRole, academyStudents: [...new Set(scopes.map((s:any)=>s.studentKey))], notionTeacherPageId: notionTeacherPageId || null }); await refresh(); setMessage(saved.syncError ? '담당 범위는 앱에 저장됐지만 노션 반영에 실패했습니다. 다시 시도해 주세요.' : '담당 범위를 저장했습니다.'); })}>담당 범위 저장</button>{data.admin && <div className="flex flex-wrap gap-2 mt-5"><button className="small-button" onClick={onAccounts}>기존 계정·리포트 관리</button><button className="small-button" disabled={busy} onClick={() => act(async () => { await request('prepare-notion'); setMessage('수업 일지·성적·일정 연결 속성을 준비했습니다.'); })}>Notion 입력 연결 준비</button></div>}</section>}
  </>}
 </div>;
}

function LessonEditorContainer({modal,busy,onClose,children}:{modal:boolean;busy:boolean;onClose:()=>void;children:ReactNode}) {return modal?<WorkspaceDialog open title="일지 수정" onClose={()=>{if(!busy)onClose();}}>{children}</WorkspaceDialog>:<>{children}</>;}
