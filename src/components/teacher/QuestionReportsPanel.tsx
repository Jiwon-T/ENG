import { useEffect, useState } from 'react';
import { passageCall } from '../../lib/passageApi';

// 관리자 설정 › 문제 신고 (admin): the open reports on 변형 문제, newest first, with the share of questions made that were
// reported (beta comes off under 5%). Each is closed as 고침 (fixed in the set) or 문제없음.
const REASON: Record<string, string> = { answer: '정답 오류', explanation: '해설', question: '문제·보기', other: '기타' };
interface Report { id: string; title: string; label: string; index: number; prompt: string; reason: string; note: string; role: string; name: string; at: number; source: string }
const day = (at: number) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }).format(new Date(at));

export default function QuestionReportsPanel({ busy, act, autoLoad = false }: { busy: boolean; act: (f: () => Promise<any>) => Promise<void>; autoLoad?: boolean }) {
  const [data, setData] = useState<{ reports: Report[]; made: number; reported: number; rate: number } | null>(null);
  const load = async () => setData(await passageCall('question-reports', {}));
  useEffect(() => { if (autoLoad) void act(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = (r: Report, status: 'fixed' | 'ok') => act(async () => { await passageCall('question-report-close', { id: r.id, status }); await load(); });
  return <section className="panel rv">
    <div className="rv-head"><h2>문제 신고</h2><button type="button" className="small-button" disabled={busy} onClick={() => void act(load)}>새로고침</button></div>
    <p className="mt-1 text-xs text-slate-500">변형 문제에서 선생님·학생이 신고한 문제예요. 고친 뒤 '고침', 괜찮으면 '문제없음'으로 닫아요. 문제 고치기는 변형 문제 만들기 › 그 세트에서 해요.</p>
    {data && <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${data.rate < 5 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
      만든 문제 {data.made.toLocaleString('ko-KR')}개 중 신고된 문제 {data.reported}개 · {data.rate}% {data.rate < 5 ? '(beta 기준 5% 미만)' : '(beta 기준 5% 넘음)'}</p>}
    {!data ? <p className="mt-2 text-sm text-slate-500">불러오는 중…</p> : !data.reports.length ? <p className="mt-2 text-sm text-slate-500">처리할 신고가 없어요.</p>
      : <ul className="mt-2 divide-y divide-slate-100">{data.reports.map(r => <li key={r.id} className="py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-1.5"><b className="font-bold text-slate-800">{r.title || '변형 문제'} · {r.index + 1}번 {r.label}</b><span className="rounded-md bg-amber-50 px-1.5 text-[11px] font-bold text-amber-800">{REASON[r.reason] || r.reason}</span>
          <span className="text-[11px] text-slate-400">{day(r.at)} · {r.role === 'teacher' ? '선생님' : '학생'} {r.name}{r.source === 'assigned' ? ' · 내준 문제' : ''}</span></div>
        {r.prompt && <p className="mt-0.5 truncate text-xs text-slate-500">{r.prompt}</p>}
        {r.note && <p className="mt-0.5 text-xs text-slate-700">“{r.note}”</p>}
        <div className="mt-1.5 flex gap-1.5"><button type="button" className="small-button" disabled={busy} onClick={() => void close(r, 'fixed')}>고침</button><button type="button" className="small-button" disabled={busy} onClick={() => void close(r, 'ok')}>문제없음</button></div>
      </li>)}</ul>}
  </section>;
}
