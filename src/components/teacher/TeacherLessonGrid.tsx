import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import OptionalMark from './OptionalMark';
import TeacherTodayLessons from './TeacherTodayLessons';
import {applyPreviousLesson,type TodayLesson} from '../../lib/teacherTodayLessons';
import WorkspaceDialog from './WorkspaceDialog';
import LessonTests from './LessonTests';
import LessonAcademyFields from './LessonAcademyFields';
import { useEffect, useState } from 'react';
import { applyCommonLesson, gridCanSubmit, gridScore, newGridLesson, processLessonRows } from '../../lib/teacherLessonGrid';
interface Props {
    active?:boolean;
    data: any;
    busy: boolean;
    request: (action?: string, body?: any) => Promise<any>;
    refresh: () => Promise<void>;
    act: (callback: () => Promise<any>) => Promise<void>;
}
interface Row {
    id: string;
    revision?: number;
    stage: string;
    data: ReturnType<typeof newGridLesson>;
    savedData?: any;
    error?: string;
    loading?: boolean;
    touched?: string[];
    publishStartedAt?:number;
    notionWrite?:any;
}
const evaluations = ['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상'];
export default function TeacherLessonGrid({ data, busy, request, refresh, act,active=true }: Props) {
    const [editorOpen,setEditorOpen]=useState(false),[activeStudent,setActiveStudent]=useState(0),[classId,setClassId]=useState('');
    const [rows, setRows] = useState<Row[]>([]), [selection, setSelection] = useState<string[]>([]), [checked, setChecked] = useState<string[]>([]);
    const [subject, setSubject] = useState(data.scopes?.[0]?.subject || '영어'), [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())), [start, setStart] = useState('14:00'), [end, setEnd] = useState('15:30');
    const [common, setCommon] = useState({ content: '', specialNote: '', assignment: '' }), [notice, setNotice] = useState(''), [search, setSearch] = useState('');
    useEffect(()=>{const c=data.classes.find((c:any)=>c.id===classId);const slot=c?.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===new Date(`${date}T12:00:00+09:00`).getUTCDay()).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];if(slot){setStart(slot.start);setEnd(slot.end);}},[classId,date,data.classes]);
    const students = data.students.filter((s: any) => data.admin || (data.teachingScopes||data.scopes).some((x: any) => x.studentKey === s.studentKey && x.subject === subject));
    const setRow = (id: string, patch: Partial<Row>) => setRows(previous => previous.map(r => r.id === id ? { ...r, ...patch } : r));
    const setField = (id: string, key: string, value: any) => setRows(previous => previous.map(r => r.id === id ? { ...r, error: undefined,touched:[...(r.touched||[]),key],data: { ...r.data, [key]: value } } : r));
    async function run(mode: 'save' | 'publish', ids: string[]) {
        const chosen = rows.filter(r => ids.includes(r.id)&&!r.loading);
        const { succeeded, failed } = await processLessonRows(chosen, mode, request, setRow);
        setNotice(`${mode === 'save' ? '저장' : '반영 요청'} ${succeeded}건${failed ? ` · 실패 ${failed}건 — 해당 학생의 안내를 확인해 주세요.` : ''}`);
        await refresh();
    }
    async function addStudents(keys=selection,settings={subject,date,start,end}) {
        const added = keys.filter(key => !rows.some(r => r.data.studentKey === key && r.data.subject === settings.subject && r.data.date === settings.date&&r.data.start===settings.start&&r.data.end===settings.end));
        const next:Row[] = added.map(key => ({ id: crypto.randomUUID(), stage: 'new', loading:true,data: newGridLesson(key, settings.subject, settings.date, settings.start, settings.end) }));
        setRows(previous => [...previous, ...next]);
        setChecked(previous => [...previous, ...next.map(r => r.id)]);
        setSelection([]);setActiveStudent(next.length?rows.length:Math.max(0,rows.findIndex(r=>keys.includes(r.data.studentKey)&&r.data.subject===settings.subject&&r.data.date===settings.date&&r.data.start===settings.start&&r.data.end===settings.end)));setEditorOpen(true);
        await Promise.all(next.map(async row=>{
            try{const result=await request('previous-lesson',{studentKey:row.data.studentKey,subject:row.data.subject,date:row.data.date});
                setRows(previous=>previous.map(r=>r.id===row.id?{...r,loading:false,data:applyPreviousLesson(r.data,row.data,result.data,r.touched),error:undefined}:r));
            }catch(e){setRow(row.id,{loading:false,error:e instanceof Error?e.message:'직전 수업 조회 실패'});}
        }));
    }
    function chooseGroup(event:TodayLesson){
        setClassId('');setSubject(event.subject);setDate(event.date);setStart(event.start);setEnd(event.end);
        void addStudents(event.students,{subject:event.subject,date:event.date,start:event.start,end:event.end});
    }
    return <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4"><aside className="min-w-0"><TeacherTodayLessons data={data} date={date} onDate={setDate} request={request} active={active} disabled={busy} onGroup={chooseGroup}/></aside><section className="panel lesson-grid min-w-0"><div className="flex flex-wrap justify-between gap-2 mb-3"><h2 className="!mb-0">여러 학생 함께 작성</h2><span className="text-xs text-slate-500">학생마다 별도 기록으로 저장됩니다. 탭을 바꿔도 입력은 유지됩니다.</span></div><fieldset disabled={busy}>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><label>과목<select value={subject} onChange={e => { setSubject(e.target.value); setSelection([]); }}>{['영어', '수학', '국어', '과학', '한국사'].map(s => <option key={s}>{s}</option>)}</select></label><label>날짜<input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label>시작<input type="time" value={start} onChange={e => setStart(e.target.value)}/></label><label>종료<input type="time" value={end} onChange={e => setEnd(e.target.value)}/></label></div>
 <label className="block mt-3">반 학생 불러오기<OptionalMark/><select value={classId} onChange={e=>{setClassId(e.target.value);const c=data.classes.find((c:any)=>c.id===e.target.value);if(!c)return;setSubject(c.subject);setSelection(c.students);const weekday=new Date(`${date}T12:00:00+09:00`).getUTCDay();const slot=c.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];if(slot){setStart(slot.start);setEnd(slot.end);}}}><option value="">반 선택 → 학생 추가에서 확인 후 추가</option>{data.classes.filter((c:any)=>c.status!=='중단'&&(data.admin||c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid))).map((c:any)=><option key={c.id} value={c.id}>{c.name} · {c.students.length}명</option>)}</select></label>
 <details open={!rows.length} className="mt-3 rounded-xl border border-pink-100 p-3"><summary className="text-sm font-bold cursor-pointer">학생 추가 · {selection.length}명 선택</summary><input aria-label="추가할 학생 검색" placeholder="학생 이름 검색" value={search} onChange={e => setSearch(e.target.value)}/><div className="flex flex-wrap gap-x-4 gap-y-1 max-h-40 overflow-auto mt-2">{students.filter((s: any) => s.studentDisplayName.includes(search.trim())).map((s: any) => <label key={s.studentKey} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" checked={selection.includes(s.studentKey)} onChange={e => setSelection(e.target.checked ? [...selection, s.studentKey] : selection.filter(x => x !== s.studentKey))}/>{s.studentDisplayName}</label>)}</div><button className="small-button mt-2" disabled={!selection.length} onClick={()=>void addStudents()}>선택한 학생 추가</button></details>
 {rows.length>0&&<button className="primary-button mt-3" onClick={()=>setEditorOpen(true)}>작성 팝업 열기 · {rows.length}명</button>}
 </fieldset><WorkspaceDialog open={editorOpen&&active} title="여러 학생 수업 일지 작성" onClose={()=>{if(!busy)setEditorOpen(false);}}><fieldset disabled={busy}><div className="flex flex-wrap gap-2 mb-3">{rows.map((r,i)=><button key={r.id} className={i===activeStudent?'primary-button':'small-button'} onClick={()=>setActiveStudent(i)}>{data.students.find((s:any)=>s.studentKey===r.data.studentKey)?.studentDisplayName||'학생'}</button>)}</div><div className="review-pagination"><button disabled={activeStudent===0} onClick={()=>setActiveStudent(i=>i-1)}>이전 학생</button><span>{Math.min(activeStudent+1,rows.length)} / {rows.length}</span><button disabled={activeStudent>=rows.length-1} onClick={()=>setActiveStudent(i=>i+1)}>다음 학생</button></div>
 <details className="mt-3 rounded-xl border border-pink-100 p-3"><summary className="text-sm font-bold cursor-pointer">공통 수업 내용·특이 사항·과제 입력</summary><div className="grid md:grid-cols-3 gap-2 mt-2">{([['content', '수업 내용'], ['specialNote', '특이 사항'], ['assignment', '과제']] as const).map(([key, label]) => <label key={key}>{label}{key==='content'?<span className="text-xs text-rose-600 ml-1">(필수)</span>:<OptionalMark/>}<textarea rows={2} value={common[key]} onChange={e => setCommon(c => ({ ...c, [key]: e.target.value }))}/></label>)}</div><button className="small-button mt-2" disabled={!checked.length} onClick={() => { if (rows.some(r => checked.includes(r.id) && (r.data.content || r.data.assignment || r.data.specialNote)) && !window.confirm('선택한 학생의 수업 내용·특이 사항·과제를 공통 입력 내용으로 바꿀까요?'))
        return; setRows(previous => previous.map(r => checked.includes(r.id) ? { ...r,touched:[...(r.touched||[]),'content','assignment'],data: applyCommonLesson(r.data, common) } : r)); }}>선택한 {checked.length}명에게 적용</button><button className="small-button ml-2 mt-2" disabled={!checked.length} onClick={() => setRows(previous => previous.map(r => checked.includes(r.id) ? { ...r, data: { ...r.data, attendance: '출석', attitude: '상', homework: '상' } } : r))}>출석·태도·숙제 일괄 상</button></details>
 <div className="flex flex-wrap items-center gap-2 my-3"><label className="flex items-center gap-2"><input type="checkbox" checked={rows.length > 0 && checked.length === rows.length} onChange={e => setChecked(e.target.checked ? rows.map(r => r.id) : [])}/>전체 선택</label><button className="primary-button" disabled={!checked.length||rows.some(r=>checked.includes(r.id)&&r.loading)} onClick={() => act(() => run('save', checked))}>선택 저장</button><button className="small-button" disabled={!checked.length || rows.filter(r => checked.includes(r.id)).some(r => !gridCanSubmit(r))} onClick={() => act(async () => { if (window.confirm(`${checked.length}명의 현재 입력 내용을 저장하고 반영할까요?`))
        await run('publish', checked); })}>선택 반영</button><button className="small-button" onClick={() => act(async () => { const fresh = await request('read:draft-records',{ids:rows.map(r=>r.id).join(','),force:'1'}); setRows(previous => previous.map(row => { const saved = fresh.records.find((d: any) => d.id === row.id); return saved ? { ...row, revision: saved.revision, stage: saved.stage, savedData: saved.data,publishStartedAt:saved.publishStartedAt,notionWrite:saved.notionWrite } : row; })); await refresh(); })}>반영 상태 확인</button></div>
 {notice && <p role="status" className="text-xs text-slate-500 mb-3">{notice}</p>}
 <div className="lesson-grid-scroll" tabIndex={0} aria-label="학생별 수업 입력 표"><table><thead><tr><th>학생</th><th>수업·자습 시간과 회차</th><th>출결·평가·점수</th><th>수업 내용</th><th>특이 사항·과제</th><th>저장·반영</th></tr></thead><tbody>{rows.slice(activeStudent,activeStudent+1).map(row => <tr key={row.id}>
 <td><label className="flex gap-2 items-center"><input type="checkbox" checked={checked.includes(row.id)} onChange={e => setChecked(e.target.checked ? [...checked, row.id] : checked.filter(x => x !== row.id))}/><strong>{data.students.find((s: any) => s.studentKey === row.data.studentKey)?.studentDisplayName}</strong></label><span className="block text-xs text-slate-500 mt-1">{row.data.subject}</span>{row.loading&&<p role="status" className="text-xs text-slate-500">직전 수업의 회차·내용·과제를 불러오는 중…</p>}<input aria-label="수업 날짜" type="date" value={row.data.date} onChange={e => setField(row.id, 'date', e.target.value)}/></td>
 <td data-label="수업·자습"><LessonAcademyFields value={row.data} onChange={(key, value) => setField(row.id, key, value)}/></td>
 <td data-label="출결·평가">{([['attendance', '출결', ['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']], ['attitude', '태도', ['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']], ['homework', '숙제', evaluations], ['test', '테스트', evaluations]] as const).map(([key, label, values]) => <label key={key} className="block mb-1">{label}<select value={row.data[key]} onChange={e => setField(row.id, key, e.target.value)}>{values.map(v => <option key={v}>{v}</option>)}</select></label>)}<LessonTests value={row.data} onChange={(key, value) => setField(row.id, key, value)}/></td>
 <td data-label="수업 내용"><label>수업 내용<span className="text-xs text-rose-600 ml-1">(필수)</span><textarea required aria-required="true" rows={5} value={row.data.content} onChange={e => setField(row.id, 'content', e.target.value)}/></label><div className="mt-2"><label>특이 사항<OptionalMark/><textarea rows={3} value={row.data.specialNote} onChange={e => setField(row.id, 'specialNote', e.target.value)}/></label><label className="block mt-2">과제<OptionalMark/><textarea rows={3} value={row.data.assignment} onChange={e => setField(row.id, 'assignment', e.target.value)}/></label>{(row.data.note || row.data.nextPlan) && <details className="text-xs text-slate-500 mt-2"><summary>기존 기록 메모</summary><p className="whitespace-pre-wrap">{row.data.note}</p><p className="whitespace-pre-wrap">{row.data.nextPlan}</p></details>}</div></td>
 <td data-label="저장·반영"><div className="flex flex-col gap-2"><button className="primary-button" disabled={row.loading} onClick={() => act(() => run('save', [row.id]))}>저장</button><button className="small-button" disabled={!gridCanSubmit(row)} onClick={() => act(() => run('publish', [row.id]))}>반영</button><span className="text-xs text-slate-500">{({ report_published_notion_pending:'리포트 반영 완료 · 노션 대기', reflection_pending:'노션 저장 완료 · 연동 대기', new: '작성 중', draft: '저장됨', published: '반영 완료', processing: '반영 중', publishing: '반영 준비 중', failed: '반영 실패' } as Record<string, string>)[row.stage] || row.stage}{row.savedData && JSON.stringify(row.savedData) !== JSON.stringify(row.data) ? ' · 수정됨' : ''}</span>{canRetryPublication(row) && <button className="small-button" onClick={()=>act(async()=>{try{const result=await request('publish',{id:row.id});if(result.record)setRow(row.id,{stage:result.record.stage,revision:result.record.revision,savedData:result.record.data,error:result.warning || ''});}finally{await refresh();}})}>저장 결과 확인·재시도</button>}{row.error && <p role="alert" className="text-xs text-rose-600">{row.error}</p>}</div></td>
 </tr>)}</tbody></table>{!rows.length && <p className="text-sm text-slate-500 p-4">학생을 추가하면 여러 명의 수업을 함께 작성할 수 있습니다.</p>}</div>
 </fieldset></WorkspaceDialog></section></div>;
}
