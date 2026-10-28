import {PET_COUPON,PET_GROWTH} from '../../lib/petCatalog';

// 쿠폰 › 월말 예상 (관리자 쿠폰 목록, 학생 정보의 쿠폰 카드): what the month's end decides as things stand — 개근 if it keeps
// up, 이달의 성장 at the place now. Shown only; nothing is saved or paid.
/** null growth: no pet, or the month's start not kept yet */
export interface CouponForecast {perfect:number;growth:Partial<Record<'floor'|'star',{gain:number;rank:number;points:number}>>|null;/** when the ranking the places come from was made */growthAt?:number}
type Forecastable={earned:number;forecast?:CouponForecast|null};
const won=(n:number)=>n.toLocaleString('ko-KR');
const clock=(at:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit'}).format(new Date(at));
/** What the month's end would add as things stand (shown only, nothing saved). */
export const expected=(s:Forecastable)=>(s.forecast?.perfect||0)+(s.forecast?.growth?.floor?.points||0)+(s.forecast?.growth?.star?.points||0);
/** The coupon the month's end would reach that the student has not reached yet (1만 원, else 5천 원). */
export const reachAtEnd=(s:Forecastable)=>{const end=s.earned+expected(s);return [...PET_COUPON.tiers].sort((a,b)=>b.points-a.points).find(t=>end>=t.points&&s.earned<t.points)||null;};
/** 월말에 정해지는 포인트: 개근 and 이달의 성장 as they stand now. */
export function MonthEndForecast({s}:{s:Forecastable}){
 const f=s.forecast;if(!f)return null;
 const lines=([['floor','이달의 성장 · 탑','층'],['star','이달의 성장 · 원정대','별']] as const).map(([k,name,unit])=>{const g=f.growth?.[k];
  return {name,sub:g?`${g.rank}위 · +${g.gain}${unit}${g.points?'':` · +${PET_GROWTH.join[k]}${unit}부터`}`:`이번 달 +0${unit}`,points:g?.points||0};});
 const rows=[...(f.perfect?[{name:'개근 보너스',sub:'지금처럼 결석 없이 마치면',points:f.perfect}]:[]),...(f.growth?lines:[])];
 if(!rows.length)return null;
 return <div className="mt-2 rounded-xl border border-[#f3d5da] bg-white px-3 py-2 text-xs text-[#5e1e2a]">
  <p className="flex justify-between gap-2 border-b border-[#f3d5da] pb-1"><span>월말에 정해지는 포인트 <span className="text-[10px] text-slate-400">{f.growth&&f.growthAt?`순위 ${clock(f.growthAt)} 기준`:'지금 그대로라면'}</span></span><b className="font-bold tabular-nums">+{won(expected(s))}</b></p>
  {rows.map(x=><p key={x.name} className={`flex justify-between gap-2 border-b border-[#f6e3e6] py-1 last:border-0 ${x.points?'':'text-slate-400'}`}><span className="min-w-0">{x.name}<span className="ml-1 text-[10px] text-slate-400">{x.sub}</span></span><b className="flex-none font-bold tabular-nums">{x.points?`+${won(x.points)}`:'—'}</b></p>)}
  <p className="pt-1 text-[10px] text-slate-400">{f.growth?'결석이 생기거나 순위가 바뀌면 달라져요':'결석이 생기면 달라져요'} · 다음 달 1일에 확정돼요</p>
 </div>;
}
