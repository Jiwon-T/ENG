import {submitSchedule} from '../../lib/scheduleSubmission';
import LessonConflictReview from './LessonConflictReview';
import {canRetryPublication} from '../../lib/teacherPublicationRecovery';
import OptionalMark from './OptionalMark';
import { useEffect, useState } from 'react';
const subjects = ['영어', '수학', '국어', '과학', '한국사'];
const labels: Record<string, string> = { draft: '저장됨', published: '반영 완료', processing: '반영 중', publishing: '반영 준비 중', notion_saved: 'Notion 저장됨', failed: '반영 실패' };
const initial = () => ({ title: '', subject: '영어', students: [] as string[], date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()), start: '14:00', end: '15:30', kind: '보강', status: '예정', place: '학원', note: '' });
interface Props {
    selection?: {
        date: string;
        record?: any;
        nonce: number;
    };
    onWorking?: (working:boolean)=>void;
    onNotice?: (message:string)=>void;
    onDirty?: (dirty: boolean) => void;
    onClose?: () => void;
    data: any;
    busy: boolean;
    request: (action?: string, body?: any) => Promise<any>;
    refresh: () => Promise<void>;
    act: (callback: () => Promise<any>) => Promise<void>;
}
export default function TeacherScheduleEditor({ data, busy, request, refresh, act, selection, onDirty, onClose, onWorking, onNotice }: Props) {
    const [form, setForm] = useState(initial), [id, setId] = useState<string | null>(null), [revision, setRevision] = useState<number>(), [notice, setNotice] = useState('');
    const [listPage,setListPage]=useState(1);
    const [places, setPlaces] = useState<string[]>([]), [placeLoading, setPlaceLoading] = useState(true), [placeError, setPlaceError] = useState('');
    const [placeRefresh, setPlaceRefresh] = useState(0);
    useEffect(() => {
        let live = true;
        setPlaceLoading(true); setPlaceError('');
        request('read:schedule-options').then(r => { if(live) setPlaces(r.places); }).catch(e => { if(live) { setPlaces([]); setPlaceError(e instanceof Error ? e.message : '장소 목록을 불러오지 못했습니다.'); } }).finally(() => { if(live) setPlaceLoading(false); });
        return () => { live = false; };
    }, [selection?.nonce, placeRefresh]);
    const [baseline, setBaseline] = useState(() => JSON.stringify(initial()));
    useEffect(() => { if (!selection)
        return; const selected = selection.record; const value = selected ? selected.data : { ...initial(), date: selection.date, subject: data.scopes?.[0]?.subject || '영어' }; setForm(value); setBaseline(JSON.stringify(value)); setId(selected?.id || crypto.randomUUID()); setRevision(selected?.revision); setNotice(''); }, [selection?.nonce]);
    useEffect(() => { onDirty?.(JSON.stringify(form) !== baseline); }, [form, baseline, onDirty]);
    const listPages=Math.max(1,Math.ceil((data.schedules?.length||0)/10)),currentListPage=Math.min(listPage,listPages);
    const record = data.schedules?.find((r: any) => r.id === id);
    const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
    const validPlace = !placeLoading && !placeError && (form.place === '' || places.includes(form.place));
    const canPublish = validPlace && Boolean(id) && !busy && !record?.deleteRequested && !['processing', 'publishing', 'notion_saved'].includes(record?.stage) && !canRetryPublication(record);
    async function submit(){if(!id)return;onWorking?.(true);try{await submitSchedule({id,revision,data:form,record,request,onSaved:saved=>{setId(saved.id);setRevision(saved.record?.revision??(revision||0)+1);setBaseline(JSON.stringify(form));onDirty?.(false);}});setNotice('노션과 학생·학부모 일정에 반영했습니다.');onNotice?.('일정을 노션과 학생·학부모 리포트에 반영했습니다.');}finally{onWorking?.(false);await refresh();}}
    return <section className="panel mt-4"><div className="flex justify-between items-center mb-3"><h2 className="!mb-0">보강·휴강·시험 일정</h2>{onClose && <button className="small-button" onClick={onClose}>닫기</button>}</div>{record?.deleteRequested&&<div role="status" className="text-sm text-slate-500 mb-3">삭제를 위한 취소 반영 {record.stage==='failed'?'실패':'진행 중'}입니다. 완료되면 목록에서 숨겨집니다. {record.stage==='failed'&&<button className="small-button ml-2" disabled={busy} onClick={()=>act(async()=>{await request('archive-schedule',{id:record.id,revision:record.revision});await refresh();setNotice('취소 반영을 다시 요청했습니다.');})}>취소 반영 다시 시도</button>}</div>}<fieldset disabled={busy || Boolean(record && !data.admin && record.ownerUid!==data.uid) || Boolean(record?.deleteRequested)}><div className="grid md:grid-cols-2 gap-5"><div>
  <label>일정명<input value={form.title} onChange={e => set('title', e.target.value)} placeholder="예: 관계대명사 보강"/></label>
  <div className="grid grid-cols-2 gap-3 mt-3"><label>날짜<input type="date" value={form.date} onChange={e => set('date', e.target.value)}/></label><label>과목<select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value, students: [] }))}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
  <label>시작<input type="time" value={form.start} onChange={e => set('start', e.target.value)}/></label><label>종료<input type="time" value={form.end} onChange={e => set('end', e.target.value)}/></label>
  {([['kind', '종류', ['정규 수업', '보강', '휴강', '시험', '기타']], ['status', '상태', ['예정', '변경', '완료', '취소']]] as const).map(([key, label, options]) => <label key={key}>{label}<select value={form[key]} onChange={e => set(key, e.target.value)}>{options.map(x => <option key={x}>{x}</option>)}</select></label>)}
  <label>장소<select value={form.place} disabled={placeLoading || Boolean(placeError)} onChange={e => set('place', e.target.value)}><option value="">미지정</option>{form.place && !places.includes(form.place) && <option value={form.place} disabled>{form.place}{placeLoading ? ' (불러오는 중)' : ' (현재 옵션에 없음)'}</option>}{places.map(place => <option key={place} value={place}>{place}</option>)}</select></label></div>
  <div className="flex items-center gap-2 mt-2"><p role="status" className="text-xs text-slate-500">{placeLoading ? '노션 장소 목록을 불러오는 중…' : placeError || (form.place && !places.includes(form.place) ? '기존 장소를 표시했습니다. 현재 노션 옵션에서 장소를 다시 선택해 주세요.' : '노션 일정표의 장소 옵션입니다.')}</p><button className="small-button" type="button" disabled={placeLoading} onClick={() => setPlaceRefresh(n => n + 1)}>장소 목록 새로고침</button></div>
  <label className="block mt-3">반 학생 불러오기<OptionalMark/><select value="" onChange={e=>{const c=data.classes.find((c:any)=>c.id===e.target.value);if(c)setForm(f=>({...f,subject:c.subject,students:c.students}));}}><option value="">반 선택</option>{data.classes.filter((c:any)=>data.admin||c.ownerUid===data.uid).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p className="text-xs font-semibold text-slate-500 mt-4 mb-2">대상 학생</p><div className="max-h-40 overflow-auto rounded-xl border border-pink-100 p-2">{data.students.filter((s: any) => data.admin || (data.teachingScopes||data.scopes).some((x: any) => x.studentKey === s.studentKey && x.subject === form.subject)).map((s: any) => <label key={s.studentKey} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" checked={form.students.includes(s.studentKey)} onChange={e => set('students', e.target.checked ? [...form.students, s.studentKey] : form.students.filter(x => x !== s.studentKey))}/>{s.studentDisplayName}</label>)}</div>
  <label className="block mt-3">안내 내용<OptionalMark/><textarea rows={3} value={form.note} onChange={e => set('note', e.target.value)}/></label>
  <div className="flex flex-wrap gap-2 mt-3"><button className="primary-button" disabled={busy || !validPlace} onClick={() => act(async () => { const r = await request('save-schedule', { id, revision, data: form }); setId(r.id); setRevision((revision || 0) + 1); setBaseline(JSON.stringify(form)); await refresh(); setNotice('일정을 저장했습니다. 반영하면 학생·학부모 리포트에 표시됩니다.'); })}>저장</button><button className="small-button" disabled={!canPublish} onClick={() => act(submit)}>반영</button><button className="small-button" disabled={busy} onClick={() => { if (JSON.stringify(form) !== baseline && !window.confirm('저장하지 않은 변경을 취소하고 새 일정을 만들까요?'))
        return; setId(crypto.randomUUID()); setRevision(undefined); const value = { ...initial(), date: selection?.date || initial().date, subject: data.scopes?.[0]?.subject || '영어' }; setForm(value); setBaseline(JSON.stringify(value)); setNotice(''); }}>새 일정</button>{record&&<button className="small-button" disabled={busy||['publishing','processing','notion_saved'].includes(record.stage)} onClick={()=>act(async()=>{if(!window.confirm(record.notionPageId?'이 일정을 삭제할까요? 학생·학부모 리포트에도 취소를 요청하고, 완료 후 목록에서 숨깁니다.':'이 일정을 삭제할까요?'))return;const r=await request('archive-schedule',{id,revision});await refresh();onDirty?.(false);setId(null);setRevision(undefined);const next=initial();setForm(next);setBaseline(JSON.stringify(next));setNotice(r.pendingCancellation?'취소 반영을 요청했습니다. 반영 완료 후 목록에서 사라집니다.':'일정을 삭제했습니다.');})}>일정 삭제</button>}<button className="small-button" disabled={busy} onClick={() => act(refresh)}>새로고침</button></div>{notice && <p role="status" className="text-xs text-slate-500 mt-3">{notice}</p>}
 </div><div><h2>저장한 일정</h2>{(data.schedules || []).slice().sort((a: any, b: any) => b.updatedAt - a.updatedAt).slice((currentListPage-1)*10,currentListPage*10).map((r: any) => <button key={r.id} className="w-full text-left py-3 min-h-[44px] border-b border-pink-100" onClick={() => { if (JSON.stringify(form) !== baseline && !window.confirm('저장하지 않은 변경을 취소하고 다른 일정을 열까요?'))
        return; setId(r.id); setRevision(r.revision); setForm(r.data); setBaseline(JSON.stringify(r.data)); setNotice(''); }}><span className="font-bold text-sm">{r.data.title}</span><span className="block text-xs text-slate-500 mt-1">{r.data.date} · {r.data.start}–{r.data.end} · {r.data.subject} · {r.data.status}</span><span className="block text-xs text-pink-500 mt-1">{labels[r.stage] || r.stage}</span></button>)}<div className="review-pagination"><button disabled={currentListPage===1} onClick={()=>setListPage(currentListPage-1)}>이전</button><span>{currentListPage} / {listPages}</span><button disabled={currentListPage===listPages} onClick={()=>setListPage(currentListPage+1)}>다음</button></div>{!data.schedules?.length && <p className="text-xs text-slate-500">저장한 일정이 없습니다.</p>}</div></div></fieldset>{busy&&<p role="status" className="text-sm mt-3">저장·반영 처리 중입니다. 창을 닫아도 요청은 계속 진행되며 결과는 상단에 표시됩니다.</p>}<LessonConflictReview kind="schedule" record={record} request={request} act={act} busy={busy} refresh={refresh}/>{canRetryPublication(record) && <div className="mt-3"><p className="text-xs text-slate-500">저장한 일정의 대상과 입력으로 반영 결과를 확인합니다.</p><button className="small-button mt-2" disabled={busy} onClick={()=>act(async()=>{try{await request(record.deleteRequested?'archive-schedule':'publish-schedule',{id:record.id,revision:record.revision});setNotice('저장한 일정 반영을 확인했습니다.');}finally{await refresh();}})}>저장 결과 확인·재시도</button></div>}</section>;
}



