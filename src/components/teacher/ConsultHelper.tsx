import { lazy, Suspense, useRef, useState } from 'react';
import WorkspaceDialog from './WorkspaceDialog';
import { askConfirm } from './ConfirmDialog';
import type { TodayConsult } from '../../lib/teacherTodayLessons';

const TeacherReportReview = lazy(() => import('./TeacherReportReview'));
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim() || name;

/** 상담 도우미 (오늘 수업 › a 상담 card naming registered students): their 학습 리포트 right over the 일지, 성적 first, one
 *  student at a time (chips when the 상담 names several). An unsaved 학습 성취도 평가 asks before it is left. */
export default function ConsultHelper({ consult, students, onClose }: { consult: TodayConsult; students: any[]; onClose: () => void }) {
  const [key, setKey] = useState(consult.students[0]), dirty = useRef(false);
  const leave = async (message: string) => !dirty.current || await askConfirm({ title: '저장하지 않은 학습 성취도 평가가 있어요', message, confirmText: '확인', tone: 'danger' });
  const name = (k: string) => shortName(students.find((s: any) => s.studentKey === k)?.studentDisplayName || '학생');
  return <WorkspaceDialog open title={`상담 도우미 · ${consult.title}`} onClose={async () => { if (await leave('버리고 닫을까요?')) onClose(); }}>
    <p className="today-consult-help">{consult.start}–{consult.end}{consult.place ? ` · ${consult.place}` : ''}</p>
    {consult.students.length > 1 && <div className="campus-chips" role="group" aria-label="상담 학생">{consult.students.map(k => <button key={k} type="button" aria-pressed={key === k}
      onClick={async () => { if (k !== key && await leave('버리고 다른 학생을 볼까요?')) { dirty.current = false; setKey(k); } }}>{name(k)}</button>)}</div>}
    <Suspense fallback={<p className="report-caption">학습 리포트를 불러오는 중…</p>}>
      <TeacherReportReview key={key} students={students} initialStudentKey={key} showStudentPicker={false} embedded initialSection="grades" onDirtyChange={d => { dirty.current = d; }} />
    </Suspense>
  </WorkspaceDialog>;
}
