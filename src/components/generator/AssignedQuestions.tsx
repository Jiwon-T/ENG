import { useEffect, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { passageCall } from '../../lib/passageApi';
import QuestionSolve from './QuestionSolve';

// 변형 문제 a teacher gave, for the student: the items in the 과제 list (below the 수업 숙제) and one row on the home 오늘
// card. Opening one solves it on screen (QuestionSolve); the home row opens the report and the set at once.
export interface AssignedRow { assignmentId: string; title: string; total: number; dueAt: number | null; createdAt: number; status: 'new' | 'draft' | 'submitted'; answered: number; score: { correct: number; total: number } | null; reward: { points: number } | null }
const OPEN_KEY = 'assignedQuestionOpen';
const dayLabel = (at: number) => { const p = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(new Date(at)).map(x => [x.type, x.value])); return `${p.month}/${p.day} (${p.weekday})`; };
const timeLabel = (at: number) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
export const dueLabel = (at: number | null) => at ? `마감 ${dayLabel(at)} ${timeLabel(at)}` : '';
const late = (r: AssignedRow) => r.status !== 'submitted' && r.dueAt !== null && Date.now() > r.dueAt;
/** Home and the report share one read for a short while (going back and forth), for the same signed-in account only (a
 *  different account never sees it); a solve or a reload asks again. */
let shared: { uid: string; at: number; rows: Promise<AssignedRow[]> } | null = null;
const loadRows = (force = false) => {
  const uid = auth.currentUser?.uid || '';
  if (!force && uid && shared?.uid === uid && Date.now() - shared.at < 15_000) return shared.rows;
  const rows = passageCall<{ assigned: AssignedRow[] }>('assigned-list').then(r => r.assigned || []);
  shared = uid ? { uid, at: Date.now(), rows } : null; rows.catch(() => { shared = null; });
  return rows;
};
/** The one to show on the home card: one being solved first, then a new one (graded ones are done). */
const nextOf = (rows: AssignedRow[]) => rows.find(r => r.status === 'draft') || rows.find(r => r.status === 'new') || null;

/** 과제 list part: each 변형 문제 with 풀기 / 이어 풀기 n/m / 결과 보기. */
export function AssignedQuestionList() {
  const [rows, setRows] = useState<AssignedRow[] | null>(null), [open, setOpen] = useState<string | null>(null);
  const reload = (force = false) => loadRows(force).then(setRows).catch(() => setRows([]));
  useEffect(() => {
    reload();
    try { const id = sessionStorage.getItem(OPEN_KEY); if (id) { sessionStorage.removeItem(OPEN_KEY); setOpen(id); } } catch { /* storage off: nothing to open */ }
  }, []);
  if (open) return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fff7f8]"><QuestionSolve assignmentId={open} backLabel="숙제로" onBack={() => { setOpen(null); void reload(true); }} /></div>;
  if (!rows?.length) return null;
  return <>{rows.map(r => <div key={r.assignmentId} className={`rounded-xl border p-3 ${r.status === 'submitted' ? 'border-slate-100 bg-white' : 'border-[#f3c4cc] bg-[#fffafb]'}`}>
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <span className="rounded-full bg-[#fef2f3] px-2 py-0.5 text-[10.5px] font-bold text-[#8b2f40]">변형 문제</span>
      {r.status === 'submitted' ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">채점 완료</span>
        : late(r) ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">마감 지남 · 포인트 90%</span>
        : r.dueAt ? <span className="text-[11px] text-slate-400">{dueLabel(r.dueAt)}</span> : null}
    </div>
    <div className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${r.status === 'submitted' ? 'text-slate-500' : 'text-slate-700'}`}>{r.title} · {r.status === 'submitted' && r.score ? `${r.score.correct}/${r.score.total}${r.reward?.points ? ` · +${r.reward.points}P` : ''}` : `${r.total}문제`}</span>
      <button type="button" onClick={() => setOpen(r.assignmentId)} className={`flex-none rounded-full px-3 py-1.5 text-xs font-bold ${r.status === 'submitted' ? 'border border-[#f3c4cc] bg-white text-[#8b2f40]' : 'bg-[#d26272] text-white'}`}>
        {r.status === 'submitted' ? '결과 보기' : r.status === 'draft' ? `이어 풀기 ${r.answered}/${r.total}` : '풀기'}</button>
    </div>
  </div>)}</>;
}

/** Home 오늘 card row: the 변형 문제 to do next (one being solved, else a new one); opens the report on it. */
export function AssignedQuestionRow({ onOpen, rowClass, iconClass, svgClass, arrowClass }: { onOpen: () => void; rowClass: string; iconClass: string; svgClass: string; arrowClass: string }) {
  const [row, setRow] = useState<AssignedRow | null>(null);
  useEffect(() => { let live = true; loadRows().then(rows => { if (live) setRow(nextOf(rows)); }).catch(() => undefined); return () => { live = false; }; }, []);
  if (!row) return null;
  const go = () => { try { sessionStorage.setItem(OPEN_KEY, row.assignmentId); } catch { /* the report still lists it */ } onOpen(); };
  return <button type="button" onClick={go} className={rowClass}><span className={iconClass}><FileText size={15} className={svgClass} aria-hidden="true" /></span>
    <span className="min-w-0 flex-1 truncate">변형 문제 · {row.title}{row.dueAt ? <span className={late(row) ? 'text-amber-700' : 'text-[#993556]'}> · {late(row) ? '마감 지남' : `마감 ${dayLabel(row.dueAt)}`}</span> : null}</span>
    {row.status === 'draft' && <span className="text-xs text-slate-400">{row.answered}/{row.total}</span>}
    <ChevronRight size={16} className={arrowClass} aria-hidden="true" /></button>;
}
