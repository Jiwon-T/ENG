import { useState } from 'react';
import { Flag } from 'lucide-react';
import { passageCall } from '../../lib/passageApi';

// 문제 신고: a small ⚑ 신고 on each question (the teacher's set, a student's result); what looks wrong and a short note go
// to the admin's 문제 신고 list. Asking again for the same question changes the earlier report.
const REASONS = [['answer', '정답이 틀렸어요'], ['explanation', '해설이 이상해요'], ['question', '문제나 보기가 이상해요'], ['other', '기타']] as const;

export default function ReportButton({ setId, assignmentId, index }: { setId?: string; assignmentId?: string; index: number }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState<string>(''), [note, setNote] = useState(''), [state, setState] = useState<'idle' | 'busy' | 'done'>('idle'), [error, setError] = useState('');
  const send = async () => {
    if (!reason) { setError('어떤 점이 이상한지 골라 주세요.'); return; }
    setState('busy'); setError('');
    try { await passageCall('question-report', { ...(assignmentId ? { assignmentId } : { setId }), index, reason, note: note.trim() }); setState('done'); window.setTimeout(() => setOpen(false), 900); }
    catch (e: any) { setState('idle'); setError(e?.message || '신고하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  };
  return <span className="relative inline-block print:hidden">
    <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${state === 'done' ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
      <Flag size={11} aria-hidden="true" />{state === 'done' ? '신고함' : '신고'}
    </button>
    {open && <>
      <button type="button" aria-label="닫기" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      <div role="dialog" aria-label="문제 신고" className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-lg">
        {state === 'done' ? <p className="py-3 text-center text-sm font-bold text-emerald-700">신고했어요. 고마워요!</p> : <>
          <b className="text-xs font-black text-slate-700">어떤 점이 이상한가요?</b>
          <div className="mt-2 space-y-1">{REASONS.map(([id, label]) => <button key={id} type="button" onClick={() => { setReason(id); setError(''); }} aria-pressed={reason === id}
            className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-xs font-bold ${reason === id ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600'}`}>{label}</button>)}</div>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="메모 (선택): 2번도 답이 될 수 있어요" aria-label="신고 메모" className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:ring-2 focus:ring-pink-100" />
          {error && <p role="alert" className="mt-1 text-[11px] text-rose-600">{error}</p>}
          <button type="button" disabled={state === 'busy'} onClick={() => void send()} className="mt-2 w-full rounded-xl bg-[#d26272] py-2 text-xs font-bold text-white disabled:opacity-50">신고하기</button>
          <p className="mt-1.5 text-[10px] text-slate-400">신고는 관리자만 봐요. 같은 문제는 한 번만 신고돼요.</p>
        </>}
      </div>
    </>}
  </span>;
}
