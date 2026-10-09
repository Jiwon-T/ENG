import { useRef, useState } from 'react';
import { Users, Trash2, CheckCircle2, AlertCircle, StickyNote } from 'lucide-react';
import StudentCombobox from './StudentCombobox';
import WorkspaceDialog from './WorkspaceDialog';
import StatusBadge from './StatusBadge';
import ExamFields from './AcademicExamFields';
import { detailMetadata, suggestedExamTitle, withSuggestedTitle, schoolTagFrom } from '../../lib/academicExamPeriod';
import { academicBatchPayload, academicBatchError, applyAcademicBatchChunks } from '../../lib/academicBatch';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const SUBJECTS = ['영어', '수학', '국어', '과학', '한국사'];
const STATUSES = ['제출 완료', '미제출', '제출 대상 아님'];
const statusLabel: Record<string, string> = { '제출 완료': '제출', '미제출': '미제출', '제출 대상 아님': '대상 아님' };
const MAX_ROWS = 100;
export default function AcademicBatchEditor({ data, kind, onClose, request, act, onSaved }: {
    data: any;
    kind: string;
    onClose: () => void;
    request: (action: string, body?: any) => Promise<any>;
    act: (f: () => Promise<any>) => Promise<void>;
    onSaved: () => Promise<any>;
}) {
    const [common, setCommon] = useState(() => { const value = { subject: data.scopes?.[0]?.subject || '영어', examType: kind, examDetail: kind === '학교 내신' ? '1학기 중간고사' : '', examYear: new Date().getFullYear(), title: '', examDate: today(), maxScore: 100 as number | null, deadline: null as string | null, ...detailMetadata(kind === '학교 내신' ? '1학기 중간고사' : '') }; return { ...value, title: suggestedExamTitle(value) }; });
    const [rows, setRows] = useState<any[]>([]), [working, setWorking] = useState(false), [message, setMessage] = useState('');
    const [schoolTag, setSchoolTag] = useState(''), [editingExam, setEditingExam] = useState(true), [notes, setNotes] = useState<Record<string, boolean>>({});
    const lock = useRef(false), scoreInputs = useRef(new Map<string, HTMLInputElement>());
    const scopes = data.principal ? data.teachingScopes || [] : data.scopes || [];
    const students = (data.students || []).filter((s: any) => data.admin || scopes.some((v: any) => v.studentKey === s.studentKey && v.subject === common.subject));
    const frozen = rows.some(row => row.phase !== 'new');
    const patch = (id: string, value: any) => setRows(old => old.map(row => row.id === id ? { ...row, ...value } : row));
    const phases: Record<string, string> = { new: '미저장', saving: '저장 중', saved: '저장됨', publishing: '반영 중', published: '반영 완료', 'failed-save': '저장 확인 필요', 'failed-publish': '반영 확인 필요' };
    function field(key: string, value: any) {
        setCommon((old: any) => { const next = key === 'examDetail' ? { ...old, examDetail: value, ...detailMetadata(value) } : key === 'examType' ? { ...old, examType: value, examDetail: '', semester: null, examPeriod: null } : { ...old, [key]: value }; return ['examDetail', 'examType', 'examYear'].includes(key) ? withSuggestedTitle(old, next, schoolTag) : next; });
    }
    function changeTag(tag: string) { setCommon((old: any) => withSuggestedTitle(old, old, schoolTag, tag)); setSchoolTag(tag); }
    const newRow = (studentKey: string) => ({ id: crypto.randomUUID(), studentKey, score: null, grade: '', note: '', submissionStatus: '제출 완료', phase: 'new' });
    function add(keys: string[]) {
        if (working || frozen) return;
        const fresh = keys.filter(key => !rows.some(row => row.studentKey === key));
        if (rows.length + fresh.length > MAX_ROWS) setMessage(`한 번에 ${MAX_ROWS}명까지 입력할 수 있습니다.`);
        const added = fresh.slice(0, Math.max(0, MAX_ROWS - rows.length));
        if (!added.length) return;
        setRows(old => [...old, ...added.map(newRow)]);
        setEditingExam(false);
        // The first student's school and grade from student management fill the 학교·학년 tag once.
        if (!schoolTag && common.examType === '학교 내신') void request('read:student-school', { studentKey: added[0] }).then(r => { const tag = schoolTagFrom(r.school, r.grade); if (tag) changeTag(tag); }).catch(() => {});
    }
    const pending = rows.filter(row => ['new', 'failed-save'].includes(row.phase)), unpublished = rows.filter(row => row.phase !== 'published');
    const filled = rows.filter(row => row.submissionStatus === '제출 완료' && row.score !== null).length, empty = rows.filter(row => row.submissionStatus === '제출 완료' && row.score === null).length, missing = rows.filter(row => row.submissionStatus === '미제출').length;
    async function run(publish: boolean) {
        if (lock.current)
            return;
        const targets = rows.filter(row => publish ? ['new', 'failed-save', 'saved', 'failed-publish'].includes(row.phase) : ['new', 'failed-save'].includes(row.phase));
        if (!targets.length)
            return;
        const exam = { ...common, title: common.title.trim() || suggestedExamTitle(common, schoolTag) };
        const inputs = targets.map(row => ({ ...row, payload: row.payload || academicBatchPayload(exam, row) }));
        {
            const invalid = inputs.find(row => !students.some((s: any) => s.studentKey === row.studentKey) || academicBatchError(row.payload));
            if (invalid) {
                const name = data.students.find((s: any) => s.studentKey === invalid.studentKey)?.studentDisplayName;
                setMessage((name ? `${name}: ` : '') + (academicBatchError(invalid.payload) || '현재 과목의 담당 범위를 확인해 주세요.'));
                if (academicBatchError(invalid.payload).includes('시험')) setEditingExam(true);
                return;
            }
        }
        lock.current = true;
        setWorking(true);
        setMessage('');
        let successes = 0;
        try {
            await act(async () => { const completed = await applyAcademicBatchChunks(request, inputs, publish, patch); successes = completed.filter(row => row.phase === 'published' || row.phase === 'saved').length; await onSaved(); return { failed: completed.filter(row => row.phase.startsWith('failed')).length }; });
            setMessage(`${successes}/${inputs.length}명 ${publish ? '반영' : '저장'} 완료. 실패한 학생은 완료된 학생과 분리해서 다시 확인할 수 있습니다.`);
        }
        finally {
            lock.current = false;
            setWorking(false);
        }
    }
    const nameOf = (key: string) => data.students.find((s: any) => s.studentKey === key)?.studentDisplayName || '학생';
    const tags = [common.subject, common.examType === '학교 내신' ? '내신' : common.examType, common.title.trim() || suggestedExamTitle(common, schoolTag) || '시험명 없음', common.examDate ? `${Number(common.examDate.slice(5, 7))}월 ${Number(common.examDate.slice(8, 10))}일` : '시험일 없음', `만점 ${common.maxScore ?? '—'}`, ...(common.deadline ? [`기한 ${common.deadline.slice(5).replace('-', '/')}`] : [])];
    return <WorkspaceDialog open title="여러 학생 성적 입력" onClose={() => { if (working)
        return; if (rows.some(row => ['new', 'failed-save'].includes(row.phase)) && !window.confirm('저장하지 않은 성적 입력을 닫을까요?'))
        return; onClose(); }}><section className="academic-batch-editor gs"><p className="gs-lead">시험 정보는 한 번만, 점수는 학생별로 입력합니다.</p>
 <section className="gs-sec"><h3><span className="gs-num">1</span>시험</h3>
  {editingExam && !frozen ? <fieldset disabled={working || frozen}>
   <div className="gs-chips" role="group" aria-label="과목">{SUBJECTS.filter(subject => data.admin || scopes.some((s: any) => s.subject === subject)).map(subject => <button key={subject} type="button" className="rv-chip" aria-pressed={common.subject === subject} onClick={() => field('subject', subject)}>{subject}</button>)}</div>
   <ExamFields value={common} onField={field} schoolTag={schoolTag} onSchoolTag={changeTag}/>
   <div className="gs-two"><label><span className="gs-lbl">만점</span><input type="number" min="0.01" step="any" value={common.maxScore ?? ''} onChange={e => field('maxScore', e.target.value === '' ? null : Number(e.target.value))}/></label><label><span className="gs-lbl">제출 기한 <span className="gs-opt">(선택)</span></span><input type="date" value={common.deadline || ''} onChange={e => field('deadline', e.target.value || null)}/></label></div>
   {rows.length > 0 && <button type="button" className="small-button" onClick={() => setEditingExam(false)}>시험 정보 접기</button>}
  </fieldset> : <div className="gs-exam">{tags.map(tag => <span key={tag} className="gs-tag">{tag}</span>)}{!frozen && <button type="button" className="gs-link" style={{ marginLeft: 'auto' }} onClick={() => setEditingExam(true)}>수정</button>}</div>}
 </section>
 <section className="gs-sec"><h3><span className="gs-num">2</span>학생과 점수</h3>
  <fieldset disabled={working || frozen}><div className="gs-add"><StudentCombobox disabled={working || frozen} students={students.filter((s: any) => !rows.some(row => row.studentKey === s.studentKey))} value="" onChange={studentKey => add([studentKey])}/><button type="button" className="small-button" disabled={!students.some((s: any) => !rows.some(row => row.studentKey === s.studentKey))} onClick={() => add(students.map((s: any) => s.studentKey))}><Users size={16} aria-hidden="true"/>{common.subject} 담당 학생 모두 추가</button></div></fieldset>
  {rows.length > 0 ? <><div className="gs-rhead" aria-hidden="true"><span>학생 · 제출</span><span>점수</span><span>등급</span><span/></div>
  <div className="gs-rows">{rows.map((row, index) => <fieldset key={row.id} disabled={working || row.phase !== 'new'} className={'gs-row' + (row.submissionStatus === '미제출' ? ' is-missing' : '')}>
   <span className="gs-row-who"><strong>{nameOf(row.studentKey)}</strong><button type="button" className={'gs-toggle' + (row.submissionStatus === '미제출' ? ' is-missing' : row.submissionStatus === '제출 대상 아님' ? ' is-exempt' : '')} aria-label={`${nameOf(row.studentKey)} 제출 상태: ${row.submissionStatus} (눌러서 바꾸기)`} onClick={() => { const next = STATUSES[(STATUSES.indexOf(row.submissionStatus) + 1) % STATUSES.length]; patch(row.id, { submissionStatus: next, score: next === '제출 완료' ? row.score : null }); }}>{statusLabel[row.submissionStatus]}</button>{row.phase !== 'new' && <StatusBadge kind={row.phase === 'published' ? 'done' : row.phase.startsWith('failed') ? 'failed' : row.phase === 'saved' ? 'saved' : 'editing'} text={phases[row.phase]} compact/>}</span>
   <input ref={el => { if (el) scoreInputs.current.set(row.id, el); else scoreInputs.current.delete(row.id); }} aria-label={`${nameOf(row.studentKey)} 원점수`} type="number" inputMode="decimal" min={0} max={common.maxScore ?? undefined} step="any" disabled={row.submissionStatus !== '제출 완료'} placeholder={row.submissionStatus === '제출 완료' ? '점수' : statusLabel[row.submissionStatus]} value={row.score ?? ''} onChange={e => patch(row.id, { score: e.target.value === '' ? null : Number(e.target.value) })} onKeyDown={e => { if (e.key !== 'Enter' || e.nativeEvent.isComposing) return; e.preventDefault(); const next = rows.slice(index + 1).find(r => r.submissionStatus === '제출 완료' && r.phase === 'new'); if (next) scoreInputs.current.get(next.id)?.focus(); }}/>
   <input aria-label={`${nameOf(row.studentKey)} 예상 등급`} maxLength={50} placeholder="—" value={row.grade} onChange={e => patch(row.id, { grade: e.target.value })}/>
   {row.phase === 'new' ? <button type="button" className="gs-remove" aria-label={`${nameOf(row.studentKey)} 학생 제외`} onClick={() => setRows(old => old.filter(r => r.id !== row.id))}><Trash2 size={15}/></button> : <span/>}
   {(notes[row.id] || row.note) ? <input className="gs-row-note" aria-label={`${nameOf(row.studentKey)} 비고`} placeholder="비고" value={row.note} onChange={e => patch(row.id, { note: e.target.value })}/> : row.phase === 'new' && <button type="button" className="gs-link" style={{ gridColumn: '1/-1', justifySelf: 'start' }} onClick={() => setNotes(old => ({ ...old, [row.id]: true }))}><StickyNote size={13} aria-hidden="true"/>비고 추가</button>}
   {row.error && <p role="alert">{row.error}</p>}</fieldset>)}</div>
  <p className="gs-note">점수 칸에서 Enter를 누르면 다음 학생 점수 칸으로 이동합니다. 제출 칩을 누르면 미제출 · 대상 아님으로 바뀝니다.</p>
  <div className="gs-summary"><span className="ok"><CheckCircle2 size={14} aria-hidden="true"/>점수 입력 {filled}명</span>{empty > 0 && <span className="warn"><AlertCircle size={14} aria-hidden="true"/>점수 비어 있음 {empty}명</span>}{missing > 0 && <span className="warn">미제출 {missing}명</span>}</div></>
  : <p className="rv-empty">시험을 본 학생을 검색해 추가하거나, 담당 학생을 한 번에 추가하세요.</p>}
 </section>
 {message && <p role="status" className="gs-note">{message}</p>}
 <div className="gs-foot"><span className="gs-grow gs-note">반영은 저장 포함이며 학생·학부모 성적에 바로 보입니다.</span><button type="button" className="small-button" disabled={working || !pending.length} onClick={() => void run(false)}>{working ? '처리 중…' : `${pending.length}명 저장`}</button><button type="button" className="primary-button" disabled={working || !unpublished.length} onClick={() => void run(true)}>{unpublished.length}명 반영</button></div></section></WorkspaceDialog>;
}
