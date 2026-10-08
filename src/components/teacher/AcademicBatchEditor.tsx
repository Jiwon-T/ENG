import { useRef, useState } from 'react';
import StudentCombobox from './StudentCombobox';
import WorkspaceDialog from './WorkspaceDialog';
import StatusBadge from './StatusBadge';
import { schoolExamDetails, assessmentDetails } from '../../lib/academicExamPeriod';
import { academicBatchPayload, academicBatchError, applyAcademicBatchChunks } from '../../lib/academicBatch';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
export default function AcademicBatchEditor({ data, kind, onClose, request, act, onSaved }: {
    data: any;
    kind: string;
    onClose: () => void;
    request: (action: string, body?: any) => Promise<any>;
    act: (f: () => Promise<any>) => Promise<void>;
    onSaved: () => Promise<any>;
}) {
    const [common, setCommon] = useState({ subject: data.scopes?.[0]?.subject || '영어', examType: kind, examDetail: kind === '학교 내신' ? '1학기 중간고사' : '', examYear: new Date().getFullYear(), title: '', examDate: today(), maxScore: 100 as number | null, deadline: null as string | null });
    const [rows, setRows] = useState<any[]>([]), [working, setWorking] = useState(false), [message, setMessage] = useState('');
    const lock = useRef(false);
    const scopes = data.principal ? data.teachingScopes || [] : data.scopes || [];
    const students = (data.students || []).filter((s: any) => data.admin || scopes.some((v: any) => v.studentKey === s.studentKey && v.subject === common.subject));
    const frozen = rows.some(row => row.phase !== 'new'), saved = rows.filter(row => ['saved', 'failed-publish'].includes(row.phase));
    const patch = (id: string, value: any) => setRows(old => old.map(row => row.id === id ? { ...row, ...value } : row));
    const phases: Record<string, string> = { new: '미저장', saving: '저장 중', saved: '저장됨', publishing: '반영 중', published: '반영 완료', 'failed-save': '저장 확인 필요', 'failed-publish': '반영 확인 필요' };
    async function run(publish: boolean) {
        if (lock.current)
            return;
        const targets = rows.filter(row => publish ? ['new', 'failed-save', 'saved', 'failed-publish'].includes(row.phase) : ['new', 'failed-save'].includes(row.phase));
        if (!targets.length)
            return;
        const inputs = targets.map(row => ({ ...row, payload: row.payload || academicBatchPayload(common, row) }));
        {
            const invalid = inputs.find(row => !students.some((s: any) => s.studentKey === row.studentKey) || academicBatchError(row.payload));
            if (invalid) {
                setMessage(academicBatchError(invalid.payload) || '현재 과목의 담당 범위를 확인해 주세요.');
                return;
            }
        }
        lock.current = true;
        setWorking(true);
        setMessage('');
        let successes = 0;
        try {
            await act(async () => { const completed = await applyAcademicBatchChunks(request, inputs, publish, patch); successes = completed.filter(row => row.phase === 'published' || row.phase === 'saved').length; await onSaved(); return { failed: completed.filter(row => row.phase.startsWith('failed')).length }; });
            setMessage(`${successes}/${inputs.length}명 ${publish ? '반영' : '저장'} 완료. 실패한 행은 완료된 행과 분리해서 다시 확인할 수 있습니다.`);
        }
        finally {
            lock.current = false;
            setWorking(false);
        }
    }
    return <WorkspaceDialog open title="여러 학생 성적 입력" onClose={() => { if (working)
        return; if (rows.some(row => ['new', 'failed-save'].includes(row.phase)) && !window.confirm('저장하지 않은 성적 입력을 닫을까요?'))
        return; onClose(); }}><section className="academic-batch-editor"><p className="text-sm mb-3">같은 시험 정보는 한 번 입력하고 학생별 점수를 각각 입력합니다.</p><fieldset disabled={working || frozen}><div className="academic-batch-common"><label>과목<select value={common.subject} onChange={e => setCommon({ ...common, subject: e.target.value })}>{['영어', '수학', '국어', '과학', '한국사'].filter(subject => data.admin || scopes.some((s: any) => s.subject === subject)).map(subject => <option key={subject}>{subject}</option>)}</select></label><label>구분<select value={common.examType} onChange={e => setCommon({ ...common, examType: e.target.value, examDetail: '' })}><option>학교 내신</option><option>학력평가</option></select></label><label>시험일<input type="date" value={common.examDate} onChange={e => setCommon({ ...common, examDate: e.target.value })}/></label><label>연도<input type="number" min={1900} max={2200} value={common.examYear ?? ''} onChange={e => setCommon({ ...common, examYear: e.target.value === '' ? null : Number(e.target.value) })}/></label><label>세부 종류<select value={common.examDetail} onChange={e => setCommon({ ...common, examDetail: e.target.value })}><option value="">미분류</option>{(common.examType === '학교 내신' ? schoolExamDetails : assessmentDetails).map(v => <option key={v}>{v}</option>)}</select></label><label>만점<input type="number" min="0.01" step="any" value={common.maxScore ?? ''} onChange={e => setCommon({ ...common, maxScore: e.target.value === '' ? null : Number(e.target.value) })}/></label><label>시험명<input value={common.title} onChange={e => setCommon({ ...common, title: e.target.value })}/></label><label>제출 기한<input type="date" value={common.deadline || ''} onChange={e => setCommon({ ...common, deadline: e.target.value || null })}/></label></div></fieldset>
 <fieldset disabled={working || frozen}><StudentCombobox disabled={working || frozen} students={students.filter((s: any) => !rows.some(row => row.studentKey === s.studentKey))} value="" onChange={studentKey => { if (working || frozen)
        return; if (rows.length >= 100) {
        setMessage('한 번에 100명까지 입력할 수 있습니다.');
        return;
    } setRows(old => old.some(row => row.studentKey === studentKey) ? old : [...old, { id: crypto.randomUUID(), studentKey, score: null, grade: '', note: '', submissionStatus: '제출 완료', phase: 'new' }]); }}/></fieldset>
 <div className="academic-batch-rows">{rows.map(row => <fieldset key={row.id} disabled={working || row.phase !== 'new'} className="academic-batch-row"><strong>{data.students.find((s: any) => s.studentKey === row.studentKey)?.studentDisplayName}</strong><label>제출 상태<select value={row.submissionStatus} onChange={e => patch(row.id, { submissionStatus: e.target.value, score: e.target.value === '제출 완료' ? row.score : null })}><option>제출 완료</option><option>미제출</option><option>제출 대상 아님</option></select></label><label>원점수<input aria-label="학생별 원점수" type="number" min={0} max={common.maxScore ?? undefined} step="any" disabled={row.submissionStatus !== '제출 완료'} value={row.score ?? ''} onChange={e => patch(row.id, { score: e.target.value === '' ? null : Number(e.target.value) })}/></label><label>예상 등급<input value={row.grade} onChange={e => patch(row.id, { grade: e.target.value })}/></label><label>비고<input value={row.note} onChange={e => patch(row.id, { note: e.target.value })}/></label><StatusBadge kind={row.phase === 'published' ? 'done' : row.phase.startsWith('failed') ? 'failed' : row.phase === 'saved' ? 'saved' : 'editing'} text={phases[row.phase]}/>{row.phase === 'new' && <button type="button" aria-label="학생 제외" onClick={() => setRows(old => old.filter(r => r.id !== row.id))}>×</button>}{row.error && <p role="alert">{row.error}</p>}</fieldset>)}</div>{!rows.length && <p className="text-sm my-3">위 검색창에서 시험을 본 학생을 추가하세요.</p>}
 <div className="academic-batch-actions"><button type="button" className="primary-button" disabled={working || !rows.some(row => ['new', 'failed-save'].includes(row.phase))} onClick={() => void run(false)}>{working ? '처리 중…' : `${rows.filter(row => ['new', 'failed-save'].includes(row.phase)).length}명 저장`}</button><button type="button" className="small-button" disabled={working || !rows.some(row => row.phase !== 'published')} onClick={() => void run(true)}>{rows.filter(row => row.phase !== 'published').length}명 반영 (저장 포함)</button></div><p className="text-xs mt-2">저장은 학생별 초안 보관이며, 반영은 필요한 저장을 먼저 처리하고 학생·학부모 성적에 적용합니다.</p>{message && <p role="status" className="text-sm mt-2">{message}</p>}</section></WorkspaceDialog>;
}
