import { useState } from 'react';
import { ROLE_MEANING, linkRuns, linkWords, structureFlow, type LinkMark, type PassageLevel, type StructureRole } from '../../lib/passageLevel';
import type { StructurePart } from '../../lib/passageApi';

// 지문 분석 4단계 pieces: 난이도 ★ (app rules, with the measurements), linking words marked in place, and the 구조 지도.

/** 난이도 ★ next to the title; pressing it shows what it was worked out from. */
export function LevelBadge({ level }: { level: PassageLevel | null }) {
  const [open, setOpen] = useState(false);
  return <span className="inline-flex flex-col">
    <button type="button" aria-expanded={open} onClick={() => setOpen(x => !x)} className="w-fit rounded-full bg-[#fbeaf0] px-2 py-0.5 text-[11px] font-bold text-[#72243e]">
      {level ? <>난이도 <span aria-label={`5개 중 ${level.stars}개`} className="tracking-[1px]">{'★'.repeat(level.stars)}{'☆'.repeat(5 - level.stars)}</span> {level.label}</> : '난이도 —'}
    </button>
    {open && <span className="mt-1 text-[11px] font-normal text-slate-400">{level ? `${level.measures.join(' · ')} — 정해진 규칙으로 센 참고용이에요(관계사·분사구는 놓칠 수 있어요)${level.short ? ' · 짧은 지문이라 대략적인 값이에요' : ''}${level.measures.some(m => m.startsWith('학원 단어')) ? '' : ' · ③ 단어 탭을 열면 학원 단어 기준도 더해져요'}` : '판단할 자료가 적어요 (15단어 이상이면 보여요)'}</span>}
  </span>;
}

const LINK_TITLE: Record<LinkMark['kind'], string> = { 역접: '역접 — 앞 내용을 뒤집어요', 예시: '예시 — 구체적인 예를 들어요', 결과: '결과 — 앞 내용 때문에 생긴 일', 결론: '결론 — 글을 정리해요' };
/** Pieces of one sentence (직독직해 chunks, pause hints or the whole sentence) with its linking words on pink. The
 *  pieces must hold the sentence's tokens in order; if they do not, they are shown plain. */
export function linkedPieces(sentence: string, pieces: string[]) {
  return linkRuns(sentence, pieces).map(runs => <>{runs.map((r, k) => <span key={k}>{k ? ' ' : ''}{r.kind ? <mark title={LINK_TITLE[r.kind]} className="rounded bg-[#fbeaf0] px-0.5 text-[#72243e]">{r.text}</mark> : r.text}</span>)}</>);
}
export const LinkedSentence = ({ text }: { text: string }) => <>{linkedPieces(text, [text])[0]}</>;
/** The legend under 직독직해 when the passage has linking words. */
export function LinkLegend({ sentences }: { sentences: string[] }) {
  const kinds = [...new Set(sentences.flatMap(s => linkWords(s).map(m => m.kind)))];
  if (!kinds.length) return null;
  return <p className="text-[11px] text-slate-400">연결어 표시: {kinds.map(k => <mark key={k} className="mr-1 rounded bg-[#fbeaf0] px-1 text-[#72243e]">{k}</mark>)}— 앱이 찾은 흐름을 바꾸는 말이에요 (마우스를 올리면 뜻이 보여요)</p>;
}

/** 구조 지도: each sentence's role (neighbours with the same role in one row), the key sentence with ★. */
export function StructureMap({ sentences, map }: { sentences: string[]; map: StructurePart }) {
  const rows: { role: string; from: number; to: number }[] = [];
  map.roles.forEach((role, i) => { const last = rows[rows.length - 1];
    if (last && role && last.role === role && i !== map.key && last.to !== map.key) last.to = i; else rows.push({ role, from: i, to: i }); });
  const used = [...new Set(map.roles.filter(Boolean))] as StructureRole[];
  return <section aria-label="구조 지도" className="rounded-xl border border-[#f3e6e8] p-3">
    <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm text-[#72243e]">글의 구조</b><span className="text-[11px] text-slate-400">{structureFlow(map.roles)}</span></div>
    <ol className="mt-1.5">{rows.map(r => { const key = r.from === map.key;
      return <li key={r.from} className="flex items-start gap-2 border-t border-slate-100 py-1.5 text-sm leading-relaxed first:border-t-0">
        <span className={`mt-0.5 w-16 flex-none rounded-full py-0.5 text-center text-[11px] font-bold ${key ? 'bg-[#72243e] text-white' : r.role ? 'bg-[#fbeaf0] text-[#72243e]' : 'bg-slate-50 text-slate-300'}`}>{key ? `★ ${r.role || '핵심'}` : r.role || '—'}</span>
        <span className={key ? 'font-bold text-slate-800' : 'text-slate-700'}><span className="mr-1 text-[11px] font-normal text-slate-400">{r.from === r.to ? r.from + 1 : `${r.from + 1}–${r.to + 1}`}</span>
          {sentences.slice(r.from, r.to + 1).map((s, k) => <span key={k}>{k ? ' ' : ''}<LinkedSentence text={s} /></span>)}</span>
      </li>; })}</ol>
    {used.length > 0 && <p className="mt-1 border-t border-slate-100 pt-1.5 text-[11px] leading-relaxed text-slate-400">{used.map(r => `${r}: ${ROLE_MEANING[r]}`).join(' · ')} · ★ 핵심 문장</p>}
  </section>;
}
