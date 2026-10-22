import { lazy, Suspense, useEffect, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { PetService } from '../../lib/petService';
import { askConfirm } from '../teacher/ConfirmDialog';
import { QuietPrompt } from '../sentence/SentenceGame';
import type { FeedRunView, FeedTaskView } from './WordFeed';

const WordFeed = lazy(() => import('./WordFeed'));

// 홈 › 오늘: the student's 원정대 단어 과제 not done yet, one line each (진행 막대); tapping one opens its game right here (no
// map). `onCount`: how many are open, counted with the 숙제 on the 오늘 badge. A task done leaves the list.
interface TaskRow extends FeedTaskView { id: string }
export default function HomeWordTasks({ rowClass, iconClass, arrowClass, onCount }: { rowClass: string; iconClass: string; arrowClass: string; onCount?: (open: number) => void }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]), [quietFor, setQuietFor] = useState<{ id: string; restart: boolean } | null>(null);
  const [game, setGame] = useState<{ run: FeedRunView; state: any; task: TaskRow } | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const load = async () => { const r: any = await PetService.act('word-tasks'); const open = (r.tasks || []).filter((t: TaskRow) => !t.completedAt); setTasks(open); onCount?.(open.length); };
  useEffect(() => { void load().catch(() => undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const play = async (task: TaskRow, restart = false, quiet?: boolean): Promise<void> => {
    if (quiet === undefined) { setQuietFor({ id: task.id, restart }); return; }
    setQuietFor(null); setBusy(true); setNotice('');
    try {
      const r: any = await PetService.act('feed-start', { task: task.id, quiet, ...(restart ? { restart: true } : {}) });
      if (r.run) setGame({ run: r.run, state: r.state, task });
    } catch (e: any) {
      if (e?.code === 'FEED_OTHER_RUN' && await askConfirm({ title: '하던 판이 있어요', message: '하던 판을 그만두고 단어 과제를 풀까요? (과제 판은 기운을 쓰지 않아요)', confirmText: '그만두고 풀기' })) { setBusy(false); return play(task, true, quiet); }
      if (e?.code !== 'FEED_OTHER_RUN') { setNotice(e?.message || '잠시 후 다시 해 주세요.'); void load().catch(() => undefined); }
    } finally { setBusy(false); }
  };
  if (!tasks.length && !game) return null;
  return <>
    {tasks.slice(0, 2).map(t => <button key={t.id} type="button" disabled={busy} onClick={() => void play(t)} className={rowClass}>
      <span className={iconClass}><MapIcon size={15} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><b className="block truncate font-bold text-[#0c447c]">원정대 단어 과제</b>
        <span className="block truncate text-xs text-slate-500">{t.title} · {t.mastered}/{t.total}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#e6f1fb]"><span className="block h-full rounded-full bg-[#1d9e75]" style={{ width: `${Math.round(t.mastered / Math.max(1, t.total) * 100)}%` }} /></span></span>
      <span className={`${arrowClass} flex-none text-xs font-bold`}>풀기 →</span>
    </button>)}
    {notice && <p role="alert" className="px-1 py-1 text-xs font-bold text-[#b04a5a]">{notice}</p>}
    {quietFor && <QuietPrompt onLoud={() => { const t = tasks.find(x => x.id === quietFor.id); if (t) void play(t, quietFor.restart, false); }} onQuiet={() => { const t = tasks.find(x => x.id === quietFor.id); if (t) void play(t, quietFor.restart, true); }} quietLabel="조용히 해야 해요 → 소리 없는 문제만" />}
    {game && <Suspense fallback={null}><WordFeed run={game.run} state={game.state} task={game.task} title={`📚 ${game.task.title}`}
      send={async (action, payload) => { const r: any = await PetService.act(action, payload); if (r.state) setGame(g => g && { ...g, state: r.state }); return r; }}
      onClose={() => { setGame(null); void load().catch(() => undefined); }} /></Suspense>}
  </>;
}
