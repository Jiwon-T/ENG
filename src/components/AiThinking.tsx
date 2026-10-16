import { useEffect, useRef } from 'react';

// "AI가 생각하는 중": while the 지문 분석기 or 변형문제 생성기 waits, the model's own thought summaries appear as steps — each
// step's title (the bold heading the model writes) with a line of what it is doing, the newest one glowing.
/** Thought pieces arrive in chunks: a piece that starts with a **heading** begins a new step, others continue the last. */
export function addThought(list: string[], piece: string) {
  const text = piece.trim(); if (!text) return list;
  return /^\*\*/.test(text) || !list.length ? [...list, text].slice(-12) : [...list.slice(0, -1), `${list[list.length - 1]} ${text}`];
}
const parse = (raw: string) => {
  const m = raw.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  const title = (m ? m[1] : raw.split(/[.!?\n]/)[0]).trim(), body = (m ? m[2] : raw.slice(title.length)).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return { title: title.slice(0, 80), body: body.length > 140 ? `${body.slice(0, 140)}…` : body };
};

export default function AiThinking({ thoughts, tone = 'blue' }: { thoughts: string[]; tone?: 'blue' | 'amber' }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [thoughts.length]);
  const c = tone === 'amber' ? { ring: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700', soft: 'bg-amber-50' } : { ring: 'border-blue-200', dot: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50' };
  const steps = thoughts.map(parse);
  return <section aria-label="AI가 생각하는 중" aria-live="polite" className={`mt-4 rounded-2xl border ${c.ring} bg-white p-4`}>
    <div className="flex items-center gap-2">
      <span className={`relative flex h-7 w-7 items-center justify-center rounded-full ${c.soft}`} aria-hidden="true">
        <span className={`absolute inset-0 animate-ping rounded-full ${c.dot} opacity-20`} />
        <svg viewBox="0 0 24 24" width="16" height="16" className={c.text} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 8.1a3 3 0 0 0 .7 4.9A3.2 3.2 0 0 0 7 18a2.8 2.8 0 0 0 2.5 2H12V2z" /><path d="M14.5 2a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 8.1a3 3 0 0 1-.7 4.9A3.2 3.2 0 0 1 17 18a2.8 2.8 0 0 1-2.5 2H12" /></svg>
      </span>
      <b className={`text-sm font-black ${c.text}`}>AI가 생각하는 중</b>
      <span className="ml-auto text-[11px] text-slate-400">{steps.length ? `${steps.length}단계` : '지문을 읽고 있어요'}</span>
    </div>
    <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
      {!steps.length && <li className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 animate-pulse rounded-full ${c.dot}`} />생각을 정리하는 중…</li>}
      {steps.map((s, i) => { const live = i === steps.length - 1; return <li key={i} ref={live ? end : undefined} className={`flex gap-2 ${live ? '' : 'opacity-60'}`}>
        <span className={`mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-black ${live ? `${c.dot} text-white` : 'bg-slate-100 text-slate-500'}`}>{live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : '✓'}</span>
        <span className="min-w-0"><b className="block text-xs font-bold text-slate-700">{s.title}</b>{s.body && <span className="block text-[11px] leading-relaxed text-slate-500">{s.body}</span>}</span>
      </li>; })}
    </ol>
  </section>;
}
