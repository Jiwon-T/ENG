import {autoSessionNumbers} from '../../lib/sessionNumbers';
import {regularLessonTime} from '../../lib/lessonTimePresets';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
import ChipGroup from './ChipGroup';
import {lessonOptionGroups} from '../../lib/lessonOptions';
import LessonActionBar from './LessonActionBar';
import {X,RefreshCw,LoaderCircle} from 'lucide-react';
import {lessonRecordStatus} from '../../lib/lessonPresentation';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import OptionalMark from './OptionalMark';
import TeacherTodayLessons from './TeacherTodayLessons';
import {applyPreviousLesson,type TodayLesson} from '../../lib/teacherTodayLessons';
import WorkspaceDialog from './WorkspaceDialog';
import LessonTests from './LessonTests';
import LessonAcademyFields from './LessonAcademyFields';
import { useEffect, useRef,useState } from 'react';
import {removeGridSelection} from '../../lib/workspaceRecords';
import {useWorkspaceNotice} from '../../lib/useWorkspaceNotice';
import type {WorkspaceAction} from '../../lib/workspaceOperations';
import { applyCommonLesson, gridCanSubmit, gridScore, newGridLesson, processLessonRows } from '../../lib/teacherLessonGrid';
interface Props {
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
}
export default function TeacherLessonGrid({ data, busy, request, refresh, act,active=true,isRecordBusy=()=>false }: Props) {
    const [editorOpen,setEditorOpen]=useState(false),[activeStudent,setActiveStudent]=useState(0),[classId,setClassId]=useState('');
    const [rows, setRows] = useState<Row[]>([]), [selection, setSelection] = useState<string[]>([]), [checked, setChecked] = useState<string[]>([]);
    const [subject, setSubject] = useState(data.scopes?.[0]?.subject || '영어'), [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())), [start, setStart] = useState('14:00'), [end, setEnd] = useState('15:30');
    const [common, setCommon] = useState({ content: '', specialNote: '', assignment: '',examScope:'' }), [search, setSearch] = useState('');
    const pendingRows=useRef(new Set<string>());
    const {message:notice,show:setNotice,dismiss:dismissNotice}=useWorkspaceNotice(`${data.uid}:${active}:${editorOpen}:${rows[activeStudent]?.id||'selection'}`);
    useEffect(()=>{const c=data.classes.find((c:any)=>c.id===classId);const slot=c?.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===new Date(`${date}T12:00:00+09:00`).getUTCDay()).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];if(slot){setStart(slot.start);setEnd(slot.end);}},[classId,date,data.classes]);
    const students = data.students.filter((s: any) => data.admin || (data.teachingScopes||data.scopes).some((x: any) => x.studentKey === s.studentKey && x.subject === subject));
    const setRow = (id: string, patch: Partial<Row>) => setRows(previous => previous.map(r => r.id === id ? { ...r, ...patch } : r));
    const setField = (id: string, key: string, value: any,manual=true) => {if(pendingRows.current.has(id))return;dismissNotice();setRows(previous => previous.map(r => r.id === id ? { ...r, error: undefined,touched:[...(r.touched||[]),...(manual?[key]:[])],data: r.sessionRecords?autoSessionNumbers({...r.data,[key]:value},r.sessionRecords,[...(r.touched||[]),...(manual?[key]:[])],Boolean(r.savedData)||r.stage!=='new').data:{...r.data,[key]:value} } : r));};
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
    function removeStudent(id:string){
        const row=rows.find(r=>r.id===id);if(!row||pendingRows.current.has(id)||isRecordBusy(id))return;
        const dirty=row.savedData?JSON.stringify(row.data)!==JSON.stringify(row.savedData):Boolean(row.touched?.length);
        if(dirty&&!window.confirm('이 학생을 작성 목록에서 제외할까요? 저장하지 않은 입력은 사라지고, 이미 저장한 일지는 유지됩니다.'))return;
        const next=removeGridSelection(rows,id,activeStudent);if(!next.removed)return;
        setRows(next.rows);setActiveStudent(next.index);setChecked(previous=>previous.filter(key=>key!==id));setSelection(previous=>previous.filter(key=>key!==row.data.studentKey));dismissNotice();if(!next.rows.length)setEditorOpen(false);
    }
    async function addStudents(keys=selection,settings={subject,date,start,end}) {
        const added = keys.filter(key => !rows.some(r => r.data.studentKey === key && r.data.subject === settings.subject && r.data.date === settings.date&&r.data.start===settings.start&&r.data.end===settings.end));
        const next:Row[] = added.map(key => ({ id: crypto.randomUUID(), stage: 'new', loading:true,data: newGridLesson(key, settings.subject, settings.date, settings.start, settings.end) }));
        setRows(previous => [...previous, ...next]);
        setChecked(previous => [...previous, ...next.map(r => r.id)]);
        setSelection([]);setActiveStudent(next.length?rows.length:Math.max(0,rows.findIndex(r=>keys.includes(r.data.studentKey)&&r.data.subject===settings.subject&&r.data.date===settings.date&&r.data.start===settings.start&&r.data.end===settings.end)));setEditorOpen(true);
        await Promise.all(next.map(async row=>{
            try{const result=await request('previous-lesson',{studentKey:row.data.studentKey,subject:row.data.subject,date:row.data.date});
                setRows(previous=>previous.map(r=>r.id===row.id?{...r,loading:false,sessionRecords:result.data.sessionRecords,data:Array.isArray(result.data.sessionRecords)?autoSessionNumbers(applyPreviousLesson(r.data,row.data,result.data,r.touched),result.data.sessionRecords,r.touched,Boolean(r.savedData)||r.stage!=='new').data:applyPreviousLesson(r.data,row.data,result.data,r.touched),error:undefined}:r));
            }catch(e){setRow(row.id,{loading:false,error:e instanceof Error?e.message:'직전 수업 조회 실패'});}
        }));
    }
    function chooseGroup(event:TodayLesson){
        setClassId('');setSubject(event.subject);setDate(event.date);setStart(event.start);setEnd(event.end);
        void addStudents(event.students,{subject:event.subject,date:event.date,start:event.start,end:event.end});
    }
    return <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4"><aside className="min-w-0"><TeacherTodayLessons data={data} records={rows.filter(row=>row.savedData).map(row=>({...row,data:row.savedData}))} date={date} onDate={setDate} request={request} active={active} disabled={false} onGroup={chooseGroup}/></aside><section className="panel lesson-grid min-w-0"><div className="flex flex-wrap justify-between gap-2 mb-3"><h2 className="!mb-0">여러 학생 함께 작성</h2><span className="text-xs text-slate-500">학생마다 별도 기록으로 저장됩니다. 탭을 바꿔도 입력은 유지됩니다.</span></div><fieldset>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><label>과목<select value={subject} onChange={e => { setSubject(e.target.value); setSelection([]); }}>{['영어', '수학', '국어', '과학', '한국사'].map(s => <option key={s}>{s}</option>)}</select></label><label>날짜<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label>시작<input type="time" value={start} onChange={e => setStart(e.target.value)}/></label><label>종료<input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
 <label className="block mt-3">반 학생 불러오기<OptionalMark/><select value={classId} onChange={e=>{setClassId(e.target.value);const c=data.classes.find((c:any)=>c.id===e.target.value);if(!c)return;setSubject(c.subject);setSelection(c.students);const weekday=new Date(`${date}T12:00:00+09:00`).getUTCDay();const slot=c.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];if(slot){setStart(slot.start);setEnd(slot.end);}}}><option value="">반 선택 → 학생 추가에서 확인 후 추가</option>{data.classes.filter((c:any)=>c.status!=='중단'&&(data.admin||c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid))).map((c:any)=><option key={c.id} value={c.id}>{c.name} · {c.students.length}명</option>)}</select></label>
 <details open={!rows.length} className="mt-3 rounded-xl border border-pink-100 p-3"><summary className="text-sm font-bold cursor-pointer">학생 추가 · {selection.length}명 선택</summary><input aria-label="추가할 학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => setSearch(e.target.value)}/><div className="flex flex-wrap gap-x-4 gap-y-1 max-h-40 overflow-auto mt-2">{students.filter((s: any) => matchesKoreanSearch(s.studentDisplayName,search)).map((s: any) => <label key={s.studentKey} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" checked={selection.includes(s.studentKey)} onChange={e => setSelection(e.target.checked ? [...selection, s.studentKey] : selection.filter(x => x !== s.studentKey))}/>{s.studentDisplayName}</label>)}</div><button className="small-button mt-2" disabled={!selection.length} onClick={()=>void addStudents()}>선택한 학생 추가</button></details>
 {rows.length>0&&<button className="primary-button mt-3" onClick={()=>setEditorOpen(true)}>작성 팝업 열기 · {rows.length}명</button>}
 </fieldset><WorkspaceDialog open={editorOpen&&active} title="여러 학생 수업 일지 작성" onClose={()=>setEditorOpen(false)}><fieldset><div className="grid-student-strip" aria-label="작성할 학생">{rows.map((r,i)=>{const name=data.students.find((s:any)=>s.studentKey===r.data.studentKey)?.studentDisplayName||'학생';const status=lessonRecordStatus(r,Boolean(r.pending),Boolean(r.savedData&&JSON.stringify(r.savedData)!==JSON.stringify(r.data)));return <div key={r.id} role="group" aria-label={name} className={`grid-student-chip ${i===activeStudent?'is-active':''}`}><button type="button" aria-pressed={i===activeStudent} aria-label={`${name} · ${status.text}`} className="grid-student-name" onClick={()=>setActiveStudent(i)}><span aria-hidden="true" className={`lesson-status-dot status-${status.tone}`}/><span className="grid-student-name-text" title={name}>{name}</span></button><button type="button" className="grid-student-remove" disabled={Boolean(r.pending||isRecordBusy(r.id))} aria-label={`${name} 제거`} onClick={()=>removeStudent(r.id)}><span><X size={12} aria-hidden="true"/></span></button></div>})}</div><div className="review-pagination"><button disabled={activeStudent===0} onClick={()=>setActiveStudent(i=>i-1)}>이전 학생</button><span>{Math.min(activeStudent+1,rows.length)} / {rows.length}</span><button disabled={activeStudent>=rows.length-1} onClick={()=>setActiveStudent(i=>i+1)}>다음 학생</button></div>
 <details className="mt-3 rounded-xl border border-pink-100 p-3"><summary className="text-sm font-bold cursor-pointer">공통 수업 내용·특이 사항·과제·시험범위 입력</summary><div className="grid md:grid-cols-3 gap-2 mt-2">{([['content', '수업 내용'], ['specialNote', '특이 사항'], ['assignment', '과제'],['examScope','시험범위']] as const).map(([key, label]) => <label key={key}>{label}{key==='content'?<span className="text-xs text-rose-600 ml-1">(필수)</span>:<OptionalMark/>}<textarea rows={2} value={common[key]} onChange={e => setCommon(c => ({ ...c, [key]: e.target.value }))}/></label>)}</div><button className="small-button mt-2" disabled={!checked.length} onClick={() => { if (rows.some(r => checked.includes(r.id) && (r.data.content || r.data.assignment || r.data.specialNote)) && !window.confirm('선택한 학생의 수업 내용·특이 사항·과제·시험범위를 공통 입력 내용으로 바꿀까요?'))
        return; setRows(previous => previous.map(r => checked.includes(r.id)&&!r.pending ? { ...r,touched:[...(r.touched||[]),'content','assignment'],data: applyCommonLesson(r.data, common) } : r)); }}>선택한 {checked.length}명에게 적용</button><button className="small-button ml-2 mt-2" disabled={!checked.length} onClick={() => setRows(previous => previous.map(r => checked.includes(r.id)&&!r.pending ? { ...r, data:r.sessionRecords?autoSessionNumbers({...r.data,attendance:'출석',attitude:'상',homework:'상'},r.sessionRecords,r.touched,Boolean(r.savedData)||r.stage!=='new').data:{...r.data,attendance:'출석',attitude:'상',homework:'상'} } : r))}>출석·태도·숙제 일괄 상</button></details>
 <div className="flex flex-wrap items-center gap-2 my-3"><label className="flex items-center gap-2"><input type="checkbox" checked={rows.length > 0 && checked.length === rows.length} onChange={e => setChecked(e.target.checked ? rows.map(r => r.id) : [])}/>전체 선택</label><button className="primary-button" disabled={!checked.length||rows.some(r=>checked.includes(r.id)&&r.loading)} onClick={() => submitRows('save', checked)}>선택 {checked.length}명 저장</button><button className="small-button" disabled={!checked.length || rows.filter(r => checked.includes(r.id)).some(r => !gridCanSubmit(r))} onClick={() => { if (window.confirm(`${checked.length}명의 현재 입력 내용을 저장하고 반영할까요?`))
        void submitRows('publish', checked); }}>선택 {checked.length}명 반영</button></div>
 {notice && <p role="status" className="text-xs text-slate-500 mb-3">{notice}</p>}
 <div className="lesson-grid-scroll lesson-editor-fields" tabIndex={0} aria-label="학생별 수업 입력 표"><table><thead><tr><th>학생</th><th>수업·자습 시간과 회차</th><th>출결·평가·점수</th><th>수업 내용</th><th>특이 사항·과제</th><th>저장·반영</th></tr></thead><tbody>{rows.slice(activeStudent,activeStudent+1).map(row => <tr key={row.id}>
 <td><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><label className="flex gap-2 items-center"><input type="checkbox" checked={checked.includes(row.id)} onChange={e => setChecked(e.target.checked ? [...checked, row.id] : checked.filter(x => x !== row.id))}/><strong>{data.students.find((s: any) => s.studentKey === row.data.studentKey)?.studentDisplayName}</strong></label><span className="block text-xs text-slate-500 mt-1">{row.data.subject}</span>{row.loading&&<p role="status" className="text-xs text-slate-500">직전 수업의 회차·내용·과제를 불러오는 중…</p>}<input aria-label="수업 날짜" type="date" value={row.data.date} onChange={e => setField(row.id, 'date', e.target.value)}/></fieldset></td>
 <td data-label="수업·자습"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><LessonAcademyFields value={row.data} roundHints={autoSessionNumbers(row.data,row.sessionRecords||[],row.touched,Boolean(row.savedData)||row.stage!=='new').hints} regularTime={regularLessonTime(data,row.data.studentKey,row.data.subject,row.data.date,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()))} onChange={(key, value,manual) => setField(row.id, key, value,manual)}/></fieldset></td>
 <td data-label="출결·평가"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="lesson-evaluation-fields">{lessonOptionGroups.map(group=><div key={group.key}><ChipGroup label={group.label} options={group.options} value={row.data[group.key]} disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))} splitAt={'splitAt' in group?group.splitAt:undefined} onChange={value=>setField(row.id,group.key,value)}/></div>)}</div><LessonTests value={row.data} onChange={(key, value) => setField(row.id, key, value)}/></fieldset></td>
 <td data-label="수업 내용"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><label>수업 내용<span className="text-xs text-rose-600 ml-1">(필수)</span><textarea required aria-required="true" rows={5} value={row.data.content} onChange={e => setField(row.id, 'content', e.target.value)}/></label><div className="mt-2"><label>특이 사항<OptionalMark/><textarea rows={3} value={row.data.specialNote} onChange={e => setField(row.id, 'specialNote', e.target.value)}/></label><label className="block mt-2">과제<OptionalMark/><textarea rows={3} value={row.data.assignment} onChange={e => setField(row.id, 'assignment', e.target.value)}/></label><label className="block mt-2">시험범위<OptionalMark/><textarea rows={3} maxLength={5000} value={row.data.examScope||''} onChange={e=>setField(row.id,'examScope',e.target.value)}/></label>{(row.data.note || row.data.nextPlan) && <details className="text-xs text-slate-500 mt-2"><summary>기존 기록 메모</summary><p className="whitespace-pre-wrap">{row.data.note}</p><p className="whitespace-pre-wrap">{row.data.nextPlan}</p></details>}</div></fieldset></td>
 <td data-label="저장·반영"><fieldset className="min-w-0" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><div className="flex flex-col gap-2">{canRetryPublication(row) && <button className="small-button" onClick={()=>act(async()=>{try{const result=await request('publish',{id:row.id});if(result.record)setRow(row.id,{stage:result.record.stage,revision:result.record.revision,savedData:result.record.data,error:result.warning || ''});}finally{await refresh();}})}>저장 결과 확인·재시도</button>}{row.error && <p role="alert" className="text-xs text-rose-600">{row.error}</p>}</div></fieldset></td>
 </tr>)}</tbody></table>{!rows.length && <p className="text-sm text-slate-500 p-4">학생을 추가하면 여러 명의 수업을 함께 작성할 수 있습니다.</p>}</div>
 {rows.slice(activeStudent,activeStudent+1).map(row=><div key={row.id} className="lesson-action-fieldset"><LessonActionBar status={lessonRecordStatus(row,Boolean(row.pending||isRecordBusy(row.id)),Boolean(row.savedData&&JSON.stringify(row.savedData)!==JSON.stringify(row.data)))} reason={row.pending||isRecordBusy(row.id)?'현재 기록을 처리하고 있어요':row.loading?'직전 수업을 불러오는 중이에요':!row.data.content?.trim()?'수업 내용을 입력하면 반영할 수 있어요':['publishing','processing','notion_saved'].includes(row.stage)?'이미 반영 중인 기록이에요':!gridCanSubmit(row)?'이미 반영 완료된 기록이에요':undefined} refresh={<button type="button" className="lesson-refresh-button" aria-label="반영 상태 확인" title="반영 상태 확인" onClick={() => act(async () => { const fresh = await request('read:draft-records',{ids:rows.map(r=>r.id).join(','),force:'1'}); setRows(previous => previous.map(row => { const saved = fresh.records.find((d: any) => d.id === row.id); return saved ? { ...row, revision: saved.revision, stage: saved.stage, savedData: saved.data,publishStartedAt:saved.publishStartedAt,notionWrite:saved.notionWrite } : row; })); await refresh(); })}><RefreshCw size={16} aria-hidden="true"/></button>}><fieldset className="lesson-action-controls" disabled={Boolean(row.pending||row.loading||isRecordBusy(row.id))}><button className="primary-button" disabled={row.loading} onClick={() => submitRows('save', [row.id])}>{row.pending&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}이 학생 저장</button><button className="small-button" disabled={!gridCanSubmit(row)} onClick={() => submitRows('publish', [row.id])}>{row.pending&&<LoaderCircle size={14} className="lesson-button-spinner" aria-hidden="true"/>}이 학생 반영</button></fieldset></LessonActionBar></div>)}</fieldset></WorkspaceDialog></section></div>;
}





