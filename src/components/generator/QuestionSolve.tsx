import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, CloudCheck, X } from 'lucide-react';
import { passageCall } from '../../lib/passageApi';
import { CIRCLED, LETTERS5 } from '../../lib/questionMaker';
import CertRequest from '../student/CertRequest';

// 변형 문제 풀기: one question at a time; each choice is saved on the server (나갔다 와도 남아요), 채점 once at the end,
// then the result with the right answers and explanations. The server never sends the answers before grading.
interface SolveQuestion { index: number; type: string; label: string; prompt: string; box?: string; passage?: string; paragraphs?: { label: string; text: string }[]; options?: string[]; pairs?: number; fixes?: number; write?: boolean }
interface Result { index: number; type: string; ok: boolean; right: number | string[]; given: number | string[] | null; pairs?: { right: string; given: string; ok: boolean; label?: string }[]; explanation: string; mark?: string; check?: { by: string; reason: string } }
interface Attempt { setId?: string; assignmentId?: string; title: string; dueAt?: number | null; reward?: { points: number; wanted: number; capped: boolean; late: boolean; noPet?: boolean } | null; status: 'draft' | 'submitted'; answers: Record<string, number | string[]>; questions: SolveQuestion[]; score?: { correct: number; total: number }; results?: Result[] }
type Answer = number | string[];
const LETTERS = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', 'ⓕ', 'ⓖ', 'ⓗ', 'ⓘ', 'ⓙ', 'ⓚ', 'ⓛ'];
const PAIRS = /[ⓐ-ⓛ]\[([^\]/]+) \/ ([^\]]+)\]/g;
const pairsOf = (passage = '') => [...passage.matchAll(PAIRS)].map(m => [m[1], m[2]]);
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-bold ${on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600 hover:border-[#eaa0a9]'}`;
const done = (q: SolveQuestion, a: Answer | undefined) => q.type === 'choice' ? Array.isArray(a) && a.length === (q.pairs || 0) && a.every(Boolean)
  : q.fixes ? Array.isArray(a) && a.length === q.fixes && a.every(x => x.length > 2 && x.slice(2).trim() !== '')
  : q.write ? Array.isArray(a) && Boolean(a[0]?.trim()) : typeof a === 'number';

/** A passage with its numbered, underlined parts (`①{word}` 어법 수정 · 어휘 선택, `ⓐ{word}` 서술형 어법). */
export function Marked({ text }: { text: string }) {
  const parts = text.split(/([①-⑤ⓐ-ⓔ])\{([^}]*)\}/);
  return <>{parts.map((p, i) => i % 3 === 1 ? <span key={i}>{p}<u className="underline-offset-2">{parts[i + 1]}</u></span> : i % 3 === 2 ? null : p)}</>;
}

/** `setId`: one's own set; `assignmentId`: a set a teacher gave (graded with points). */
export default function QuestionSolve({ setId, assignmentId, onBack, backLabel = '문제로' }: { setId?: string; assignmentId?: string; onBack: () => void; backLabel?: string }) {
  const which = assignmentId ? { assignmentId } : { setId };
  const [attempt, setAttempt] = useState<Attempt | null>(null), [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [at, setAt] = useState(0), [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle'), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined), latest = useRef(answers);
  useEffect(() => { passageCall<{ attempt: Attempt }>('attempt-open', which).then(r => { setAttempt(r.attempt); setAnswers(r.attempt.answers || {}); latest.current = r.attempt.answers || {}; }).catch(e => setMessage(e?.message || '열지 못했어요.')); }, [setId, assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const choose = (q: SolveQuestion, value: Answer) => {
    const next = { ...latest.current, [String(q.index)]: value }; latest.current = next; setAnswers(next); setSaving('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { passageCall('attempt-save', { ...which, answers: latest.current }).then(() => setSaving('saved'), e => { setSaving('idle'); setMessage(e?.message || '저장하지 못했어요.'); }); }, 700);
  };
  const submit = async () => {
    if (!attempt || busy) return;
    const left = attempt.questions.filter(q => !done(q, answers[String(q.index)]));
    if (left.length) { setMessage(`아직 고르지 않은 문제가 있어요 (${left.map(q => attempt.questions.indexOf(q) + 1).join(', ')}번).`); setAt(attempt.questions.indexOf(left[0])); return; }
    setBusy(true); setMessage(''); window.clearTimeout(timer.current);
    try { const r = await passageCall<{ attempt: Attempt }>('attempt-submit', { ...which, answers: latest.current }); setAttempt(r.attempt); }
    catch (e: any) { setMessage(e?.message || '채점하지 못했어요.'); } finally { setBusy(false); }
  };
  const back = <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeft size={14} aria-hidden="true" />{backLabel}</button>;
  const shell = (body: ReactNode) => <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 md:px-6 md:pt-8">{back}{body}</div>;
  if (!attempt) return shell(<p role={message ? 'alert' : 'status'} className="text-sm text-slate-500">{message || '불러오는 중…'}</p>);

  if (attempt.status === 'submitted' && attempt.results && attempt.score) {
    const byIndex = new Map(attempt.questions.map((q, k) => [q.index, k + 1]));
    return shell(<div className="rounded-2xl border border-[#f3e6e8] bg-white p-4">
      <p className="text-xs text-slate-500">{attempt.title}</p>
      <div className="mt-1 flex items-center justify-between gap-2"><p className="text-2xl font-black text-[#5e1e2a]">{attempt.score.correct} / {attempt.score.total}</p>
        {attempt.reward && <span className="rounded-full bg-[#fef2f3] px-2.5 py-1 text-xs font-bold text-[#8b2f40]">{attempt.reward.noPet ? '펫이 있으면 포인트를 받아요' : `+${attempt.reward.points}P`}</span>}</div>
      {attempt.reward && !attempt.reward.noPet && (attempt.reward.late || attempt.reward.capped) && <p className="mt-0.5 text-[11px] text-slate-400">{attempt.reward.late ? '마감 뒤 제출 · 포인트 90%' : ''}{attempt.reward.late && attempt.reward.capped ? ' · ' : ''}{attempt.reward.capped ? '오늘 공부 포인트를 다 채웠어요' : ''}</p>}
      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">{attempt.results.map(r => {
        const q = attempt.questions.find(x => x.index === r.index);
        return <li key={r.index} className="py-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-bold text-slate-700">{r.ok ? <Check size={14} className="text-emerald-600" aria-label="맞음" /> : <X size={14} className="text-rose-600" aria-label="틀림" />}{byIndex.get(r.index)}. {q?.label}
            {r.type !== 'choice' && !r.pairs && r.type !== 'compose' && <span className="font-medium text-slate-500"> · 정답 {r.mark}{!r.ok && typeof r.given === 'number' ? ` (내 답 ${CIRCLED[r.given - 1]})` : ''}</span>}</p>
          {r.type === 'compose' && Array.isArray(r.right) && <div className="mt-1 space-y-0.5 pl-5 text-slate-600"><p>정답 {r.right[0]}</p><p className={r.ok ? '' : 'font-bold text-rose-700'}>내 답 {Array.isArray(r.given) ? r.given[0] : ''}</p>{r.check?.reason && <p className="text-slate-500">{r.check.by === 'none' ? '' : '확인: '}{r.check.reason}</p>}</div>}
          {r.pairs && <p className="mt-1 pl-5 text-slate-600">{r.pairs.map((p, k) => <span key={k} className={`mr-2 ${p.ok ? '' : 'font-bold text-rose-700'}`}>{p.label || LETTERS[k]} {p.right}{p.ok ? '' : ` (내 답 ${p.given || '-'})`}</span>)}</p>}
          {r.explanation && <p className="mt-1 whitespace-pre-line pl-5 text-slate-500">{r.explanation}</p>}
        </li>;
      })}</ul>
      {setId && !assignmentId && <CertRequest kind="questions" refId={setId} />}
    </div>);
  }

  const q = attempt.questions[at], total = attempt.questions.length, answered = attempt.questions.filter(x => done(x, answers[String(x.index)])).length, a = answers[String(q.index)];
  return shell(<div className="rounded-2xl border border-[#f3e6e8] bg-white p-4">
    <div className="mb-1.5 flex items-center justify-between gap-2"><b className="truncate text-sm text-[#5e1e2a]">{attempt.title}</b>
      <span className="flex flex-none items-center gap-1 text-[11px] text-slate-400">{at + 1} / {total}{saving !== 'idle' && <> · <CloudCheck size={12} aria-hidden="true" />{saving === 'saving' ? '저장 중' : '자동 저장'}</>}</span></div>
    <div className="mb-3 h-1 rounded-full bg-slate-100" aria-hidden="true"><div className="h-1 rounded-full bg-[#d26272]" style={{ width: `${Math.round((answered / total) * 100)}%` }} /></div>
    <p className="text-sm font-bold text-[#5e1e2a]">{at + 1}. {q.prompt}</p>
    {q.box && <p className="mt-2 rounded-lg border border-slate-400 px-3 py-2 text-sm leading-relaxed">{q.box}</p>}
    {q.paragraphs?.map(p => <p key={p.label} className="mt-2 text-sm leading-relaxed"><b className="mr-1">{p.label}</b>{p.text}</p>)}
    {q.passage && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"><Marked text={q.passage} /></p>}
    {q.type === 'choice'
      ? <div className="mt-3 space-y-1.5">{pairsOf(q.passage).map((pair, k) => { const mine = Array.isArray(a) ? a : []; return <div key={k} className="flex items-center gap-1.5"><span className="w-5 text-sm">{LETTERS[k]}</span>
          {pair.map(w => <button key={w} type="button" aria-pressed={mine[k] === w} onClick={() => { const cur = latest.current[String(q.index)], now = Array.isArray(cur) ? cur : [], next = Array.from({ length: q.pairs || 0 }, (_, j) => now[j] || ''); next[k] = w; choose(q, next); }} className={chip(mine[k] === w)}>{w}</button>)}</div>; })}</div>
      : q.fixes ? <div className="mt-3 space-y-1.5">{Array.from({ length: q.fixes }, (_, k) => { const mine = Array.isArray(a) ? a[k] || '' : '', letter = mine.slice(0, 1), word = mine.slice(2);
          const put = (l: string, w: string) => { const cur = latest.current[String(q.index)], now = Array.isArray(cur) ? cur : [], next = Array.from({ length: q.fixes || 0 }, (_, j) => now[j] || ''); next[k] = l ? `${l} ${w}` : ''; choose(q, next); };
          return <div key={k} className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-slate-400">{k + 1}</span>
            {LETTERS5.map(l => <button key={l} type="button" aria-pressed={letter === l} onClick={() => put(l, word)} className={chip(letter === l)}>{l}</button>)}
            <input value={word} disabled={!letter} maxLength={60} onChange={e => put(letter, e.target.value)} placeholder={letter ? '바르게 고친 말' : '기호를 먼저 골라요'} aria-label={`${k + 1}번째 고친 말`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50" />
          </div>; })}</div>
      : q.write ? <textarea value={Array.isArray(a) ? a[0] || '' : ''} maxLength={400} rows={3} onChange={e => choose(q, [e.target.value])} placeholder="영어 문장을 써요" aria-label="영작" className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#eaa0a9]" />
      : !q.options ? <div className="mt-3 flex gap-1.5" role="group" aria-label="번호 고르기">{CIRCLED.map((m, k) => <button key={m} type="button" aria-pressed={a === k + 1} onClick={() => choose(q, k + 1)} className={`h-10 flex-1 rounded-xl border text-base ${a === k + 1 ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-700 hover:border-[#eaa0a9]'}`}>{m}</button>)}</div>
      : <ol className="mt-3 grid gap-1">{q.options.map((o, k) => <li key={k}><button type="button" aria-pressed={a === k + 1} onClick={() => choose(q, k + 1)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${a === k + 1 ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-700 hover:border-[#eaa0a9]'}`}>{CIRCLED[k]} {o}</button></li>)}</ol>}
    {message && <p role="alert" className="mt-3 text-xs font-bold text-[#b04a5a]">{message}</p>}
    <div className="mt-4 flex gap-2">
      <button type="button" disabled={at === 0} onClick={() => setAt(at - 1)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 disabled:opacity-40">이전</button>
      {at < total - 1 ? <button type="button" onClick={() => setAt(at + 1)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600">다음</button>
        : <button type="button" disabled={busy} onClick={() => void submit()} className="flex-1 rounded-xl bg-[#d26272] py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '채점 중…' : '채점하기'}</button>}
    </div>
    <p className="mt-2 text-[11px] text-slate-400">나갔다 와도 고른 답이 남아요 · 채점은 한 번만 할 수 있어요</p>
  </div>);
}
