import LessonRestorePanel from './LessonRestorePanel';
import WorkspaceSkeleton from './WorkspaceSkeleton';
const WorkbookMaker = lazy(() => import('./WorkbookMaker'));
import TeacherPetView from './TeacherPetView';
import {PetCouponDialog,type PetCouponRow} from './PetCouponPanel';
import AdminDashboard from './AdminDashboard';
import StudentMasterPanel from './StudentMasterPanel';
import ScheduleViewHeader,{type ScheduleView} from './ScheduleViewHeader';
import WorkspaceNavigation from './WorkspaceNavigation';
import LessonModeSwitch from './LessonModeSwitch';
import StatusBadge,{statusKind} from './StatusBadge';
import {fieldDisclosureError} from '../../lib/lessonDisclosure';
import AutoTextarea from './AutoTextarea';
import { autoSessionNumbers, editedSessionNumbers, withStudyDefaults, numberTenths, sameLessonTarget } from '../../lib/sessionNumbers';
import WorkspaceRequestMetrics from './WorkspaceRequestMetrics';
import {beginWorkspaceRequest,finishWorkspaceRequest,clearWorkspaceRequestMetrics} from '../../lib/workspaceRequestMetrics';
import {regularLessonTime} from '../../lib/lessonTimePresets';
import StudentCombobox from './StudentCombobox';
import type {TodayLesson} from '../../lib/teacherTodayLessons';
import ChipGroup from './ChipGroup';
import {lessonOptionGroups} from '../../lib/lessonOptions';
import LessonActionBar,{ShortcutKey,lessonShortcut} from './LessonActionBar';
import LessonDeleteButton from './LessonDeleteButton';
import {stageLabel,lessonRecordStatus} from '../../lib/lessonPresentation';
import {submitLesson} from '../../lib/lessonSubmission';
import {createWorkspaceOperations,type WorkspaceActionOptions,type WorkspaceOperation} from '../../lib/workspaceOperations';
import {upsertWorkspaceRecord} from '../../lib/workspaceRecords';
import {useWorkspaceNotice} from '../../lib/useWorkspaceNotice';
import StudentManagementCard from './StudentManagementCard';
import StudentManagementDialog from './StudentManagementDialog';
import WorkspaceToast from './WorkspaceToast';
import StudentAccountLink from './StudentAccountLink';
import ParentLinkControl from './ParentLinkControl';
const RECENT_SECTION_MS=45_000;
import {recordTiming} from '../../lib/requestTimings';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import {teacherCachedRead,teacherCacheRead,teacherCacheAge,teacherReadGeneration,invalidateTeacherReads} from '../../lib/teacherReadCache';
import OptionalMark from './OptionalMark';
import {AudienceLegend,AudienceTag,LessonPreviewButton,TeacherOnlyFields} from './LessonAudience';
import {LESSON_AUDIENCE} from '../../lib/lessonAudience';
import TeacherTodayLessons from './TeacherTodayLessons';
import { applyPreviousLesson,sessionSeed} from '../../lib/teacherTodayLessons';
import { loadTeacherSection } from '../../lib/loadTeacherSection';
import WorkspaceDialog from './WorkspaceDialog';
import LessonTests from './LessonTests';
import TeacherClassManager from './TeacherClassManager';
import StudentPartyCard from './StudentPartyCard';
import { compactLessonInput } from '../../lib/lessonInput';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import LessonAcademyFields from './LessonAcademyFields';
import TeacherWeeklyCalendar from './TeacherWeeklyCalendar';
import { lazy, Suspense, useCallback,useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayRecords, todayLessonState, todayLessonRecord, nextUnwrittenLesson } from '../../lib/todayLessonProgress';
import StudentSummary from './StudentSummary';
import StudentOverview from './StudentOverview';
import StudentAdmissionEditor from './StudentAdmissionEditor';
import {askConfirm,ask,askDiscard} from './ConfirmDialog';
import {plannedStops} from '../../lib/studentOverview';
import { auth } from '../../lib/firebase';
import {onAuthStateChanged} from 'firebase/auth';
import LessonSaveStatus from './LessonSaveStatus';
import { BookOpen, CalendarDays, ClipboardList, Users, Settings, RefreshCw, LoaderCircle, ArrowRight, Info } from 'lucide-react';
const StudentEnrollmentEditor = lazy(() => import('./StudentEnrollmentEditor'));
const TeacherMessageComposer = lazy(() => import('./TeacherMessageComposer'));
const StudentProfileEditor = lazy(() => import('./StudentProfileEditor'));
const StudentRegistrationManager = lazy(() => import('./StudentRegistrationManager'));
const TeacherAcademicManager = lazy(() => import('./TeacherAcademicManager'));
const AcademyLessonReview = lazy(() => import('./AcademyLessonReview'));
const WordbookManager = lazy(() => import('./WordbookManager'));
const LessonParentPreview=lazy(()=>import('./LessonParentPreview'));
import './teacherWorkspace.css';
import './lessonCutover.css';
import './reviewRedesign.css';
import './scheduleWorkspace.css';
import TeacherReportReview, { UNSAVED_EVALUATION_MESSAGE } from './TeacherReportReview';
import TeacherLessonGrid from './TeacherLessonGrid';
import {matchingSavedLesson,openTodayLesson} from '../../lib/teacherLessonGrid';
import TeacherScheduleEditor from './TeacherScheduleEditor';
import {useLeaveProtection} from '../../lib/leaveProtection';
import {autoOpenDone,markAutoOpenDone} from '../../lib/autoOpenGuard';
const subjects = ['영어', '수학', '국어', '과학', '한국사'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const emptyLesson = () => ({ studentKey: '', subject: '영어', date: today(), start: '14:00', end: '15:30', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', wrong:null as number | null,examWrong:null as number | null,correct: null, total: null, examCorrect: null, examTotal: null, round: null, classSession: '있음', selfStudy: '없음', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, attendanceNote: '', specialNote: '', teacherNote: '' });
const errors: any = { UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.', TEACHER_NOTION_LINK_REQUIRED: '관리자 설정에서 선생님 정보를 확인해 주세요.', TEACHER_NOT_CONFIGURED: '관리자가 담당 학생과 과목을 연결하면 사용할 수 있습니다.', SOURCE_IDENTITY_LOCKED: '반영된 기록의 학생·과목은 바꿀 수 없습니다. 새 수업으로 작성해 주세요.', INVALID_INPUT: '입력한 날짜, 시간, 점수와 필수 항목을 확인해 주세요.', FORBIDDEN: '이 자료에 접근할 권한이 없습니다.', DRAFT_CONFLICT: '다른 화면에서 수정되었습니다. 새로고침 후 확인해 주세요.', PUBLISH_IN_PROGRESS: '반영 중입니다. 잠시 후 새로고침해 주세요.', NOTION_SCHEMA_SETUP_REQUIRED: '관리자 설정에서 수업 일지 연결을 준비해 주세요.', MAKE_SUBJECT_NOT_CONFIGURED: '이 과목은 아직 반영 연결이 준비되지 않았습니다.', MAKE_TRIGGER_NOT_CONFIGURED: '수업 일지의 반영 연결을 확인해야 합니다.' };
/** Round hints: for a saved lesson only where it had no counter yet (that one is counted from the earlier lessons). */
const roundHintsFor=(lesson:any,history:any[],touched:Set<string>,baseline:any)=>{const hints=autoSessionNumbers(lesson,history,touched,false).hints;if(!baseline)return hints;return Object.fromEntries(Object.entries(hints).filter(([key])=>numberTenths(baseline[key])===null));};
export default function TeacherWorkspace({ onNavigate, initialTab }: {
    onNavigate?: (view: any) => void;
    /** The tab to open first (home's 워크북 → 'workbook'); otherwise 수업 일지. */
    initialTab?: string;
}) {
    const [savedPulse,setSavedPulse]=useState<{id:string;at:number}|null>(null);
    const [parentPreview,setParentPreview]=useState(false);
    const [scheduleView,setScheduleView]=useState<ScheduleView>('dated');
    const createScheduleRef=useRef<(()=>void)|null>(null),createClassRef=useRef<(()=>void)|null>(null);
    const [lessonDay,setLessonDay]=useState(today);
    // Opened by itself (today's first or last 반영 lesson) until the teacher picks a lesson: shows the pick hint.
    const [pickHint,setPickHint]=useState(false);
    const [todayStudents,setTodayStudents]=useState<{uid:string;date:string;keys:string[];events?:TodayLesson[];matchEvents?:TodayLesson[];dayLessons?:any[]}>({uid:"",date:"",keys:[]});
    const receiveTodayLessons=useCallback((events:TodayLesson[],uid:string,date:string,dayLessons?:any[],matchEvents?:TodayLesson[])=>setTodayStudents(old=>({uid,date,keys:[...new Set(events.flatMap(event=>event.students))],events,matchEvents,dayLessons:dayLessons??(old.uid===uid&&old.date===date?old.dayLessons:undefined)})),[]);
    const sessionHistory=useRef<any[]>([]);const autoTouches=useRef(new Set<string>());const autoVersion=useRef(0);const [autoLoading,setAutoLoading]=useState(false);
    // Opening a today card's saved lesson by id: editing and saving wait; a failed read stops with a retry.
    const [savedLookup,setSavedLookup]=useState<null|'loading'|'failed'>(null);const lookupRetry=useRef<(()=>void)|null>(null);
    useEffect(()=>()=>{autoVersion.current++;},[]);
    const [draftPage,setDraftPage]=useState(1),[draftList,setDraftList]=useState<any>({records:[],page:1,pages:1,total:0}),[draftLoading,setDraftLoading]=useState(false);
    const [sectionLoading,setSectionLoading]=useState(false);
    const dirtyResources=useRef(new Set<string>());
    const loadVersion=useRef(0),draftVersion=useRef(0);
    const activeTab=useRef('lesson');
    const [lessonDialogOpen,setLessonDialogOpen]=useState(false);
 const studentAttemptRef=useRef<null|((action:()=>void)=>void)>(null);
 const registerStudentAttempt=useCallback((attempt:(action:()=>void)=>void)=>{studentAttemptRef.current=attempt;return()=>{if(studentAttemptRef.current===attempt)studentAttemptRef.current=null;};},[]);
 const [managementInitialTab,setManagementInitialTab]=useState('review');const [petViewKey,setPetViewKey]=useState('');const [couponRows,setCouponRows]=useState<PetCouponRow[]>([]),[couponKey,setCouponKey]=useState('');
    // Unsaved 학습 성취도 평가 in the report tab: closing, switching tabs or students asks first.
    const reviewDirty=useRef(false);
    const [lessonMode, setLessonMode] = useState<'single' | 'grid'>('single'), [managementStudentKey,setManagementStudentKey]=useState('');
    const profileStudentKey=managementStudentKey, enrollmentStudentKey=managementStudentKey, messageStudentKey=managementStudentKey;
    const setProfileStudentKey=setManagementStudentKey, setEnrollmentStudentKey=setManagementStudentKey;
    const [data, setData] = useState<any>(null), [tab, setTab] = useState(initialTab || 'lesson');
    activeTab.current=tab;
    const [lesson, setLesson] = useState<any>(emptyLesson), [draftId, setDraftId] = useState<string | null>(null), [revision, setRevision] = useState<number | undefined>();
    const latestLesson=useRef<any>(null);latestLesson.current=lesson;
    const newLessonId=useRef(crypto.randomUUID());
    const [search, setSearch] = useState(''), [status, setStatus] = useState('등록'), [page, setPage] = useState(1), [subjectFilter, setSubjectFilter] = useState('');
    const [scheduleSelection, setScheduleSelection] = useState<{
        date: string;
        record?: any;
        nonce: number;
    } | undefined>(), [scheduleDirty, setScheduleDirty] = useState(false);
    const scheduleNonce=useRef(0);
    const [jobs,setJobs]=useState<WorkspaceOperation[]>([]);
    const operationsRef=useRef<ReturnType<typeof createWorkspaceOperations>|null>(null);
    if(!operationsRef.current)operationsRef.current=createWorkspaceOperations(setJobs);
    const operations=operationsRef.current;
    const operationContext=lessonDialogOpen||(tab==='lesson'&&lessonMode==='single')?'lesson-editor:'+autoVersion.current:tab==='schedule'&&scheduleSelection?'schedule-editor:'+scheduleSelection.nonce:tab==='students'&&managementStudentKey?'student:'+managementStudentKey:tab+':'+lessonMode;
    const recordScope=(lessonDialogOpen||tab==='lesson'&&lessonMode==='single'||tab==='students'&&managementStudentKey)&&draftId?'lesson-record:'+draftId:tab==='schedule'&&scheduleSelection?.record?.id?'schedule-record:'+scheduleSelection.record.id:null;
    const busy=operations.busy(operationContext)||Boolean(recordScope&&operations.busy(recordScope));
    const scheduleWorking=Boolean(scheduleSelection&&operations.busy('schedule-editor:'+scheduleSelection.nonce));
    const currentContext=useRef(operationContext);currentContext.current=operationContext;
    const {message,show:setMessage,dismiss:dismissMessage}=useWorkspaceNotice(operationContext);
    const handleScheduleDirty=useCallback((dirty:boolean)=>{setScheduleDirty(dirty);if(dirty)dismissMessage();},[dismissMessage]);
    const [bootstrapError,setBootstrapError]=useState('');
    const [authEpoch,setAuthEpoch]=useState(0),accountRef=useRef(auth.currentUser?.uid);
    useEffect(()=>onAuthStateChanged(auth,user=>{if(user?.uid===accountRef.current)return;accountRef.current=user?.uid;if(import.meta.env.DEV)clearWorkspaceRequestMetrics();operations.reset();dismissMessage();dirtyResources.current.clear();autoVersion.current++;setData(null);sessionHistory.current=[];setLesson(emptyLesson());setDraftId(null);setRevision(undefined);setScheduleSelection(undefined);setManagementStudentKey('');setBootstrapError('');setAuthEpoch(value=>value+1);}),[operations,dismissMessage]);
    const studentListRef=useRef<HTMLElement>(null);
    const scheduleEditorRef = useRef<HTMLDivElement>(null), regularRef = useRef<HTMLDivElement>(null);
    async function openSchedule(date: string, record?: any) { if (busy)
        return; if (scheduleDirty && !await askDiscard('저장하지 않은 일정 변경을 취소하고 다른 일정을 열까요?', { discardText: '버리고 열기' }))
        return; setScheduleSelection(previous => ({ date, record, nonce: ++scheduleNonce.current })); setScheduleDirty(false);  }
    const [setCategory, setSetCategory] = useState<'word' | 'grammar' | 'exam' | 'sentence'>('word');
    const [intakeCount,setIntakeCount]=useState(0),[intakeStart,setIntakeStart]=useState(0);
    const [studentView,setStudentView]=useState<'students'|'classes'>('students'),studentClassRef=useRef<(()=>void)|null>(null);
    async function request(action?: string, body: any = {}) {
        const requestAccount=data?.uid||auth.currentUser?.uid;if(requestAccount&&auth.currentUser?.uid!==requestAccount)throw new Error('로그인 계정이 변경되었습니다.');
        const reading = action?.startsWith('read:');
        const posting = Boolean(action && !reading);
        const query=new URLSearchParams(reading?{action:action!.slice(5)}:{action:'bootstrap',section:workspaceSection(activeTab.current)});
        if(reading)for(const [key,value] of Object.entries(body)){if(value!==undefined&&value!==null)query.set(key,String(value));}
        const endpoint='/api/teacher/workspace'+(!posting?'?'+query.toString():'');
        const metric=import.meta.env.DEV?beginWorkspaceRequest(action||'bootstrap'):undefined;
        let result:any;try{result = await teacherAuthenticatedRequest<any>(auth, endpoint, posting ? {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }),
        } : {},requestAccount);
        }finally{if(import.meta.env.DEV&&metric)finishWorkspaceRequest(metric,Boolean(result?.ok&&result?.data?.ok));}
        if(requestAccount&&auth.currentUser?.uid!==requestAccount)throw new Error('로그인 계정이 변경되었습니다.');
        if(!result.ok&&posting&&['publish','publish-schedule','publish-academic'].includes(action||'')&&body.id&&!['UNAUTHORIZED','SESSION_REVOKED','FORBIDDEN','FIRESTORE_RESOURCE_EXHAUSTED'].includes(result.data?.error||'')){
            try{const kind=action==='publish'?'lesson':action==='publish-schedule'?'schedule':'academic';const saved=await request('read:managed-record',{kind,id:body.id});if(kind!=='academic')setData((old:any)=>old?{...old,[kind==='lesson'?'drafts':'schedules']:upsertWorkspaceRecord(old[kind==='lesson'?'drafts':'schedules'],saved.record)}:old);}catch{/* Preserve the original error, never retry the mutation. */}
        }
        if (!result.ok || !result.data?.ok)
            throw Object.assign(new Error(`${result.data?.message || errors[result.data?.error] || result.userMessage || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`),{code:result.data?.error,blocker:result.data?.blocker});
        if(posting&&action!=='previous-lesson'&&action!=='report-review'&&!action!.startsWith('workbook-')) {
            if(currentContext.current===operationContext)loadVersion.current++;if(action==='save-draft'||action==='publish')draftVersion.current++;invalidateTeacherReads(action!);
            dirtyResources.current.add(action==='save-class'&&result.data.statusOnly?'save-class-status':action!);
            const kind=action==='save-draft'||action==='publish'?'lesson':action==='save-academic'||action==='publish-academic'?'academic':action==='save-schedule'||action==='publish-schedule'?'schedule':action==='save-class'&&result.data.statusOnly?'class':null;
            const id=result.data.id||body.id;
            if(kind&&id){try{
                const saved=result.data.record?{record:result.data.record}:await request('read:managed-record',{kind,id});result.data.record=saved.record;operations.alias(operationContext,kind+'-record:'+id);
                if(kind==='lesson'&&saved.record.ownerUid===data?.uid)setDraftList((old:any)=>({...old,records:upsertWorkspaceRecord(old.records,saved.record).slice(0,10),total:Math.max(old.total,old.records.length+(old.records.some((r:any)=>r.id===id)?0:1))}));
                if(kind==='lesson')setData((old:any)=>old?{...old,drafts:upsertWorkspaceRecord(old.drafts,saved.record)}:old);
                if(kind==='class')setData((old:any)=>old?{...old,classes:[saved.record,...old.classes.filter((r:any)=>r.id!==id&&(!saved.record.notionPageId||r.notionPageId!==saved.record.notionPageId))]}:old);
                if(kind==='schedule')setData((old:any)=>old?{...old,schedules:upsertWorkspaceRecord(old.schedules,saved.record)}:old);
            }catch{throw new Error('저장은 처리됐지만 최신 기록을 불러오지 못했습니다. 새로고침해 주세요.');}}
        }
        return result.data;
    }
    function workspaceSection(value:string){return ['lesson','students','schedule','curriculum','settings'].includes(value)?value:'base';}
    function mergeData(fresh:any){setData((old:any)=>({...{classes:[],curricula:[],drafts:[],schedules:[],reflectedSchedules:[],staff:[],access:[]},...old,...fresh,students:fresh.students?.map((s:any)=>({...old?.students?.find((student:any)=>student.studentKey===s.studentKey),...s}))||old?.students||[]}));}
    // Page 1 of saved lessons comes with the lesson bootstrap; later pages and refreshes still ask for drafts-page.
    const draftsViaBootstrap=useRef(false);
    function applyDraftsPage(r:any,uid:string,generation:number){if(draftPage!==1)return;draftVersion.current++;setDraftLoading(false);setDraftList(r);teacherCacheRead(uid,'drafts-page:1',r,generation);setData((old:any)=>old?{...old,drafts:[...r.records,...(old.drafts||[]).filter((d:any)=>!r.records.some((row:any)=>row.id===d.id))]}:old);}
    async function loadDrafts(force=false){
        const version=++draftVersion.current;setDraftLoading(true);await auth.authStateReady();
        const key='drafts-page:'+draftPage,uid=auth.currentUser?.uid||'';
        const cached=teacherCachedRead(uid,key),generation=teacherReadGeneration();if(cached)setDraftList(cached);
        try{const r=await request('read:drafts-page',{page:draftPage,size:'6',force:force?'1':undefined});if(version!==draftVersion.current)return;setDraftList(r);teacherCacheRead(uid,key,r,generation);setData((old:any)=>old?{...old,drafts:[...r.records,...old.drafts.filter((d:any)=>!r.records.some((row:any)=>row.id===d.id))]}:old);}finally{if(version===draftVersion.current)setDraftLoading(false);}
    }
    async function refresh() {
        const changes=[...dirtyResources.current];dirtyResources.current.clear();
        if(changes.length&&changes.every(action=>['save-draft','publish','save-schedule','publish-schedule','save-class-status'].includes(action)))return;
        const changed=changes[0]||'';
        if(changed==='save-schedule'||changed==='save-class-status')return;
        if(changed==='publish-schedule'||changed==='archive-schedule'){mergeData(await request('read:schedule-records',{force:'1'}));return;}
        if(['save-class','save-curriculum','archive-class','archive-curriculum'].includes(changed)){
            mergeData(await request('read:bootstrap',{section:'curriculum',resourcesOnly:'1',force:'1'}));return;
        }
        const fresh=await request('read:bootstrap',{section:workspaceSection(activeTab.current),force:'1'});mergeData(fresh);
        teacherCacheRead(auth.currentUser?.uid||'','workspace:'+workspaceSection(activeTab.current),fresh);
        if(activeTab.current==='lesson')await loadDrafts(true);
    }
    useEffect(() => {
        const version=++loadVersion.current;let live=true;
        const section=workspaceSection(tab);setSectionLoading(true);const shownFrom=performance.now();let shown=false;const markShown=()=>{if(shown)return;shown=true;recordTiming({at:Date.now(),action:`화면 표시 · ${section}`,ms:Math.round(performance.now()-shownFrom),token:0,status:200,server:[]});};if(section==='lesson')draftsViaBootstrap.current=true;
        (async()=>{
            await auth.authStateReady();const uid=auth.currentUser?.uid||'';if(!uid)throw new Error('로그인 인증이 만료되었습니다.');
            const cached=teacherCachedRead(uid,'workspace:'+section),generation=teacherReadGeneration();
            if(cached&&live&&version===loadVersion.current){mergeData(cached);setSectionLoading(false);markShown();}
            // Switching back to a section fetched moments ago reuses it instead of asking again (e.g. 성적 → 일지 조회 → 학습 세트
            // all use 'base'). Own saves clear these entries and 새로고침 forces a fresh read, so this only skips repeats.
            if(cached&&teacherCacheAge(uid,'workspace:'+section)<RECENT_SECTION_MS){if(live&&version===loadVersion.current&&(cached as any).draftsPage)applyDraftsPage((cached as any).draftsPage,uid,generation);return;}
            await loadTeacherSection({
                fresh:()=>request('read:bootstrap',section==='lesson'?{section,draftsSize:'6'}:{section}),
                apply:(value,isFresh)=>{
                    if(!live||version!==loadVersion.current||auth.currentUser?.uid!==uid)return;
                    mergeData(value);setSectionLoading(false);setBootstrapError('' );markShown();
                    if((value as any)?.draftsPage)applyDraftsPage((value as any).draftsPage,uid,generation);
                    else if(isFresh&&section==='lesson')void loadDrafts().catch(()=>{}); // a server without the bundled list still gets one
                    if(isFresh)teacherCacheRead(uid,'workspace:'+section,value,generation);
                },
            });
        })().catch(e=>{if(live&&version===loadVersion.current){setBootstrapError(e.message);setMessage(e.message);}}).finally(()=>{if(live&&version===loadVersion.current)setSectionLoading(false);});
        return()=>{live=false;};
    },[tab,authEpoch]);
    useEffect(()=>{if(tab!=='lesson')return;if(draftPage===1&&draftsViaBootstrap.current){draftsViaBootstrap.current=false;const uid=auth.currentUser?.uid||'',cached=uid?teacherCachedRead(uid,'drafts-page:1'):null;if(cached)setDraftList(cached);return;}void loadDrafts().catch(e=>setMessage(e.message));return()=>{draftVersion.current++;};},[tab,draftPage]);
    async function act(callback:()=>Promise<any>,options:WorkspaceActionOptions={}){
        const account=auth.currentUser?.uid,context=operationContext;
        const sectionLabel=({lesson:'수업 일지',academy:'일지 조회',schedule:'시간표·일정',students:'학생 관리',academic:'성적 관리',curriculum:'커리큘럼',word:'학습 세트',settings:'관리자 설정'} as Record<string,string>)[tab]||'자료';
        const label=options.label||(context.startsWith('lesson-editor:')?`${data?.students?.find((s:any)=>s.studentKey===lesson.studentKey)?.studentDisplayName||'학생'} · 일지`:context.startsWith('schedule-editor:')?scheduleSelection?.record?.data?.title||'일정':sectionLabel);
        setMessage('');
        const task=await operations.run(options.keys||[context,...(recordScope?[recordScope]:[])],label,async()=>{if(auth.currentUser?.uid!==account)throw Error('로그인 계정이 변경되었습니다.');return callback();});
        if(task?.status==='failed'&&auth.currentUser?.uid===account)setMessage(label+' · '+(task.error||'처리 오류'));
    }
    async function selectStudent(studentKey:string,patch:any={},matchEnd=true,savedId?:string) {
        const seed={...emptyLesson(),date:lesson.date,start:lesson.start,end:lesson.end,subject:lesson.subject,...patch,studentKey};
        const touched=new Set<string>();autoTouches.current=touched;sessionHistory.current=[];
        const version=++autoVersion.current;newLessonId.current=crypto.randomUUID();setLesson(seed);setDraftId(null);setRevision(undefined);setMessage('');setSavedLookup(null);
        if(!studentKey){setAutoLoading(false);return;}
        // A card can be matched to a lesson outside the first page of saved lessons: read it by id instead of starting a new one.
        // The card's lesson id wins over a lesson at the same time; without an id, the loaded lesson at that time is used.
        let saved:any=savedId?null:matchingSavedLesson(data?.drafts||[],seed,data?.uid,matchEnd);
        if(savedId){
            setAutoLoading(true);setSavedLookup('loading');lookupRetry.current=()=>void selectStudent(studentKey,patch,matchEnd,savedId);
            const opened=await openTodayLesson(data?.drafts||[],seed,data?.uid,matchEnd,savedId,async id=>(await request('read:draft-records',{ids:id})).records||[]);
            if(version!==autoVersion.current)return;
            if(opened.kind==='failed'){setSavedLookup('failed');return;} // autoLoading stays on: no save or publish until it is read
            setSavedLookup(null);
            if(opened.kind==='saved'){saved=opened.record;if(opened.add)setData((old:any)=>({...old,drafts:[opened.record,...(old.drafts||[]).filter((r:any)=>r.id!==opened.record.id)]}));}
        }
        if(saved){setLesson(compactLessonInput({...emptyLesson(),...saved.data}));setDraftId(saved.id);setRevision(saved.revision);setAutoLoading(false);loadSessionHistory(saved.data);return;}
        setAutoLoading(true);
        try{const previous=await request('previous-lesson',{studentKey,subject:seed.subject,date:seed.date});
            if(version===autoVersion.current){sessionHistory.current=previous.data.sessionRecords||[];setLesson((current:any)=>{const filled=applyPreviousLesson(current,seed,previous.data,touched);return Array.isArray(previous.data.sessionRecords)?autoSessionNumbers(filled,sessionHistory.current,touched).data:filled;});}
        }catch(e){if(version===autoVersion.current)setMessage(e instanceof Error?e.message:'직전 수업을 불러오지 못했습니다.');}
        finally{if(version===autoVersion.current)setAutoLoading(false);}
    }
    function resetLesson(){setSavedLookup(null);autoTouches.current=new Set();sessionHistory.current=[];autoVersion.current++;newLessonId.current=crypto.randomUUID();dismissMessage();setAutoLoading(false);setLesson(emptyLesson());setDraftId(null);setRevision(undefined);}
    function setField(key: string, value: any,manual=true) { dismissMessage();if(manual)autoTouches.current.add(key);setLesson((d: any) => {const next=withStudyDefaults({...d,[key]:value},key);return draftId?editedSessionNumbers(next,data?.drafts?.find((r:any)=>r.id===draftId)?.data,autoTouches.current,sessionHistory.current):sessionHistory.current.length?autoSessionNumbers(next,sessionHistory.current,autoTouches.current).data:next;}); }
    // A saved lesson also loads the earlier lessons, so a counter turned on later (e.g. 자습) can be counted and hinted.
    const [,setHistoryTick]=useState(0);
    // When they arrive, the automatic rounds are counted again (a 자습 turned on meanwhile); rounds typed by hand stay.
    function loadSessionHistory(baseline:any){const version=autoVersion.current,{studentKey,subject,date}=baseline||{};if(!studentKey||!subject||!date)return;void request('previous-lesson',{studentKey,subject,date}).then((p:any)=>{if(version!==autoVersion.current||!sameLessonTarget(latestLesson.current,{studentKey,subject,date}))return; /* the date (or student) changed meanwhile: these are not its earlier lessons */const history=p?.data?.sessionRecords||[];sessionHistory.current=history;setLesson((d:any)=>sameLessonTarget(d,{studentKey,subject,date})?editedSessionNumbers(d,baseline,autoTouches.current,history):d);setHistoryTick(n=>n+1);}).catch(()=>{/* hints only; the lesson stays usable */});}
    function openDraft(d: any) { setSavedLookup(null);autoTouches.current=new Set();sessionHistory.current=[];autoVersion.current++;setAutoLoading(false); setData((old:any)=>({...old,drafts:[d,...old.drafts.filter((r:any)=>r.id!==d.id)]}));setLesson(compactLessonInput({ ...emptyLesson(), ...d.data })); setDraftId(d.id); setRevision(d.revision); setLessonMode('single'); setLessonDialogOpen(true); loadSessionHistory(d.data); }
    const students = data?.students || [];
    // 이달의 장학 쿠폰 badges on the student list (admin): loaded with the list.
    const loadCoupons=async()=>{const r=await request('read:pet-coupons');setCouponRows(r.coupons||[]);};
    useEffect(()=>{if(data?.admin&&tab==='students')void loadCoupons().catch(()=>undefined);},[data?.admin,tab]); // eslint-disable-line react-hooks/exhaustive-deps
    const couponsByStudent=useMemo(()=>{const m:Record<string,PetCouponRow[]>={};for(const c of couponRows)(m[c.studentKey]||=[]).push(c);return m;},[couponRows]);
    // 학생 관리 for the principal and admin: everyone, or only their own assigned students (list and dashboard); remembered on this device.
    const canSeeAll=Boolean(data?.admin||data?.principal);
    const myStudentKeys=useMemo(()=>new Set<string>((data?.teachingScopes||[]).map((s:any)=>s.studentKey)),[data?.teachingScopes]);
    const [studentScope,setStudentScope]=useState<'all'|'mine'>(()=>{try{return localStorage.getItem('studentScope')==='mine'?'mine':'all';}catch{return 'all';}});
    const chooseStudentScope=(next:'all'|'mine')=>{setStudentScope(next);try{localStorage.setItem('studentScope',next);}catch{/* not remembered */}};
    const scopedStudents=canSeeAll&&studentScope==='mine'?students.filter((s:any)=>myStudentKeys.has(s.studentKey)):students;
    const dueStops=useMemo(()=>plannedStops(students,today()).due.length,[students]);
    // 학생 관리: today's lessons and which logs are still unwritten, from what is already in memory (no extra reads).
    const todayMarks=useMemo(()=>{if(!data||todayStudents.uid!==data.uid||todayStudents.date!==today()||!todayStudents.events)return undefined;const records=todayRecords(todayStudents.dayLessons,data.drafts||[]);
     return {lesson:new Set(todayStudents.keys),unwritten:new Set(todayStudents.events.flatMap(event=>event.students.filter(key=>todayLessonState(event,key,records,todayStudents.matchEvents||todayStudents.events)==='미작성')))};},[todayStudents,data?.uid,data?.drafts]);
    // Ctrl/⌘+S saves and Ctrl/⌘+Enter publishes (after the usual confirm) the single lesson editor while it is on screen
    // (not the grid, not under a confirm modal).
    const saveShortcut=useRef<(()=>void)|null>(null),publishShortcut=useRef<(()=>void)|null>(null);
    useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const shortcut=lessonShortcut(e);if(!shortcut)return;
     if(document.querySelector('dialog.confirm-modal[open]'))return;
     if(![...document.querySelectorAll('.lesson-editor-panel')].some(el=>el.getClientRects().length))return;
     e.preventDefault();if(e.repeat)return; /* held key: still no browser dialog, but one save / publish only */if(shortcut==='save')saveShortcut.current?.();else publishShortcut.current?.();};
     window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
    const filtered = students.filter((s: any) => {
        const active = s.subjects?.length ? s.subjects.some((x: any) => (!status || x.status === status) && (!subjectFilter || x.subject === subjectFilter)) : s.enrollmentStatus === status && !subjectFilter;
        return ((!status && !subjectFilter) || active) && `${s.studentDisplayName}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
    const savedDrafts=draftList.records;
    const draftPages=draftList.pages,currentDraftPage=draftList.page;
    const currentDraft = data?.drafts?.find((d: any) => d.id === draftId);
    async function deleteCurrentLesson(){
        if(!currentDraft)return;
        const target=currentDraft,version=autoVersion.current;
        if(!await askConfirm({title:`${target.data.date} ${target.data.subject} 일지를 삭제할까요?`,message:`선택한 일지와 해당 리포트만 숨기며, ${data?.lessonAppMode?'삭제 전 내용은 복구용 기록으로 보관합니다.':'삭제한 일지는 일지 조회의 휴지통에서 7일 동안 복원할 수 있습니다.'}`,confirmText:'삭제',tone:'danger',icon:'trash'}))return;
        void act(async()=>{
            await request('archive-lesson',{id:target.id,revision:target.revision});
            setData((old:any)=>old?{...old,drafts:old.drafts.filter((row:any)=>row.id!==target.id)}:old);
            setDraftList((old:any)=>({...old,records:old.records.filter((row:any)=>row.id!==target.id)}));
            if(autoVersion.current===version){resetLesson();setLessonDialogOpen(false);}
            await refresh();
        },{label:'일지 삭제'});
    }

    const latestLessonJob=[...jobs].reverse().find(job=>job.keys.includes('lesson-editor:'+autoVersion.current)||Boolean(draftId&&job.keys.includes('lesson-record:'+draftId)));
    async function submitSingleLesson(mode:'save'|'publish'){
        if(mode==='publish'&&!await askConfirm({title:'리포트에 반영할까요?',message:'현재 입력 내용을 저장하고 학생·학부모 리포트에 반영해요.',details:[[students.find((s:any)=>s.studentKey===lesson.studentKey)?.studentDisplayName||'학생',lesson.subject,lesson.date].filter(Boolean).join(' · ')],confirmText:'반영하기',icon:'send'}))return;
        const token=autoVersion.current;
        try{
            const outcome=await submitLesson({mode,id:draftId||newLessonId.current,revision,data:lesson,record:currentDraft,request,onSaved:saved=>{
                if(token!==autoVersion.current)return;
                setSavedPulse({id:saved.id,at:Date.now()});setDraftId(saved.id);setRevision(saved.record?.revision);if(saved.record)setLesson(compactLessonInput(saved.record.data));setMessage('앱에 저장했습니다.');
            }});
            if(mode==='publish'&&token===autoVersion.current)setMessage(outcome.warning||(data?.lessonAppMode?'학생·학부모 리포트에 반영했습니다.':'학생·학부모 리포트에 반영했습니다.'));
            return outcome;
        }finally{await refresh();}
    }
    const workspaceHistory = <>{import.meta.env.DEV&&<WorkspaceRequestMetrics/>}{jobs.length?<>{jobs.map(job=><p key={job.id}>{job.label} · {job.status==='running'?'처리 중':job.status==='done'?'요청 처리 완료':'실패'}{job.error&&' · '+job.error}{job.note&&' · '+job.note}</p>)}</>:<p>이번 화면의 작업 내역이 없습니다.</p>}</>;
    const modeSwitch = <LessonModeSwitch value={lessonMode} onChange={setLessonMode}/>;
    // Input changed since this lesson was opened or saved (same rule as closing 수업 작성).
    const lessonDirty=Boolean(autoTouches.current.size)&&JSON.stringify(lesson)!==JSON.stringify(currentDraft?.data);
    useLeaveProtection(lessonDirty||scheduleDirty);
    const publishReady=Boolean(lesson.studentKey&&lesson.content?.trim())&&!['publishing','processing','notion_saved'].includes(currentDraft?.stage)&&!(currentDraft?.stage==='published'&&JSON.stringify(currentDraft?.data)===JSON.stringify(lesson));
    saveShortcut.current=()=>{if(!busy&&!autoLoading)void act(()=>submitSingleLesson('save'));};
    publishShortcut.current=()=>{if(!busy&&!autoLoading&&publishReady)void act(()=>submitSingleLesson('publish'));};
    /** Before another lesson replaces the editor: with unsaved input ask 저장하고 이동 / 저장 안 하고 이동 / 취소. */
    async function leaveLessonGuard(){
        if(busy||!lessonDirty)return true;
        const who=[students.find((s:any)=>s.studentKey===lesson.studentKey)?.studentDisplayName||'학생',lesson.subject,lesson.date?.slice(5).replace('-','/')].filter(Boolean).join(' · ');
        const choice=await ask({title:'저장하지 않은 입력이 있어요',message:`${who} 일지를 저장하지 않고 이동할까요?`,confirmText:'저장하고 이동',altText:'저장 안 하고 이동',icon:'edit'});
        if(choice==='cancel')return false;
        if(choice==='alt')return true;
        let saved=false;await act(async()=>{await submitSingleLesson('save');saved=true;});
        return saved;
    }
    const guarded=(go:()=>unknown)=>{void leaveLessonGuard().then(ok=>{if(ok)void go();});};
    /** Open a lesson from the day's list (row, next button or auto-open). */
    const openDayLesson=(key:string,event:TodayLesson,savedId?:string,manual=true)=>{if(manual)setPickHint(false);if(data?.uid)markAutoOpenDone(data.uid,event.date);guarded(()=>selectStudent(key,{date:event.date,subject:event.subject,start:event.start,end:event.end,...sessionSeed(event,key)},false,savedId));};
    // After 반영: the next unwritten lesson of that day, offered as a button (moving only when pressed).
    const dayRecords=todayStudents.uid===data?.uid&&todayStudents.date===lesson.date&&todayStudents.events?todayRecords(todayStudents.dayLessons,data?.drafts||[]):null;
    const nextAfterPublish=dayRecords&&currentDraft?.stage==='published'&&!lessonDirty?nextUnwrittenLesson(todayStudents.events!,dayRecords,lesson,todayStudents.matchEvents||todayStudents.events):undefined;
    const lessonEditor = <section className="panel lesson-editor-panel"><div className="lesson-panel-heading"><div className="lesson-title-row"><h2>수업 일지</h2><LessonSaveStatus record={currentDraft} dirty={lessonDirty} busy={busy} savedAt={savedPulse?.id===draftId?savedPulse.at:undefined}/><button className="small-button lesson-new-button" type="button" onClick={()=>{setPickHint(false);if(data?.uid)markAutoOpenDone(data.uid,lessonDay);guarded(resetLesson);}}>+ 새 일지</button>{pickHint&&<span className="lesson-pick-hint" role="note"><Info size={13} aria-hidden="true"/>왼쪽에서 수업을 고르세요</span>}<AudienceLegend/></div>{tab==='lesson'&&modeSwitch}</div><div className="lesson-form-layout"><div className="lesson-area-basics"><div className="lesson-top-fields"><StudentCombobox students={students} value={lesson.studentKey} disabled={Boolean(managementStudentKey)&&tab==='students'} todayKeys={todayStudents.uid===data?.uid&&todayStudents.date===today()?todayStudents.keys:[]} onChange={key=>{setPickHint(false);guarded(()=>selectStudent(key));}}/><fieldset disabled={busy}><label>날짜<input type="date" value={lesson.date} onChange={e=>setField('date',e.target.value)}/></label></fieldset><fieldset disabled={busy}><label>과목<select value={lesson.subject} onChange={e => {const subject=e.target.value;guarded(()=>selectStudent(lesson.studentKey,{subject}));}}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label></fieldset></div></div><fieldset className="lesson-editor-fields lesson-form-fields" disabled={busy||Boolean(savedLookup)}><div className="lesson-first-band"><div className="lesson-area-schedule">{savedLookup==='failed'?<p role="alert" className="text-xs text-rose-600 my-2">저장된 일지를 불러오지 못했어요. 새 일지를 만들지 않았어요. <button type="button" className="small-button ml-1" onClick={()=>lookupRetry.current?.()}>다시 시도</button></p>:savedLookup==='loading'?<p role="status" className="text-xs text-slate-500 my-2">저장된 일지를 불러오는 중…</p>:autoLoading&&<p role="status" className="text-xs text-slate-500 my-2">직전 수업의 회차·내용·과제를 불러오는 중…</p>}<LessonAcademyFields value={lesson} error={fieldDisclosureError(message,'study')} roundHints={roundHintsFor(lesson,sessionHistory.current,autoTouches.current,draftId?currentDraft?.data:null)} onChange={setField} regularTime={regularLessonTime(data,lesson.studentKey,lesson.subject,lesson.date,today())}/>
   </div><div className="lesson-area-content lesson-content-split"><label className="lesson-text-field lesson-content-main"><span className="lesson-label-line">수업 내용<span className="text-xs text-rose-600 ml-1">(필수)</span><AudienceTag to={LESSON_AUDIENCE.content}/></span><AutoTextarea required aria-required="true" value={lesson.content || ''} onChange={e => setField('content', e.target.value)}/></label><label className="lesson-text-field lesson-content-note"><span className="lesson-label-line">특이 사항<OptionalMark/><AudienceTag to={LESSON_AUDIENCE.specialNote}/></span><AutoTextarea minRows={1} maxRows={5} value={lesson.specialNote || ''} onChange={e => setField('specialNote', e.target.value)}/></label></div></div><div className="lesson-second-band"><div className="lesson-area-assessment"><div className="lesson-evaluation-heading"><h3>출결·평가</h3><span className="lesson-bulk-buttons">{(['상','중'] as const).map(level=><button key={level} type="button" className="small-button" onClick={() => {autoTouches.current.add('attendance');setLesson((d: any) => {const next={...d,attendance:'출석',attitude:level,homework:level};return draftId?editedSessionNumbers(next,data?.drafts?.find((r:any)=>r.id===draftId)?.data,autoTouches.current):sessionHistory.current.length?autoSessionNumbers(next,sessionHistory.current,autoTouches.current).data:next;});}}>출석·태도·숙제 일괄 {level}</button>)}</span></div>
   <div className="lesson-evaluation-fields">{lessonOptionGroups.map(group=><div key={group.key}><ChipGroup label={group.label} tag={<AudienceTag to={LESSON_AUDIENCE[group.key]}/>} options={group.options} value={lesson[group.key]||''} disabled={busy} splitAt={'splitAt' in group?group.splitAt:undefined} onChange={value=>setField(group.key,value)}/></div>)}</div>
   <LessonTests value={lesson} error={fieldDisclosureError(message,'scores')} onChange={setField}/>
   </div><div className="lesson-area-extras lesson-extras-stack"><label className="lesson-text-field"><span className="lesson-label-line">과제<OptionalMark/><AudienceTag to={LESSON_AUDIENCE.assignment}/></span><AutoTextarea value={lesson.assignment || ''} onChange={e => setField('assignment', e.target.value)}/></label><TeacherOnlyFields value={lesson} onChange={setField}/>{(lesson.note || lesson.nextPlan) && <div className="mt-3 text-xs text-slate-500"><p className="font-semibold">기존 기록 메모</p>{lesson.note && <p className="whitespace-pre-wrap mt-2">기존 개인 피드백: {lesson.note}</p>}{lesson.nextPlan && <p className="whitespace-pre-wrap mt-2">기존 다음 수업 메모: {lesson.nextPlan}</p>}</div>}
   
   </div></div></fieldset></div> {canRetryPublication(currentDraft) && <div className="mt-3"><p className="text-xs text-slate-500">저장한 요청의 반영 결과를 확인합니다. 이후 화면에서 바꾼 입력은 이 재시도에 포함하지 않습니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{const result=await request('publish',{id:currentDraft.id});setMessage(result.warning || '저장한 수업일지 반영을 확인했습니다.');}finally{await refresh();}})}>저장 결과 확인·재시도</button></div>}{busy && <p role="status" className="text-xs mt-3">저장·반영 처리 중입니다. 창을 닫아도 처리는 계속됩니다.</p>}<LessonActionBar statusInTitle extra={<><LessonPreviewButton disabled={!lesson.studentKey} onClick={()=>setParentPreview(true)}/>{nextAfterPublish?<button type="button" className="lesson-next-lesson" onClick={()=>openDayLesson(nextAfterPublish.key,nextAfterPublish.event,todayLessonRecord(nextAfterPublish.event,nextAfterPublish.key,dayRecords!,todayStudents.matchEvents||todayStudents.events)?.id)}>다음: {(students.find((s:any)=>s.studentKey===nextAfterPublish.key)?.studentDisplayName||'학생').replace(/\s*\(.*\)\s*$/,'')} {nextAfterPublish.event.start}<ArrowRight size={14} aria-hidden="true"/></button>:null}</>} more={<><button type="button" className="lesson-more-item" disabled={busy} onClick={() => act(refresh)}><RefreshCw size={15} aria-hidden="true"/>새로고침</button><LessonDeleteButton viewer={data} record={currentDraft} busy={busy||autoLoading} onDelete={deleteCurrentLesson}/></>} savedAt={savedPulse?.id===draftId?savedPulse.at:undefined} failureReason={!busy&&(latestLessonJob?.status==='failed'||currentDraft?.stage==='failed')?latestLessonJob?.error||currentDraft?.failureMessage||message||'반영 결과를 확인하고 다시 시도해 주세요.':undefined} onRetry={()=>act(()=>submitSingleLesson('save'))} retryDisabled={busy||autoLoading} status={lessonRecordStatus(currentDraft,busy,Boolean(currentDraft&&JSON.stringify(currentDraft.data)!==JSON.stringify(lesson)))} reason={busy?'현재 기록을 처리하고 있어요':savedLookup==='failed'?'저장된 일지를 불러오지 못했어요':savedLookup==='loading'?'저장된 일지를 불러오는 중이에요':autoLoading?'직전 수업을 불러오는 중이에요':!lesson.studentKey?'학생을 선택하면 반영할 수 있어요':!lesson.content?.trim()?'수업 내용을 입력하면 반영할 수 있어요':['publishing','processing','notion_saved'].includes(currentDraft?.stage)?'이미 반영 중인 기록이에요':currentDraft?.stage==='published'&&JSON.stringify(currentDraft.data)===JSON.stringify(lesson)?'이미 반영 완료된 기록이에요':undefined} refresh={<button type="button" disabled={busy} className="lesson-refresh-button" aria-label="새로고침" title="새로고침" onClick={() => act(refresh)}><RefreshCw size={15} aria-hidden="true"/><span className="lesson-refresh-label" aria-hidden="true">새로고침</span></button>}><button disabled={busy||autoLoading} className={publishReady?'small-button':'primary-button'} onClick={() => act(()=>submitSingleLesson('save'))}>{busy&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}저장<ShortcutKey keys="S"/></button><button disabled={busy || autoLoading || !publishReady} className={publishReady?'primary-button':'small-button'} onClick={() => act(()=>submitSingleLesson('publish'))}>{busy&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}반영<ShortcutKey keys="Enter"/></button><LessonDeleteButton viewer={data} record={currentDraft} busy={busy||autoLoading} onDelete={deleteCurrentLesson}/></LessonActionBar>{parentPreview&&<Suspense fallback={null}><LessonParentPreview lesson={lesson} studentName={(students.find((s:any)=>s.studentKey===lesson.studentKey)?.studentDisplayName||'').replace(/\s*\(.*\)\s*$/,'')} onClose={()=>setParentPreview(false)}/></Suspense>}</section>;
    return <div className={`teacher-workspace max-w-6xl mx-auto px-4 py-5 md:p-8 ${tab==='lesson'?'lesson-writing':''} ${tab==='schedule'?'schedule-active':''}`}>
  <WorkspaceNavigation tab={tab} onTab={next=>{if(tab==='students'&&studentAttemptRef.current)studentAttemptRef.current(()=>setTab(next));else setTab(next);}} admin={data?.admin} principal={data?.principal} date={today()} history={workspaceHistory}/>
  {/* 중단 예약: from the day the planned date comes until it is decided, every visit shows this on any tab. */}
  {(data?.admin||data?.principal)&&dueStops>0&&!(tab==='students'&&studentView==='students'&&!managementStudentKey)&&<div className="stop-banner" role="status"><span>중단 예정일이 지난 학생 <b>{dueStops}</b>명 · 중단할지 정해 주세요</span><button type="button" className="small-button" onClick={()=>{const go=()=>{setTab('students');setStudentView('students');setManagementStudentKey('');};if(tab==='students'&&studentAttemptRef.current)studentAttemptRef.current(go);else go();}}>확인하기</button></div>}

  {sectionLoading&&data&&<p role="status" className="text-sm text-slate-500 mb-3">자료를 불러오는 중…</p>}{message && <WorkspaceToast message={message} onClose={dismissMessage}/>}{jobs.some(job=>job.status==='running')&&<p role="status" className="workspace-job-status">처리 중: {jobs.filter(job=>job.status==='running').map(job=>job.label).join(' · ')} · 다른 기록을 작업할 수 있습니다.</p>}
  {!data ? bootstrapError ? <div className="panel text-sm text-slate-500"><p>{bootstrapError}</p><button className="small-button mt-3" disabled={busy} onClick={() => act(refresh)}>다시 불러오기</button></div> : <WorkspaceSkeleton/> : <>
  <div hidden={tab !== 'lesson'}><div hidden={lessonMode !== 'grid'}><TeacherLessonGrid headingActions={modeSwitch} isRecordBusy={id=>operations.busy('lesson-record:'+id)} active={tab==='lesson'&&lessonMode==='grid'} data={data} busy={busy} request={request} refresh={refresh} act={act}/></div></div>
  
  {((tab === 'lesson' && lessonMode === 'single') || lessonDialogOpen) && <div className="lesson-writing-layout">
   <aside hidden={lessonDialogOpen} className="space-y-3 lesson-writing-sidebar"><TeacherTodayLessons selection={lesson} onNewLesson={()=>guarded(resetLesson)} data={data} date={lessonDay} onDate={setLessonDay} onEvents={receiveTodayLessons} active={tab==='lesson'&&lessonMode==='single'&&!lessonDialogOpen} request={request} disabled={false} onStudent={(key,event,savedId)=>openDayLesson(key,event,savedId)} autoOpen={tab==='lesson'&&lessonMode==='single'&&!lessonDialogOpen&&lessonDay===today()&&!lesson.studentKey&&!autoTouches.current.size&&!autoOpenDone(data.uid,lessonDay)} onAutoOpen={(key,event,savedId)=>{setPickHint(true);openDayLesson(key,event,savedId,false);}}/>

    <section className="panel"><h2>저장한 기록</h2><button onClick={() => guarded(resetLesson)} className="small-button">+ 새 수업</button>{draftLoading&&<p role="status" className="text-xs text-slate-500">저장한 기록을 불러오는 중…</p>}{savedDrafts.map((d: any) => <button key={d.id} className="saved-lesson-row" onClick={() => guarded(()=>openDraft(d))}><span className="saved-lesson-name" title={students.find((s:any)=>s.studentKey===d.data.studentKey)?.studentDisplayName}>{students.find((s: any) => s.studentKey === d.data.studentKey)?.studentDisplayName}</span><span className="saved-lesson-date">{d.data.date}</span><StatusBadge kind={statusKind(lessonRecordStatus(d))} text={stageLabel[d.stage]}/></button>)}<div className="review-pagination"><button disabled={draftLoading||currentDraftPage===1} onClick={()=>setDraftPage(currentDraftPage-1)}>이전</button><span>{currentDraftPage} / {draftPages}</span><button disabled={draftLoading||currentDraftPage===draftPages} onClick={()=>setDraftPage(currentDraftPage+1)}>다음</button></div></section>
   </aside>
   <LessonEditorContainer modal={lessonDialogOpen} onClose={()=>setLessonDialogOpen(false)}>{lessonEditor}</LessonEditorContainer>
  </div>}
  <div className="schedule-workspace-page" hidden={tab !== 'schedule'}><ScheduleViewHeader view={scheduleView} onView={setScheduleView} count={data.classes?.length||0} disabled={busy} onCreate={()=>scheduleView==='dated'?createScheduleRef.current?.():createClassRef.current?.()}/><TeacherWeeklyCalendar hidden={scheduleView!=='dated'} createRef={createScheduleRef} data={data} busy={busy} request={request} active={tab==='schedule'} onAdd={date => openSchedule(date)} onEdit={record => {if((record.source==='notion'||record.notionPageId)&&!record.deleteRequested&&!canRetryPublication(record)){void act(async()=>{const result=await request('import-source-record',{id:record.notionPageId||record.id,kind:'schedule'});setData((old:any)=>({...old,schedules:[result.record,...old.schedules.filter((r:any)=>r.id!==result.record.id&&r.notionPageId!==result.record.notionPageId)]}));openSchedule(result.record.data.date,result.record);});}else openSchedule(record.data.date,record);}} onRegular={() => {}}/><div ref={scheduleEditorRef}><WorkspaceDialog open={Boolean(scheduleSelection) && tab==='schedule'} title="일정 추가·수정" onClose={async () => { if (scheduleWorking || !scheduleDirty || await askDiscard('저장하지 않은 변경을 취소하고 닫을까요?')) { setScheduleSelection(undefined); setScheduleDirty(false); } }}>{scheduleSelection && <TeacherScheduleEditor data={data} busy={busy} request={request} refresh={refresh} act={act} selection={scheduleSelection} onSelection={record=>{setScheduleSelection({date:record.data.date,record,nonce:++scheduleNonce.current});setScheduleDirty(false);}} onNotice={setMessage} onDirty={handleScheduleDirty} onClose={async () => { if (scheduleWorking || !scheduleDirty || await askDiscard('저장하지 않은 변경을 취소하고 닫을까요?')) {
            setScheduleSelection(undefined);
            setScheduleDirty(false);
        } }}/>}</WorkspaceDialog></div><div ref={regularRef}><TeacherClassManager view={scheduleView} createRef={createClassRef} data={data} busy={busy} request={request} refresh={refresh} act={act} active={tab==='schedule'} mode="schedule"/></div></div>
  {tab === 'academic' && <Suspense fallback={<p className="text-sm text-slate-500">성적 관리 준비 중…</p>}><TeacherAcademicManager data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'academy' && <Suspense fallback={<p className="text-sm text-slate-500">학원 기록 준비 중…</p>}><AcademyLessonReview refreshVersion={teacherReadGeneration()} onEdit={openDraft} onOpenStudent={key=>{setTab('students');setStudentView('students');setManagementInitialTab('review');setManagementStudentKey(key);window.scrollTo({top:0});}} data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab==='students'&&<div className="student-view-switch"><div className="rv-seg" role="group" aria-label="학생 관리 보기"><button type="button" aria-pressed={studentView==='students'} onClick={()=>setStudentView('students')}>학생</button><button type="button" aria-pressed={studentView==='classes'} onClick={()=>setStudentView('classes')}>반 관리 <b>{data.classes?.length||0}</b></button></div>{studentView==='classes'&&<button type="button" className="primary-button" disabled={busy} onClick={()=>studentClassRef.current?.()}>+ 새 반</button>}</div>}
  {/* 반 관리 is reachable from 학생 관리 too: the same class cards and editor as the schedule tab. */}
  {tab==='students'&&studentView==='classes'&&<TeacherClassManager view="classes" createRef={studentClassRef} data={data} busy={busy} request={request} refresh={refresh} act={act} active mode="schedule"/>}
  {tab==='students'&&studentView==='students'&&<section ref={studentListRef} className="student-dashboard-shell"><div className="student-dashboard"><aside className="student-master-panel"><StudentMasterPanel onPet={key=>setPetViewKey(key)} coupons={couponsByStudent} onCoupon={key=>setCouponKey(key)} registrations={data.admin||data.principal?{count:intakeCount,onAdd:()=>setIntakeStart(n=>n+1),render:(query,active)=><Suspense fallback={<p className="report-caption">상담·신입생을 불러오는 중…</p>}><StudentRegistrationManager query={query} active={active} startSignal={intakeStart} onCount={setIntakeCount} coreMode={Boolean(data.coreMode)} students={students} key={data.uid + ':' + data.academyId} onSynced={async()=>{invalidateTeacherReads('sync-student-registration');const fresh=await request('read:bootstrap',{section:'students',force:'1'});mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}}/></Suspense>}:undefined} scope={canSeeAll?{value:studentScope,mine:students.filter((s:any)=>myStudentKeys.has(s.studentKey)).length,onChange:chooseStudentScope}:undefined} students={scopedStudents} today={todayMarks} value={managementStudentKey} onSelect={key=>{const change=()=>{setMessage('');setManagementInitialTab('review');setManagementStudentKey(key);};if(key===managementStudentKey)return;if(studentAttemptRef.current)studentAttemptRef.current(change);else change();}}/></aside><div className="student-dashboard-detail">  {tab==='students' && managementStudentKey && students.some((s:any)=>s.studentKey===managementStudentKey) ? <div key={data.uid+':'+managementStudentKey}><StudentManagementDialog inline registerAttempt={registerStudentAttempt} summary={<><StudentSummary student={students.find((s:any)=>s.studentKey===managementStudentKey)} unwritten={Boolean(todayMarks?.unwritten.has(managementStudentKey))} lessonToday={Boolean(todayMarks?.lesson.has(managementStudentKey))} showLink={!(data.admin&&data.academyId==='main')} onSince={(subject,since)=>act(async()=>{await request('set-assignment-start',{uid:data.uid,studentKey:managementStudentKey,subject,since});await refresh();})}/>{managementStudentKey&&<>{students.find((s:any)=>s.studentKey===managementStudentKey)?.look?.pet&&<button type="button" className="small-button mt-2" onClick={()=>setPetViewKey(managementStudentKey)}>🐾 펫 보기</button>}<StudentPartyCard studentKey={managementStudentKey} request={request}/></>}</>} headerExtra={data.admin&&data.academyId==='main'?<><StudentAccountLink studentKey={managementStudentKey} studentName={students.find((s:any)=>s.studentKey===managementStudentKey)?.studentDisplayName||'학생'} linkedUid={students.find((s:any)=>s.studentKey===managementStudentKey)?.linkedFirebaseUid||null} onChanged={async()=>{invalidateTeacherReads('student-link');const fresh=await request('read:bootstrap',{section:'students',force:'1'});mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}}/><ParentLinkControl studentKey={managementStudentKey} studentName={students.find((s:any)=>s.studentKey===managementStudentKey)?.studentDisplayName||'학생'}/></>:undefined} initialTab={managementInitialTab} name={students.find((s:any)=>s.studentKey===managementStudentKey)?.studentDisplayName||'학생'} canManage={Boolean(data.admin||data.principal)} busy={busy||autoLoading} notice={message} onClose={()=>{autoVersion.current++;setAutoLoading(false);setManagementStudentKey('');}} onSelect={next=>{if(next==='lesson'){const student=students.find((s:any)=>s.studentKey===managementStudentKey);guarded(()=>selectStudent(managementStudentKey,{subject:data.teachingScopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||data.scopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||student?.subjects?.[0]?.subject||'영어'}));}}} render={(active,leave,headerId)=><Suspense fallback={<p role="status" className="text-sm text-slate-500">학생 관리 정보를 불러오는 중…</p>}>
  {active==='profile' && (data.admin||data.principal) ? <StudentProfileEditor key={data.uid+':'+profileStudentKey} studentKey={profileStudentKey} onClose={leave} onSaved={profile=>{const key=profileStudentKey;setProfileStudentKey('');invalidateTeacherReads('save-student-profile');setData((old:any)=>({...old,students:old.students.map((s:any)=>s.studentKey===key?{...s,studentDisplayName:profile.displayName,hasGuardianContact:Boolean(profile.guardianPhone)}:s)}));setMessage('학생 정보를 저장했습니다. 보호자 번호를 바꾼 경우 새 번호 뒤 4자리로 인증해 주세요.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('학생 정보는 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='admission' && (data.admin||data.principal) ? <StudentAdmissionEditor studentKey={managementStudentKey} onClose={leave}/> : null}
  {active==='enrollment' && (data.admin||data.principal) ? <StudentEnrollmentEditor key={data.uid+':'+enrollmentStudentKey} studentKey={enrollmentStudentKey} onClose={leave} onSaved={()=>{setEnrollmentStudentKey('');invalidateTeacherReads('save-student-enrollment');setMessage('수강·담당·소속반 변경을 저장했습니다.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(uid,'workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('수강 변경은 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='message' ? <TeacherMessageComposer key={data.uid+':'+messageStudentKey} studentKey={messageStudentKey} subjects={students.find((s:any)=>s.studentKey===messageStudentKey)?.subjects?.map((s:any)=>s.subject)||[]} onClose={leave}/> : null}
  {active==='review' ? <WorkspaceDialog open title="학습 리포트" onClose={async()=>{if(reviewDirty.current&&!await askDiscard(UNSAVED_EVALUATION_MESSAGE))return;reviewDirty.current=false;leave();}}><TeacherReportReview students={students} initialStudentKey={managementStudentKey} showStudentPicker={false} embedded headerTarget={headerId} onDirtyChange={dirty=>{reviewDirty.current=dirty;}}/></WorkspaceDialog> : null}
  {active==='lesson' ? <WorkspaceDialog open title="수업 작성" onClose={async()=>{if(!await leaveLessonGuard())return;autoVersion.current++;setAutoLoading(false);leave();}}>{lessonEditor}</WorkspaceDialog> : null}
  </Suspense>}/></div> : <StudentOverview students={scopedStudents} intakeCount={data.admin||data.principal?intakeCount:undefined} onEnrollmentChanged={data.admin||data.principal?async()=>{invalidateTeacherReads('save-student-enrollment');const fresh=await request('read:bootstrap',{section:'students',force:'1'});mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}:undefined}/>}
</div></div></section>}
  {tab === 'curriculum' && <TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} mode="curriculum"/>}
  {tab === 'word' && <section className="panel"><h2>내 학습 세트 관리</h2><div className="set-tabs" role="tablist" aria-label="관리할 세트 종류">{([['word', '단어장', '단어 암기·테스트'], ['grammar', '문법 세트', '문법 개념·문제'], ['exam', '시험기간', '시험 대비 묶음'], ['sentence', '문장 세트', '문장 배열·낭독']] as const).map(([value, label, hint]) => <button key={value} type="button" role="tab" className="set-tab" aria-selected={setCategory === value} onClick={() => setSetCategory(value)}><strong>{label}</strong><small>{hint}</small></button>)}</div><Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager key={setCategory} category={setCategory}/></Suspense></section>}
  {/* After the app-only switch the settings tab is for everyday management; migration tools move into one collapsed section. */}
  {couponKey&&(couponsByStudent[couponKey]||[]).length>0&&<PetCouponDialog name={(students.find((s:any)=>s.studentKey===couponKey)?.studentDisplayName||'학생').replace(/\s*\(.*\)$/,'')} coupons={couponsByStudent[couponKey]} busy={busy} onClose={()=>setCouponKey('')} onPaid={(c,paid)=>void act(async()=>{await request('coupon-paid',{id:c.id,paid});await loadCoupons();})}/>}
  {petViewKey&&<TeacherPetView studentKey={petViewKey} name={(students.find((s:any)=>s.studentKey===petViewKey)?.studentDisplayName||'학생').replace(/\s*\(.*\)$/,'')} request={request} onClose={()=>setPetViewKey('')}/>}
  {tab === 'workbook' && <Suspense fallback={<WorkspaceSkeleton/>}><WorkbookMaker request={request}/></Suspense>}
  {tab === 'settings' && (data.admin || data.principal) && data.coreMode && <AdminDashboard data={data} request={request} act={act} busy={busy} refresh={refresh}/>}
  {tab === 'settings' && !data.coreMode && (data.admin || data.principal) && <LessonRestorePanel request={request} act={act} busy={busy} students={data.students} staff={data.staff} onRestored={refresh}/>}
  </>}
 </div>;
}

function LessonEditorContainer({modal,onClose,children}:{modal:boolean;onClose:()=>void;children:ReactNode}) {return modal?<WorkspaceDialog open title="일지 수정" onClose={onClose}>{children}</WorkspaceDialog>:<>{children}</>;}

















