import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { MAX_TYPES, typeLabel, type QuestionType } from '../../lib/questionMaker';
import { practiceHints } from '../../lib/practiceTypes';

// 연습 유형 추천 (지문 분석, above the tabs): types suggested from formal clues in the passage, each with the clue; the
// first few are picked for you (and say so), any can be changed; 변형 문제 만들기 opens with them. 서술형 is shown apart
// (from the ② 문법·구조 part), not ranked with the others.
export default function PracticeHints({ sentences, essay, onMake }: { sentences: string[]; essay?: { index: number; reason: string } | null; onMake: (types: QuestionType[]) => void }) {
  const hints = useMemo(() => practiceHints(sentences), [sentences]);
  const top = () => hints.slice(0, MAX_TYPES).map(h => h.type);
  const [picked, setPicked] = useState<QuestionType[]>(top), [changed, setChanged] = useState(false), [seen, setSeen] = useState(hints);
  // another passage (or an edited one): pick its top types again
  if (seen !== hints) { setSeen(hints); setPicked(top()); setChanged(false); }
  if (!hints.length && !essay) return null;
  const flip = (t: QuestionType) => { setChanged(true); setPicked(x => x.includes(t) ? x.filter(y => y !== t) : x.length >= MAX_TYPES ? x : [...x, t]); };
  // one line per clue: types found by the same clue are listed together
  const reasons = hints.reduce<{ reason: string; types: QuestionType[] }[]>((all, h) => { const r = all.find(x => x.reason === h.reason); if (r) r.types.push(h.type); else all.push({ reason: h.reason, types: [h.type] }); return all; }, []);
  return <section aria-label="연습 유형 추천" className="mt-3 rounded-2xl border border-[#f3e6e8] bg-white p-3">
    <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm text-[#72243e]">연습 유형 추천</b><span className="text-[11px] text-slate-400">지문에서 찾은 형식적 단서로 추천해요 · 참고용이에요</span></div>
    {hints.length > 0 && <>
      <div className="mt-2 flex flex-wrap gap-1.5">{hints.map(h => { const on = picked.includes(h.type), full = !on && picked.length >= MAX_TYPES;
        return <button key={h.type} type="button" aria-pressed={on} disabled={full} onClick={() => flip(h.type)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : full ? 'border-dashed border-slate-200 text-slate-300' : 'border-slate-200 text-slate-600 hover:border-[#eaa0a9]'}`}>{on && <Check size={12} aria-hidden="true" />}{typeLabel(h.type)}</button>; })}</div>
      <ul className="mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">{reasons.map(r => <li key={r.reason}><b className="font-bold text-slate-700">{r.types.map(typeLabel).join(' · ')}</b> — {r.reason}</li>)}</ul>
    </>}
    {essay && <p className="mt-1.5 text-[11px] text-slate-500"><b className="font-bold text-[#8b2f40]">서술형 관련 참고</b> — {essay.index + 1}번째 문장 (② 문법·구조에서 고른 문장)</p>}
    {hints.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-slate-400">{changed ? `${picked.length}개 골랐어요 (${MAX_TYPES}개까지)` : `위 ${picked.length}개를 자동으로 골랐어요 · 눌러서 바꿀 수 있어요`}</span>
      <button type="button" disabled={!picked.length} onClick={() => onMake(picked)} className="ml-auto rounded-lg bg-[#d26272] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">이 유형으로 변형 문제 만들기 →</button>
    </div>}
  </section>;
}
