import { useEffect, useRef } from 'react';
import { PET_GROWTH } from '../../lib/petCatalog';
import type { GrowthNoticeView } from '../../lib/petService';

const won = (n: number) => n.toLocaleString('ko-KR');

/** 이달의 성장 보상: paid on the 1st for the month before (탑 and 원정대 growth), shown once when the app opens — every month
 *  not seen yet (a student away for a while sees each); 받기 clears them on the server so another device does not show them again. */
export default function GrowthNotice({ notices, onClose }: { notices: GrowthNoticeView[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), button = useRef<HTMLButtonElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } } button.current?.focus(); }, []);
  const months = [...notices].sort((a, b) => a.month.localeCompare(b.month)).map(n => ({ month: n.month, lines: ([['floor', '🗼 탑 성장', '층'], ['star', '⭐ 원정대 성장', '별']] as const).map(([k, label, unit]) => ({ k, label, unit, l: n[k] })).filter(x => x.l && x.l.points > 0) }));
  const all = months.flatMap(m => m.lines), total = all.reduce((n, x) => n + x.l!.points, 0), last = months[months.length - 1], top = last?.lines.find(x => (x.l!.rank || 99) <= PET_GROWTH.top.length);
  const mm = (month: string) => `${Number(month.slice(5))}월`;
  return <dialog ref={ref} aria-labelledby="growth-notice-title" onCancel={e => { e.preventDefault(); onClose(); }} className="m-auto w-[min(340px,calc(100vw-32px))] rounded-3xl border-0 bg-white p-0 text-[#5e1e2a] shadow-2xl backdrop:bg-slate-900/40">
    <div className="px-5 pb-3 pt-5 text-center">
      <p className="text-4xl" aria-hidden="true">🏆</p>
      <h2 id="growth-notice-title" className="mt-1 text-base font-black">{months.length > 1 ? `${months.map(m => mm(m.month)).join('·')} 이달의 성장 보상` : `${mm(last.month)} 이달의 성장 보상`}</h2>
      {top && <p className="mt-1 inline-block rounded-full bg-[#faeeda] px-3 py-0.5 text-xs font-bold text-[#854f0b]">{top.k === 'floor' ? PET_GROWTH.titles.floor : PET_GROWTH.titles.star} {top.l!.rank}위!</p>}
      <p className="mt-1 text-2xl font-black text-[#d26272]">+{won(total)}P</p>
      <ul className="mt-3 rounded-2xl bg-[#fef2f3] px-3 py-2 text-left text-xs">
        {months.flatMap(m => m.lines.map(x => <li key={m.month + x.k} className="flex items-baseline justify-between gap-2 py-0.5"><span className="text-slate-600">{months.length > 1 ? `${mm(m.month)} ` : ''}{x.label}{x.l!.rank && x.l!.rank <= PET_GROWTH.next.upTo ? ` ${x.l!.rank}위` : ''} (+{x.l!.gain}{x.unit})</span><b>{won(x.l!.points)}P</b></li>))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">{months.map(m => mm(m.month)).join('·')} 장학 쿠폰에도 더해졌어요 · 이번 달도 순위표 '이달의 성장'에서 볼 수 있어요</p>
    </div>
    <div className="px-5 pb-5"><button ref={button} type="button" onClick={onClose} className="h-11 w-full rounded-2xl bg-[#d26272] text-sm font-bold text-white">받기</button></div>
  </dialog>;
}
