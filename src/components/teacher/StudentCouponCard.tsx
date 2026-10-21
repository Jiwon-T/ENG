import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { CouponBonus, PointsHistory } from '../pet/PetCoupon';
import type { CouponExtraView, LedgerItem } from '../../lib/petService';

// 학습 리포트 › 장학 쿠폰 (선생님): one student's 이달의 장학 쿠폰 — how far this month's points are from the goal, the points
// held, whether this month's coupon was asked for, and the same 내역 the student sees under the gauge (folded).
interface View { linked: boolean; /** no app account: counted from the 수업 일지 */ offline?: boolean; month?: string; goal?: number; earned?: number; points?: number; requested?: boolean; paid?: boolean; coupons?: { won: number; paid: boolean }[]; ledger?: LedgerItem[]; extra?: CouponExtraView | null }
const won = (n: number) => n.toLocaleString('ko-KR');

export default function StudentCouponCard({ studentKey, open = false }: { studentKey: string; open?: boolean }) {
  const [v, setV] = useState<View | null>(null);
  useEffect(() => {
    let live = true; setV(null);
    teacherAuthenticatedRequest<any>(auth, `/api/teacher/workspace?action=student-coupon&studentKey=${encodeURIComponent(studentKey)}`).then(r => { if (live) setV(r.ok && r.data?.ok ? r.data : { linked: false }); }).catch(() => { if (live) setV({ linked: false }); });
    return () => { live = false; };
  }, [studentKey]);
  if (!v || (!v.linked && !v.offline)) return null; // no record at all: nothing to show
  const goal = v.goal || 10000, earned = v.earned || 0, pct = Math.min(100, Math.floor(earned / goal * 100));
  return <section aria-label="이달의 장학 쿠폰" className="report-online-assignments">
    <div className="flex items-baseline justify-between gap-2"><h4>🎟️ 이달의 장학 쿠폰 · {pct}%</h4><span className="text-xs text-slate-500">{won(earned)} / {won(goal)}P{v.offline ? ' · 앱 미연결 (수업 일지대로)' : ` · 포인트 ${won(v.points || 0)}P`}</span></div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f6e3e6]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: earned >= goal ? '#efa23a' : '#e0587a' }} /></div>
    {v.requested && <p className="mt-1 text-[11px] text-slate-500">{Number(v.month!.slice(5))}월 쿠폰 · {(v.coupons || []).map(c => `${c.won >= 10000 ? '1만 원' : '5천 원'} ${c.paid ? '지급 완료' : '지급 전'}`).join(' · ')}</p>}
    <CouponBonus extra={v.extra} earned={earned} />
    <PointsHistory coupon={{ month: v.month!, earned }} ledger={v.ledger || []} extra={v.extra} defaultOpen={open} />
    {!earned && <p className="mt-1 text-[11px] text-slate-400">이번 달 모은 포인트가 아직 없어요.</p>}
  </section>;
}
