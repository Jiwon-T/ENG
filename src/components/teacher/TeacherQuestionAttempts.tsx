import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';

// 학습 리포트 › 변형 문제 (선생님): the student's question sets, newest first — 선생님이 내준 문제 and the ones they made
// themselves. A row opens the 풀이 기록 시간 (each visit, by server time: not study time) and each question's answer.
// 서술형 answers can be marked right or wrong by the teacher (판정 바꾸기: the score follows; a raise pays the points).
interface Row { id: string; kind: 'self' | 'assigned'; title: string; status: 'draft' | 'submitted'; dueAt: number | null; createdAt: number; submittedAt: number | null; score: { correct: number; total: number } | null; reward: { points: number; late: boolean; capped: boolean } | null; answered: number; total: number | null; visits: { sessions: { start: number; end: number }[]; folded: number; minutes: number }; results: { n: number; index: number; label: string; ok: boolean; given: string; right: string; check?: string; written?: boolean; judged?: boolean; answer?: string }[] }
const day = (at: number) => new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
const time = (at: number) => new Date(at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export default function TeacherQuestionAttempts({ studentKey }: { studentKey: string }) {
  const [rows, setRows] = useState<Row[] | null>(null), [reason, setReason] = useState(''), [open, setOpen] = useState<string | null>(null);
  const [judging, setJudging] = useState(''), [judgeError, setJudgeError] = useState('');
  const judge = async (row: Row, index: number, ok: boolean) => {
    if (judging) return; setJudging(`${row.id}:${index}`); setJudgeError('');
    try {
      const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'question-attempt-judge', studentKey, attemptId: row.id, index, ok }) });
      if (!r.ok || !r.data?.ok) throw Error(r.data?.message || '바꾸지 못했어요.');
      setRows(list => (list || []).map(x => (x.id === row.id ? r.data.attempt : x)));
    } catch (e: any) { setJudgeError(e?.message || '바꾸지 못했어요.'); } finally { setJudging(''); }
  };
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
            <p>{r.results.map(q => <span key={q.n} className={`mr-2 inline-block ${q.ok ? '' : 'font-bold text-rose-700'}`}>{q.n} {q.ok ? '○' : '×'}{!q.ok && (q.given || q.right) ? ` (${q.right ? `${q.given} → ${q.right}` : q.given})` : ''}</span>)}</p>
            {r.results.filter(q => q.check && !q.written).map(q => <p key={`c${q.n}`} className="text-slate-500">{q.n}번 {q.label} · {q.check}</p>)}
            {r.results.some(q => q.written) && <><p className="mt-1.5 font-bold text-slate-500">서술형 판정</p>
              {r.results.filter(q => q.written).map(q => { const busy = judging === `${r.id}:${q.index}`;
                return <div key={`w${q.n}`} className="mt-1 rounded-lg border border-slate-100 p-2">
                  <p><b className="text-slate-700">{q.n}번 {q.label}</b> · {q.ok ? '맞음' : '틀림'}{q.judged ? ' (선생님 판정)' : ''}</p>
                  {q.answer && <p className="text-slate-700">학생 답: {q.answer}</p>}
                  {!q.ok && q.right && <p className="text-slate-500">정답: {q.right}</p>}
                  {q.check && <p className="text-slate-500">{q.check}</p>}
                  <span className="mt-1 flex gap-1.5">
                    {([[true, '맞음으로'], [false, '틀림으로']] as const).map(([ok, label]) => <button key={label} type="button" disabled={busy || q.ok === ok} onClick={() => void judge(r, q.index, ok)} className={`rounded-lg border px-2.5 py-1 font-bold disabled:opacity-40 ${ok ? 'border-emerald-200 text-emerald-700' : 'border-rose-200 text-rose-700'}`}>{busy ? '바꾸는 중…' : label}</button>)}
                  </span>
                </div>; })}
              {r.kind === 'assigned' && r.reward && <p className="mt-1 text-slate-400">맞음으로 바꾸면 차이만큼 포인트를 더 줘요(오늘 공부 포인트 한도 안). 틀림으로 바꿔도 이미 받은 포인트는 그대로예요.</p>}
              {judgeError && <p role="alert" className="font-bold text-rose-700">{judgeError}</p>}</>}</>}
        </div>}
      </article>;
    })}
  </section>;
}
