import { useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';
import { passageCall } from '../../lib/passageApi';
import { CIRCLED, OPTION_EDIT_TYPES, QUESTION_TYPES, type MadeQuestion } from '../../lib/questionMaker';

// 문제 하나 다시 만들기 · 고치기 (beside each question of one's own set). 다시 만들기: the same type again from the passage
// (AI-helped types count once this month; not in a 합본). 고치기: the question and the explanation, and for the choice
// types the five choices and the answer; the server checks the result against the passage before saving.
interface Props<S> { q: MadeQuestion; setId: string; index: number; bundle: boolean; onChanged: (set: S, left: number | null) => void }
const field = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#eaa0a9]';

export default function QuestionTools<S>({ q, setId, index, bundle, onChanged }: Props<S>) {
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState<'' | 'redo' | 'edit'>(''), [message, setMessage] = useState('');
  const [prompt, setPrompt] = useState(q.prompt), [explanation, setExplanation] = useState(q.explanation);
  const [options, setOptions] = useState<string[]>(q.options || []), [answer, setAnswer] = useState(typeof q.answer === 'number' ? q.answer : 1);
  const choices = OPTION_EDIT_TYPES.includes(q.type) && Boolean(q.options), ai = QUESTION_TYPES.find(t => t.id === q.type)?.by === 'ai';
  const open = () => { setPrompt(q.prompt); setExplanation(q.explanation); setOptions(q.options || []); setAnswer(typeof q.answer === 'number' ? q.answer : 1); setMessage(''); setEditing(true); };
  const redo = async () => {
    if (busy) return;
    if (ai && !window.confirm('이 문제를 같은 유형으로 다시 만들어요. 이번 달 만들기 횟수가 1번 들어요.')) return;
    setBusy('redo'); setMessage('');
    try { const r = await passageCall<{ set: S; left: number | null }>('question-redo', { setId, index }); setEditing(false); onChanged(r.set, r.left); }
    catch (e: any) { setMessage(e?.message || '다시 만들지 못했어요.'); } finally { setBusy(''); }
  };
  const save = async () => {
    if (busy) return; setBusy('edit'); setMessage('');
    try {
      const r = await passageCall<{ set: S; changed: boolean }>('question-edit', { setId, index, question: { prompt, explanation, ...(choices ? { options, answer } : {}) } });
      setEditing(false); if (r.changed) onChanged(r.set, null);
    } catch (e: any) { setMessage(e?.message || '저장하지 못했어요.'); } finally { setBusy(''); }
  };
  const btn = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:border-[#eaa0a9] hover:text-[#8b2f40] disabled:opacity-50';
  // open, the form takes the whole width (the card wraps it under the question)
  return <div className={editing ? 'w-full print:hidden' : 'print:hidden'}>
    <span className="flex justify-end gap-1">
      {!bundle && <button type="button" disabled={Boolean(busy)} onClick={() => void redo()} title={ai ? '이번 달 만들기 1번' : '횟수가 들지 않아요'} className={btn}><RefreshCw size={11} aria-hidden="true" className={busy === 'redo' ? 'animate-spin' : ''} />{busy === 'redo' ? '만드는 중…' : '다시 만들기'}</button>}
      <button type="button" aria-expanded={editing} disabled={Boolean(busy)} onClick={() => (editing ? setEditing(false) : open())} className={btn}><Pencil size={11} aria-hidden="true" />고치기</button>
    </span>
    {message && !editing && <p role="alert" className="mt-1 text-right text-[11px] font-bold text-[#b04a5a]">{message}</p>}
    {editing && <div className="mt-2 w-full space-y-2 rounded-xl border border-[#f3d5da] bg-[#fffafa] p-3 text-left">
      <label className="block text-[11px] font-bold text-slate-500">발문<textarea value={prompt} rows={2} maxLength={300} onChange={e => setPrompt(e.target.value)} className={`${field} mt-0.5 font-normal`} /></label>
      {choices && <div className="space-y-1"><p className="text-[11px] font-bold text-slate-500">보기 <span className="font-normal text-slate-400">· 동그라미를 눌러 정답을 골라요</span></p>
        {options.map((o, i) => <div key={i} className="flex items-center gap-1.5">
          <button type="button" aria-pressed={answer === i + 1} aria-label={`${i + 1}번을 정답으로`} onClick={() => setAnswer(i + 1)} className={`h-6 w-6 flex-none rounded-full text-sm ${answer === i + 1 ? 'bg-[#d26272] text-white' : 'border border-slate-200 text-slate-500'}`}>{CIRCLED[i]}</button>
          <input value={o} maxLength={200} onChange={e => setOptions(x => x.map((y, k) => (k === i ? e.target.value : y)))} aria-label={`보기 ${i + 1}`} className={field} />
        </div>)}</div>}
      {!choices && <p className="text-[11px] text-slate-400">이 유형은 정답이 지문에서 정해져서 발문과 해설만 고칠 수 있어요.</p>}
      <label className="block text-[11px] font-bold text-slate-500">해설<textarea value={explanation} rows={3} maxLength={1200} onChange={e => setExplanation(e.target.value)} className={`${field} mt-0.5 font-normal`} /></label>
      {message && <p role="alert" className="text-[11px] font-bold text-[#b04a5a]">{message}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500">취소</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void save()} className="rounded-lg bg-[#d26272] px-3 py-1 text-xs font-bold text-white disabled:opacity-50">{busy === 'edit' ? '확인하는 중…' : '저장'}</button>
      </div>
    </div>}
  </div>;
}
