import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { medalLabel, PET_COUPON } from '../../lib/petCatalog';
import type { CouponView, MedalSpot } from '../../lib/petService';

// 이달의 장학 쿠폰 and its 금메달: the goal gauge on the pet home, the 쿠폰 shop tab, and the medals placed in the room
// (꾸미기: drag a medal anywhere in the room; the 메달함 puts one in or takes it out). One medal design for every month,
// only the 'YY.MM' in the middle changes.
const won = (n: number) => n.toLocaleString('ko-KR');

/** The medal: ribbon, gold rim, star and the month ('2026-10' → 26.10). */
export function MedalArt({ month, size = 44 }: { month: string; size?: number }) {
  return <svg viewBox="0 0 60 92" width={size} height={size * 92 / 60} role="img" aria-label={`${medalLabel(month)} 금메달`}>
    <path d="M14 0h12l8 30h-12z" fill="#e0587a" /><path d="M34 0h12l-8 30h-12z" fill="#5b8fd6" />
    <path d="M22 0h4l8 30h-4z" fill="#fff" opacity=".85" /><path d="M34 0h4l-8 30h-4z" fill="#fff" opacity=".85" />
    <circle cx="30" cy="58" r="26" fill="#efa23a" /><circle cx="30" cy="58" r="21" fill="#fac977" />
    <circle cx="30" cy="58" r="21" fill="none" stroke="#b9761c" strokeWidth="1" strokeDasharray="2 2.5" />
    <path d="M30 40l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill="#b9761c" />
    <text x="30" y="67" textAnchor="middle" fontSize="12" fontWeight="800" fill="#6b3d08" letterSpacing=".4">{medalLabel(month)}</text>
  </svg>;
}

/** 펫 홈: how far this month's points are from the coupon (shown only to 영어 이지원T's students). */
export function CouponGauge({ coupon, onShop }: { coupon: CouponView; onShop: () => void }) {
  const pct = Math.min(100, Math.floor((coupon.earned / coupon.goal) * 100)), ready = coupon.earned >= coupon.goal;
  return <section aria-label={PET_COUPON.name} className="rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <b className="text-sm font-black text-[#5e1e2a]">🎟️ {coupon.requested ? `${coupon.label} 장학 쿠폰 신청 완료` : `이달의 장학 쿠폰까지 ${pct}%`}</b>
      <span className="text-xs text-slate-500">{won(coupon.earned)} / {won(coupon.goal)}P</span>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#efa23a]" style={{ width: `${pct}%` }} /></div>
    {coupon.requested ? <p className="mt-1.5 text-[11px] text-slate-500">{coupon.paid ? '선생님이 쿠폰을 주셨어요.' : '선생님이 곧 쿠폰을 주실 거예요.'} 금메달은 방 꾸미기에서 놓을 수 있어요.</p>
      : ready ? <button type="button" onClick={onShop} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#fff6e6] px-3 py-2 text-left text-xs font-bold text-[#8a5a12]"><span className="flex-1">이번 달 쿠폰을 받을 수 있어요!</span><span>상점 가기 ›</span></button>
      : <p className="mt-1.5 text-[11px] text-slate-400">이번 달 1일부터 모은 포인트예요 (써도 줄지 않아요) · 쿠폰은 한 달에 1장</p>}
  </section>;
}

/** 상점 › 쿠폰: ask for this month's coupon (no points are taken) and see the medals. */
export function CouponShop({ coupon, medals, busy, onRequest }: { coupon: CouponView; medals: string[]; busy: boolean; onRequest: () => void }) {
  const [asking, setAsking] = useState(false), ready = coupon.earned >= coupon.goal;
  const shown = [...new Set([coupon.month, ...medals])].sort().reverse();
  return <div className="space-y-3">
    <div className="rounded-2xl border border-[#f3e6e8] bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#fff6e6] text-xl" aria-hidden="true">🎟️</span>
        <span className="min-w-0 flex-1"><b className="block text-sm font-black text-[#5e1e2a]">{coupon.label} {PET_COUPON.name}</b><span className="block text-xs text-slate-500">이번 달 {won(coupon.goal)}P 모으면 교환 · 포인트는 그대로예요</span></span>
        {coupon.requested ? <span className="flex-none rounded-full bg-[#eef6ea] px-2.5 py-1 text-[11px] font-bold text-[#4f7a43]">{coupon.paid ? '받았어요' : '신청 완료'}</span>
          : !asking && <button type="button" disabled={!ready || busy} onClick={() => setAsking(true)} className="flex-none rounded-xl bg-[#e0587a] px-3.5 py-2 text-xs font-bold text-white disabled:bg-[#f8f1f2] disabled:text-[#b9a0a5]">교환하기</button>}
      </div>
      {!coupon.requested && !ready && <p className="mt-2 text-[11px] text-slate-500">{won(coupon.goal - coupon.earned)}P 더 모으면 교환할 수 있어요. 신청하지 않고 달이 바뀌면 그 달 쿠폰은 넘어가요.</p>}
      {asking && !coupon.requested && <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#fff6e6] px-3 py-2 text-xs text-[#8a5a12]">
        <span className="flex-1">{coupon.label} 쿠폰을 신청할까요? 금메달도 함께 받아요.</span>
        <button type="button" onClick={() => setAsking(false)} className="rounded-lg border border-[#f0d9b0] bg-white px-2.5 py-1 font-bold">취소</button>
        <button type="button" disabled={busy} onClick={() => { setAsking(false); onRequest(); }} className="rounded-lg bg-[#e0587a] px-2.5 py-1 font-bold text-white disabled:opacity-60">신청</button>
      </div>}
    </div>
    <div>
      <p className="mb-1.5 text-xs font-bold text-[#8b2f40]">금메달 · 쿠폰을 신청하면 그 달 메달을 받아요</p>
      <div className="grid grid-cols-3 gap-2">{shown.map(m => { const mine = medals.includes(m); return <div key={m} className={`flex flex-col items-center rounded-2xl border px-1 py-2 text-center ${mine ? 'border-[#efc77a] bg-[#fffaf0]' : 'border-[#f3e6e8] bg-white'}`}>
        <span className={mine ? '' : 'opacity-40 grayscale'}><MedalArt month={m} size={34} /></span>
        <span className="mt-1 text-[11px] font-bold text-[#5e1e2a]">{medalLabel(m)} 금메달</span>
        <span className="text-[10px] text-slate-400">{mine ? '메달함에 있어요' : m === coupon.month ? '이번 달' : ''}</span>
      </div>; })}</div>
    </div>
  </div>;
}

/** The medals placed in the room. While decorating they can be dragged (mouse or touch); otherwise they stay out of the way. */
export function MedalLayer({ spots, editing, onMove }: { spots: MedalSpot[]; editing: boolean; onMove: (id: string, x: number, y: number) => void }) {
  const box = useRef<HTMLDivElement>(null), drag = useRef<string | null>(null);
  const move = (e: ReactPointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!drag.current || !r) return;
    onMove(drag.current, Math.round(Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100))), Math.round(Math.max(8, Math.min(90, ((e.clientY - r.top) / r.height) * 100))));
  };
  return <div ref={box} className={`absolute inset-0 ${editing ? 'z-30 touch-none' : 'pointer-events-none z-[4]'}`} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {spots.map(s => <span key={s.id} onPointerDown={editing ? e => { drag.current = s.id; (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); } : undefined}
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${editing ? 'cursor-grab rounded-md outline-dashed outline-[1.5px] outline-offset-2 outline-[#d29a3a] active:cursor-grabbing' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
      <MedalArt month={s.id} size={34} />
    </span>)}
  </div>;
}

/** 꾸미기 bar: the 메달함 (tap to put a medal in the room or take it out), then 취소 / 저장. */
export function MedalBox({ medals, spots, busy, onToggle, onCancel, onSave }: { medals: string[]; spots: MedalSpot[]; busy: boolean; onToggle: (id: string) => void; onCancel: () => void; onSave: () => void }) {
  const placed = new Set(spots.map(s => s.id));
  return <div className="border-t border-[#f3e6e8] bg-[#fffaf0] px-3 py-2.5">
    <div className="mb-1.5 flex items-center justify-between text-xs"><b className="font-black text-[#8a5a12]">메달함</b><span className="text-slate-500">눌러서 놓기·빼기 · 끌어서 옮기기</span></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1">{[...new Set(medals)].sort().reverse().map(m => <button key={m} type="button" aria-pressed={placed.has(m)} onClick={() => onToggle(m)} className={`flex flex-none flex-col items-center rounded-xl border px-2 py-1 text-[10px] font-bold ${placed.has(m) ? 'border-[#d29a3a] bg-white text-[#8a5a12]' : 'border-[#f0e2c8] bg-white/60 text-slate-500'}`}>
      <MedalArt month={m} size={22} />{medalLabel(m)}{placed.has(m) ? ' · 놓음' : ''}
    </button>)}</div>
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-xl border border-[#f3d5da] bg-white px-3 py-1.5 text-xs font-bold text-[#8b2f40]">취소</button>
      <button type="button" disabled={busy} onClick={onSave} className="rounded-xl bg-[#d26272] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">저장</button>
    </div>
  </div>;
}
