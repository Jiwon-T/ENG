import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { registrationSubjects, type RegistrationOptions } from '../../lib/studentRegistration';
import type { EnrollmentInput, EnrollmentRecord } from '../../lib/studentEnrollment';
import WorkspaceDialog from './WorkspaceDialog';
type Intent = {
    operationId: string;
    studentEditedAt: string;
    enrollmentEditedAt: string;
    data: EnrollmentInput;
};
const messageFor = (r: any) => `${r.data?.message || r.userMessage || '처리 결과를 확인하지 못했습니다.'}${r.data?.diagnosticId ? ` (오류 ID: ${r.data.diagnosticId})` : ''}`;
export default function StudentEnrollmentEditor({ studentKey, onClose, onSaved }: {
    studentKey: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [record, setRecord] = useState<EnrollmentRecord | null>(null), [options, setOptions] = useState<RegistrationOptions>({ teachers: [], classes: [] }), [value, setValue] = useState<EnrollmentInput | null>(null), [intent, setIntent] = useState<Intent | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState(''), [dirty, setDirty] = useState(false);
    const version = useRef(0), writing = useRef(false);
    async function getRecord() { const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace?' + new URLSearchParams({ action: 'student-enrollment', studentKey })); if (!r.ok || !r.data?.ok)
        throw Error(messageFor(r)); return r.data.record as EnrollmentRecord; }
    function select(subject: EnrollmentInput['subject'], r = record) { const row = r?.subjects.find(s => s.subject === subject); setValue({ subject, status: (row?.status || '등록') as EnrollmentInput['status'], startDate: row?.startDate || '', endDate: row?.endDate || null, addTeacherUid: null, removeTeacherIds: [], classIds: row?.classes.map(c => c.id) || [] }); setDirty(false); }
    function load(r: EnrollmentRecord) { setRecord(r); if (r.pending) {
        setValue(r.pending.data);
        setIntent({ operationId: r.pending.operationId, studentEditedAt: r.pending.studentEditedAt, enrollmentEditedAt: r.pending.enrollmentEditedAt, data: r.pending.data });
    }
    else {
        setIntent(null);
        select(value?.subject || registrationSubjects[0], r);
    } }
    useEffect(() => {
        let live = true;
        const current = ++version.current, uid = auth.currentUser?.uid;
        const unsubscribe = onAuthStateChanged(auth, u => { if (u?.uid !== uid) {
            version.current++;
            setRecord(null);
            setValue(null);
            setIntent(null);
        } });
        Promise.all([getRecord(), teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace?action=registration-options')]).then(([r, o]) => { if (!live || current !== version.current || auth.currentUser?.uid !== uid)
            return; load(r); if (o.ok && o.data?.ok)
            setOptions({ teachers: o.data.teachers, classes: o.data.classes });
        else
            setMessage(messageFor(o)); }).catch(e => { if (live && current === version.current)
            setMessage(e.message); }).finally(() => { if (live && current === version.current)
            setLoading(false); });
        return () => { live = false; version.current++; unsubscribe(); };
    }, [studentKey]);
    async function save() {
        if (writing.current || !record || !value)
            return;
        const original = record.subjects.find(s => s.subject === value.subject);
        const review = original?.classes.filter(c => c.withdrawalReview) || [];
        if (!intent && value.status === '중단' && original?.status !== '중단' && review.length && !window.confirm(`${review.map(c => c.name).join(', ')}의 유일한 학생을 중단합니다. 반도 중단할 필요가 있는지 확인해 주세요.\n반을 진행 중으로 유지하고 학생만 중단하려면 확인을 누르세요. 반도 중단하려면 취소 후 반 관리에서 상태를 변경해 주세요.`))
            return;
        const current = version.current, uid = auth.currentUser?.uid;
        const request = intent || { operationId: crypto.randomUUID(), studentEditedAt: record.studentEditedAt, enrollmentEditedAt: record.enrollmentEditedAt, data: structuredClone(value) };
        writing.current = true;
        setBusy(true);
        setIntent(request);
        setMessage('');
        try {
            const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-student-enrollment', studentKey, ...request }) });
            if (current !== version.current || auth.currentUser?.uid !== uid)
                return;
            if (!r.ok || !r.data?.ok) {
                setMessage(messageFor(r));
                try {
                    const saved = await getRecord();
                    if (current !== version.current)
                        return;
                    if (saved.pending)
                        load(saved);
                    else if (r.status >= 400 && r.status < 500 && ![408, 425, 429].includes(r.status))
                        load(saved);
                }
                catch { }
                return;
            }
            setDirty(false);
            setIntent(null);
            onSaved();
        }
        catch (e) {
            if (current === version.current)
                setMessage(e instanceof Error ? e.message : '저장 결과를 확인하지 못했습니다.');
        }
        finally {
            writing.current = false;
            if (current === version.current)
                setBusy(false);
        }
    }
    async function discard() {
        if (writing.current || !intent || !record?.pending?.canDiscard)
            return;
        if (!window.confirm('저장되지 않은 수강 변경 요청을 취소할까요?'))
            return;
        writing.current = true;
        setBusy(true);
        const current = version.current;
        try {
            const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discard-student-enrollment', studentKey, operationId: intent.operationId }) });
            if (current !== version.current)
                return;
            if (!r.ok || !r.data?.ok)
                throw Error(messageFor(r));
            const saved = await getRecord();
            if (current === version.current) {
                load(saved);
                setMessage('수정 요청을 취소했습니다.');
            }
        }
        catch (e) {
            if (current === version.current)
                setMessage(e instanceof Error ? e.message : '취소에 실패했습니다.');
        }
        finally {
            writing.current = false;
            if (current === version.current)
                setBusy(false);
        }
    }
    const row = record?.subjects.find(s => s.subject === value?.subject);
    const classChoices = [...options.classes.filter(c => c.subject === value?.subject), ...(row?.classes || []).filter(c => !options.classes.some(o => o.id === c.id)).map(c => ({ ...c, subject: value!.subject, teacherUids: [] }))];
    function change(p: Partial<EnrollmentInput>) { if (value) {
        setValue({ ...value, ...p });
        setDirty(true);
    } }
    function close() { if (dirty && !intent && !window.confirm('저장하지 않은 수강 변경을 닫을까요?'))
        return; onClose(); }
    const fmt = (d: string | null | undefined) => d ? d.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, (_, y, m, day) => `${y}.${Number(m)}.${Number(day)}`) : '';
    const tone = (s: string) => s === '등록' ? 'is-on' : s === '대기' ? 'is-wait' : s === '중단' ? 'is-off' : 'is-none';
    function open(subject: EnrollmentInput['subject']) { if (subject === value?.subject) return; if (!dirty || window.confirm('저장하지 않은 변경을 지우고 다른 과목을 열까요?')) select(subject); }
    return <WorkspaceDialog open title="수강·담당·반 관리" onClose={close}>
 <div className="enr">
 {loading ? <p role="status">수강 정보를 불러오는 중…</p> : null}{message ? <p role="status" className="text-sm text-rose-600 mb-3">{message}</p> : null}
 {intent ? <p className="text-xs text-slate-500 mb-3">저장한 요청을 유지합니다. 창을 다시 열어도 같은 요청의 반영 결과를 확인할 수 있습니다.</p> : null}
 {record ? <div className="enr-overview" role="tablist" aria-label="과목별 수강 현황">{registrationSubjects.map(subject => { const r = record.subjects.find(s => s.subject === subject), status = r?.status || ''; const on = value?.subject === subject; return <button type="button" role="tab" aria-selected={on} key={subject} disabled={busy || Boolean(intent)} className={`enr-card ${tone(status)}${on ? ' is-open' : ''}`} onClick={() => open(subject)}>
  <span className="enr-card-top"><strong>{subject}</strong><span className="enr-status">{status || '수강 안 함'}</span></span>
  {status ? <span className="enr-card-dates">{fmt(r?.startDate) || '시작일 없음'}{status === '중단' && r?.endDate ? ` ~ ${fmt(r.endDate)}` : ''}</span> : <span className="enr-card-dates is-empty">눌러서 등록</span>}
  {status ? <span className="enr-card-meta"><span>담당 {r?.teachers.length ? r.teachers.map(t => t.name).join(', ') : '없음'}</span><span>반 {r?.classes.length ? r.classes.map(c => c.name).join(', ') : '없음'}</span></span> : null}
 </button>; })}</div> : null}
 {value ? <form onSubmit={e => { e.preventDefault(); void save(); }} className="enr-edit"><fieldset disabled={busy || Boolean(intent)} className="enr-fields">
 <h3 className="enr-edit-title">{value.subject} 수강 정보{dirty ? <small>변경됨</small> : null}</h3>
 <div className="enr-row"><span className="enr-label">수강 상태</span><div className="enr-seg" role="group" aria-label="수강 상태">{(['등록', '대기', '중단'] as const).map(s => <button type="button" key={s} aria-pressed={value.status === s} className={tone(s)} onClick={() => change({ status: s, endDate: s === '중단' ? value.endDate : null })}>{s}</button>)}</div></div>
 <div className="enr-dates"><label>시작일<input type="date" required value={value.startDate} onChange={e => change({ startDate: e.target.value })}/></label>{value.status === '중단' ? <label>중단일<input type="date" required min={value.startDate} value={value.endDate || ''} onChange={e => change({ endDate: e.target.value || null })}/></label> : null}</div>
 <div className="enr-row is-top"><span className="enr-label">담당 선생님</span><div className="enr-chips">{row?.teachers.map(t => { const removed = value.removeTeacherIds.includes(t.id); return <button type="button" key={t.id} aria-pressed={!removed} title={removed ? '다시 누르면 담당 유지' : '누르면 이 과목 담당에서 제외'} className={`enr-chip is-teacher${removed ? ' is-removed' : ''}`} onClick={() => change({ removeTeacherIds: removed ? value.removeTeacherIds.filter(id => id !== t.id) : [...value.removeTeacherIds, t.id] })}>{t.name}{removed ? ' · 제외' : ''}</button>; })}
  <select aria-label="담당 추가" className="enr-add" value={value.addTeacherUid || ''} onChange={e => change({ addTeacherUid: e.target.value || null })}><option value="">+ 담당 추가</option>{options.teachers.filter(t => t.subjects.includes(value.subject)).map(t => <option value={t.uid} key={t.uid}>{t.name}</option>)}</select>
  {!row?.teachers.length && !value.addTeacherUid ? <span className="enr-empty">담당 없음</span> : null}</div></div>
 <p className="enr-hint">이름을 누르면 이 과목 담당에서 빠지고, 다시 누르면 유지돼요. 누르지 않은 공동 담당은 그대로예요.</p>
 <div className="enr-row is-top"><span className="enr-label">소속반</span><div className="enr-chips">{classChoices.map(c => { const picked = value.classIds.includes(c.id), locked = value.status === '중단' && !row?.classes.some(existing => existing.id === c.id); return <button type="button" key={c.id} aria-pressed={picked} disabled={locked} className={`enr-chip${picked ? ' is-picked' : ''}`} onClick={() => change({ classIds: picked ? value.classIds.filter(id => id !== c.id) : [...value.classIds, c.id] })}>{picked ? '✓ ' : ''}{c.name}</button>; })}{!classChoices.length ? <span className="enr-empty">선택 가능한 반이 없습니다.</span> : null}</div></div>
 <p className="enr-hint">중단 시 기존 반 연결은 퇴원 이력으로 유지할 수 있습니다. 반은 자동으로 중단되지 않습니다. 대기 상태는 이 과목의 반 선택을 해제해 주세요. 다른 과목의 반은 유지됩니다.</p>
 </fieldset><div className="enr-foot"><button className="primary-button" type="submit" disabled={busy || (!dirty && !intent)}>{busy ? '반영 결과 확인 중…' : intent ? '저장 결과 확인·재시도' : `${value.subject} 변경 반영`}</button>{record?.pending?.canDiscard ? <button type="button" className="small-button" disabled={busy} onClick={() => void discard()}>미반영 요청 취소</button> : null}</div></form> : null}
 </div>
 </WorkspaceDialog>;
}
