import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';

// 학습 리포트 › 변형 문제 (선생님, 읽기 전용): the student's question sets, newest first — 선생님이 내준 문제 and the ones they
// made themselves. A row opens the 풀이 기록 시간 (each visit, by server time: not study time) and each question's answer.
interface Row { id: string; kind: 'self' | 'assigned'; title: string; status: 'draft' | 'submitted'; dueAt: number | null; createdAt: number; submittedAt: number | null; score: { correct: number; total: number } | null; reward: { points: number; late: boolean; capped: boolean } | null; answered: number; total: number | null; visits: { sessions: { start: number; end: number }[]; folded: number; minutes: number }; results: { n: number; label: string; ok: boolean; given: string; right: string }[] }
const day = (at: number) => new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
const time = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export default function TeacherQuestionAttempts({ studentKey }: { studentKey: string }) {
  const [rows, setRows] = useState<Row[] | null>(null), [reason, setReason] = useState(''), [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setRows(null); setReason('');
    teacherAuthenticatedRequest<any>(auth, `/api/teacher/workspace?action=question-attempts&studentKey=${encodeURIComponent(studentKey)}`).then(r => {
      if (!live) return;
      if (!r.ok || !r.data?.ok) { setRows([]); setReason('error'); return; }
      setRows(r.data.attempts || []); setReason(r.data.reason || '');
    }).catch(() => { if (live) { setRows([]); setReason('error'); } });
    return () => { live = false; };
  }, [studentKey]);
  if (!rows) return <section className="report-online-assignments"><h4>변형 문제</h4><p className="report-caption">불러오는 중…</p></section>;
  if (reason && !rows.length) return null; // no linked account etc.: the online view above already says why
  return <section className="report-online-assignments" aria-label="변형 문제"><h4>변형 문제 · 최근 {Math.min(rows.length, 20)}개</h4>
    {!rows.length && <p className="report-caption">푼 변형 문제가 없습니다.</p>}
    {rows.map(r => {
      const isOpen = open === r.id, s = r.visits.sessions;
      return <article key={r.id} className="report-assignment">
        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-center gap-2 text-left">
          <span className="rounded-full bg-[#fef2f3] px-2 py-0.5 text-[11px] font-bold text-[#8b2f40]">변형 문제</span>
          <span className="min-w-0 flex-1 truncate text-sm">{r.title} <span className="text-xs text-slate-400">· {r.kind === 'assigned' ? '선생님이 내줌' : '직접 만든 문제'}</span></span>
          <span className="text-xs font-bold text-slate-600">{r.status === 'submitted' && r.score ? `${r.score.correct}/${r.score.total}` : `푸는 중${r.total ? ` ${r.answered}/${r.total}` : ''}`}</span>
        </button>
        {isOpen && <div className="mt-2 text-xs leading-relaxed text-slate-600">
          <p className="font-bold text-slate-500">풀이 기록 시간</p>
          {s.map((v, k) => <p key={k}>{day(v.start)} {time(v.start)}–{time(v.end)}{k === 0 ? ' 풀기 시작' : r.status === 'submitted' && k === s.length - 1 ? ' 이어서 풀고 채점' : ' 이어서 풀기'}</p>)}
          <p className="text-slate-400">총 {r.visits.minutes}분{r.visits.folded ? ` (오래된 기록 ${r.visits.folded}개 포함)` : ''}{r.submittedAt ? ` · 제출 ${day(r.submittedAt)} ${time(r.submittedAt)}` : ''}{r.dueAt ? ` · ${r.submittedAt ? (r.submittedAt > r.dueAt ? '마감 뒤' : '마감 전') : `마감 ${day(r.dueAt)} ${time(r.dueAt)}`}` : ''}{r.reward ? ` · +${r.reward.points}P` : ''}</p>
          {r.results.length > 0 && <><p className="mt-1.5 font-bold text-slate-500">문제별</p>
            <p>{r.results.map(q => <span key={q.n} className={`mr-2 inline-block ${q.ok ? '' : 'font-bold text-rose-700'}`}>{q.n} {q.ok ? '○' : '×'}{!q.ok && (q.given || q.right) ? ` (${q.right ? `${q.given} → ${q.right}` : q.given})` : ''}</span>)}</p></>}
        </div>}
      </article>;
    })}
  </section>;
}
