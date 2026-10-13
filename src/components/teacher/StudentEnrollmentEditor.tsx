import { CalendarClock } from 'lucide-react';
import { statusIcon } from './StatusBadge';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { registrationSubjects, type RegistrationOptions } from '../../lib/studentRegistration';
import { teacherTransferReasons, type EnrollmentInput, type EnrollmentRecord } from '../../lib/studentEnrollment';
import WorkspaceDialog from './WorkspaceDialog';
import {askConfirm,askDiscard} from './ConfirmDialog';
import {useLeaveProtection} from '../../lib/leaveProtection';
import CampusToggle from './CampusToggle';
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
    useLeaveProtection(dirty && !intent);
    const version = useRef(0), writing = useRef(false);
    async function getRecord() { const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace?' + new URLSearchParams({ action: 'student-enrollment', studentKey })); if (!r.ok || !r.data?.ok)
        throw Error(messageFor(r)); return r.data.record as EnrollmentRecord; }
    function select(subject: EnrollmentInput['subject'], r = record) { const row = r?.subjects.find(s => s.subject === subject); setValue({ subject, status: (row?.status || '등록') as EnrollmentInput['status'], startDate: row?.startDate || '', endDate: row?.endDate || null, addTeacherUid: null, removeTeacherIds: [], classIds: row?.classes.map(c => c.id) || [], plannedEndDate: row?.status === '등록' ? row?.plannedEndDate || null : null, transferReason: null, transferNote: '', campus: (row?.campus as EnrollmentInput['campus']) || null }); setDirty(false); }
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
        if (!intent && value.status === '중단' && original?.status !== '중단' && review.length && !await askConfirm({ title: '학생만 중단할까요?', message: `${review.map(c => c.name).join(', ')}의 유일한 학생을 중단합니다. 반은 진행 중으로 남아요.\n반도 중단하려면 취소 후 반 관리에서 상태를 바꿔 주세요.`, confirmText: '학생만 중단', icon: 'alert' }))
            return;
        const current = version.current, uid = auth.currentUser?.uid;
        const request = intent || { operationId: crypto.randomUUID(), studentEditedAt: record.studentEditedAt, enrollmentEditedAt: record.enrollmentEditedAt, data: structuredClone(withoutUnchangedCampus(needsReason ? value : { ...value, transferReason: null, transferNote: '' })) };
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
        if (!await askConfirm({ title: '저장되지 않은 수강 변경 요청을 취소할까요?', confirmText: '요청 취소', cancelText: '그대로 두기', tone: 'danger', icon: 'alert' }))
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
    // 담당 변경: an existing teacher taken off a subject that continues → one-tap reason (principal/admin records only).
    const removedTeachers = value && value.status !== '중단' ? (row?.teachers || []).filter(t => value.removeTeacherIds.includes(t.id)) : [];
    const needsReason = removedTeachers.length > 0, reasonMissing = needsReason && !value?.transferReason;
    // Campus goes to the server only when it changed, so saving for another reason never rewrites the student 캠퍼스.
    const withoutUnchangedCampus = (v: EnrollmentInput) => { if ((v.campus || null) !== ((row?.campus as EnrollmentInput['campus']) || null)) return v; const { campus: _unchanged, ...rest } = v; return rest as EnrollmentInput; };
    const classChoices = [...options.classes.filter(c => c.subject === value?.subject), ...(row?.classes || []).filter(c => !options.classes.some(o => o.id === c.id)).map(c => ({ ...c, subject: value!.subject, teacherUids: [] }))];
    function change(p: Partial<EnrollmentInput>) { if (value) {
        setValue({ ...value, ...p });
        setDirty(true);
    } }
    async function close() { if (dirty && !intent && !await askDiscard('저장하지 않은 수강 변경을 닫을까요?'))
        return; onClose(); }
    const fmt = (d: string | null | undefined) => d ? d.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, (_, y, m, day) => `${y}.${Number(m)}.${Number(day)}`) : '';
    const tone = (s: string) => s === '등록' ? 'is-on' : s === '대기' ? 'is-wait' : s === '중단' ? 'is-off' : 'is-none';
    async function open(subject: EnrollmentInput['subject']) { if (subject === value?.subject) return; if (!dirty || await askDiscard('저장하지 않은 변경을 지우고 다른 과목을 열까요?', { discardText: '버리고 열기' })) select(subject); }
    return <WorkspaceDialog open title="수강·담당·반 관리" onClose={close}>
 <div className="enr">
 {loading ? <p role="status">수강 정보를 불러오는 중…</p> : null}{message ? <p role="status" className="text-sm text-rose-600 mb-3">{message}</p> : null}
 {intent ? <p className="text-xs text-slate-500 mb-3">저장한 요청을 유지합니다. 창을 다시 열어도 같은 요청의 반영 결과를 확인할 수 있습니다.</p> : null}
 {record ? <div className="enr-overview" role="tablist" aria-label="과목별 수강 현황">{registrationSubjects.map(subject => { const r = record.subjects.find(s => s.subject === subject), status = r?.status || ''; const on = value?.subject === subject; return <button type="button" role="tab" aria-selected={on} key={subject} disabled={busy || Boolean(intent)} className={`enr-card ${tone(status)}${on ? ' is-open' : ''}`} onClick={() => open(subject)}>
  <span className="enr-card-top"><strong>{subject}</strong>{r?.campus ? <span className="enr-campus">{r.campus}</span> : null}<span className="enr-status">{(()=>{const Icon=status==='등록'?statusIcon('running'):status==='대기'?statusIcon('waiting'):status==='중단'?statusIcon('stopped'):null;return Icon?<Icon size={11} aria-hidden="true"/>:null;})()}{status || '수강 안 함'}</span></span>
  {status ? <span className="enr-card-dates">{fmt(r?.startDate) || '시작일 없음'}{status === '중단' && r?.endDate ? ` ~ ${fmt(r.endDate)}` : ''}{status === '등록' && r?.plannedEndDate ? <em className="enr-planned"><CalendarClock size={11} aria-hidden="true"/>{fmt(r.plannedEndDate)} 중단 예정</em> : null}</span> : <span className="enr-card-dates is-empty">눌러서 등록</span>}
  {status ? <span className="enr-card-meta"><span>담당 {r?.teachers.length ? r.teachers.map(t => t.name).join(', ') : '없음'}</span><span>반 {r?.classes.length ? r.classes.map(c => c.name).join(', ') : '없음'}</span></span> : null}
 </button>; })}</div> : null}
 {value ? <form onSubmit={e => { e.preventDefault(); void save(); }} className="enr-edit"><fieldset disabled={busy || Boolean(intent)} className="enr-fields">
 <h3 className="enr-edit-title">{value.subject} 수강 정보{dirty ? <small>변경됨</small> : null}</h3>
 <div className="enr-row"><span className="enr-label">캠퍼스</span><CampusToggle value={value.campus} onChange={campus => change({ campus: campus as EnrollmentInput['campus'] })}/></div>
 <div className="enr-row"><span className="enr-label">수강 상태</span><div className="enr-seg" role="group" aria-label="수강 상태">{(['등록', '대기', '중단'] as const).map(s => <button type="button" key={s} aria-pressed={value.status === s} className={tone(s)} onClick={() => change({ status: s, endDate: s === '중단' ? value.endDate : null, plannedEndDate: s === '등록' ? value.plannedEndDate ?? null : null })}>{s}</button>)}</div></div>
 <div className="enr-dates"><label>시작일<input type="date" required value={value.startDate} onChange={e => change({ startDate: e.target.value })}/></label>{value.status === '중단' ? <label>중단일<input type="date" required min={value.startDate} value={value.endDate || ''} onChange={e => change({ endDate: e.target.value || null })}/></label> : null}</div>
 {value.status === '등록' ? <div className="enr-row"><span className="enr-label">중단 예약</span>{value.plannedEndDate != null ? <div className="enr-plan"><input type="date" aria-label="중단 예약일" required min={value.startDate} value={value.plannedEndDate} onChange={e => change({ plannedEndDate: e.target.value })}/><span>부터 중단 예정</span><button type="button" className="gs-quiet" onClick={() => change({ plannedEndDate: null })}>예약 취소</button></div> : <button type="button" className="small-button enr-plan-add" onClick={() => change({ plannedEndDate: '' })}>+ 중단일 예약하기</button>}</div> : null}
 {value.status === '등록' && value.plannedEndDate != null ? <p className="enr-hint">그날까지는 지금처럼 다니고, 날짜가 되면 학생 관리 첫 화면에서 ‘중단할까요?’를 물어봐요. 자동으로 중단되지는 않아요.</p> : null}
 <div className="enr-row is-top"><span className="enr-label">담당 선생님</span><div className="enr-chips">{row?.teachers.map(t => { const removed = value.removeTeacherIds.includes(t.id); return <button type="button" key={t.id} aria-pressed={!removed} title={removed ? '다시 누르면 담당 유지' : '누르면 이 과목 담당에서 제외'} className={`enr-chip is-teacher${removed ? ' is-removed' : ''}`} onClick={() => change({ removeTeacherIds: removed ? value.removeTeacherIds.filter(id => id !== t.id) : [...value.removeTeacherIds, t.id] })}>{t.name}{removed ? ' · 제외' : ''}</button>; })}
  <select aria-label="담당 추가" className="enr-add" value={value.addTeacherUid || ''} onChange={e => change({ addTeacherUid: e.target.value || null })}><option value="">+ 담당 추가</option>{options.teachers.filter(t => t.subjects.includes(value.subject)).map(t => <option value={t.uid} key={t.uid}>{t.name}</option>)}</select>
  {!row?.teachers.length && !value.addTeacherUid ? <span className="enr-empty">담당 없음</span> : null}</div></div>
 <p className="enr-hint">이름을 누르면 이 과목 담당에서 빠지고, 다시 누르면 유지돼요. 누르지 않은 공동 담당은 그대로예요.</p>
 {needsReason ? <div className="enr-row is-top enr-transfer"><span className="enr-label">바꾸는 이유</span><div className="enr-transfer-body"><p className="enr-transfer-who">{removedTeachers.map(t => t.name).join(', ')} 선생님에서 바꾸는 이유 <b aria-hidden="true">*</b></p><div className="enr-chips" role="group" aria-label="담당을 바꾸는 이유">{teacherTransferReasons.map(reason => <button type="button" key={reason} aria-pressed={value.transferReason === reason} className={`enr-chip${value.transferReason === reason ? ' is-picked' : ''}`} onClick={() => change({ transferReason: reason })}>{reason}</button>)}</div>{value.transferReason === '기타' ? <input className="enr-transfer-note" aria-label="기타 사유 메모 (선택)" placeholder="메모 (선택)" maxLength={200} value={value.transferNote || ''} onChange={e => change({ transferNote: e.target.value })}/> : null}<p className="enr-hint">원장·관리자만 볼 수 있어요. 선생님에게는 보이지 않아요.</p></div></div> : null}
 <div className="enr-row is-top"><span className="enr-label">소속반</span><div className="enr-chips">{classChoices.map(c => { const picked = value.classIds.includes(c.id), locked = value.status === '중단' && !row?.classes.some(existing => existing.id === c.id); return <button type="button" key={c.id} aria-pressed={picked} disabled={locked} className={`enr-chip${picked ? ' is-picked' : ''}`} onClick={() => change({ classIds: picked ? value.classIds.filter(id => id !== c.id) : [...value.classIds, c.id] })}>{picked ? '✓ ' : ''}{c.name}</button>; })}{!classChoices.length ? <span className="enr-empty">선택 가능한 반이 없습니다.</span> : null}</div></div>
 <p className="enr-hint">중단 시 기존 반 연결은 퇴원 이력으로 유지할 수 있습니다. 반은 자동으로 중단되지 않습니다. 대기 상태는 이 과목의 반 선택을 해제해 주세요. 다른 과목의 반은 유지됩니다.</p>
 </fieldset><div className="enr-foot">{reasonMissing && !intent ? <span className="enr-warn">바꾸는 이유를 골라 주세요</span> : null}<button className="primary-button" type="submit" disabled={busy || (!dirty && !intent) || (reasonMissing && !intent)}>{busy ? '반영 결과 확인 중…' : intent ? '저장 결과 확인·재시도' : `${value.subject} 변경 반영`}</button>{record?.pending?.canDiscard ? <button type="button" className="small-button" disabled={busy} onClick={() => void discard()}>미반영 요청 취소</button> : null}</div></form> : null}
 </div>
 </WorkspaceDialog>;
}
