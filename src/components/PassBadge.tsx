import { useState } from 'react';
import { Medal } from 'lucide-react';
import { AI_PLANS } from '../lib/aiPlans';
import { PET_ASSIGNMENT_REWARD, PET_ATTENDANCE_REWARD, PET_COUPON, PET_DAILY_STUDY_POINTS, PET_STUDY_RATES } from '../lib/petCatalog';
import type { PetSummary } from '../lib/petService';

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
  ['과제 완료', `+${PET_ASSIGNMENT_REWARD.points}P`],
  ['단어 시험 정답 1개', `+${PET_STUDY_RATES['vocab-test'].points}P`],
  ['오답 복습 1개', `+${PET_STUDY_RATES['review-confirm'].points}P`],
  ['단어장 퀴즈·짝 맞추기 1개', `+${PET_STUDY_RATES['wordbook-quiz'].points}P`],
  ['플래시카드 1장', `+${PET_STUDY_RATES['wordbook-flashcard'].points}P`],
  ['펫 원정대·채움의 탑 보상', '+α'],
];

/** The home screen's point chip: tap it for how points are earned and a way to the pet. The panel opens under the
 *  nearest positioned parent (Home: the chip and menu group), right-aligned so it stays on a phone screen. */
/** The best 모험가 place beside the points (1·2·3위 in gold, silver and bronze); it opens the 순위. */
const PLACE = [{ bg: '#fac775', fg: '#412402', bd: '#ef9f27' }, { bg: '#e2e8f0', fg: '#334155', bd: '#b4b2a9' }, { bg: '#f5c4b3', fg: '#4a1b0c', bd: '#d85a30' }];
export function RankChip({ rank, onOpen }: { rank: number; onOpen: () => void }) {
  const c = PLACE[rank - 1] || { bg: '#ffffff', fg: '#633806', bd: '#fac775' };
  return <button type="button" onClick={onOpen} aria-label={`모험가 순위 ${rank}위, 순위표 보기`} style={{ background: c.bg, color: c.fg, borderColor: c.bd }} className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold"><Medal size={12} aria-hidden="true" />{rank}위</button>;
}
export function PetPointsChip({ points, onPet, coupon }: { points: number; onPet: () => void; coupon?: PetSummary['coupon'] }) {
  const [open, setOpen] = useState(false);
  return <span>
    <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`내 펫 포인트 ${won(points)}P, 모으는 방법 보기`} className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[#f3d5da] bg-white px-2.5 py-1 text-xs font-bold text-[#8b2f40]">
      <span className="h-2 w-2 rounded-full bg-[#e07a87]" aria-hidden="true" />{won(points)}P
    </button>
    {open && <>
      <button type="button" aria-label="닫기" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
      <div role="dialog" aria-label="내 펫 포인트" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-[#f3e6e8] bg-white p-3.5 text-[#5e1e2a] shadow-lg">
        <div className="flex items-baseline justify-between"><b className="text-sm">내 펫 포인트</b><b className="text-base text-[#8b2f40]">{won(points)}P</b></div>
        <p className="mt-1.5 mb-1 text-xs text-slate-500">이렇게 모아요</p>
        <ul className="text-xs leading-6 text-slate-700">{WAYS.map(([what, pts]) => <li key={what} className="flex justify-between"><span>{what}</span><b className="font-bold">{pts}</b></li>)}</ul>
        <p className="mt-1.5 text-[11px] text-slate-400">공부로 받는 포인트는 하루 {won(PET_DAILY_STUDY_POINTS)}P까지 (출석·과제는 따로)</p>
        {coupon && <div className="mt-2.5 rounded-xl border border-[#f3e6e8] bg-[#fffafa] px-3 py-2">
          <div className="flex items-baseline justify-between text-xs"><b className="text-[#5e1e2a]">🏅 {PET_COUPON.name}</b><span className="font-bold text-[#8b2f40]">{won(Math.min(coupon.earned, coupon.goal))} / {won(coupon.goal)}P</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f8e8eb]" aria-hidden="true"><div className="h-full rounded-full bg-[#e07a87]" style={{ width: `${Math.min(100, coupon.earned / coupon.goal * 100)}%` }} /></div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{coupon.requested ? '이번 달 장학 쿠폰을 신청했어요. 자세한 건 학원에 문의해 주세요.' : `이번 달 모은 포인트가 ${won(coupon.goal)}P가 되면 장학 쿠폰으로 바꿀 수 있어요. 포인트는 줄지 않아요. 학원에 문의해 주세요.`}</p>
        </div>}
        <div className="mt-2.5 flex gap-1.5">
          <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-[#f3d5da] py-2 text-xs font-bold text-[#8b2f40]">닫기</button>
          <button type="button" onClick={() => { setOpen(false); onPet(); }} className="flex-[2] rounded-xl bg-[#d26272] py-2 text-xs font-bold text-white">펫 키우러 가기</button>
        </div>
      </div>
    </>}
  </span>;
}
