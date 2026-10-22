import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { askConfirm } from './ConfirmDialog';
import { WorkspaceDialogEmbedding } from './WorkspaceDialogEmbedding';
import { consultName, type TodayConsult } from '../../lib/teacherTodayLessons';
import type { PanelClose } from '../../lib/studentDialogNavigation';

const TeacherReportReview = lazy(() => import('./TeacherReportReview'));
const StudentRegistrationManager = lazy(() => import('./StudentRegistrationManager'));
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim() || name;

/**
 * 상담 공간 (수업 일지 › 오늘 수업 › a 상담 card): the wide right column becomes the 상담 instead of a pop-up. 재원생: their
 * 학습 리포트, 성적 first (chips when several). 신입생: the 원서 right here (종이 사진·같은 학생 원서·PDF in it); a new 원서 is
 * tied to the 일정 at its first save. '← 일지로' (or another card) asks first when something is unsaved.
 */
export default function ConsultPane({ consult, data, request, onBack, leaveRef, onStudentsChanged }: {
  consult: TodayConsult; data: any; request: (action: string, body?: any) => Promise<any>; onBack: () => void;
  /** the parent asks this before showing something else (true = may leave) */ leaveRef: MutableRefObject<null | (() => Promise<boolean>)>;
  onStudentsChanged?: () => Promise<void>;
}) {
  const [key, setKey] = useState(consult.students[0] || ''), reviewDirty = useRef(false);
  const closeIntake = useRef<PanelClose | null>(null), closed = useRef(false);
  const registerClose = useCallback((close: PanelClose) => { closeIntake.current = close; return () => { if (closeIntake.current === close) closeIntake.current = null; }; }, []);
  const prospect = consult.prospects[0], student = consult.students.length > 0;
  const name = (k: string) => shortName(data.students?.find((s: any) => s.studentKey === k)?.studentDisplayName || '학생');
  const askReview = (message: string) => !reviewDirty.current ? Promise.resolve(true) : askConfirm({ title: '저장하지 않은 학습 성취도 평가가 있어요', message, confirmText: '확인', tone: 'danger' });
  // may this pane go? the 원서's own close (it asks about unsaved input), or the unsaved 평가
  const leave = useCallback(async () => {
    if (!student && closeIntake.current) { closed.current = false; await closeIntake.current(); return closed.current; }
    return askReview('버리고 나갈까요?');
  }, [student]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { leaveRef.current = leave; return () => { if (leaveRef.current === leave) leaveRef.current = null; }; }, [leave, leaveRef]);
  // a new 원서 from a 신입생 of the 일정: tied to that name at its first save (the card then says 원서 이어 쓰기)
  const tie = async (registrationId: string) => {
    if (!prospect || prospect.registrationId || !consult.scheduleId) return;
    try { await request('link-consult-registration', { scheduleId: consult.scheduleId, name: prospect.name, registrationId }); } catch { /* saved; tied next time */ }
  };
  const back = async () => { if (await leave()) onBack(); };
  return <section className="panel consult-pane" aria-label={`상담 · ${consult.title}`}>
    <header className="consult-pane-head">
      <MessageCircle size={18} aria-hidden="true" />
      <h2>{consult.title}</h2>
      <span className="consult-pane-when">{consult.start}–{consult.end}{consult.place ? ` · ${consult.place}` : ''}</span>
      <span className={`consult-pane-pill${student ? '' : ' is-new'}`}>{student ? '재원생' : '신입생'}</span>
      <button type="button" className="small-button consult-pane-back" onClick={() => void back()}><ArrowLeft size={14} aria-hidden="true" />일지로</button>
    </header>
    {student ? <>
      {consult.students.length > 1 && <div className="campus-chips" role="group" aria-label="상담 학생">{consult.students.map(k => <button key={k} type="button" aria-pressed={key === k}
        onClick={async () => { if (k !== key && await askReview('버리고 다른 학생을 볼까요?')) { reviewDirty.current = false; setKey(k); } }}>{name(k)}</button>)}</div>}
      <Suspense fallback={<p className="report-caption">학습 리포트를 불러오는 중…</p>}>
        <TeacherReportReview key={key} students={data.students || []} initialStudentKey={key} showStudentPicker={false} embedded initialSection="grades" onDirtyChange={d => { reviewDirty.current = d; }} />
      </Suspense>
    </> : <WorkspaceDialogEmbedding.Provider value={{ registerClose }}>
      <Suspense fallback={<p className="report-caption">원서를 불러오는 중…</p>}>
        <StudentRegistrationManager startSignal={1} startName={prospect?.name || consultName(consult.title)} startId={prospect?.registrationId || ''} onSavedNew={id => void tie(id)} onClosed={() => { closed.current = true; }}
          coreMode={Boolean(data.coreMode)} canAdditional={Boolean(data.admin || data.principal)} students={data.students || []} onSynced={async () => { await onStudentsChanged?.(); }} />
      </Suspense>
    </WorkspaceDialogEmbedding.Provider>}
  </section>;
}
