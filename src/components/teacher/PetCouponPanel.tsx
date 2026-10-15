import {useEffect,useMemo,useState} from 'react';
import {Check,Undo2} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';

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
  <p className="mt-1 text-xs text-slate-500">영어 이지원T 반 학생이 한 달에 모은 포인트가 1만 P를 넘으면 신청할 수 있어요 (포인트는 줄지 않아요).</p>
  {rows&&(list.length?<ul className="mt-2">{list.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={paid}/>)}</ul>:<p className="mt-2 text-sm text-slate-500">아직 신청한 학생이 없어요.</p>)}
 </section>;
}

/** The window a "26.10 쿠폰" badge opens on the student list. */
export function PetCouponDialog({name,coupons,busy,onPaid,onClose}:{name:string;coupons:PetCouponRow[];busy:boolean;onPaid:(c:PetCouponRow,paid:boolean)=>void;onClose:()=>void}){
 return <WorkspaceDialog open title={`${name} 학생의 장학 쿠폰`} onClose={onClose}>
  <ul>{coupons.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={onPaid}/>)}</ul>
 </WorkspaceDialog>;
}
