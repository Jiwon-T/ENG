import { useEffect, useRef } from 'react';
import type { CouponExtraView, InboxLine } from '../../lib/petService';

const won = (n: number) => n.toLocaleString('ko-KR');
const signed = (n: number) => `${n < 0 ? '−' : '+'}${won(Math.abs(n))}`;
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/**
 * 쌓인 포인트 알림: when the app opens, the 수업 보상 that came in while the student was away (the teacher's 반영 pays
 * without the app), once. 확인 empties the inbox on the server, so it does not come back on another device.
 */
export default function PointsInbox({ lines, extra, onClose }: { lines: InboxLine[]; extra?: CouponExtraView | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), button = useRef<HTMLButtonElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } } button.current?.focus(); }, []);
  const total = lines.reduce((n, x) => n + x.points, 0), sorted = [...lines].sort((a, b) => b.day.localeCompare(a.day));
  // 쿠폰 누적: the same lessons, with what the 보완 added on those days (잘한 수업 ×3, 자습)
  const days = new Set(lines.filter(x => x.points > 0).map(x => x.day)), more = (extra?.days || []).filter(x => days.has(x.day)).reduce((n, x) => n + x.points, 0);
  return <dialog ref={ref} aria-labelledby="points-inbox-title" onCancel={e => { e.preventDefault(); onClose(); }} className="m-auto w-[min(360px,calc(100vw-32px))] rounded-3xl border-0 bg-white p-0 text-[#5e1e2a] shadow-2xl backdrop:bg-slate-900/40">
    <div className="px-5 pb-4 pt-5 text-center">
      <p className="text-3xl" aria-hidden="true">🏫</p>
      <h2 id="points-inbox-title" className="mt-1 text-base font-black">{total >= 0 ? '앱에 안 들어온 동안 포인트가 쌓였어요' : '수업 평가가 바뀌어 포인트가 맞춰졌어요'}</h2>
      <p className={`mt-1 text-2xl font-black ${total < 0 ? 'text-slate-500' : 'text-[#d26272]'}`}>{more > 0 ? <span className="mr-1 align-middle text-xs font-bold text-slate-500">포인트</span> : null}{signed(total)}P</p>
      {more > 0 && total > 0 && <p className="mt-1 inline-block rounded-full bg-[#fdf1dd] px-3 py-1 text-xs font-bold text-[#7a4a0c]">🎟️ 쿠폰 누적 {signed(total + more)}P <span className="font-medium">(잘한 수업 3배·자습 포함)</span></p>}
      <ul className="mt-3 max-h-56 overflow-y-auto rounded-2xl bg-[#fef2f3] px-3 py-2 text-left text-xs">
        {sorted.map(x => <li key={`${x.day}|${x.label}`} className="flex items-baseline justify-between gap-2 py-0.5"><span className="min-w-0 text-slate-600">{md(x.day)} {x.label}</span><b className={`flex-none ${x.points < 0 ? 'text-slate-500' : ''}`}>{signed(x.points)}</b></li>)}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">선생님이 수업 일지를 반영하면 앱을 안 열어도 들어와요</p>
    </div>
    <div className="px-5 pb-5"><button ref={button} type="button" onClick={onClose} className="h-11 w-full rounded-2xl bg-[#d26272] text-sm font-bold text-white">확인</button></div>
  </dialog>;
}
