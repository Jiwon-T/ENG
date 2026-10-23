import { lazy, Suspense, useEffect, useState } from 'react';
import { CheckCircle2, FilePenLine, Map as MapIcon } from 'lucide-react';
import { PetService } from '../../lib/petService';
import { askConfirm } from '../teacher/ConfirmDialog';
import { QuietPrompt } from '../sentence/SentenceGame';
import type { FeedRunView, FeedTaskView } from './WordFeed';

const WordFeed = lazy(() => import('./WordFeed'));
const VocabularyTest = lazy(() => import('../student/VocabularyTest'));

// 홈 › 오늘: the student's 단어 과제 not done yet, one line each — 🗺️ 원정대 (맞힘 / 전체) opens its game right here (no map),
// 📝 단어 테스트 (최고 점수 / 통과 점수) opens that range's test. `onCount`: how many are open, counted with the 숙제 on the
// 오늘 badge. A task finished today stays as a ✅ line (out of the count) until the next day.
interface TaskRow extends FeedTaskView { id: string; kind?: 'expedition' | 'test'; passScore?: number | null; best?: number | null }
const seoulDay = (at: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(at));
export default function HomeWordTasks({ rowClass, iconClass, arrowClass, onCount }: { rowClass: string; iconClass: string; arrowClass: string; onCount?: (open: number) => void }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]), [quietFor, setQuietFor] = useState<{ id: string; restart: boolean } | null>(null);
  const [game, setGame] = useState<{ run: FeedRunView; state: any; task: TaskRow } | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [test, setTest] = useState<{ words: any[]; wordbookId: string; bookTitle: string; startDay: number; endDay: number; passScore: number } | null>(null);
  const load = async () => { const r: any = await PetService.act('word-tasks'); const all: TaskRow[] = r.tasks || []; setTasks(all); onCount?.(all.filter(t => !t.completedAt).length); };
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
  // 📝 the range's test (its words kept with the task): the result shows whether the 통과 점수 was reached
  const openTest = async (task: TaskRow) => {
    setBusy(true); setNotice('');
    try { const r: any = await PetService.act('word-task-words', { id: task.id }); if (r.words?.length) setTest(r); }
    catch (e: any) { setNotice(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };
  const open = tasks.filter(t => !t.completedAt), doneToday = tasks.filter(t => t.completedAt && seoulDay(t.completedAt) === seoulDay(Date.now()));
  if (!open.length && !doneToday.length && !game && !test) return null;
  const bar = (percent: number, color: string) => <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, percent)}%`, background: color }} /></span>;
  return <>
    {open.slice(0, 3).map(t => t.kind === 'test'
      ? <button key={t.id} type="button" disabled={busy} onClick={() => void openTest(t)} className={rowClass}>
        <span className={iconClass}><FilePenLine size={15} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><b className="block truncate font-bold text-[#993556]">단어 테스트 과제</b>
          <span className="block truncate text-xs text-slate-500">{t.title} · {t.passScore ?? 90}점 넘기기{t.best != null ? ` · 최고 ${t.best}점` : ''}</span>
          {bar(Math.round((t.best || 0) / (t.passScore || 90) * 100), '#d4537e')}</span>
        <span className={`${arrowClass} flex-none text-xs font-bold`}>테스트 →</span>
      </button>
      : <button key={t.id} type="button" disabled={busy} onClick={() => void play(t)} className={rowClass}>
        <span className={iconClass}><MapIcon size={15} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><b className="block truncate font-bold text-[#0c447c]">원정대 단어 과제</b>
          <span className="block truncate text-xs text-slate-500">{t.title} · {t.mastered}/{t.total}</span>
          {bar(Math.round(t.mastered / Math.max(1, t.total) * 100), '#1d9e75')}</span>
        <span className={`${arrowClass} flex-none text-xs font-bold`}>풀기 →</span>
      </button>)}
    {doneToday.map(t => <div key={t.id} className={rowClass}>
      <span className={iconClass}><CheckCircle2 size={15} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><b className="block truncate font-bold text-[#27500a]">{t.kind === 'test' ? '단어 테스트 과제 통과' : '원정대 단어 과제 완료'}</b>
        <span className="block truncate text-xs text-slate-500">{t.title} · {t.kind === 'test' ? `${t.best ?? ''}점` : `${t.total}/${t.total}`}</span></span>
    </div>)}
    {notice && <p role="alert" className="px-1 py-1 text-xs font-bold text-[#b04a5a]">{notice}</p>}
    {quietFor && <QuietPrompt onLoud={() => { const t = tasks.find(x => x.id === quietFor.id); if (t) void play(t, quietFor.restart, false); }} onQuiet={() => { const t = tasks.find(x => x.id === quietFor.id); if (t) void play(t, quietFor.restart, true); }} quietLabel="조용히 해야 해요 → 소리 없는 문제만" />}
    {game && <Suspense fallback={null}><WordFeed run={game.run} state={game.state} task={game.task} title={`📚 ${game.task.title}`}
      send={async (action, payload) => { const r: any = await PetService.act(action, payload); if (r.state) setGame(g => g && { ...g, state: r.state }); return r; }}
      onClose={() => { setGame(null); void load().catch(() => undefined); }} /></Suspense>}
    {test && <Suspense fallback={null}><VocabularyTest words={test.words} dayRange={{ start: test.startDay, end: test.endDay }} wordbookId={test.wordbookId} wordbookTitle={test.bookTitle} category="word"
      assignment={{ passScore: test.passScore }} onClose={() => { setTest(null); window.setTimeout(() => void load().catch(() => undefined), 800); }} /></Suspense>}
  </>;
}
