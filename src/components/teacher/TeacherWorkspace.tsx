import StudentManagementCard from './StudentManagementCard';
import StudentManagementDialog from './StudentManagementDialog';
import TeacherAssignmentManager from './TeacherAssignmentManager';
import LessonConflictReview from './LessonConflictReview';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import {teacherCachedRead,teacherCacheRead,teacherReadGeneration,invalidateTeacherReads} from '../../lib/teacherReadCache';
import OptionalMark from './OptionalMark';
import TeacherTodayLessons from './TeacherTodayLessons';
import { applyPreviousLesson } from '../../lib/teacherTodayLessons';
import { loadTeacherSection } from '../../lib/loadTeacherSection';
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
import { BookOpen, CalendarDays, ClipboardList, Users, Settings } from 'lucide-react';
const TeacherIntegrityAudit = lazy(() => import('./TeacherIntegrityAudit'));
const StudentEnrollmentEditor = lazy(() => import('./StudentEnrollmentEditor'));
const TeacherMessageComposer = lazy(() => import('./TeacherMessageComposer'));
const StudentProfileEditor = lazy(() => import('./StudentProfileEditor'));
const StudentRegistrationManager = lazy(() => import('./StudentRegistrationManager'));
const TeacherAcademicManager = lazy(() => import('./TeacherAcademicManager'));
const AcademyLessonReview = lazy(() => import('./AcademyLessonReview'));
const WordbookManager = lazy(() => import('./WordbookManager'));
import './teacherWorkspace.css';
import TeacherReportReview from './TeacherReportReview';
import TeacherLessonGrid from './TeacherLessonGrid';
import TeacherScheduleEditor from './TeacherScheduleEditor';
const subjects = ['영어', '수학', '국어', '과학', '한국사'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const emptyLesson = () => ({ studentKey: '', subject: '영어', date: today(), start: '14:00', end: '15:30', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', wrong:null as number | null,examWrong:null as number | null,correct: null, total: null, examCorrect: null, examTotal: null, round: null, classSession: '있음', selfStudy: '미확인', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, attendanceNote: '', specialNote: '' });
const stageLabel: any = { report_published_notion_pending:'리포트 반영 완료 · 노션 대기', reflection_pending:'노션 저장 완료 · 연동 대기', draft: '저장됨', publishing: '반영 준비 중', notion_saved: 'Notion 저장됨', processing: '반영 중', published: '반영 완료', failed: '반영 실패' };
const errors: any = { UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.', TEACHER_NOTION_LINK_REQUIRED: '관리자 설정에서 Notion 선생님 페이지를 연결해 주세요.', TEACHER_NOT_CONFIGURED: '관리자가 담당 학생과 과목을 연결하면 사용할 수 있습니다.', SOURCE_IDENTITY_LOCKED: '반영된 기록의 학생·과목은 바꿀 수 없습니다. 새 수업으로 작성해 주세요.', INVALID_INPUT: '입력한 날짜, 시간, 점수와 필수 항목을 확인해 주세요.', FORBIDDEN: '이 자료에 접근할 권한이 없습니다.', DRAFT_CONFLICT: '다른 화면에서 수정되었습니다. 새로고침 후 확인해 주세요.', PUBLISH_IN_PROGRESS: '반영 중입니다. 잠시 후 새로고침해 주세요.', NOTION_SCHEMA_SETUP_REQUIRED: '관리자 설정에서 수업 일지 연결을 준비해 주세요.', MAKE_SUBJECT_NOT_CONFIGURED: '이 과목은 아직 반영 연결이 준비되지 않았습니다.', MAKE_TRIGGER_NOT_CONFIGURED: '수업 일지의 반영 연결을 확인해야 합니다.' };
export default function TeacherWorkspace({ onNavigate, onAccounts }: {
    onNavigate?: (view: any) => void;
    onAccounts?: () => void;
}) {
    const [lessonDay,setLessonDay]=useState(today);
    const autoTouches=useRef(new Set<string>());const autoVersion=useRef(0);const [autoLoading,setAutoLoading]=useState(false);
    useEffect(()=>()=>{autoVersion.current++;},[]);
    const [draftPage,setDraftPage]=useState(1),[draftList,setDraftList]=useState<any>({records:[],page:1,pages:1,total:0}),[draftLoading,setDraftLoading]=useState(false);
    const [sectionLoading,setSectionLoading]=useState(false);
    const dirtyResource=useRef('');
    const loadVersion=useRef(0),draftVersion=useRef(0);
    const activeTab=useRef('lesson');
    const [lessonDialogOpen,setLessonDialogOpen]=useState(false);
    const [lessonMode, setLessonMode] = useState<'single' | 'grid'>('single'), [managementStudentKey,setManagementStudentKey]=useState('');
    const profileStudentKey=managementStudentKey, enrollmentStudentKey=managementStudentKey, messageStudentKey=managementStudentKey;
    const setProfileStudentKey=setManagementStudentKey, setEnrollmentStudentKey=setManagementStudentKey;
    const [data, setData] = useState<any>(null), [tab, setTab] = useState('lesson'), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    activeTab.current=tab;
    const [lesson, setLesson] = useState<any>(emptyLesson), [draftId, setDraftId] = useState<string | null>(null), [revision, setRevision] = useState<number | undefined>();
    const [search, setSearch] = useState(''), [status, setStatus] = useState('등록'), [page, setPage] = useState(1), [subjectFilter, setSubjectFilter] = useState('');
    const [scheduleSelection, setScheduleSelection] = useState<{
        date: string;
        record?: any;
        nonce: number;
    } | undefined>(), [scheduleDirty, setScheduleDirty] = useState(false);
    const [scheduleWorking,setScheduleWorking]=useState(false);
    const studentListRef=useRef<HTMLElement>(null);
    const scheduleEditorRef = useRef<HTMLDivElement>(null), regularRef = useRef<HTMLDivElement>(null);
    function openSchedule(date: string, record?: any) { if (busy)
        return; if (scheduleDirty && !window.confirm('저장하지 않은 일정 변경을 취소하고 다른 일정을 열까요?'))
        return; setScheduleSelection(previous => ({ date, record, nonce: (previous?.nonce || 0) + 1 })); setScheduleDirty(false);  }
    const [setCategory, setSetCategory] = useState<'word' | 'grammar' | 'exam'>('word');
    async function request(action?: string, body: any = {}) {
        const reading = action?.startsWith('read:');
        const posting = Boolean(action && !reading);
        const query=new URLSearchParams(reading?{action:action!.slice(5)}:{action:'bootstrap',section:workspaceSection(activeTab.current)});
        if(reading)for(const [key,value] of Object.entries(body)){if(value!==undefined&&value!==null)query.set(key,String(value));}
        const endpoint='/api/teacher/workspace'+(!posting?'?'+query.toString():'');
        const result = await teacherAuthenticatedRequest<any>(auth, endpoint, posting ? {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }),
        } : {});
        if (!result.ok || !result.data?.ok)
            throw new Error(`${result.data?.message || errors[result.data?.error] || result.userMessage || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`);
        if(posting&&action!=='previous-lesson'&&action!=='report-review') {
            loadVersion.current++;draftVersion.current++;invalidateTeacherReads(action!);
            dirtyResource.current=action==='save-class'&&result.data.statusOnly?'save-class-status':action!;
            const kind=action==='save-draft'||action==='publish'?'lesson':action==='save-academic'||action==='publish-academic'?'academic':action==='save-schedule'||action==='publish-schedule'?'schedule':action==='save-class'&&result.data.statusOnly?'class':null;
            const id=result.data.id||body.id;
            if(kind&&id){try{
                const saved=await request('read:managed-record',{kind,id});result.data.record=saved.record;
                if(kind==='lesson')setData((old:any)=>old?{...old,drafts:[saved.record,...old.drafts.filter((r:any)=>r.id!==id)]}:old);
                if(kind==='class')setData((old:any)=>old?{...old,classes:[saved.record,...old.classes.filter((r:any)=>r.id!==id&&(!saved.record.notionPageId||r.notionPageId!==saved.record.notionPageId))]}:old);
                if(kind==='schedule')setData((old:any)=>old?{...old,schedules:[saved.record,...old.schedules.filter((r:any)=>r.id!==id&&(!saved.record.notionPageId||r.notionPageId!==saved.record.notionPageId))]}:old);
            }catch{throw new Error('저장은 처리됐지만 최신 기록을 불러오지 못했습니다. 새로고침해 주세요.');}}
        }
        return result.data;
    }
    function workspaceSection(value:string){return ['lesson','students','schedule','curriculum','settings'].includes(value)?value:'base';}
    function mergeData(fresh:any){setData((old:any)=>({...{classes:[],curricula:[],drafts:[],schedules:[],reflectedSchedules:[],staff:[],access:[],notionSources:[],notionIssues:[]},...old,...fresh,students:fresh.students?.map((s:any)=>({...old?.students?.find((student:any)=>student.studentKey===s.studentKey),...s}))||old?.students||[]}));}
    async function loadDrafts(force=false){
        const version=++draftVersion.current;setDraftLoading(true);await auth.authStateReady();
        const key='drafts-page:'+draftPage,uid=auth.currentUser?.uid||'';
        const cached=teacherCachedRead(uid,key),generation=teacherReadGeneration();if(cached)setDraftList(cached);
        try{const r=await request('read:drafts-page',{page:draftPage,force:force?'1':undefined});if(version!==draftVersion.current)return;setDraftList(r);teacherCacheRead(uid,key,r,generation);setData((old:any)=>old?{...old,drafts:[...r.records,...old.drafts.filter((d:any)=>!r.records.some((row:any)=>row.id===d.id))]}:old);}finally{if(version===draftVersion.current)setDraftLoading(false);}
    }
    async function refresh() {
        const changed=dirtyResource.current;dirtyResource.current='';
        if(changed==='save-draft'||changed==='publish'){await loadDrafts(true);return;}
        if(changed==='save-schedule'||changed==='save-class-status')return;
        if(changed==='publish-schedule'||changed==='archive-schedule'){mergeData(await request('read:schedule-records',{force:'1'}));return;}
        if(['save-class','save-curriculum','archive-class','archive-curriculum','sync-notion-record','migrate-notion-records'].includes(changed)){
            mergeData(await request('read:bootstrap',{section:'curriculum',resourcesOnly:'1',force:'1'}));return;
        }
        const fresh=await request('read:bootstrap',{section:workspaceSection(activeTab.current),force:'1'});mergeData(fresh);
        teacherCacheRead(auth.currentUser?.uid||'','workspace:'+workspaceSection(activeTab.current),fresh);
        if(activeTab.current==='lesson')await loadDrafts(true);
    }
    useEffect(() => {
        const version=++loadVersion.current;let live=true;
        const section=workspaceSection(tab);setSectionLoading(true);
        (async()=>{
            await auth.authStateReady();const uid=auth.currentUser?.uid||'';if(!uid)throw new Error('로그인 인증이 만료되었습니다.');
            const cached=teacherCachedRead(uid,'workspace:'+section),generation=teacherReadGeneration();
            if(cached&&live&&version===loadVersion.current){mergeData(cached);setSectionLoading(false);}
            await loadTeacherSection({
                fast:cached?undefined:()=>request('read:bootstrap-fast',{section}),
                fresh:()=>request('read:bootstrap',{section}),
                apply:(value,isFresh)=>{
                    if(!live||version!==loadVersion.current||auth.currentUser?.uid!==uid)return;
                    mergeData(value);setSectionLoading(false);
                    if(isFresh)teacherCacheRead(uid,'workspace:'+section,value,generation);
                },
            });
        })().catch(e=>{if(live&&version===loadVersion.current)setMessage(e.message);}).finally(()=>{if(live&&version===loadVersion.current)setSectionLoading(false);});
        return()=>{live=false;};
    },[tab]);
    useEffect(()=>{if(tab==='lesson')void loadDrafts().catch(e=>setMessage(e.message));return()=>{draftVersion.current++;};},[tab,draftPage]);
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
    async function selectStudent(studentKey:string,patch:any={}) {
        const seed={...emptyLesson(),date:lesson.date,start:lesson.start,end:lesson.end,subject:lesson.subject,...patch,studentKey};
        const touched=new Set<string>();autoTouches.current=touched;
        const version=++autoVersion.current;setLesson(seed);setDraftId(null);setRevision(undefined);setMessage('');
        if(!studentKey){setAutoLoading(false);return;}setAutoLoading(true);
        try{const previous=await request('previous-lesson',{studentKey,subject:seed.subject,date:seed.date});
            if(version===autoVersion.current)setLesson((current:any)=>applyPreviousLesson(current,seed,previous.data,touched));
        }catch(e){if(version===autoVersion.current)setMessage(e instanceof Error?e.message:'직전 수업을 불러오지 못했습니다.');}
        finally{if(version===autoVersion.current)setAutoLoading(false);}
    }
    function resetLesson(){autoVersion.current++;setAutoLoading(false);setLesson(emptyLesson());setDraftId(null);setRevision(undefined);}
    function setField(key: string, value: any) { autoTouches.current.add(key);setLesson((d: any) => ({ ...d, [key]: value })); }
    function openDraft(d: any) { autoVersion.current++;setAutoLoading(false); setData((old:any)=>({...old,drafts:[d,...old.drafts.filter((r:any)=>r.id!==d.id)]}));setLesson(compactLessonInput({ ...emptyLesson(), ...d.data })); setDraftId(d.id); setRevision(d.revision); setLessonMode('single'); setLessonDialogOpen(true); }
    const students = data?.students || [];
    const filtered = students.filter((s: any) => {
        const active = s.subjects?.length ? s.subjects.some((x: any) => (!status || x.status === status) && (!subjectFilter || x.subject === subjectFilter)) : s.enrollmentStatus === status && !subjectFilter;
        return ((!status && !subjectFilter) || active) && `${s.studentDisplayName}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
    const savedDrafts=draftList.records;
    const draftPages=draftList.pages,currentDraftPage=draftList.page;
    const currentDraft = data?.drafts?.find((d: any) => d.id === draftId);
    const lessonEditor = <section className="panel"><h2>수업 일지</h2><fieldset disabled={busy}><label>날짜<input type="date" value={lesson.date} onChange={e=>setField('date',e.target.value)}/></label><div className="grid sm:grid-cols-2 gap-3">
    <label>학생<select disabled={Boolean(managementStudentKey)&&tab==='students'} value={lesson.studentKey} onChange={e => void selectStudent(e.target.value)}><option value="">학생 선택</option>{students.map((s: any) => <option key={s.studentKey} value={s.studentKey}>{s.studentDisplayName}</option>)}</select></label>
    <label>과목<select value={lesson.subject} onChange={e => void selectStudent(lesson.studentKey,{subject:e.target.value})}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
   </div>
   {autoLoading&&<p role="status" className="text-xs text-slate-500 my-2">직전 수업의 회차·내용·과제를 불러오는 중…</p>}<LessonAcademyFields value={lesson} onChange={setField}/>
   <div className="flex flex-wrap gap-2 my-3"><button className="small-button" onClick={() => {autoTouches.current.add('attendance');setLesson((d: any) => ({ ...d, attendance: '출석', attitude: '상', homework: '상' }));}}>출석·태도·숙제 일괄 상</button></div>
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['attendance', '출결', ['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']], ['attitude', '태도', ['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']], ['homework', '숙제', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']], ['test', '테스트', ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']]].map(([key, label, options]: any) => <label key={key}>{label}<select value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}>{options.map((x: string) => <option key={x}>{x}</option>)}</select></label>)}</div>
   <LessonTests value={lesson} onChange={setField}/>
   {[['content', '수업 내용'], ['specialNote', '특이 사항'], ['assignment', '과제'],['examScope','시험범위']].map(([key, label]) => <label key={key} className="block mt-3">{label}{key === 'content' ? <span className="text-xs text-rose-600 ml-1">(필수)</span> : <OptionalMark/>}<textarea required={key === 'content'} aria-required={key === 'content'} rows={key === 'content' ? 4 : 2} value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}/></label>)}
   {(lesson.note || lesson.nextPlan) && <details className="mt-3 text-xs text-slate-500"><summary>기존 기록 메모</summary>{lesson.note && <p className="whitespace-pre-wrap mt-2">기존 개인 피드백: {lesson.note}</p>}{lesson.nextPlan && <p className="whitespace-pre-wrap mt-2">기존 다음 수업 메모: {lesson.nextPlan}</p>}</details>}
   <div className="flex flex-wrap gap-2 mt-4"><button disabled={busy||autoLoading} className="primary-button" onClick={() => act(async () => { const result = await request('save-draft', { id: draftId, revision, data: lesson }); setDraftId(result.id); const savedDraft=result.record;await refresh(); setRevision(savedDraft?.revision); if(savedDraft) setLesson(compactLessonInput(savedDraft.data)); setMessage('초안을 저장했습니다.'); })}>저장</button><button disabled={busy || autoLoading || !lesson.studentKey || !lesson.content?.trim() || ['publishing', 'processing', 'notion_saved'].includes(currentDraft?.stage) || (currentDraft?.stage==='published' && JSON.stringify(currentDraft?.data)===JSON.stringify(lesson))} className="small-button" onClick={() => act(async () => {
                    if (!window.confirm('현재 입력 내용을 저장하고 Notion과 리포트에 반영할까요?'))
                        return;
                    let publishId=draftId;
                    if(!draftId || JSON.stringify(currentDraft?.data)!==JSON.stringify(lesson)) {
                        const saved=await request('save-draft',{id:draftId,revision,data:lesson});
                        publishId=saved.id;setDraftId(saved.id);setRevision(saved.record?.revision);
                        if(saved.record)setLesson(compactLessonInput(saved.record.data));
                    }
                    const published=await request('publish', { id: publishId });
                    void refresh().catch(()=>setMessage('반영 요청은 처리됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.'));
                    setMessage(published.warning || '학생·학부모 리포트와 노션에 반영했습니다.');
                })}>반영</button><button disabled={busy} className="small-button" onClick={() => act(refresh)}>새로고침</button><span className="self-center text-xs text-slate-500">{stageLabel[currentDraft?.stage] || '작성 중'}</span></div>
   </fieldset>{currentDraft&&<LessonConflictReview key={currentDraft.id+':'+currentDraft.revision} record={currentDraft} request={request} act={act} busy={busy} refresh={refresh}/>} {canRetryPublication(currentDraft) && <div className="mt-3"><p className="text-xs text-slate-500">저장한 요청의 반영 결과를 확인합니다. 이후 화면에서 바꾼 입력은 이 재시도에 포함하지 않습니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{const result=await request('publish',{id:currentDraft.id});setMessage(result.warning || '저장한 수업일지 반영을 확인했습니다.');}finally{await refresh();}})}>저장 결과 확인·재시도</button></div>}{busy && <p role="status" className="text-xs mt-3">저장·반영 처리 중입니다. 창을 닫아도 처리는 계속됩니다.</p>}</section>;
    return <div className="teacher-workspace max-w-6xl mx-auto px-4 py-5 md:p-8">
  <header className="mb-5"><p className="text-xs font-bold text-pastel-pink-500 mb-1">지원T · TEACHER ROOM</p><h1 className="text-2xl font-black text-slate-800">나의 선생님방</h1><p className="text-sm text-slate-500 mt-1">오늘 수업을 기록하고, 다음 수업을 준비해요.</p></header>
  <nav aria-label="선생님방 메뉴" className="flex flex-wrap gap-2 mb-5">
   {[['lesson', '수업 일지 작성', ClipboardList], ['academy', '일지 조회', ClipboardList], ['schedule', '시간표·일정', CalendarDays], ['students', '학생 관리', Users], ['academic', '성적 관리', BookOpen], ['curriculum', '커리큘럼', BookOpen], ['word', '학습 세트', BookOpen], ...(data?.admin || data?.principal ? [['settings', '관리자 설정', Settings]] : [])].map(([id, label, Icon]: any) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-bold ${tab === id ? 'bg-pastel-pink-500 text-white' : 'bg-white border border-pastel-pink-100 text-slate-600'}`}><Icon size={16}/>{label}</button>)}
  </nav>
  {sectionLoading&&data&&<p role="status" className="text-sm text-slate-500 mb-3">자료를 불러오는 중…</p>}{message && <p role="status" className="p-3 mb-4 rounded-xl bg-rose-50 text-sm text-rose-700">{message}</p>}
  {!data ? <div className="panel text-sm text-slate-500">{message ? <><p>위 안내를 확인한 뒤 다시 시도해 주세요.</p><button className="small-button mt-3" disabled={busy} onClick={() => act(refresh)}>다시 불러오기</button>{auth.currentUser?.email === 'lizzieshere1@gmail.com' && <button className="small-button mt-3 ml-2" onClick={onAccounts}>기존 계정·리포트 관리</button>}</> : '선생님방을 불러오는 중…'}</div> : <>
  <div hidden={tab !== 'lesson'}><div className="flex gap-2 mb-3">{([['single', '한 학생 작성'], ['grid', '여러 학생 작성']] as const).map(([value, label]) => <button key={value} aria-pressed={lessonMode === value} className={lessonMode === value ? 'primary-button' : 'small-button'} onClick={() => setLessonMode(value)}>{label}</button>)}</div><div hidden={lessonMode !== 'grid'}><TeacherLessonGrid active={tab==='lesson'&&lessonMode==='grid'} data={data} busy={busy} request={request} refresh={refresh} act={act}/></div></div>
  
  {((tab === 'lesson' && lessonMode === 'single') || lessonDialogOpen) && <div className="grid lg:grid-cols-[240px_1fr] gap-4">
   <aside hidden={lessonDialogOpen} className="space-y-3"><TeacherTodayLessons data={data} date={lessonDay} onDate={setLessonDay} active={tab==='lesson'&&lessonMode==='single'&&!lessonDialogOpen} request={request} disabled={busy} onStudent={(key,event)=>void selectStudent(key,{date:event.date,subject:event.subject,start:event.start,end:event.end})}/>

    <section className="panel"><h2>저장한 기록</h2><button disabled={busy} onClick={() => { resetLesson(); }} className="small-button">+ 새 수업</button>{draftLoading&&<p role="status" className="text-xs text-slate-500">저장한 기록을 불러오는 중…</p>}{savedDrafts.map((d: any) => <button disabled={busy} key={d.id} className="block w-full text-left min-h-[44px] border-b border-pastel-pink-50 py-2 text-xs" onClick={() => openDraft(d)}>{students.find((s: any) => s.studentKey === d.data.studentKey)?.studentDisplayName} · {d.data.date}<span className="block text-pastel-pink-500">{stageLabel[d.stage]}</span></button>)}<div className="review-pagination"><button disabled={draftLoading||currentDraftPage===1} onClick={()=>setDraftPage(currentDraftPage-1)}>이전</button><span>{currentDraftPage} / {draftPages}</span><button disabled={draftLoading||currentDraftPage===draftPages} onClick={()=>setDraftPage(currentDraftPage+1)}>다음</button></div></section>
   </aside>
   <LessonEditorContainer modal={lessonDialogOpen} onClose={()=>setLessonDialogOpen(false)}>{lessonEditor}</LessonEditorContainer>
  </div>}
  <div hidden={tab !== 'schedule'}><TeacherWeeklyCalendar data={data} busy={busy} request={request} active={tab==='schedule'} onAdd={date => openSchedule(date)} onEdit={record => {if((record.source==='notion'||record.notionPageId)&&!record.deleteRequested&&!canRetryPublication(record)){void act(async()=>{const result=await request('import-source-record',{id:record.notionPageId||record.id,kind:'schedule'});setData((old:any)=>({...old,schedules:[result.record,...old.schedules.filter((r:any)=>r.id!==result.record.id&&r.notionPageId!==result.record.notionPageId)]}));openSchedule(result.record.data.date,result.record);});}else openSchedule(record.data.date,record);}} onRegular={() => {}}/><div ref={scheduleEditorRef}><WorkspaceDialog open={Boolean(scheduleSelection) && tab==='schedule'} title="일정 추가·수정" onClose={() => { if (scheduleWorking || !scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) { setScheduleSelection(undefined); setScheduleDirty(false); } }}>{scheduleSelection && <TeacherScheduleEditor data={data} busy={busy} request={request} refresh={refresh} act={act} selection={scheduleSelection} onWorking={setScheduleWorking} onNotice={setMessage} onDirty={setScheduleDirty} onClose={() => { if (scheduleWorking || !scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) {
            setScheduleSelection(undefined);
            setScheduleDirty(false);
        } }}/>}</WorkspaceDialog></div><div ref={regularRef} className="mt-4"><TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} active={tab==='schedule'} mode="schedule"/></div></div>
  {tab === 'academic' && <Suspense fallback={<p className="text-sm text-slate-500">성적 관리 준비 중…</p>}><TeacherAcademicManager data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'academy' && <Suspense fallback={<p className="text-sm text-slate-500">학원 기록 준비 중…</p>}><AcademyLessonReview refreshVersion={teacherReadGeneration()} onEdit={openDraft} data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'students' && <section ref={studentListRef} className="panel">{data.admin || data.principal ? <Suspense fallback={<p className="text-xs text-slate-500">등록 내용을 불러오는 중…</p>}><StudentRegistrationManager students={students} key={data.uid + ':' + data.academyId} onSynced={async()=>{invalidateTeacherReads('sync-student-registration');const fresh=await request('read:bootstrap',{section:'students',force:'1'});mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}}/></Suspense> : null}<h2>학생 관리 <span className="text-xs font-normal text-slate-400">{filtered.length}명</span></h2><div className="workspace-filters mb-4"><input aria-label="학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/><select aria-label="수강 상태" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">전체 상태</option>{['등록', '대기', '중단'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="과목 필터" value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setPage(1); }}><option value="">전체 과목</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></div><div className="student-management-cards">{filtered.slice((currentPage - 1) * 20, currentPage * 20).map((s: any) => <div key={s.studentKey} className="student-management-card-wrap"><StudentManagementCard student={s} onOpen={()=>{setMessage('');setManagementStudentKey(s.studentKey);}}/></div>)}</div>{!filtered.length && <p className="text-sm text-slate-500 py-5">해당하는 학생이 없습니다.</p>}<div className="flex justify-center items-center gap-3 mt-4"><button className="small-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button><span className="text-xs">{currentPage} / {pages}</span><button className="small-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></section>}
  {tab==='students' && managementStudentKey && students.some((s:any)=>s.studentKey===managementStudentKey) ? <div key={data.uid+':'+managementStudentKey}><StudentManagementDialog name={students.find((s:any)=>s.studentKey===managementStudentKey)?.studentDisplayName||'학생'} canManage={Boolean(data.admin||data.principal)} busy={busy} notice={message} onClose={()=>{autoVersion.current++;setAutoLoading(false);setManagementStudentKey('');}} onSelect={next=>{if(next==='lesson'){const student=students.find((s:any)=>s.studentKey===managementStudentKey);void selectStudent(managementStudentKey,{subject:data.teachingScopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||data.scopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||student?.subjects?.[0]?.subject||'영어'});}}} render={(active,leave)=><Suspense fallback={<p role="status" className="text-sm text-slate-500">학생 관리 정보를 불러오는 중…</p>}>
  {active==='profile' && (data.admin||data.principal) ? <StudentProfileEditor key={data.uid+':'+profileStudentKey} studentKey={profileStudentKey} onClose={leave} onSaved={profile=>{const key=profileStudentKey;setProfileStudentKey('');invalidateTeacherReads('save-student-profile');setData((old:any)=>({...old,students:old.students.map((s:any)=>s.studentKey===key?{...s,studentDisplayName:profile.displayName,hasGuardianContact:Boolean(profile.guardianPhone)}:s)}));setMessage('학생 정보를 노션에 반영했습니다. 보호자 번호를 바꾼 경우 새 번호 뒤 4자리로 인증해 주세요.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('학생 정보는 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='enrollment' && (data.admin||data.principal) ? <StudentEnrollmentEditor key={data.uid+':'+enrollmentStudentKey} studentKey={enrollmentStudentKey} onClose={leave} onSaved={()=>{setEnrollmentStudentKey('');invalidateTeacherReads('save-student-enrollment');setMessage('수강·담당·소속반 변경을 노션에 반영했습니다.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(uid,'workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('수강 변경은 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='message' ? <TeacherMessageComposer key={data.uid+':'+messageStudentKey} studentKey={messageStudentKey} subjects={students.find((s:any)=>s.studentKey===messageStudentKey)?.subjects?.map((s:any)=>s.subject)||[]} onClose={leave}/> : null}
  {active==='review' ? <WorkspaceDialog open title="학습 리포트" onClose={leave}><TeacherReportReview students={students} initialStudentKey={managementStudentKey} showStudentPicker={false}/></WorkspaceDialog> : null}
  {active==='lesson' ? <WorkspaceDialog open title="수업 작성" onClose={()=>{if(busy)return;if(autoTouches.current.size && JSON.stringify(lesson)!==JSON.stringify(currentDraft?.data) && !window.confirm('저장하지 않은 수업 내용을 닫을까요?'))return;autoVersion.current++;setAutoLoading(false);leave();}}>{lessonEditor}</WorkspaceDialog> : null}
  </Suspense>}/></div> : null}
  {tab === 'curriculum' && <TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} mode="curriculum"/>}
  {tab === 'word' && <section className="panel"><h2>내 학습 세트 관리</h2><div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="관리할 세트 종류">{([['word', '단어장'], ['grammar', '문법 세트'], ['exam', '시험기간']] as const).map(([value, label]) => <button key={value} className={setCategory === value ? 'primary-button' : 'small-button'} aria-pressed={setCategory === value} onClick={() => setSetCategory(value)}>{label}</button>)}</div><Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager key={setCategory} category={setCategory}/></Suspense></section>}
  {tab === 'settings' && (data.admin || data.principal) && <Suspense fallback={<p>점검 화면을 불러오는 중…</p>}><TeacherIntegrityAudit key={data.uid+':'+data.academyId}/></Suspense>}
  {tab === 'settings' && (data.admin || data.principal) && <WorkspaceSyncPanel data={data} busy={busy} request={request} refresh={refresh} act={act}/>}
  {tab === 'settings' && (data.admin || data.principal) && <TeacherAssignmentManager data={data} request={request} act={act} busy={busy} refresh={refresh} onAccounts={onAccounts}/>}
  </>}
 </div>;
}

function LessonEditorContainer({modal,onClose,children}:{modal:boolean;onClose:()=>void;children:ReactNode}) {return modal?<WorkspaceDialog open title="일지 수정" onClose={onClose}>{children}</WorkspaceDialog>:<>{children}</>;}




