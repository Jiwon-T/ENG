import { useState } from 'react';
import { Medal } from 'lucide-react';
import { AI_PLANS } from '../lib/aiPlans';
import { PET_ATTENDANCE_REWARD, PET_HOMEWORK_REWARD, PET_DAILY_STUDY_POINTS, PET_STUDY_RATES, PET_TEST_DAY } from '../lib/petCatalog';
import type { PetSummary } from '../lib/petService';
import { CouponBonus } from './pet/PetCoupon';

/** 펫 패스 / 프리미엄 hanging under the name button (inside it, which is `relative`), so the name stays readable and a
 *  person can see their pass is on. Phones show only the avatar and ☰. Nothing on the free plan. */
export function PassBadge({ pass }: { pass?: PetSummary['pass'] }) {
  if (!pass) return null;
  const at = 'pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10px] font-bold leading-[16px]';
  return pass.plan === 'premium'
    ? <span className={`${at} bg-[#8b2f40] text-white`}>{AI_PLANS.premium.label.replace(' 패스', '')}</span>
    : <span className={`${at} border border-[#f3d5da] bg-[#fef2f3] text-[#8b2f40]`}>{AI_PLANS.pet.label}</span>;
}

const won = (n: number) => n.toLocaleString('ko-KR');
const WAYS: [string, string][] = [
  ['수업 출석', `+${PET_ATTENDANCE_REWARD.points}P`],
  ['누적 테스트 날 출석 (출석 포함)', `+${PET_ATTENDANCE_REWARD.points + PET_TEST_DAY.bonus.points}P`],
  ['숙제 (선생님 평가 중 이상)', `+${PET_HOMEWORK_REWARD['중'].points}~${PET_HOMEWORK_REWARD['최상'].points}P`],
  ['단어 시험 정답 1개', `+${PET_STUDY_RATES['vocab-test'].points}P`],
  ['오답 복습 1개', `+${PET_STUDY_RATES['review-confirm'].points}P`],
  ['단어장 퀴즈·짝 맞추기 1개', `+${PET_STUDY_RATES['wordbook-quiz'].points}P`],
  ['플래시카드 1장', `+${PET_STUDY_RATES['wordbook-flashcard'].points}P`],
  ['펫 원정대·채움의 탑 보상', '+α'],
];

/** The best 모험가 place beside the points (1·2·3위 in gold, silver and bronze; –위 when there is none yet, to make one
 *  curious); it opens the 순위. */
const PLACE = [{ bg: '#fac775', fg: '#412402', bd: '#ef9f27' }, { bg: '#e2e8f0', fg: '#334155', bd: '#b4b2a9' }, { bg: '#f5c4b3', fg: '#4a1b0c', bd: '#d85a30' }];
export function RankChip({ rank, onOpen }: { rank: number | null; onOpen: () => void }) {
  const c = rank ? PLACE[rank - 1] || { bg: '#ffffff', fg: '#633806', bd: '#fac775' } : { bg: '#ffffff', fg: '#94a3b8', bd: '#e2e8f0' };
  return <button type="button" onClick={onOpen} aria-label={rank ? `모험가 순위 ${rank}위, 순위표 보기` : '아직 모험가 순위 없음, 순위표 보기'} style={{ background: c.bg, color: c.fg, borderColor: c.bd }} className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold"><Medal size={12} aria-hidden="true" />{rank ?? '–'}위</button>;
}
/** The home screen's points chips, on the date line under the greeting: 포인트 (what the shop takes) and, for 장학 쿠폰
 *  students, 쿠폰 누적 (counted apart: lesson points ×3, 자습, 보너스) with a small ring for how far it is. Each opens its own
 *  panel under the nearest positioned parent (Home: the date line), right-aligned so it stays on a phone screen. */
export function PetPointsChip({ points, onPet, onCoupon, coupon }: { points: number; onPet: () => void; /** 쿠폰 자세히 (else onPet) */ onCoupon?: () => void; coupon?: PetSummary['coupon'] }) {
  const [open, setOpen] = useState<'points' | 'coupon' | null>(null), close = () => setOpen(null);
  const chip = 'flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold', pct = coupon ? Math.min(100, Math.floor(coupon.earned / coupon.goal * 100)) : 0;
  const panel = 'absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-[#f3e6e8] bg-white p-3.5 text-[#5e1e2a] shadow-lg';
  const buttons = (go: string, then = onPet) => <div className="mt-2.5 flex gap-1.5">
    <button type="button" onClick={close} className="flex-1 rounded-xl border border-[#f3d5da] py-2 text-xs font-bold text-[#8b2f40]">닫기</button>
    <button type="button" onClick={() => { close(); then(); }} className="flex-[2] rounded-xl bg-[#d26272] py-2 text-xs font-bold text-white">{go}</button>
  </div>;
  return <span>
    <span className="flex items-center gap-1.5">
      <button type="button" onClick={() => setOpen(o => o === 'points' ? null : 'points')} aria-expanded={open === 'points'} aria-label={`포인트 ${won(points)}P, 설명 보기`} className={`${chip} border-[#f3d5da] bg-white text-[#8b2f40]`}>
        <span className="h-2 w-2 rounded-full bg-[#e07a87]" aria-hidden="true" />포인트 {won(points)}
      </button>
      {coupon && <button type="button" onClick={() => setOpen(o => o === 'coupon' ? null : 'coupon')} aria-expanded={open === 'coupon'} aria-label={`쿠폰 누적 ${won(coupon.earned)}P, 설명 보기`} className={`${chip} border-[#efa23a] bg-[#fdf1dd] text-[#7a4a0c]`}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full border border-[#efa23a]" style={{ background: `conic-gradient(#efa23a 0 ${pct}%, #fff ${pct}% 100%)` }} />쿠폰 {won(coupon.earned)}
      </button>}
    </span>
    {open && <button type="button" aria-label="닫기" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={close} />}
    {open === 'points' && <div role="dialog" aria-label="포인트" className={panel}>
      <div className="flex items-baseline justify-between"><b className="text-sm">포인트</b><b className="text-base text-[#8b2f40]">{won(points)}P</b></div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">상점에서 간식·옷·꾸미기에 쓰는 포인트예요.{coupon ? ' 써도 쿠폰 누적은 줄지 않아요.' : ''}</p>
      <p className="mt-2 mb-1 text-xs text-slate-500">이렇게 모아요</p>
      <ul className="text-xs leading-6 text-slate-700">{WAYS.map(([what, pts]) => <li key={what} className="flex justify-between"><span>{what}</span><b className="font-bold">{pts}</b></li>)}</ul>
      <p className="mt-1.5 text-[11px] text-slate-400">공부로 받는 포인트는 하루 {won(PET_DAILY_STUDY_POINTS)}P까지 (출석·과제는 따로)</p>
      {buttons('상점 가기')}
    </div>}
    {open === 'coupon' && coupon && <div role="dialog" aria-label="쿠폰 누적" className={panel}>
      <div className="flex items-baseline justify-between"><b className="text-sm">쿠폰 누적</b><b className="text-base text-[#8a5a12]">{won(coupon.earned)} / {won(coupon.goal)}P</b></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f8ead2]" aria-hidden="true"><div className="h-full rounded-full bg-[#efa23a]" style={{ width: `${Math.min(100, coupon.earned / coupon.goal * 100)}%` }} /></div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{coupon.requested ? '이번 달 장학 쿠폰을 신청했어요.' : '포인트와 따로 쌓여요 · 잘한 수업은 3배로!'}</p>
      <CouponBonus extra={coupon.extra} earned={coupon.earned} />
      {buttons('쿠폰 자세히', onCoupon || onPet)}
    </div>}
  </span>;
}
