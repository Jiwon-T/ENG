import ScheduleTransitionPanel from './ScheduleTransitionPanel';
import LessonMigrationPanel from './LessonMigrationPanel';
import LessonRestorePanel from './LessonRestorePanel';
import NotionDisconnectPanel from './NotionDisconnectPanel';
import StudentMasterPanel from './StudentMasterPanel';
import ScheduleViewHeader,{type ScheduleView} from './ScheduleViewHeader';
import WorkspaceNavigation from './WorkspaceNavigation';
import LessonModeSwitch from './LessonModeSwitch';
import StatusBadge,{statusKind} from './StatusBadge';
import {fieldDisclosureError} from '../../lib/lessonDisclosure';
import AutoTextarea from './AutoTextarea';
import {autoSessionNumbers,editedSessionNumbers} from '../../lib/sessionNumbers';
import WorkspaceRequestMetrics from './WorkspaceRequestMetrics';
import {beginWorkspaceRequest,finishWorkspaceRequest,clearWorkspaceRequestMetrics} from '../../lib/workspaceRequestMetrics';
import {regularLessonTime} from '../../lib/lessonTimePresets';
import StudentCombobox from './StudentCombobox';
import type {TodayLesson} from '../../lib/teacherTodayLessons';
import ChipGroup from './ChipGroup';
import {lessonOptionGroups} from '../../lib/lessonOptions';
import LessonActionBar from './LessonActionBar';
import LessonDeleteButton from './LessonDeleteButton';
import {stageLabel,lessonRecordStatus} from '../../lib/lessonPresentation';
import {submitLesson} from '../../lib/lessonSubmission';
import {createWorkspaceOperations,type WorkspaceActionOptions,type WorkspaceOperation} from '../../lib/workspaceOperations';
import {upsertWorkspaceRecord} from '../../lib/workspaceRecords';
import {useWorkspaceNotice} from '../../lib/useWorkspaceNotice';
import StudentManagementCard from './StudentManagementCard';
import StudentManagementDialog from './StudentManagementDialog';
import TeacherAssignmentManager from './TeacherAssignmentManager';
import TeacherManager from './TeacherManager';
import AppTemplateManager from './AppTemplateManager';
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
import { lazy, Suspense, useCallback,useEffect, useRef, useState, type ReactNode } from 'react';
import { auth } from '../../lib/firebase';
import {onAuthStateChanged} from 'firebase/auth';
import { BookOpen, CalendarDays, ClipboardList, Users, Settings, RefreshCw, LoaderCircle } from 'lucide-react';
const TeacherIntegrityAudit = lazy(() => import('./TeacherIntegrityAudit'));
const StudentEnrollmentEditor = lazy(() => import('./StudentEnrollmentEditor'));
const TeacherMessageComposer = lazy(() => import('./TeacherMessageComposer'));
const StudentProfileEditor = lazy(() => import('./StudentProfileEditor'));
const StudentRegistrationManager = lazy(() => import('./StudentRegistrationManager'));
const TeacherAcademicManager = lazy(() => import('./TeacherAcademicManager'));
const AcademyLessonReview = lazy(() => import('./AcademyLessonReview'));
const WordbookManager = lazy(() => import('./WordbookManager'));
import './teacherWorkspace.css';
import './lessonCutover.css';
import './reviewRedesign.css';
import './scheduleWorkspace.css';
import TeacherReportReview from './TeacherReportReview';
import TeacherLessonGrid from './TeacherLessonGrid';
import {matchingSavedLesson} from '../../lib/teacherLessonGrid';
import TeacherScheduleEditor from './TeacherScheduleEditor';
const subjects = ['영어', '수학', '국어', '과학', '한국사'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const emptyLesson = () => ({ studentKey: '', subject: '영어', date: today(), start: '14:00', end: '15:30', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', wrong:null as number | null,examWrong:null as number | null,correct: null, total: null, examCorrect: null, examTotal: null, round: null, classSession: '있음', selfStudy: '미확인', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null, attendanceNote: '', specialNote: '' });
const errors: any = { UNAUTHORIZED: '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.', SESSION_REVOKED: '로그인이 해제되었습니다. 다시 로그인해 주세요.', TEACHER_NOTION_LINK_REQUIRED: '관리자 설정에서 선생님 정보를 확인해 주세요.', TEACHER_NOT_CONFIGURED: '관리자가 담당 학생과 과목을 연결하면 사용할 수 있습니다.', SOURCE_IDENTITY_LOCKED: '반영된 기록의 학생·과목은 바꿀 수 없습니다. 새 수업으로 작성해 주세요.', INVALID_INPUT: '입력한 날짜, 시간, 점수와 필수 항목을 확인해 주세요.', FORBIDDEN: '이 자료에 접근할 권한이 없습니다.', DRAFT_CONFLICT: '다른 화면에서 수정되었습니다. 새로고침 후 확인해 주세요.', PUBLISH_IN_PROGRESS: '반영 중입니다. 잠시 후 새로고침해 주세요.', NOTION_SCHEMA_SETUP_REQUIRED: '관리자 설정에서 수업 일지 연결을 준비해 주세요.', MAKE_SUBJECT_NOT_CONFIGURED: '이 과목은 아직 반영 연결이 준비되지 않았습니다.', MAKE_TRIGGER_NOT_CONFIGURED: '수업 일지의 반영 연결을 확인해야 합니다.' };
export default function TeacherWorkspace({ onNavigate, onAccounts }: {
    onNavigate?: (view: any) => void;
    onAccounts?: () => void;
}) {
    const [savedPulse,setSavedPulse]=useState<{id:string;at:number}|null>(null);
    const [scheduleView,setScheduleView]=useState<ScheduleView>('dated');
    const createScheduleRef=useRef<(()=>void)|null>(null),createClassRef=useRef<(()=>void)|null>(null);
    const [lessonDay,setLessonDay]=useState(today);
    const [todayStudents,setTodayStudents]=useState<{uid:string;date:string;keys:string[]}>({uid:"",date:"",keys:[]});
    const receiveTodayLessons=useCallback((events:TodayLesson[],uid:string,date:string)=>setTodayStudents({uid,date,keys:[...new Set(events.flatMap(event=>event.students))]}),[]);
    const sessionHistory=useRef<any[]>([]);const autoTouches=useRef(new Set<string>());const autoVersion=useRef(0);const [autoLoading,setAutoLoading]=useState(false);
    useEffect(()=>()=>{autoVersion.current++;},[]);
    const [draftPage,setDraftPage]=useState(1),[draftList,setDraftList]=useState<any>({records:[],page:1,pages:1,total:0}),[draftLoading,setDraftLoading]=useState(false);
    const [sectionLoading,setSectionLoading]=useState(false);
    const dirtyResources=useRef(new Set<string>());
    const loadVersion=useRef(0),draftVersion=useRef(0);
    const activeTab=useRef('lesson');
    const [lessonDialogOpen,setLessonDialogOpen]=useState(false);
 const studentAttemptRef=useRef<null|((action:()=>void)=>void)>(null);
 const registerStudentAttempt=useCallback((attempt:(action:()=>void)=>void)=>{studentAttemptRef.current=attempt;return()=>{if(studentAttemptRef.current===attempt)studentAttemptRef.current=null;};},[]);
 const [managementInitialTab,setManagementInitialTab]=useState('review');
    const [lessonMode, setLessonMode] = useState<'single' | 'grid'>('single'), [managementStudentKey,setManagementStudentKey]=useState('');
    const profileStudentKey=managementStudentKey, enrollmentStudentKey=managementStudentKey, messageStudentKey=managementStudentKey;
    const setProfileStudentKey=setManagementStudentKey, setEnrollmentStudentKey=setManagementStudentKey;
    const [data, setData] = useState<any>(null), [tab, setTab] = useState('lesson');
    activeTab.current=tab;
    const [lesson, setLesson] = useState<any>(emptyLesson), [draftId, setDraftId] = useState<string | null>(null), [revision, setRevision] = useState<number | undefined>();
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
    function openSchedule(date: string, record?: any) { if (busy)
        return; if (scheduleDirty && !window.confirm('저장하지 않은 일정 변경을 취소하고 다른 일정을 열까요?'))
        return; setScheduleSelection(previous => ({ date, record, nonce: ++scheduleNonce.current })); setScheduleDirty(false);  }
    const [setCategory, setSetCategory] = useState<'word' | 'grammar' | 'exam'>('word');
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
        if(posting&&action!=='previous-lesson'&&action!=='report-review') {
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
    function mergeData(fresh:any){setData((old:any)=>({...{classes:[],curricula:[],drafts:[],schedules:[],reflectedSchedules:[],staff:[],access:[],notionSources:[],notionIssues:[]},...old,...fresh,students:fresh.students?.map((s:any)=>({...old?.students?.find((student:any)=>student.studentKey===s.studentKey),...s}))||old?.students||[]}));}
    async function loadDrafts(force=false){
        const version=++draftVersion.current;setDraftLoading(true);await auth.authStateReady();
        const key='drafts-page:'+draftPage,uid=auth.currentUser?.uid||'';
        const cached=teacherCachedRead(uid,key),generation=teacherReadGeneration();if(cached)setDraftList(cached);
        try{const r=await request('read:drafts-page',{page:draftPage,force:force?'1':undefined});if(version!==draftVersion.current)return;setDraftList(r);teacherCacheRead(uid,key,r,generation);setData((old:any)=>old?{...old,drafts:[...r.records,...old.drafts.filter((d:any)=>!r.records.some((row:any)=>row.id===d.id))]}:old);}finally{if(version===draftVersion.current)setDraftLoading(false);}
    }
    async function refresh() {
        const changes=[...dirtyResources.current];dirtyResources.current.clear();
        if(changes.length&&changes.every(action=>['save-draft','publish','save-schedule','publish-schedule','save-class-status'].includes(action)))return;
        const changed=changes[0]||'';
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
                    mergeData(value);setSectionLoading(false);setBootstrapError('' );
                    if(isFresh)teacherCacheRead(uid,'workspace:'+section,value,generation);
                },
            });
        })().catch(e=>{if(live&&version===loadVersion.current){setBootstrapError(e.message);setMessage(e.message);}}).finally(()=>{if(live&&version===loadVersion.current)setSectionLoading(false);});
        return()=>{live=false;};
    },[tab,authEpoch]);
    useEffect(()=>{if(tab==='lesson')void loadDrafts().catch(e=>setMessage(e.message));return()=>{draftVersion.current++;};},[tab,draftPage]);
    async function act(callback:()=>Promise<any>,options:WorkspaceActionOptions={}){
        const account=auth.currentUser?.uid,context=operationContext;
        const sectionLabel=({lesson:'수업 일지',academy:'일지 조회',schedule:'시간표·일정',students:'학생 관리',academic:'성적 관리',curriculum:'커리큘럼',word:'학습 세트',settings:'관리자 설정'} as Record<string,string>)[tab]||'자료';
        const label=options.label||(context.startsWith('lesson-editor:')?`${data?.students?.find((s:any)=>s.studentKey===lesson.studentKey)?.studentDisplayName||'학생'} · 일지`:context.startsWith('schedule-editor:')?scheduleSelection?.record?.data?.title||'일정':sectionLabel);
        setMessage('');
        const task=await operations.run(options.keys||[context,...(recordScope?[recordScope]:[])],label,async()=>{if(auth.currentUser?.uid!==account)throw Error('로그인 계정이 변경되었습니다.');return callback();});
        if(task?.status==='failed'&&auth.currentUser?.uid===account)setMessage(label+' · '+(task.error||'처리 오류'));
    }
    async function selectStudent(studentKey:string,patch:any={},matchEnd=true) {
        const seed={...emptyLesson(),date:lesson.date,start:lesson.start,end:lesson.end,subject:lesson.subject,...patch,studentKey};
        const touched=new Set<string>();autoTouches.current=touched;sessionHistory.current=[];
        const version=++autoVersion.current;newLessonId.current=crypto.randomUUID();setLesson(seed);setDraftId(null);setRevision(undefined);setMessage('');
        if(!studentKey){setAutoLoading(false);return;}
        const saved=matchingSavedLesson(data?.drafts||[],seed,data?.uid,matchEnd);
        if(saved){setLesson(compactLessonInput({...emptyLesson(),...saved.data}));setDraftId(saved.id);setRevision(saved.revision);setAutoLoading(false);return;}
        setAutoLoading(true);
        try{const previous=await request('previous-lesson',{studentKey,subject:seed.subject,date:seed.date});
            if(version===autoVersion.current){sessionHistory.current=previous.data.sessionRecords||[];setLesson((current:any)=>{const filled=applyPreviousLesson(current,seed,previous.data,touched);return Array.isArray(previous.data.sessionRecords)?autoSessionNumbers(filled,sessionHistory.current,touched).data:filled;});}
        }catch(e){if(version===autoVersion.current)setMessage(e instanceof Error?e.message:'직전 수업을 불러오지 못했습니다.');}
        finally{if(version===autoVersion.current)setAutoLoading(false);}
    }
    function resetLesson(){autoTouches.current=new Set();sessionHistory.current=[];autoVersion.current++;newLessonId.current=crypto.randomUUID();dismissMessage();setAutoLoading(false);setLesson(emptyLesson());setDraftId(null);setRevision(undefined);}
    function setField(key: string, value: any,manual=true) { dismissMessage();if(manual)autoTouches.current.add(key);setLesson((d: any) => {const next={...d,[key]:value};return draftId?editedSessionNumbers(next,data?.drafts?.find((r:any)=>r.id===draftId)?.data,autoTouches.current):sessionHistory.current.length?autoSessionNumbers(next,sessionHistory.current,autoTouches.current).data:next;}); }
    function openDraft(d: any) { autoTouches.current=new Set();sessionHistory.current=[];autoVersion.current++;setAutoLoading(false); setData((old:any)=>({...old,drafts:[d,...old.drafts.filter((r:any)=>r.id!==d.id)]}));setLesson(compactLessonInput({ ...emptyLesson(), ...d.data })); setDraftId(d.id); setRevision(d.revision); setLessonMode('single'); setLessonDialogOpen(true); }
    const students = data?.students || [];
    const filtered = students.filter((s: any) => {
        const active = s.subjects?.length ? s.subjects.some((x: any) => (!status || x.status === status) && (!subjectFilter || x.subject === subjectFilter)) : s.enrollmentStatus === status && !subjectFilter;
        return ((!status && !subjectFilter) || active) && `${s.studentDisplayName}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
    const savedDrafts=draftList.records;
    const draftPages=draftList.pages,currentDraftPage=draftList.page;
    const currentDraft = data?.drafts?.find((d: any) => d.id === draftId);
    function deleteCurrentLesson(){
        if(!currentDraft)return;
        const target=currentDraft,version=autoVersion.current;
        if(!window.confirm(`${target.data.date} ${target.data.subject} 일지를 삭제할까요?\n선택한 일지와 해당 리포트만 숨기며, ${data?.lessonAppMode?'삭제 전 내용은 복구용 기록으로 보관합니다.':'삭제한 일지는 일지 조회의 휴지통에서 7일 동안 복원할 수 있습니다.'}`))return;
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
        if(mode==='publish'&&!window.confirm(data?.lessonAppMode?'현재 입력 내용을 저장하고 학생·학부모 리포트에 반영할까요?':'현재 입력 내용을 저장하고 학생·학부모 리포트에 반영할까요?'))return;
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
    const lessonEditor = <section className="panel lesson-editor-panel"><div className="lesson-panel-heading"><h2>수업 일지</h2>{tab==='lesson'&&modeSwitch}</div><div className="lesson-form-layout"><div className="lesson-area-basics"><div className="lesson-top-fields"><StudentCombobox students={students} value={lesson.studentKey} disabled={Boolean(managementStudentKey)&&tab==='students'} todayKeys={todayStudents.uid===data?.uid&&todayStudents.date===today()?todayStudents.keys:[]} onChange={key=>void selectStudent(key)}/><fieldset disabled={busy}><label>날짜<input type="date" value={lesson.date} onChange={e=>setField('date',e.target.value)}/></label></fieldset><fieldset disabled={busy}><label>과목<select value={lesson.subject} onChange={e => void selectStudent(lesson.studentKey,{subject:e.target.value})}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label></fieldset><button className="small-button lesson-new-button" type="button" onClick={resetLesson}>+ 새 일지</button></div></div><fieldset className="lesson-editor-fields lesson-form-fields" disabled={busy}><div className="lesson-first-band"><div className="lesson-area-schedule">{autoLoading&&<p role="status" className="text-xs text-slate-500 my-2">직전 수업의 회차·내용·과제를 불러오는 중…</p>}<LessonAcademyFields value={lesson} error={fieldDisclosureError(message,'study')} roundHints={autoSessionNumbers(lesson,sessionHistory.current,autoTouches.current,Boolean(draftId)).hints} onChange={setField} regularTime={regularLessonTime(data,lesson.studentKey,lesson.subject,lesson.date,today())}/>
   </div><div className="lesson-area-content">{[['content', '수업 내용']].map(([key, label]) => <label key={key} className="lesson-text-field"><span className="lesson-label-line">{label}{key === 'content' ? <span className="text-xs text-rose-600 ml-1">(필수)</span> : <OptionalMark/>}</span><AutoTextarea required={key === 'content'} aria-required={key === 'content'} rows={key === 'content' ? 4 : 2} value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}/></label>)}</div></div><div className="lesson-second-band"><div className="lesson-area-assessment"><div className="lesson-evaluation-heading"><h3>출결·평가</h3><button className="small-button" onClick={() => {autoTouches.current.add('attendance');setLesson((d: any) => {const next={...d,attendance:'출석',attitude:'상',homework:'상'};return draftId?editedSessionNumbers(next,data?.drafts?.find((r:any)=>r.id===draftId)?.data,autoTouches.current):sessionHistory.current.length?autoSessionNumbers(next,sessionHistory.current,autoTouches.current).data:next;});}}>출석·태도·숙제 일괄 상</button></div>
   <div className="lesson-evaluation-fields">{lessonOptionGroups.map(group=><div key={group.key}><ChipGroup label={group.label} options={group.options} value={lesson[group.key]||''} disabled={busy} splitAt={'splitAt' in group?group.splitAt:undefined} onChange={value=>setField(group.key,value)}/></div>)}</div>
   <LessonTests value={lesson} error={fieldDisclosureError(message,'scores')} onChange={setField}/>
   </div><div className="lesson-area-extras">{[['specialNote', '특이 사항'], ['assignment', '과제'],['examScope','시험범위']].map(([key, label]) => <label key={key} className="lesson-text-field"><span className="lesson-label-line">{label}{key === 'content' ? <span className="text-xs text-rose-600 ml-1">(필수)</span> : <OptionalMark/>}</span><AutoTextarea required={key === 'content'} aria-required={key === 'content'} rows={key === 'content' ? 4 : 2} value={lesson[key] || ''} onChange={e => setField(key, e.target.value)}/></label>)}{(lesson.note || lesson.nextPlan) && <div className="mt-3 text-xs text-slate-500"><p className="font-semibold">기존 기록 메모</p>{lesson.note && <p className="whitespace-pre-wrap mt-2">기존 개인 피드백: {lesson.note}</p>}{lesson.nextPlan && <p className="whitespace-pre-wrap mt-2">기존 다음 수업 메모: {lesson.nextPlan}</p>}</div>}
   
   </div></div></fieldset></div>{currentDraft&&<LessonConflictReview key={currentDraft.id+':'+currentDraft.revision} record={currentDraft} request={request} act={act} busy={busy} refresh={refresh}/>} {canRetryPublication(currentDraft) && <div className="mt-3"><p className="text-xs text-slate-500">저장한 요청의 반영 결과를 확인합니다. 이후 화면에서 바꾼 입력은 이 재시도에 포함하지 않습니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{const result=await request('publish',{id:currentDraft.id});setMessage(result.warning || '저장한 수업일지 반영을 확인했습니다.');}finally{await refresh();}})}>저장 결과 확인·재시도</button></div>}{busy && <p role="status" className="text-xs mt-3">저장·반영 처리 중입니다. 창을 닫아도 처리는 계속됩니다.</p>}<LessonActionBar savedAt={savedPulse?.id===draftId?savedPulse.at:undefined} failureReason={!busy&&(latestLessonJob?.status==='failed'||currentDraft?.stage==='failed')?latestLessonJob?.error||currentDraft?.failureMessage||message||'반영 결과를 확인하고 다시 시도해 주세요.':undefined} onRetry={()=>act(()=>submitSingleLesson('save'))} retryDisabled={busy||autoLoading} status={lessonRecordStatus(currentDraft,busy,Boolean(currentDraft&&JSON.stringify(currentDraft.data)!==JSON.stringify(lesson)))} reason={busy?'현재 기록을 처리하고 있어요':autoLoading?'직전 수업을 불러오는 중이에요':!lesson.studentKey?'학생을 선택하면 반영할 수 있어요':!lesson.content?.trim()?'수업 내용을 입력하면 반영할 수 있어요':['publishing','processing','notion_saved'].includes(currentDraft?.stage)?'이미 반영 중인 기록이에요':currentDraft?.stage==='published'&&JSON.stringify(currentDraft.data)===JSON.stringify(lesson)?'이미 반영 완료된 기록이에요':undefined} refresh={<button type="button" disabled={busy} className="lesson-refresh-button" aria-label="새로고침" title="새로고침" onClick={() => act(refresh)}><RefreshCw size={16} aria-hidden="true"/></button>}><button disabled={busy||autoLoading} className="primary-button" onClick={() => act(()=>submitSingleLesson('save'))}>{busy&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}이 학생 저장</button><button disabled={busy || autoLoading || !lesson.studentKey || !lesson.content?.trim() || ['publishing', 'processing', 'notion_saved'].includes(currentDraft?.stage) || (currentDraft?.stage==='published' && JSON.stringify(currentDraft?.data)===JSON.stringify(lesson))} className="small-button" onClick={() => act(()=>submitSingleLesson('publish'))}>{busy&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}이 학생 반영</button><LessonDeleteButton viewer={data} record={currentDraft} busy={busy||autoLoading} onDelete={deleteCurrentLesson}/></LessonActionBar></section>;
    return <div className={`teacher-workspace max-w-6xl mx-auto px-4 py-5 md:p-8 ${tab==='lesson'?'lesson-writing':''} ${tab==='schedule'?'schedule-active':''}`}>
  <WorkspaceNavigation tab={tab} onTab={next=>{if(tab==='students'&&studentAttemptRef.current)studentAttemptRef.current(()=>setTab(next));else setTab(next);}} admin={data?.admin} principal={data?.principal} date={today()} history={workspaceHistory}/>

  {sectionLoading&&data&&<p role="status" className="text-sm text-slate-500 mb-3">자료를 불러오는 중…</p>}{message && <div role="status" className="workspace-toast"><span>{message}</span><button type="button" aria-label="알림 닫기" onClick={dismissMessage}>×</button></div>}{jobs.some(job=>job.status==='running')&&<p role="status" className="workspace-job-status">처리 중: {jobs.filter(job=>job.status==='running').map(job=>job.label).join(' · ')} · 다른 기록을 작업할 수 있습니다.</p>}
  {!data ? <div className="panel text-sm text-slate-500">{bootstrapError ? <><p>{bootstrapError}</p><button className="small-button mt-3" disabled={busy} onClick={() => act(refresh)}>다시 불러오기</button>{auth.currentUser?.email === 'lizzieshere1@gmail.com' && <button className="small-button mt-3 ml-2" onClick={onAccounts}>기존 계정·리포트 관리</button>}</> : '선생님방을 불러오는 중…'}</div> : <>
  <div hidden={tab !== 'lesson'}><div hidden={lessonMode !== 'grid'}><TeacherLessonGrid headingActions={modeSwitch} isRecordBusy={id=>operations.busy('lesson-record:'+id)} active={tab==='lesson'&&lessonMode==='grid'} data={data} busy={busy} request={request} refresh={refresh} act={act}/></div></div>
  
  {((tab === 'lesson' && lessonMode === 'single') || lessonDialogOpen) && <div className="lesson-writing-layout">
   <aside hidden={lessonDialogOpen} className="space-y-3 lesson-writing-sidebar"><TeacherTodayLessons selection={lesson} onNewLesson={resetLesson} data={data} date={lessonDay} onDate={setLessonDay} onEvents={receiveTodayLessons} active={tab==='lesson'&&lessonMode==='single'&&!lessonDialogOpen} request={request} disabled={false} onStudent={(key,event)=>void selectStudent(key,{date:event.date,subject:event.subject,start:event.start,end:event.end},false)}/>

    <section className="panel"><h2>저장한 기록</h2><button onClick={() => { resetLesson(); }} className="small-button">+ 새 수업</button>{draftLoading&&<p role="status" className="text-xs text-slate-500">저장한 기록을 불러오는 중…</p>}{savedDrafts.map((d: any) => <button key={d.id} className="saved-lesson-row" onClick={() => openDraft(d)}><span className="saved-lesson-name" title={students.find((s:any)=>s.studentKey===d.data.studentKey)?.studentDisplayName}>{students.find((s: any) => s.studentKey === d.data.studentKey)?.studentDisplayName}</span><span className="saved-lesson-date">{d.data.date}</span><StatusBadge kind={statusKind(lessonRecordStatus(d))} text={stageLabel[d.stage]}/></button>)}<div className="review-pagination"><button disabled={draftLoading||currentDraftPage===1} onClick={()=>setDraftPage(currentDraftPage-1)}>이전</button><span>{currentDraftPage} / {draftPages}</span><button disabled={draftLoading||currentDraftPage===draftPages} onClick={()=>setDraftPage(currentDraftPage+1)}>다음</button></div></section>
   </aside>
   <LessonEditorContainer modal={lessonDialogOpen} onClose={()=>setLessonDialogOpen(false)}>{lessonEditor}</LessonEditorContainer>
  </div>}
  <div className="schedule-workspace-page" hidden={tab !== 'schedule'}>{tab==='schedule'&&data.admin&&data.academyId==='main'&&!data.scheduleAppOnly&&<ScheduleTransitionPanel request={request} act={act} onChanged={refresh}/>}<ScheduleViewHeader view={scheduleView} onView={setScheduleView} count={data.classes?.length||0} disabled={busy} onCreate={()=>scheduleView==='dated'?createScheduleRef.current?.():createClassRef.current?.()}/><TeacherWeeklyCalendar hidden={scheduleView!=='dated'} createRef={createScheduleRef} data={data} busy={busy} request={request} active={tab==='schedule'} onAdd={date => openSchedule(date)} onEdit={record => {if((record.source==='notion'||record.notionPageId)&&!record.deleteRequested&&!canRetryPublication(record)){void act(async()=>{const result=await request('import-source-record',{id:record.notionPageId||record.id,kind:'schedule'});setData((old:any)=>({...old,schedules:[result.record,...old.schedules.filter((r:any)=>r.id!==result.record.id&&r.notionPageId!==result.record.notionPageId)]}));openSchedule(result.record.data.date,result.record);});}else openSchedule(record.data.date,record);}} onRegular={() => {}}/><div ref={scheduleEditorRef}><WorkspaceDialog open={Boolean(scheduleSelection) && tab==='schedule'} title="일정 추가·수정" onClose={() => { if (scheduleWorking || !scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) { setScheduleSelection(undefined); setScheduleDirty(false); } }}>{scheduleSelection && <TeacherScheduleEditor data={data} busy={busy} request={request} refresh={refresh} act={act} selection={scheduleSelection} onSelection={record=>{setScheduleSelection({date:record.data.date,record,nonce:++scheduleNonce.current});setScheduleDirty(false);}} onNotice={setMessage} onDirty={handleScheduleDirty} onClose={() => { if (scheduleWorking || !scheduleDirty || window.confirm('저장하지 않은 변경을 취소하고 닫을까요?')) {
            setScheduleSelection(undefined);
            setScheduleDirty(false);
        } }}/>}</WorkspaceDialog></div><div ref={regularRef}><TeacherClassManager view={scheduleView} createRef={createClassRef} data={data} busy={busy} request={request} refresh={refresh} act={act} active={tab==='schedule'} mode="schedule"/></div></div>
  {tab === 'academic' && <Suspense fallback={<p className="text-sm text-slate-500">성적 관리 준비 중…</p>}><TeacherAcademicManager data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab === 'academy' && <Suspense fallback={<p className="text-sm text-slate-500">학원 기록 준비 중…</p>}><AcademyLessonReview refreshVersion={teacherReadGeneration()} onEdit={openDraft} data={data} busy={busy} request={request} act={act}/></Suspense>}
  {tab==='students'&&<div className="student-view-switch"><div className="rv-seg" role="group" aria-label="학생 관리 보기"><button type="button" aria-pressed={studentView==='students'} onClick={()=>setStudentView('students')}>학생</button><button type="button" aria-pressed={studentView==='classes'} onClick={()=>setStudentView('classes')}>반 관리 <b>{data.classes?.length||0}</b></button></div>{studentView==='classes'&&<button type="button" className="primary-button" disabled={busy} onClick={()=>studentClassRef.current?.()}>+ 새 반</button>}</div>}
  {/* 반 관리 is reachable from 학생 관리 too: the same class cards and editor as the schedule tab. */}
  {tab==='students'&&studentView==='classes'&&<TeacherClassManager view="classes" createRef={studentClassRef} data={data} busy={busy} request={request} refresh={refresh} act={act} active mode="schedule"/>}
  {tab==='students'&&studentView==='students'&&<section ref={studentListRef} className="student-dashboard-shell"><div className="student-dashboard"><aside className="student-master-panel"><StudentMasterPanel registrations={data.admin||data.principal?{count:intakeCount,onAdd:()=>setIntakeStart(n=>n+1),render:(query,active)=><Suspense fallback={<p className="report-caption">상담·신입생을 불러오는 중…</p>}><StudentRegistrationManager query={query} active={active} startSignal={intakeStart} onCount={setIntakeCount} coreMode={Boolean(data.coreMode)} students={students} key={data.uid + ':' + data.academyId} onSynced={async()=>{invalidateTeacherReads('sync-student-registration');const fresh=await request('read:bootstrap',{section:'students',force:'1'});mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}}/></Suspense>}:undefined} students={students} value={managementStudentKey} onSelect={key=>{const change=()=>{setMessage('');setManagementInitialTab('review');setManagementStudentKey(key);};if(key===managementStudentKey)return;if(studentAttemptRef.current)studentAttemptRef.current(change);else change();}}/></aside><div className="student-dashboard-detail">  {tab==='students' && managementStudentKey && students.some((s:any)=>s.studentKey===managementStudentKey) ? <div key={data.uid+':'+managementStudentKey}><StudentManagementDialog inline registerAttempt={registerStudentAttempt} initialTab={managementInitialTab} name={students.find((s:any)=>s.studentKey===managementStudentKey)?.studentDisplayName||'학생'} canManage={Boolean(data.admin||data.principal)} busy={busy||autoLoading} notice={message} onClose={()=>{autoVersion.current++;setAutoLoading(false);setManagementStudentKey('');}} onSelect={next=>{if(next==='lesson'){const student=students.find((s:any)=>s.studentKey===managementStudentKey);void selectStudent(managementStudentKey,{subject:data.teachingScopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||data.scopes?.find((s:any)=>s.studentKey===managementStudentKey)?.subject||student?.subjects?.[0]?.subject||'영어'});}}} render={(active,leave,headerId)=><Suspense fallback={<p role="status" className="text-sm text-slate-500">학생 관리 정보를 불러오는 중…</p>}>
  {active==='profile' && (data.admin||data.principal) ? <StudentProfileEditor key={data.uid+':'+profileStudentKey} studentKey={profileStudentKey} onClose={leave} onSaved={profile=>{const key=profileStudentKey;setProfileStudentKey('');invalidateTeacherReads('save-student-profile');setData((old:any)=>({...old,students:old.students.map((s:any)=>s.studentKey===key?{...s,studentDisplayName:profile.displayName,hasGuardianContact:Boolean(profile.guardianPhone)}:s)}));setMessage('학생 정보를 저장했습니다. 보호자 번호를 바꾼 경우 새 번호 뒤 4자리로 인증해 주세요.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(auth.currentUser?.uid||'','workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('학생 정보는 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='enrollment' && (data.admin||data.principal) ? <StudentEnrollmentEditor key={data.uid+':'+enrollmentStudentKey} studentKey={enrollmentStudentKey} onClose={leave} onSaved={()=>{setEnrollmentStudentKey('');invalidateTeacherReads('save-student-enrollment');setMessage('수강·담당·소속반 변경을 저장했습니다.');const uid=auth.currentUser?.uid||'',generation=teacherReadGeneration(),load=++loadVersion.current;void request('read:bootstrap',{section:'students',force:'1'}).then(fresh=>{if(auth.currentUser?.uid!==uid || loadVersion.current!==load || teacherReadGeneration()!==generation)return;mergeData(fresh);teacherCacheRead(uid,'workspace:students',fresh);}).catch(()=>{if(auth.currentUser?.uid===uid && loadVersion.current===load)setMessage('수강 변경은 반영됐지만 목록을 갱신하지 못했습니다. 새로고침해 주세요.');});}}/> : null}
  {active==='message' ? <TeacherMessageComposer key={data.uid+':'+messageStudentKey} studentKey={messageStudentKey} subjects={students.find((s:any)=>s.studentKey===messageStudentKey)?.subjects?.map((s:any)=>s.subject)||[]} onClose={leave}/> : null}
  {active==='review' ? <WorkspaceDialog open title="학습 리포트" onClose={leave}><TeacherReportReview students={students} initialStudentKey={managementStudentKey} showStudentPicker={false} embedded headerTarget={headerId}/></WorkspaceDialog> : null}
  {active==='lesson' ? <WorkspaceDialog open title="수업 작성" onClose={()=>{if(!busy&&autoTouches.current.size && JSON.stringify(lesson)!==JSON.stringify(currentDraft?.data) && !window.confirm('저장하지 않은 수업 내용을 닫을까요?'))return;autoVersion.current++;setAutoLoading(false);leave();}}>{lessonEditor}</WorkspaceDialog> : null}
  </Suspense>}/></div> : <div className="student-detail-empty">왼쪽에서 학생을 선택하세요</div>}
</div></div></section>}
  {tab === 'curriculum' && <TeacherClassManager data={data} busy={busy} request={request} refresh={refresh} act={act} mode="curriculum"/>}
  {tab === 'word' && <section className="panel"><h2>내 학습 세트 관리</h2><div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="관리할 세트 종류">{([['word', '단어장'], ['grammar', '문법 세트'], ['exam', '시험기간']] as const).map(([value, label]) => <button key={value} className={setCategory === value ? 'primary-button' : 'small-button'} aria-pressed={setCategory === value} onClick={() => setSetCategory(value)}>{label}</button>)}</div><Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager key={setCategory} category={setCategory}/></Suspense></section>}
  {/* After the app-only switch the settings tab is for everyday management; migration tools move into one collapsed section. */}
  {tab === 'settings' && (data.admin || data.principal) && data.coreMode && <>
   <TeacherManager data={data} request={request} act={act} busy={busy} refresh={refresh}/>
   {data.admin && data.academyId==='main' && <AppTemplateManager busy={busy} request={request} act={act}/>}
   <details className="panel rv-admin"><summary>정리·점검 · 관리자용</summary><p className="gs-note my-2">외부 연결 정리 단계와 연결 점검입니다. 평소에는 열 필요가 없습니다.</p>
    {data.admin && data.academyId==='main' && <NotionDisconnectPanel request={request}/>}
    <Suspense fallback={<p>점검 화면을 불러오는 중…</p>}><TeacherIntegrityAudit key={data.uid+':'+data.academyId}/></Suspense>
    {data.admin && onAccounts && <button type="button" className="small-button mt-3" onClick={onAccounts}>기존 계정·리포트 관리</button>}
   </details>
  </>}
  {tab === 'settings' && (data.admin || data.principal) && !data.coreMode && <><Suspense fallback={<p>점검 화면을 불러오는 중…</p>}><TeacherIntegrityAudit key={data.uid+':'+data.academyId}/></Suspense></>}
  {tab === 'settings' && (data.admin || data.principal) && !data.coreMode && <WorkspaceSyncPanel data={data} busy={busy} request={request} refresh={refresh} act={act}/>}
  {tab === 'settings' && !data.coreMode && (data.admin || data.principal) && <LessonRestorePanel request={request} act={act} busy={busy} students={data.students} staff={data.staff} onRestored={refresh}/>}
  {tab === 'settings' && !data.coreMode && data.admin && data.academyId==='main' && <NotionDisconnectPanel request={request}/>}
  {tab === 'settings' && !data.coreMode && data.admin && data.academyId==='main' && <LessonMigrationPanel request={request} act={act} students={data.students} staff={data.staff}/>}
  {tab === 'settings' && !data.coreMode && (data.admin || data.principal) && <TeacherAssignmentManager data={data} request={request} act={act} busy={busy} refresh={refresh} onAccounts={onAccounts}/>}
  </>}
 </div>;
}

function LessonEditorContainer({modal,onClose,children}:{modal:boolean;onClose:()=>void;children:ReactNode}) {return modal?<WorkspaceDialog open title="일지 수정" onClose={onClose}>{children}</WorkspaceDialog>:<>{children}</>;}

















