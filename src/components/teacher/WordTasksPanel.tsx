import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { askConfirm } from './ConfirmDialog';

// 학습 리포트 › 온라인 학습: the student's 단어 과제 (given from the 일지 단어 칩) — 🗺️ 원정대 (맞힘 / 전체) and 📝 단어 테스트
// (최고 점수 / 통과 점수, how many tests), done or not.
// Nothing shows when the student has none. 빼기: the teacher who gave it (or 원장님·관리자; the server checks).
// Folded into one chip (진행 중 · 완료) above the records; open it to see each task. `onTasks`: the tasks, so the record list
// can mark the records that were 과제.
export interface TaskRow { id: string; kind?: 'expedition' | 'test'; wordbookId: string; bookTitle: string; startDay: number; endDay: number; total: number; mastered: number; completedAt: number | null; createdAt: number; passScore?: number | null; best?: number | null; attempts?: number }
export const md = (at: number) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(at)).replace(/\.\s?/g, '/').replace(/\/$/, '');
export const days = (t: { startDay: number; endDay: number }) => t.startDay === t.endDay ? `Day ${t.startDay}` : `Day ${t.startDay}~${t.endDay}`;

export default function WordTasksPanel({ studentKey, onTasks }: { studentKey: string; onTasks?: (tasks: TaskRow[]) => void }) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [open, setOpen] = useState(false);
  useEffect(() => { onTasks?.(tasks || []); }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const load = async () => {
    const r = await teacherAuthenticatedRequest<any>(auth, `/api/teacher/workspace?action=word-tasks&studentKey=${encodeURIComponent(studentKey)}`);
    if (r.ok && r.data?.ok) setTasks(r.data.tasks || []); else setTasks([]);
  };
  useEffect(() => { setTasks(null); setMessage(''); if (studentKey) void load().catch(() => setTasks([])); }, [studentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async (t: TaskRow) => {
    if (!await askConfirm({ title: '이 단어 과제를 뺄까요?', message: `${t.bookTitle} · ${days(t)} — 학생 과제 목록에서 사라져요.`, confirmText: '빼기', tone: 'danger', icon: 'trash' })) return;
    setBusy(true); setMessage('');
    try {
      const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'word-task-remove', id: t.id }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || r.userMessage || '과제를 빼지 못했어요.');
      await load();
    } catch (e: any) { setMessage(e?.message || '과제를 빼지 못했어요.'); } finally { setBusy(false); }
  };
  if (!tasks || !tasks.length) return null;
  const going = tasks.filter(t => !t.completedAt).length;
  return <div className="word-tasks-fold">
    <button type="button" className="word-tasks-chip" aria-expanded={open} onClick={() => setOpen(o => !o)}>📚 단어 과제 · 진행 중 {going} · 완료 {tasks.length - going} {open ? '▴' : '▾'}</button>
    {open && <section className="word-tasks-panel" aria-label="단어 과제">
    {tasks.map(t => <div key={t.id} className="word-tasks-row">
      <span className="word-tasks-name"><b>{t.kind === 'test' ? '📝' : '🗺️'} {t.bookTitle}</b><small>{days(t)} · {t.kind === 'test' ? '단어 테스트' : '원정대'} · {md(t.createdAt)} 냄</small></span>
      {t.kind === 'test'
        ? <span className="word-tasks-progress"><small>{t.best == null ? '아직 안 봄' : `최고 ${t.best}점`} · 통과 {t.passScore ?? 90}점{t.attempts ? ` · ${t.attempts}번 봄` : ''}</small><span className="word-tasks-bar"><i className="is-test" style={{ width: `${Math.min(100, Math.round((t.best || 0) / (t.passScore || 90) * 100))}%` }} /></span></span>
        : <span className="word-tasks-progress"><small>{t.mastered} / {t.total} 맞힘</small><span className="word-tasks-bar"><i style={{ width: `${Math.round(t.mastered / Math.max(1, t.total) * 100)}%` }} /></span></span>}
      <span className={t.completedAt ? 'word-tasks-done' : 'word-tasks-open'}>{t.completedAt ? `✅ ${md(t.completedAt)} ${t.kind === 'test' ? '통과' : '완료'}` : '진행 중'}</span>
      {!t.completedAt ? <button type="button" className="word-tasks-remove" disabled={busy} onClick={() => void remove(t)}>빼기</button> : <span />}
    </div>)}
    {message && <p role="alert" className="word-tasks-error">{message}</p>}
  </section>}
  </div>;
}
