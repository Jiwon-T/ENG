import type {ReactNode} from 'react';
import StatusBadge,{statusKind} from './StatusBadge';
import {withAutoTestGrade} from '../../lib/lessonTestInput';
import {fieldDisclosureError} from '../../lib/lessonDisclosure';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import AutoTextarea from './AutoTextarea';
import { autoSessionNumbers, editedSessionNumbers, withStudyDefaults } from '../../lib/sessionNumbers';
import {regularLessonTime} from '../../lib/lessonTimePresets';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
import ChipGroup from './ChipGroup';
import {lessonOptionGroups} from '../../lib/lessonOptions';
import LessonActionBar,{ShortcutKey,lessonShortcut} from './LessonActionBar';
import {X,RefreshCw,LoaderCircle} from 'lucide-react';
import {lessonRecordStatus} from '../../lib/lessonPresentation';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import OptionalMark from './OptionalMark';
import {AudienceLegend,AudienceTag,LessonPreviewButton,TeacherOnlyFields} from './LessonAudience';
import {LESSON_AUDIENCE} from '../../lib/lessonAudience';
import TeacherTodayLessons from './TeacherTodayLessons';
import {applyPreviousLesson,type TodayLesson,sessionSeed} from '../../lib/teacherTodayLessons';
import WorkspaceDialog from './WorkspaceDialog';
import LessonTests from './LessonTests';
import LessonDayStudy from './LessonDayStudy';
import LessonAcademyFields from './LessonAcademyFields';
import { lazy, Suspense, useEffect, useRef,useState } from 'react';
import ClassPicker from './ClassPicker';
import {askConfirm} from './ConfirmDialog';
import {confirmLessonPublish} from './lessonPublishConfirm';
import {removeGridSelection} from '../../lib/workspaceRecords';
import {useWorkspaceNotice} from '../../lib/useWorkspaceNotice';
import type {WorkspaceAction} from '../../lib/workspaceOperations';
import { matchingSavedLesson, newerSavedLesson, applyCommonLesson, gridCanSubmit, gridScore, newGridLesson, processLessonRows } from '../../lib/teacherLessonGrid';
import {useLeaveProtection} from '../../lib/leaveProtection';
import LessonSaveStatus from './LessonSaveStatus';
interface Props {
    headingActions?:ReactNode;
    isRecordBusy?:(id:string)=>boolean;
    active?:boolean;
    data: any;
    busy: boolean;
    request: (action?: string, body?: any) => Promise<any>;
    refresh: () => Promise<void>;
    act: WorkspaceAction;
}
interface Row {
    id: string;
    revision?: number;
    stage: string;
    data: ReturnType<typeof newGridLesson>;
    savedData?: any;
    sessionRecords?:any[];
    error?: string;
    loading?: boolean;
    touched?: string[];
    publishStartedAt?:number;
    notionWrite?:any;
    pending?:boolean;
    savedAt?:number;
}
const LessonParentPreview=lazy(()=>import('./LessonParentPreview'));
export default function TeacherLessonGrid({ headingActions,data, busy, request, refresh, act,active=true,isRecordBusy=()=>false }: Props) {
    const [commonExpanded,setCommonExpanded]=useState(false);const [editorOpen,setEditorOpen]=useState(false),[activeStudent,setActiveStudent]=useState(0),[classId,setClassId]=useState('');
    const [rows, setRows] = useState<Row[]>([]), [selection, setSelection] = useState<string[]>([]), [checked, setChecked] = useState<string[]>([]);
    // Ctrl/⌘+S saves the student shown in the 여러 학생 editor (not under a confirm modal).
    const gridSave=useRef<(()=>void)|null>(null),gridPublish=useRef<(()=>void)|null>(null);
    useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const shortcut=lessonShortcut(e);if(!shortcut||!gridSave.current)return;if(document.querySelector('dialog.confirm-modal[open]'))return;e.preventDefault();if(e.repeat)return; /* held key: one save / publish only */if(shortcut==='save')gridSave.current();else gridPublish.current?.();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[]);
    const [subject, setSubject] = useState(data.scopes?.[0]?.subject || '영어'), [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())), [start, setStart] = useState('14:00'), [end, setEnd] = useState('15:30');
    const [common, setCommon] = useState({ content: '', specialNote: '', assignment: '',examScope:'' }), [search, setSearch] = useState(''), [previewRow, setPreviewRow] = useState<string | null>(null);
    // Also typed 공통 입력 not yet applied to any student.
    useLeaveProtection(rows.some(r=>r.savedData?JSON.stringify(r.data)!==JSON.stringify(r.savedData):Boolean(r.touched?.length))||Object.values(common).some(value=>Boolean(String(value||'').trim())));
    const pendingRows=useRef(new Set<string>());
    const removedSavedRows=useRef(new Map<string,any>());
    const latest=useRef<{rows:any[];activeStudent:number}>({rows:[],activeStudent:0});
    useEffect(()=>{removedSavedRows.current.clear();},[data.uid]);
    const {message:notice,show:setNotice,dismiss:dismissNotice}=useWorkspaceNotice(`${data.uid}:${active}:${editorOpen}:${rows[activeStudent]?.id||'selection'}`);
    useEffect(()=>{const c=data.classes.find((c:any)=>c.id===classId);const slot=c?.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===new Date(`${date}T12:00:00+09:00`).getUTCDay()).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];if(slot){setStart(slot.start);setEnd(slot.end);}},[classId,date,data.classes]);
    const students = data.students.filter((s: any) => data.admin || (data.teachingScopes||data.scopes).some((x: any) => x.studentKey === s.studentKey && x.subject === subject));
    const setRow = (id: string, patch: Partial<Row>) => setRows(previous => previous.map(r => r.id === id ? { ...r, ...patch,...(patch.savedData&&patch.stage==='draft'?{savedAt:Date.now()}: {}) } : r));
    const setField = (id: string, key: string, value: any,manual=true) => {if(pendingRows.current.has(id))return;dismissNotice();setRows(previous => previous.map(r => r.id === id ? { ...r, error: undefined,touched:[...(r.touched||[]),...(manual?[key]:[])],data: r.savedData?editedSessionNumbers(withAutoTestGrade(r.data,withStudyDefaults({...r.data,[key]:value},key),key),r.savedData,[...(r.touched||[]),...(manual?[key]:[])],r.sessionRecords||[]):r.sessionRecords?autoSessionNumbers(withAutoTestGrade(r.data,withStudyDefaults({...r.data,[key]:value},key),key),r.sessionRecords,[...(r.touched||[]),...(manual?[key]:[])],Boolean(r.savedData)||r.stage!=='new').data:withAutoTestGrade(r.data,withStudyDefaults({...r.data,[key]:value},key),key) } : r));};
    async function run(mode: 'save' | 'publish', ids: string[]) {
        const chosen = rows.filter(r => ids.includes(r.id)&&!r.loading);
        const { succeeded, failed } = await processLessonRows(chosen, mode, request, setRow);
        setNotice(`${mode === 'save' ? '저장' : '반영 요청'} ${succeeded}건${failed ? ` · 실패 ${failed}건 — 해당 학생의 안내를 확인해 주세요.` : ''}`);
        await refresh();
        return {succeeded,failed};
    }
    async function submitRows(mode:'save'|'publish',ids:string[]){
        const selected=ids.filter(id=>!pendingRows.current.has(id)&&!isRecordBusy(id));if(!selected.length)return;
        for(const id of selected)pendingRows.current.add(id);
        setRows(previous=>previous.map(row=>selected.includes(row.id)?{...row,pending:true}:row));
        try{await act(()=>run(mode,selected),{keys:selected.map(id=>'lesson-record:'+id),label:`여러 학생 일지 ${mode==='save'?'저장':'반영'} ${selected.length}건`});}
        finally{for(const id of selected)pendingRows.current.delete(id);setRows(previous=>previous.map(row=>selected.includes(row.id)?{...row,pending:false}:row));}
    }
    latest.current={rows,activeStudent};
    async function removeStudent(id:string){
        const first=rows.find(r=>r.id===id);if(!first||pendingRows.current.has(id)||isRecordBusy(id))return;
        const changed=(r:any)=>r.savedData?JSON.stringify(r.data)!==JSON.stringify(r.savedData):Boolean(r.touched?.length);
        if(changed(first)&&!await askConfirm({title:'이 학생을 작성 목록에서 뺄까요?',message:'저장하지 않은 입력은 사라지고, 이미 저장한 일지는 유지됩니다.',confirmText:'빼기',tone:'danger',icon:'trash'}))return;
        // The rows may have changed while the modal was open (a save finishing): continue from the latest ones.
        const now=latest.current;
        const row=now.rows.find(r=>r.id===id);if(!row||pendingRows.current.has(id)||isRecordBusy(id))return;
        if(row.savedData)removedSavedRows.current.set(id,{...row,ownerUid:data.uid,data:row.savedData});
        const next=removeGridSelection(now.rows,id,now.activeStudent);if(!next.removed)return;
        setRows(next.rows);setActiveStudent(next.index);setChecked(previous=>previous.filter(key=>key!==id));setSelection(previous=>previous.filter(key=>key!==row.data.studentKey));dismissNotice();if(!next.rows.length)setEditorOpen(false);
    }
    async function addStudents(keys=selection,settings:{subject:string;date:string;start:string;end:string;event?:TodayLesson}={subject,date,start,end},matchEnd=true) {
        const added = keys.filter(key => !rows.some(r => r.data.studentKey === key && r.data.subject === settings.subject && r.data.date === settings.date&&r.data.start===settings.start&&(!matchEnd||r.data.end===settings.end)));
        const next:Row[] = added.map(key => {const seed={...newGridLesson(key,settings.subject,settings.date,settings.start,settings.end),...(settings.event?sessionSeed(settings.event,key):{})};const saved=matchingSavedLesson([...(data.drafts||[]),...removedSavedRows.current.values()],seed,data.uid,matchEnd);return saved?{...saved,data:structuredClone(saved.data),savedData:structuredClone(saved.data),loading:false,touched:[]}: {id:crypto.randomUUID(),stage:'new',loading:true,data:seed};});
        setRows(previous => [...previous, ...next]);
        setChecked(previous => [...previous, ...next.map(r => r.id)]);
        setSelection([]);setActiveStudent(next.length?rows.length:Math.max(0,rows.findIndex(r=>keys.includes(r.data.studentKey)&&r.data.subject===settings.subject&&r.data.date===settings.date&&r.data.start===settings.start&&(!matchEnd||r.data.end===settings.end))));setEditorOpen(true);
        await Promise.all(next.filter(row=>row.loading).map(async row=>{
            try{const result=await request('previous-lesson',{studentKey:row.data.studentKey,subject:row.data.subject,date:row.data.date});
                setRows(previous=>previous.map(r=>r.id===row.id?{...r,loading:false,sessionRecords:result.data.sessionRecords,data:Array.isArray(result.data.sessionRecords)?autoSessionNumbers(applyPreviousLesson(r.data,row.data,result.data,r.touched),result.data.sessionRecords,r.touched,Boolean(r.savedData)||r.stage!=='new').data:applyPreviousLesson(r.data,row.data,result.data,r.touched),error:undefined}:r));
            }catch(e){setRow(row.id,{loading:false,error:e instanceof Error?e.message:'직전 수업 조회 실패'});}
        }));
    }
    const myClasses=(data.classes||[]).filter((c:any)=>c.status!=='중단'&&(data.admin||c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid)));
    const [classQuery,setClassQuery]=useState('');
    // One tap: the class's students are added with its subject and, when it meets on this date, its time.
    function pickClass(c:any){
        const weekday=new Date(`${date}T12:00:00+09:00`).getUTCDay();
        const slot=c.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];
        const settings={subject:c.subject,date,start:slot?.start||start,end:slot?.end||end};
        setClassId(c.id);setSubject(settings.subject);setStart(settings.start);setEnd(settings.end);
        void addStudents(c.students,settings);
    }
    const checkStatus=() => act(async () => { const fresh = await request('read:draft-records',{ids:rows.map(r=>r.id).join(','),force:'1'}); setRows(previous => previous.map(row => { const saved = fresh.records.find((d: any) => d.id === row.id); return saved ? { ...row, revision: saved.revision, stage: saved.stage, savedData: saved.data,publishStartedAt:saved.publishStartedAt,notionWrite:saved.notionWrite } : row; })); await refresh(); });
    gridSave.current=editorOpen&&active?()=>{const row=rows[activeStudent];if(row&&!row.pending&&!row.loading&&!isRecordBusy(row.id))void submitRows('save',[row.id]);}:null;
    // 반영: always asked first, with the 학부모·학생 report preview in the question.
    const publishRow=(row:any)=>confirmLessonPublish(row.data,data.students.find((s:any)=>s.studentKey===row.data.studentKey)?.studentDisplayName||'학생').then(ok=>{if(ok)void submitRows('publish',[row.id]);});
    // Ctrl/⌘+Enter: publish the open student after the same confirm as the single editor.
    gridPublish.current=editorOpen&&active?()=>{const row=rows[activeStudent];if(!row||row.pending||row.loading||isRecordBusy(row.id)||!gridCanSubmit(row))return;void publishRow(row);}:null;
    const rowDirty=(r:any)=>r.savedData?JSON.stringify(r.data)!==JSON.stringify(r.savedData):Boolean(r.touched?.length);
    // A student's lesson saved elsewhere meanwhile (한 학생 작성, another device): a row with nothing typed takes the newer
    // save; a row with typing keeps it and is told to check first (its save would be refused as out of date).
    useEffect(()=>{
        const drafts=data.drafts||[];if(!drafts.length)return;
        const patches=new Map<string,any>();
        for(const r of latest.current.rows){
            if(r.pending||r.loading||pendingRows.current.has(r.id))continue;
            const newer=newerSavedLesson({id:r.id,revision:r.revision,saved:Boolean(r.savedData),data:r.data},drafts,data.uid);
            if(!newer)continue;
            patches.set(r.id,rowDirty(r)?{error:'다른 화면에서 이 학생 일지가 먼저 저장됐어요. 상태 확인 후 저장해 주세요.'}
                :{id:newer.id,revision:newer.revision,stage:newer.stage,data:structuredClone(newer.data),savedData:structuredClone(newer.data),touched:[],error:undefined});
        }
        if(!patches.size)return;
        setRows(previous=>previous.map(r=>patches.has(r.id)&&!pendingRows.current.has(r.id)?{...r,...patches.get(r.id)}:r));
        // a new row that took up the saved lesson now goes by its id
        setChecked(previous=>previous.map(id=>patches.get(id)?.id||id));
    // rows that were saving are looked at again once their save ends (`waiting` changes)
    },[data.drafts,active,rows.filter(r=>r.pending||r.loading).map(r=>r.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
    function chooseGroup(event:TodayLesson){
        setClassId('');setSubject(event.subject);setDate(event.date);setStart(event.start);setEnd(event.end);
        void addStudents(event.students,{subject:event.subject,date:event.date,start:event.start,end:event.end,event},false);
    }
    return <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4"><aside className="min-w-0"><TeacherTodayLessons selection={rows[activeStudent]?.data} onNewLesson={()=>{setSelection([]);setEditorOpen(false);setSearch('');}} data={data} records={rows.filter(row=>row.savedData).map(row=>({...row,data:row.savedData}))} date={date} onDate={setDate} request={request} active={active} disabled={false} onGroup={chooseGroup}/></aside><section className="panel lesson-grid min-w-0"><div className="flex flex-wrap justify-between gap-2 mb-3"><h2 className="!mb-0">여러 학생 함께 작성</h2>{headingActions}<span className="text-xs text-slate-500">학생마다 별도 기록으로 저장됩니다. 탭을 바꿔도 입력은 유지됩니다.</span></div><fieldset>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><label>과목<select value={subject} onChange={e => { setSubject(e.target.value); setSelection([]); }}>{['영어', '수학', '국어', '과학', '한국사'].map(s => <option key={s}>{s}</option>)}</select></label><label>날짜<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label>시작<input type="time" value={start} onChange={e => setStart(e.target.value)}/></label><label>종료<input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
 <ClassPicker classes={myClasses} students={data.students||[]} date={date} query={classQuery} onQuery={setClassQuery} selectedId={classId} isAdded={c=>c.students.length>0&&c.students.every((key:string)=>rows.some(r=>r.data.studentKey===key&&r.data.subject===c.subject&&r.data.date===date))} onPick={pickClass}/>
 <details open={Boolean(search)||selection.length>0} className="mt-3 rounded-xl border border-pink-100 p-3"><summary className="text-sm font-bold cursor-pointer">학생 한 명씩 추가 · {selection.length}명 선택</summary><input aria-label="추가할 학생 검색" placeholder="이름·초성 검색 (예: ㅈㅅㅎ)" value={search} onChange={e => setSearch(e.target.value)}/><div className="flex flex-wrap gap-x-4 gap-y-1 max-h-40 overflow-auto mt-2">{students.filter((s: any) => matchesKoreanSearch(s.studentDisplayName,search)).map((s: any) => <label key={s.studentKey} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" checked={selection.includes(s.studentKey)} onChange={e => setSelection(e.target.checked ? [...selection, s.studentKey] : selection.filter(x => x !== s.studentKey))}/>{s.studentDisplayName}</label>)}</div><button className="small-button mt-2" disabled={!selection.length} onClick={()=>void addStudents()}>선택한 학생 추가</button></details>
 {rows.length>0&&<button className="primary-button mt-3" onClick={()=>setEditorOpen(true)}>작성 팝업 열기 · {rows.length}명</button>}
 </fieldset><WorkspaceDialog open={editorOpen&&active} title="여러 학생 수업 일지 작성" onClose={()=>setEditorOpen(false)}><fieldset className="grid-editor-form"><div className="grid-editor-toolbar"><div className="grid-toolbar-students"><div className="grid-student-strip" aria-label="작성할 학생">{rows.map((r,i)=>{const name=data.students.find((s:any)=>s.studentKey===r.data.studentKey)?.studentDisplayName||'학생';const status=lessonRecordStatus(r,Boolean(r.pending),Boolean(r.savedData&&JSON.stringify(r.savedData)!==JSON.stringify(r.data)));return <div key={r.id} role="group" aria-label={name} className={`grid-student-chip ${i===activeStudent?'is-active':''}`}><button type="button" aria-pressed={i===activeStudent} aria-label={`${name} · ${status.text}`} className="grid-student-name" onClick={()=>setActiveStudent(i)}><StatusBadge kind={statusKind(status)} text={status.text} compact/><span className="grid-student-name-text" title={name}>{name}</span></button><button type="button" className="grid-student-remove" disabled={Boolean(r.pending||isRecordBusy(r.id))} aria-label={`${name} 제거`} onClick={()=>removeStudent(r.id)}><span><X size={12} aria-hidden="true"/></span></button></div>})}</div><div className="review-pagination grid-student-navigation" hidden={rows.length<=2}><button disabled={activeStudent===0} aria-label="이전 학생" onClick={()=>setActiveStudent(i=>i-1)}><ChevronLeft size={16}/></button><span>{Math.min(activeStudent+1,rows.length)} / {rows.length}</span><button disabled={activeStudent>=rows.length-1} aria-label="다음 학생" onClick={()=>setActiveStudent(i=>i+1)}><ChevronRight size={16}/></button></div>
 </div><div className="grid-toolbar-actions"><div className="grid-bulk-actions"><label className="flex items-center gap-2"><input type="checkbox" checked={rows.length > 0 && checked.length === rows.length} onChange={e => setChecked(e.target.checked ? rows.map(r => r.id) : [])}/>전체 선택</label><button className="primary-button" disabled={!checked.length||rows.some(r=>checked.includes(r.id)&&r.loading)} onClick={() => submitRows('save', checked)}>선택 {checked.length}명 저장</button><button className="small-button" disabled={!checked.length || rows.filter(r => checked.includes(r.id)).some(r => !gridCanSubmit(r))} onClick={() => { void askConfirm({title:`${checked.length}명을 리포트에 반영할까요?`,message:'선택한 학생들의 현재 입력 내용을 저장하고 학생·학부모 리포트에 반영해요.',details:rows.filter(r=>checked.includes(r.id)).map(r=>`${data.students.find((s:any)=>s.studentKey===r.data.studentKey)?.studentDisplayName||'학생'} · ${r.data.subject} · ${r.data.date}`),confirmText:'반영하기',icon:'send'}).then(ok=>{if(ok)void submitRows('publish', checked);}); }}>선택 {checked.length}명 반영</button></div><details className="grid-common-input" open={commonExpanded||Object.values(common).some(Boolean)} onToggle={e=>{if(Object.values(common).some(Boolean)&&!e.currentTarget.open){e.currentTarget.open=true;return;}setCommonExpanded(e.currentTarget.open);}}><summary title="공통 수업 내용·특이 사항·과제·시험범위 입력">공통 입력</summary><div className="grid-common-fields">{([['content', '수업 내용'], ['specialNote', '특이 사항'], ['assignment', '과제'],['examScope','시험범위']] as const).map(([key, label]) => <label key={key}>{label}{key==='content'?<span className="text-xs text-rose-600 ml-1">(필수)</span>:<OptionalMark/>}<AutoTextarea rows={2} value={common[key]} onChange={e => setCommon(c => ({ ...c, [key]: e.target.value }))}/></label>)}</div><button className="small-button mt-2" disabled={!checked.length} onClick={async () => { if (rows.some(r => checked.includes(r.id) && (r.data.content || r.data.assignment || r.data.specialNote)) && !await askConfirm({title:'공통 입력 내용으로 바꿀까요?',message:'선택한 학생의 수업 내용·특이 사항·과제·시험범위가 공통 입력 내용으로 바뀝니다.',confirmText:'바꾸기',tone:'danger',icon:'alert'}))
        return; setRows(previous => previous.map(r => checked.includes(r.id)&&!r.pending ? { ...r,touched:[...(r.touched||[]),'content','assignment'],data: applyCommonLesson(r.data, common) } : r)); }}>선택한 {checked.length}명에게 적용</button></details></div></div>
 {notice && <p role="status" className="text-xs text-slate-500 mb-3">{notice}</p>}
 {rows[activeStudent]&&(()=>{const row=rows[activeStudent];return <div className="grid-active-title" aria-label={`${data.students.find((s:any)=>s.studentKey===row.data.studentKey)?.studentDisplayName||'학생'} 저장 상태`}><LessonSaveStatus record={{stage:row.stage,updatedAt:(row as any).updatedAt}} dirty={rowDirty(row)} busy={Boolean(row.pending||isRecordBusy(row.id))} savedAt={row.savedAt}/><AudienceLegend/></div>;})()}
 <div className="lesson-grid-scroll lesson-editor-fields" tabIndex={0} aria-label="학생별 수업 입력 표"><table><thead><tr><th>학생</th><th>수업·자습 시간과 회차</th><th>출결·평가·점수</th><th>수업 내용·특이 사항</th><th>과제·선생님만</th><th>저장·반영</th></tr></thead><tbody>{rows.slice(activeStudent,activeStudent+1).map(row => <tr className="lesson-form-layout" key={row.id}>
 <td className="grid-lesson-top"><fieldset className="lesson-top-fields min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><label className="grid-row-selection"><input type="checkbox" checked={checked.includes(row.id)} onChange={e => setChecked(e.target.checked ? [...checked, row.id] : checked.filter(x => x !== row.id))}/><span>이 학생 선택</span><span className="sr-only">{data.students.find((s:any)=>s.studentKey===row.data.studentKey)?.studentDisplayName}</span></label><label>날짜<input aria-label="수업 날짜" type="date" value={row.data.date} onChange={e => setField(row.id, 'date', e.target.value)}/></label><div className="lesson-readonly-subject"><span>과목</span><span className="lesson-readonly-field">{row.data.subject}</span></div>{row.loading&&<p role="status" className="text-xs text-slate-500">직전 수업의 회차·내용·과제를 불러오는 중…</p>}</fieldset></td>
<td className="lesson-first-band"><div className="lesson-area-schedule"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><LessonAcademyFields value={row.data} error={fieldDisclosureError(row.error,'study')} roundHints={autoSessionNumbers(row.data,row.sessionRecords||[],row.touched,Boolean(row.savedData)||row.stage!=='new').hints} regularTime={regularLessonTime(data,row.data.studentKey,row.data.subject,row.data.date,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()))} onChange={(key, value,manual) => setField(row.id, key, value,manual)}/></fieldset></div><div className="lesson-area-content"><fieldset className="min-w-0 lesson-area-fields" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="lesson-content-split"><label className="lesson-content-main"><span className="lesson-label-line">수업 내용<span className="text-xs text-rose-600 ml-1">(필수)</span><AudienceTag to={LESSON_AUDIENCE.content}/></span><AutoTextarea required aria-required="true" value={row.data.content} onChange={e => setField(row.id, 'content', e.target.value)}/></label><label className="lesson-content-note"><span className="lesson-label-line">특이 사항<OptionalMark/><AudienceTag to={LESSON_AUDIENCE.specialNote}/></span><AutoTextarea minRows={1} maxRows={5} value={row.data.specialNote} onChange={e => setField(row.id, 'specialNote', e.target.value)}/></label></div></fieldset></div></td>
<td className="lesson-second-band"><div className="lesson-area-assessment"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="lesson-evaluation-heading"><h3>출결·평가<LessonDayStudy studentKey={row.data.studentKey} date={row.data.date} request={request} onFill={({wrong,total,word})=>{setField(row.id,'scorePercent',false);setField(row.id,'wrong',wrong);setField(row.id,'total',total);setField(row.id,'correct',total-wrong);if(word&&!row.data.testName)setField(row.id,'testName','단어');}}/></h3><span className="lesson-bulk-buttons">{(['상','중'] as const).map(level=><button key={level} type="button" className="small-button" disabled={!checked.length} onClick={() => setRows(previous => previous.map(r => checked.includes(r.id)&&!r.pending ? { ...r, data:r.sessionRecords?autoSessionNumbers({...r.data,attendance:'출석',attitude:level,homework:level},r.sessionRecords,r.touched,Boolean(r.savedData)||r.stage!=='new').data:{...r.data,attendance:'출석',attitude:level,homework:level} } : r))}>출석·태도·숙제 일괄 {level}</button>)}</span></div><div className="lesson-evaluation-fields">{lessonOptionGroups.map(group=><div key={group.key}><ChipGroup label={group.label} tag={<AudienceTag to={LESSON_AUDIENCE[group.key]}/>} options={group.options} value={row.data[group.key]} disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))} splitAt={'splitAt' in group?group.splitAt:undefined} onChange={value=>setField(row.id,group.key,value)}/></div>)}</div><LessonTests value={row.data} error={fieldDisclosureError(row.error,'scores')} onChange={(key, value) => setField(row.id, key, value)}/></fieldset></div><div className="lesson-area-extras"><fieldset className="min-w-0 lesson-area-fields" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="mt-2 lesson-extras-stack"><label><span className="lesson-label-line">과제<OptionalMark/><AudienceTag to={LESSON_AUDIENCE.assignment}/></span><AutoTextarea value={row.data.assignment} onChange={e => setField(row.id, 'assignment', e.target.value)}/></label><TeacherOnlyFields value={row.data} onChange={(key,value)=>setField(row.id,key,value)}/>{(row.data.note || row.data.nextPlan) && <div className="text-xs text-slate-500 mt-2"><p className="font-semibold">기존 기록 메모</p><p className="whitespace-pre-wrap">{row.data.note}</p><p className="whitespace-pre-wrap">{row.data.nextPlan}</p></div>}</div></fieldset></div></td>
<td data-label="저장·반영"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="flex flex-col gap-2">{canRetryPublication(row) && <button className="small-button" onClick={()=>act(async()=>{try{const result=await request('publish',{id:row.id});if(result.record)setRow(row.id,{stage:result.record.stage,revision:result.record.revision,savedData:result.record.data,error:result.warning || ''});}finally{await refresh();}})}>저장 결과 확인·재시도</button>}{row.error && <p role="alert" className="text-xs text-rose-600">{row.error}</p>}</div></fieldset></td></tr>)}</tbody></table>{!rows.length && <p className="text-sm text-slate-500 p-4">학생을 추가하면 여러 명의 수업을 함께 작성할 수 있습니다.</p>}</div>
 {rows.slice(activeStudent,activeStudent+1).map(row=><div key={row.id} className="lesson-action-fieldset"><LessonActionBar statusInTitle more={<><LessonPreviewButton onClick={()=>setPreviewRow(row.id)}/><button type="button" className="lesson-more-item" onClick={checkStatus}><RefreshCw size={15} aria-hidden="true"/>새로고침</button></>} savedAt={row.savedAt} failureReason={row.error} onRetry={()=>submitRows('save',[row.id])} retryDisabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))} status={lessonRecordStatus(row,Boolean(row.pending||isRecordBusy(row.id)),Boolean(row.savedData&&JSON.stringify(row.savedData)!==JSON.stringify(row.data)))} reason={row.pending||isRecordBusy(row.id)?'현재 기록을 처리하고 있어요':row.loading?'직전 수업을 불러오는 중이에요':!row.data.content?.trim()?'수업 내용을 입력하면 반영할 수 있어요':['publishing','processing','notion_saved'].includes(row.stage)?'이미 반영 중인 기록이에요':!gridCanSubmit(row)?'이미 반영 완료된 기록이에요':undefined} refresh={<button type="button" className="lesson-refresh-button" aria-label="반영 상태 확인" title="반영 상태 확인" onClick={checkStatus}><RefreshCw size={15} aria-hidden="true"/><span className="lesson-refresh-label" aria-hidden="true">새로고침</span></button>}><fieldset className="lesson-action-controls" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><button className={gridCanSubmit(row)?'small-button':'primary-button'} disabled={row.loading} onClick={() => submitRows('save', [row.id])}>{row.pending&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}저장<ShortcutKey keys="S"/></button><button className={gridCanSubmit(row)?'primary-button':'small-button'} disabled={!gridCanSubmit(row)} onClick={() => void publishRow(row)}>{row.pending&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}반영<ShortcutKey keys="Enter"/></button></fieldset></LessonActionBar>{previewRow===row.id&&<Suspense fallback={null}><LessonParentPreview lesson={row.data} studentName={(data.students.find((s:any)=>s.studentKey===row.data.studentKey)?.studentDisplayName||'').replace(/\s*\(.*\)\s*$/,'')} onClose={()=>setPreviewRow(null)}/></Suspense>}</div>)}</fieldset></WorkspaceDialog></section></div>;
}












