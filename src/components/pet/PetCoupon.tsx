import { type ReactNode, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { countsForMonth, isSilverMedal, medalLabel, PET_COUPON, silverMedal, towerDecor } from '../../lib/petCatalog';
import type { CouponMonth, CouponView, LedgerItem, MedalSpot } from '../../lib/petService';
import { DECOR_ART } from './TowerDecorArt';

// 이달의 장학 쿠폰 and its 금메달: the goal gauge on the pet home, the 쿠폰 shop tab, and the medals placed in the room
// (꾸미기: drag a medal anywhere in the room; the 메달함 puts one in or takes it out). One medal design for every month,
// only the 'YY.MM' in the middle changes.
const won = (n: number) => n.toLocaleString('ko-KR');
/** +80 / −15 (a lowered 평가 or a deleted 일지 shows as a minus). */
const signed = (n: number) => `${n < 0 ? '−' : '+'}${won(Math.abs(n))}`;

/** The medal: ribbon, rim, star and the month ('2026-10' → 26.10); gold, or silver for a '2026-11-s' 은메달. */
const SILVER = { rim: '#9aa4b2', face: '#dfe4ea', line: '#6b7685', text: '#3d4654' }, GOLD = { rim: '#efa23a', face: '#fac977', line: '#b9761c', text: '#6b3d08' };
export function MedalArt({ month, size = 44 }: { month: string; size?: number }) {
  const c = isSilverMedal(month) ? SILVER : GOLD;
  return <svg viewBox="0 0 60 92" width={size} height={size * 92 / 60} role="img" aria-label={`${medalLabel(month)} ${isSilverMedal(month) ? '은메달' : '금메달'}`}>
    <path d="M14 0h12l8 30h-12z" fill="#e0587a" /><path d="M34 0h12l-8 30h-12z" fill="#5b8fd6" />
    <path d="M22 0h4l8 30h-4z" fill="#fff" opacity=".85" /><path d="M34 0h4l-8 30h-4z" fill="#fff" opacity=".85" />
    <circle cx="30" cy="58" r="26" fill={c.rim} /><circle cx="30" cy="58" r="21" fill={c.face} />
    <circle cx="30" cy="58" r="21" fill="none" stroke={c.line} strokeWidth="1" strokeDasharray="2 2.5" />
    <path d="M30 40l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill={c.line} />
    <text x="30" y="67" textAnchor="middle" fontSize="12" fontWeight="800" fill={c.text} letterSpacing=".4">{medalLabel(month)}</text>
  </svg>;
}

/** 탑 장식 art: 이끼 화분 … 마도서 책장 (floors 10–50), 용암 화로 … 용왕의 왕좌 (60–100), in TowerDecorArt. */
export function DecorArt({ id, size = 44 }: { id: string; size?: number }) {
  return <svg viewBox="0 0 60 76" width={size} height={size * 76 / 60} role="img" aria-label={towerDecor(id)?.name || '장식'} style={{ overflow: 'visible' }}>{DECOR_ART[id] || null}</svg>;
}
/** One thing in the room: a 금메달 (by month) or a 탑 장식 (by id). */
const Placed = ({ id, size }: { id: string; size: number }) => towerDecor(id) ? <DecorArt id={id} size={size * 1.1} /> : <MedalArt month={id} size={size} />;

/** 펫 홈: how far this month's points are from the coupon (shown to students linked to the academy). */
/** 포인트 내역 kinds: colour, icon and name (the bar under the gauge and each line). */
const KINDS: Record<LedgerItem['kind'], { color: string; icon: string; name: string }> = {
  class: { color: '#e0587a', icon: '🏫', name: '수업' }, study: { color: '#efa23a', icon: '📚', name: '앱 공부' }, cert: { color: '#7f77dd', icon: '✅', name: '선생님 인증' },
  adventure: { color: '#5dcaa5', icon: '🗺️', name: '모험' }, etc: { color: '#cbd5e1', icon: '✨', name: '그 밖' },
};
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayTitle = (day: string) => { const d = new Date(`${day}T12:00:00+09:00`); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`; };
/** 이번 달 내역: what this month's points came from — a bar by kind, then (folded) a line per day and kind, newest first. */
export function PointsHistory({ coupon, ledger, defaultOpen = false }: { coupon: Pick<CouponView, 'month' | 'earned'>; ledger: LedgerItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen), [days, setDays] = useState(5);
  const mine = ledger.filter(x => countsForMonth(x.day, coupon.month));
  const byKind = new Map<LedgerItem['kind'], number>();
  for (const x of mine) byKind.set(x.kind, (byKind.get(x.kind) || 0) + x.points);
  // points counted before the 내역 began (the first season's points held, older records)
  const rest = coupon.earned - mine.reduce((sum, x) => sum + x.points, 0); if (rest > 0) byKind.set('etc', (byKind.get('etc') || 0) + rest);
  const parts = (Object.keys(KINDS) as LedgerItem['kind'][]).map(k => [k, byKind.get(k) || 0] as const).filter(([, n]) => n > 0);
  const lines = new Map<string, { day: string; kind: LedgerItem['kind']; labels: string[]; points: number }>();
  for (const x of mine) { const key = x.kind === 'class' ? `${x.day}|class|${x.label}` : `${x.day}|${x.kind}`, l = lines.get(key) || { day: x.day, kind: x.kind, labels: [], points: 0 }; if (x.label && !l.labels.includes(x.label)) l.labels.push(x.label); l.points += x.points; lines.set(key, l); }
  for (const [key, l] of lines) if (!l.points) lines.delete(key); // a 수정 that went back and forth
  const grouped = [...new Set([...lines.values()].map(l => l.day))].sort().reverse();
  if (!parts.length) return null;
  return <div className="mt-2">
    <div className="flex h-1 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">{parts.map(([k, n]) => <span key={k} style={{ flex: n, background: KINDS[k].color }} />)}</div>
    <p className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">{parts.map(([k, n]) => <span key={k}><b style={{ color: KINDS[k].color }} aria-hidden="true">●</b> {k === 'etc' && rest > 0 && !mine.some(x => x.kind === 'etc') ? '이전 포인트' : KINDS[k].name} {won(n)}</span>)}</p>
    {grouped.length > 0 && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-2 w-full border-t border-dashed border-[#f3d5da] pt-2 text-left text-xs font-bold text-[#8b2f40]">{open ? '이번 달 내역 접기 ▴' : '이번 달 내역 보기 ▾'}</button>}
    {open && <div className="mt-1 text-xs text-[#5e1e2a]">
      {grouped.slice(0, days).map(day => <div key={day}>
        <p className="mb-0.5 mt-2 text-[11px] text-slate-400">{dayTitle(day)}</p>
        {[...lines.values()].filter(l => l.day === day).sort((a, b) => Object.keys(KINDS).indexOf(a.kind) - Object.keys(KINDS).indexOf(b.kind)).map(l =>
          <p key={`${l.kind}|${l.labels.join()}`} className="flex items-baseline justify-between gap-2 py-0.5"><span className="min-w-0"><span aria-hidden="true">{KINDS[l.kind].icon}</span> {l.labels.join(' · ') || KINDS[l.kind].name}</span><b className={`flex-none font-bold ${l.points < 0 ? 'text-slate-500' : ''}`}>{signed(l.points)}</b></p>)}
      </div>)}
      {grouped.length > days && <button type="button" onClick={() => setDays(days + 7)} className="mt-1 w-full text-center text-[11px] font-bold text-[#8b2f40]">더 보기</button>}
    </div>}
  </div>;
}

export function CouponGauge({ coupon, onShop, ledger = [] }: { coupon: CouponView; onShop: () => void; ledger?: LedgerItem[] }) {
  const pct = Math.min(100, Math.floor((coupon.earned / coupon.goal) * 100)), ready = (coupon.options || []).some(o => o.ready) || !coupon.options && coupon.earned >= coupon.goal && !coupon.requested;
  const lastOpen = Boolean(coupon.last && (coupon.last.options || []).some(o => o.ready));
  const half = coupon.tiered ? PET_COUPON.tiers.find(t => t.id === 'half')!.points : 0;
  return <section aria-label={PET_COUPON.name} className="rounded-2xl border border-[#f3e6e8] bg-white px-4 py-3">
    {lastOpen && <button type="button" onClick={onShop} className="mb-2 flex w-full items-center gap-2 rounded-xl bg-[#fff6e6] px-3 py-2 text-left text-xs font-bold text-[#8a5a12]"><span className="flex-1">지난달({coupon.last!.label}) 쿠폰도 {Number(coupon.last!.until.slice(8))}일까지 신청할 수 있어요!</span><span>상점 가기 ›</span></button>}
    <div className="flex items-center justify-between gap-2">
      <b className="text-sm font-black text-[#5e1e2a]">🎟️ {coupon.requested ? `${coupon.label} 장학 쿠폰 신청 완료` : `이달의 장학 쿠폰까지 ${pct}%`}</b>
      <span className="text-xs text-slate-500">{won(coupon.earned)} / {won(coupon.goal)}P</span>
    </div>
    <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full bg-[#efa23a]" style={{ width: `${pct}%` }} />{half > 0 && <span className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${half / coupon.goal * 100}%` }} title="6,000P · 5천 원" />}</div>
    {coupon.tiered && <p className="mt-1 flex justify-between text-[10px] text-slate-400"><span>6,000P · 5천 원</span><span>10,000P · 1만 원</span></p>}
    {ready ? <button type="button" onClick={onShop} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-[#fff6e6] px-3 py-2 text-left text-xs font-bold text-[#8a5a12]"><span className="flex-1">{coupon.requested ? '쿠폰을 한 장 더 받을 수 있어요!' : '이번 달 쿠폰을 받을 수 있어요!'}</span><span>상점 가기 ›</span></button>
      : coupon.requested ? <p className="mt-1.5 text-[11px] text-slate-500">{coupon.paid ? '선생님이 쿠폰을 주셨어요.' : '선생님이 곧 쿠폰을 주실 거예요.'}{coupon.tiered && (coupon.won || 0) < PET_COUPON.monthWon ? ` 남은 ${won(coupon.left ?? 0)}P로 6,000P를 채우면 5천 원을 한 번 더 받아요.` : ''} 메달은 방 꾸미기에서 놓을 수 있어요.</p>
      : <p className="mt-1.5 text-[11px] text-slate-400">이번 달 1일부터 모은 포인트예요 (써도 줄지 않아요) · {coupon.tiered ? '한 달 최대 1만 원' : '쿠폰은 한 달에 1장'}</p>}
    <PointsHistory coupon={coupon} ledger={ledger} />
  </section>;
}

/** 상점 › 쿠폰: ask for this month's coupon (no points are taken) and see the medals. */
const wonText = (n: number) => n >= 10_000 ? `${n / 10_000}만 원` : `${n / 1_000}천 원`;
/** One month's coupon card: what was asked for, then each coupon that can be asked for now (단계 쿠폰: 5천 원 · 1만 원). */
function CouponMonthCard({ title, note, m, busy, onRequest }: { title: string; note: string; m: CouponMonth; busy: boolean; onRequest: (tier: 'half' | 'full') => void }) {
  const [asking, setAsking] = useState<'half' | 'full' | null>(null);
  const options = m.options || [{ id: 'full' as const, points: PET_COUPON.goal, won: PET_COUPON.monthWon, ready: !m.requested && m.earned >= PET_COUPON.goal }];
  const left = m.left ?? m.earned, next = options.filter(o => !o.ready && (m.won || 0) + o.won <= PET_COUPON.monthWon).sort((a, b) => a.points - b.points)[0];
  return <div className="rounded-2xl border border-[#f3e6e8] bg-white px-3 py-3">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#fff6e6] text-xl" aria-hidden="true">🎟️</span>
      <span className="min-w-0 flex-1"><b className="block text-sm font-black text-[#5e1e2a]">{title}</b><span className="block text-xs text-slate-500">{note}</span></span>
    </div>
    {(m.coupons || []).length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{m.coupons!.map((c, k) => <span key={k} className="rounded-full bg-[#eef6ea] px-2.5 py-1 text-[11px] font-bold text-[#4f7a43]">{wonText(c.won)} {c.paid ? '받았어요' : '신청 완료'}</span>)}</p>}
    <div className="mt-2 grid gap-1.5">{options.map(o => <div key={o.id} className="flex items-center gap-2 rounded-xl bg-[#fffaf6] px-3 py-2 text-xs">
      <span className="min-w-0 flex-1"><b className="font-black text-[#5e1e2a]">{wonText(o.won)} 쿠폰</b> <span className="text-slate-500">· {won(o.points)}P{m.tiered && o.id === 'half' ? ' 사용 (남은 포인트는 계속 모여요)' : ''}</span></span>
      {asking === o.id ? <><button type="button" onClick={() => setAsking(null)} className="rounded-lg border border-[#f0d9b0] bg-white px-2.5 py-1 font-bold">취소</button><button type="button" disabled={busy} onClick={() => { setAsking(null); onRequest(o.id); }} className="rounded-lg bg-[#e0587a] px-2.5 py-1 font-bold text-white disabled:opacity-60">신청</button></>
        : <button type="button" disabled={!o.ready || busy} onClick={() => setAsking(o.id)} className="flex-none rounded-xl bg-[#e0587a] px-3 py-1.5 font-bold text-white disabled:bg-[#f8f1f2] disabled:text-[#b9a0a5]">교환하기</button>}
    </div>)}</div>
    {next && <p className="mt-2 text-[11px] text-slate-500">{won(Math.max(0, next.points - left))}P 더 모으면 {wonText(next.won)} 쿠폰을 받을 수 있어요{m.tiered ? ' (한 달 최대 1만 원)' : ''}. 신청하지 않고 기간이 지나면 넘어가요.</p>}
  </div>;
}

export function CouponShop({ coupon, medals, busy, onRequest }: { coupon: CouponView; medals: string[]; busy: boolean; onRequest: (month?: string, tier?: 'half' | 'full') => void }) {
  // one place a month: its 금메달, else its 은메달, else (not yet) the gold greyed out
  const shown = [...new Set([coupon.month, ...medals.map(m => m.slice(0, 7))])].sort().reverse();
  const art = (month: string) => medals.includes(month) ? month : medals.includes(silverMedal(month)) ? silverMedal(month) : month;
  const last = coupon.last && (coupon.last.options || []).some(o => o.ready) ? coupon.last : null;
  return <div className="space-y-3">
    {/* last month's coupons, in the first days of a month (its lessons' points came in late) */}
    {last && <CouponMonthCard title={`지난달 ${last.label} ${PET_COUPON.name}`} note={`${Number(last.until.slice(8))}일까지 신청할 수 있어요 · 남은 포인트 ${won(last.left ?? last.earned)}P`} m={last} busy={busy} onRequest={tier => onRequest(last.month, tier)} />}
    <CouponMonthCard title={`${coupon.label} ${PET_COUPON.name}`} note={coupon.tiered ? `이번 달 모은 ${won(coupon.earned)}P · 남은 ${won(coupon.left ?? coupon.earned)}P (포인트를 써도 줄지 않아요)` : `이번 달 ${won(coupon.goal)}P 모으면 교환 · 포인트는 그대로예요`} m={coupon} busy={busy} onRequest={tier => onRequest(undefined, tier)} />
    <div>
      <p className="mb-1.5 text-xs font-bold text-[#8b2f40]">메달 · 쿠폰을 신청하면 그 달 메달을 받아요{coupon.tiered ? ' (5천 원 은메달, 그 달 1만 원을 채우면 금메달)' : ''}</p>
      <div className="grid grid-cols-3 gap-2">{shown.map(m => { const id = art(m), mine = medals.includes(id); return <div key={m} className={`flex flex-col items-center rounded-2xl border px-1 py-2 text-center ${mine ? 'border-[#efc77a] bg-[#fffaf0]' : 'border-[#f3e6e8] bg-white'}`}>
        <span className={mine ? '' : 'opacity-40 grayscale'}><MedalArt month={id} size={34} /></span>
        <span className="mt-1 text-[11px] font-bold text-[#5e1e2a]">{medalLabel(m)} {isSilverMedal(id) ? '은메달' : '금메달'}</span>
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
      <Placed id={s.id} size={34} />
    </span>)}
  </div>;
}

/** 꾸미기 bar: the 장식함 (금메달 and 탑 장식; tap to put one in the room or take it out), then 취소 / 저장. */
export function MedalBox({ medals, spots, busy, onToggle, onCancel, onSave }: { medals: string[]; spots: MedalSpot[]; busy: boolean; onToggle: (id: string) => void; onCancel: () => void; onSave: () => void }) {
  const placed = new Set(spots.map(s => s.id));
  return <div className="border-t border-[#f3e6e8] bg-[#fffaf0] px-3 py-2.5">
    <div className="mb-1.5 flex items-center justify-between text-xs"><b className="font-black text-[#8a5a12]">장식함</b><span className="text-slate-500">눌러서 놓기·빼기 · 끌어서 옮기기</span></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1">{[...new Set(medals)].sort((a, b) => Number(Boolean(towerDecor(a))) - Number(Boolean(towerDecor(b))) || b.localeCompare(a)).map(m => <button key={m} type="button" aria-pressed={placed.has(m)} onClick={() => onToggle(m)} className={`flex flex-none flex-col items-center rounded-xl border px-2 py-1 text-[10px] font-bold ${placed.has(m) ? 'border-[#d29a3a] bg-white text-[#8a5a12]' : 'border-[#f0e2c8] bg-white/60 text-slate-500'}`}>
      <Placed id={m} size={22} />{towerDecor(m)?.name || medalLabel(m)}{placed.has(m) ? ' · 놓음' : ''}
    </button>)}</div>
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-xl border border-[#f3d5da] bg-white px-3 py-1.5 text-xs font-bold text-[#8b2f40]">취소</button>
      <button type="button" disabled={busy} onClick={onSave} className="rounded-xl bg-[#d26272] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">저장</button>
    </div>
  </div>;
}
