import {useEffect,useMemo,useState} from 'react';
import {Check,Undo2} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import {PointsHistory} from '../pet/PetCoupon';
import type {LedgerItem} from '../../lib/petService';

// 이달의 장학 쿠폰 (admin): every coupon students asked for, by month, and 지급 완료. The same rows give the "26.10 쿠폰"
// badges on the student list (StudentMasterPanel) and the small window a badge opens.
export interface PetCouponRow {id:string;studentKey:string;month:string;label:string;requestedAt:number;paidAt:number|null;name:string;points:number}
const day=(at:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(at));
const won=(n:number)=>n.toLocaleString('ko-KR');

/** One coupon: asked on, current points, 지급 완료 (or undo). */
function CouponLine({c,busy,onPaid}:{key?:string;c:PetCouponRow;busy:boolean;onPaid:(c:PetCouponRow,paid:boolean)=>void}){
 return <li className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm">
  <span className="min-w-0 flex-1"><b className="font-bold">{c.name}</b> <span className="text-xs text-slate-400">{c.label} · {day(c.requestedAt)} 신청 · 지금 {won(c.points)}P</span></span>
  {c.paidAt?<><span className="text-xs text-slate-500">{day(c.paidAt)} 지급</span><button type="button" className="small-button" disabled={busy} title="지급 취소" aria-label={`${c.name} ${c.label} 쿠폰 지급 취소`} onClick={()=>onPaid(c,false)}><Undo2 size={14} aria-hidden="true"/></button></>
   :<><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">지급 전</span><button type="button" className="small-button" disabled={busy} onClick={()=>onPaid(c,true)}><Check size={14} aria-hidden="true"/>지급 완료</button></>}
 </li>;
}

/** 이번 달 포인트: how this month's earned points (the coupon count) spread over the students, then each student's points
 *  held and earned this month, most earned first (a name filter). */
interface PointsRow {name:string;points:number;earned:number;requested:boolean;ledger?:LedgerItem[]}
const BUCKETS=[[0,2000,'~2천'],[2000,4000,'~4천'],[4000,6000,'~6천'],[6000,8000,'~8천'],[8000,10000,'~1만'],[10000,Infinity,'1만+']] as const;
export function PetPointsOverview({request,act}:{request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}){
 const [data,setData]=useState<{month:string;goal:number;students:PointsRow[]}|null>(null),[query,setQuery]=useState(''),[all,setAll]=useState(false),[openRow,setOpenRow]=useState(-1);
 useEffect(()=>{void act(async()=>setData(await request('read:pet-points')));},[]);
 if(!data)return <p className="mt-2 text-xs text-slate-400">이번 달 포인트를 불러오는 중…</p>;
 const counts=BUCKETS.map(([lo,hi])=>data.students.filter(s=>s.earned>=lo&&s.earned<hi).length),top=Math.max(1,...counts),reached=counts[counts.length-1];
 const shown=data.students.filter(s=>!query.trim()||s.name.includes(query.trim())),list=all||query.trim()?shown:shown.slice(0,10);
 return <div className="mt-3 rounded-xl border border-slate-100 p-3">
  <div className="flex items-baseline justify-between gap-2 text-sm"><b className="font-bold">{Number(data.month.slice(5))}월 누적 분포</b><span className="text-xs text-slate-500">학생 {data.students.length}명 · 목표 달성 {reached}명</span></div>
  <div className="mt-2 flex h-16 items-end gap-1.5" role="img" aria-label={BUCKETS.map(([, , l],i)=>`${l} ${counts[i]}명`).join(', ')}>{counts.map((n,i)=><div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5"><span className="text-[10px] text-slate-500">{n||''}</span><span className="w-full rounded-t" style={{height:`${Math.max(n?8:2,(n/top)*48)}px`,background:i===BUCKETS.length-1?'#efa23a':'#f4c0d1'}}/></div>)}</div>
  <div className="flex gap-1.5 text-center text-[10px] text-slate-400">{BUCKETS.map(([, , l],i)=><span key={l} className={`flex-1 ${i===BUCKETS.length-1?'font-bold text-amber-700':''}`}>{l}</span>)}</div>
  <div className="mt-3 flex items-center gap-2"><input aria-label="학생 이름 찾기" placeholder="이름 찾기" value={query} onChange={e=>setQuery(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs"/></div>
  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1.4fr)] gap-x-2 border-b border-slate-100 pb-1 text-[11px] text-slate-400"><span>학생</span><span className="text-right">보유</span><span>이번 달 누적</span></div>
  {list.map((s,i)=><div key={s.name+i}><button type="button" aria-expanded={openRow===i} onClick={()=>setOpenRow(openRow===i?-1:i)} title="이번 달 내역 보기" className="grid w-full grid-cols-[minmax(0,1fr)_64px_minmax(0,1.4fr)] items-center gap-x-2 rounded py-1 text-left text-xs hover:bg-[#fff7f8]">
   <span className="truncate">{s.name}{s.requested&&<span className="ml-1" title="이번 달 쿠폰 신청">🎟️</span>}</span>
   <span className="text-right tabular-nums">{won(s.points)}</span>
   <span className="flex items-center gap-1.5"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f6e3e6]"><span className="block h-full rounded-full" style={{width:`${Math.min(100,s.earned/data.goal*100)}%`,background:s.earned>=data.goal?'#efa23a':'#e0587a'}}/></span><span className="w-12 text-right tabular-nums text-[11px]">{won(s.earned)}</span></span>
  </button>
   {/* the gauge's 내역, as the student sees it */}
   {openRow===i&&<div className="mb-2 rounded-lg bg-[#fffafb] px-3 pb-2"><PointsHistory coupon={{month:data.month,earned:s.earned}} ledger={s.ledger||[]} defaultOpen/>{!s.earned&&<p className="pt-2 text-[11px] text-slate-400">이번 달 모은 포인트가 아직 없어요.</p>}</div>}
  </div>)}
  {!query.trim()&&shown.length>10&&<button type="button" className="mt-1 w-full text-center text-xs font-bold text-[#8b2f40]" onClick={()=>setAll(!all)}>{all?'접기':`전체 ${shown.length}명 보기`}</button>}
 </div>;
}

/** 관리자 설정 › 쿠폰. */
export default function PetCouponPanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [rows,setRows]=useState<PetCouponRow[]|null>(null),[month,setMonth]=useState('');
 const load=async()=>{const r=await request('read:pet-coupons');setRows(r.coupons||[]);};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const months=useMemo(()=>[...new Set((rows||[]).map(r=>r.month))],[rows]),shown=month||months[0]||'';
 const list=(rows||[]).filter(r=>r.month===shown),waiting=list.filter(r=>!r.paidAt).length;
 const paid=(c:PetCouponRow,value:boolean)=>act(async()=>{await request('coupon-paid',{id:c.id,paid:value});await load();});
 return <section className="panel rv">
  <div className="rv-head"><h2>이달의 장학 쿠폰{rows&&<small>{list.length}장{waiting?` · 지급 전 ${waiting}`:''}</small>}</h2>
   {months.length>1&&<select aria-label="달" value={shown} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{m.replace('-','년 ')}월</option>)}</select>}</div>
  <p className="mt-1 text-xs text-slate-500">채움 학원 학생이 한 달에 모은 포인트가 1만 P를 넘으면 신청할 수 있어요 (포인트는 줄지 않아요).</p>
  {autoLoad&&<PetPointsOverview request={request} act={act}/>}
  {rows&&(list.length?<ul className="mt-2">{list.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={paid}/>)}</ul>:<p className="mt-2 text-sm text-slate-500">아직 신청한 학생이 없어요.</p>)}
 </section>;
}

/** The window a "26.10 쿠폰" badge opens on the student list. */
export function PetCouponDialog({name,coupons,busy,onPaid,onClose}:{name:string;coupons:PetCouponRow[];busy:boolean;onPaid:(c:PetCouponRow,paid:boolean)=>void;onClose:()=>void}){
 return <WorkspaceDialog open title={`${name} 학생의 장학 쿠폰`} onClose={onClose}>
  <ul>{coupons.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={onPaid}/>)}</ul>
 </WorkspaceDialog>;
}
