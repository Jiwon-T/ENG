import {useEffect,useMemo,useState} from 'react';
import {Check,Undo2} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import {PointsHistory} from '../pet/PetCoupon';
import type {LedgerItem} from '../../lib/petService';
import {askConfirm} from './ConfirmDialog';
import {maskedName} from '../../lib/rankNames';

// 이달의 장학 쿠폰 (admin): every coupon students asked for, by month, and 지급 완료. The same rows give the "26.10 쿠폰"
// badges on the student list (StudentMasterPanel) and the small window a badge opens.
export interface PetCouponRow {id:string;studentKey:string;month:string;label:string;requestedAt:number;paidAt:number|null;name:string;points:number;/** 오프라인 신청 (by the admin) */offline?:boolean}
const day=(at:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(at));
const won=(n:number)=>n.toLocaleString('ko-KR');

/** One coupon: asked on, current points, 지급 완료 (or undo). */
function CouponLine({c,busy,onPaid}:{key?:string;c:PetCouponRow;busy:boolean;onPaid:(c:PetCouponRow,paid:boolean)=>void}){
 return <li className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm">
  <span className="min-w-0 flex-1"><b className="font-bold">{c.name}</b>{c.offline&&<span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500" title="관리자가 대신 신청했어요">오프라인</span>} <span className="text-xs text-slate-400">{c.label} · {day(c.requestedAt)} 신청{c.offline?'':` · 지금 ${won(c.points)}P`}</span></span>
  {c.paidAt?<><span className="text-xs text-slate-500">{day(c.paidAt)} 지급</span><button type="button" className="small-button" disabled={busy} title="지급 취소" aria-label={`${c.name} ${c.label} 쿠폰 지급 취소`} onClick={()=>onPaid(c,false)}><Undo2 size={14} aria-hidden="true"/></button></>
   :<><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">지급 전</span><button type="button" className="small-button" disabled={busy} onClick={()=>onPaid(c,true)}><Check size={14} aria-hidden="true"/>지급 완료</button></>}
 </li>;
}

/** 순위 닉네임: the name the 이달 포인트 ranking shows for a student instead of the family name only (a pet's 별칭 comes
 *  first). Empty removes it. */
function RankNickname({name,value,save}:{name:string;value:string;save:(nickname:string)=>Promise<void>}){
 const [text,setText]=useState(value);
 useEffect(()=>setText(value),[value]);
 const changed=text.trim()!==value;
 return <form className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px]" onSubmit={e=>{e.preventDefault();if(changed)void save(text.trim());}}>
  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-slate-500">순위 닉네임<input value={text} maxLength={10} onChange={e=>setText(e.target.value)} placeholder={`비우면 ${maskedName(name)}`} className="h-7 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-800"/></label>
  <button type="submit" className="small-button" disabled={!changed}>저장</button>
  <span className="w-full text-slate-400">순위에 보이는 이름: <b className="font-bold text-slate-600">{value||maskedName(name)}</b> · 펫 별칭이 있으면 별칭이 먼저 보여요</span>
 </form>;
}

/** 이번 달 포인트: how this month's earned points (the coupon count) spread over the students, then each student's points
 *  held and earned this month, most earned first (a name filter). */
/** app: 'linked' (pet), 'no-pet' (account, no pet yet), 'none' (no app account); waiting: points still to be settled. */
interface PointsRow {key?:string;name:string;points:number;earned:number;requested:boolean;ledger?:LedgerItem[];app?:'linked'|'no-pet'|'none';waiting?:number;/** coupons that can be asked for now */options?:{id:'full'|'half';won:number}[]}
const BUCKETS=[[0,2000,'~2천'],[2000,4000,'~4천'],[4000,6000,'~6천'],[6000,8000,'~8천'],[8000,10000,'~1만'],[10000,Infinity,'1만+']] as const;
/** `canRequest` (관리자 설정 › 쿠폰): 오프라인 신청 for a student who reached a coupon but can't ask in the app. */
export function PetPointsOverview({request,act,canRequest=false,onRequested}:{key?:number;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;canRequest?:boolean;onRequested?:()=>Promise<void>|void}){
 const [data,setData]=useState<{month:string;goal:number;students:PointsRow[]}|null>(null),[query,setQuery]=useState(''),[all,setAll]=useState(false),[openRow,setOpenRow]=useState(-1);
 const reload=async()=>setData(await request('read:pet-points'));
 const [nicks,setNicks]=useState<Record<string,string>>({});
 useEffect(()=>{void act(reload);void request('read:rank-names').then(r=>setNicks(Object.fromEntries(Object.entries(r?.names||{}).map(([k,v]:any)=>[k,v.nickname])))).catch(()=>undefined);},[]);
 // a 닉네임 holding the student's real name is asked first (nothing is saved until the yes)
 const saveNick=(s:PointsRow)=>async(nickname:string)=>{
  let r:any=null;await act(async()=>{r=await request('rank-nickname',{studentKey:s.key,nickname});});
  if(r?.needsConfirm==='real-name'){
   if(!await askConfirm({title:'실명을 입력하셨어요',message:'순위표에 드러날 수 있는데 그대로 진행하시겠어요?',confirmText:'그대로 하기'}))return;
   await act(async()=>{r=await request('rank-nickname',{studentKey:s.key,nickname,realName:true});});
  }
  if(r&&!r.needsConfirm)setNicks(n=>({...n,[s.key!]:r.nickname||''}));
 };
 const offline=async(s:PointsRow,o:{id:'full'|'half';won:number})=>{
  const what=`${won(o.won)}원 쿠폰`;
  if(!await askConfirm({title:`${s.name} 학생의 ${what}을 오프라인으로 신청할까요?`,message:s.app==='none'?'앱 계정이 없어 금메달 없이 쿠폰 기록만 남아요. 지급은 아래 목록에서 표시해요.':'수업 보상을 먼저 정산하고, 앱에서 신청한 것과 똑같이 기록해요(금메달 포함).',confirmText:'신청',icon:'check'}))return;
  await act(async()=>{await request('coupon-offline',{studentKey:s.key,tier:o.id});await reload();await onRequested?.();});
 };
 if(!data)return <p className="mt-2 text-xs text-slate-400">이번 달 포인트를 불러오는 중…</p>;
 const counts=BUCKETS.map(([lo,hi])=>data.students.filter(s=>s.earned>=lo&&s.earned<hi).length),top=Math.max(1,...counts),reached=counts[counts.length-1];
 const shown=data.students.filter(s=>!query.trim()||s.name.includes(query.trim())),list=all||query.trim()?shown:shown.slice(0,10);
 return <div className="mt-3 rounded-xl border border-slate-100 p-3">
  <div className="flex items-baseline justify-between gap-2 text-sm"><b className="font-bold">{Number(data.month.slice(5))}월 누적 분포</b><span className="text-xs text-slate-500">학생 {data.students.length}명 · 목표 달성 {reached}명</span></div>
  <div className="mt-2 flex h-16 items-end gap-1.5" role="img" aria-label={BUCKETS.map(([, , l],i)=>`${l} ${counts[i]}명`).join(', ')}>{counts.map((n,i)=><div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5"><span className="text-[10px] text-slate-500">{n||''}</span><span className="w-full rounded-t" style={{height:`${Math.max(n?8:2,(n/top)*48)}px`,background:i===BUCKETS.length-1?'#efa23a':'#f4c0d1'}}/></div>)}</div>
  <div className="flex gap-1.5 text-center text-[10px] text-slate-400">{BUCKETS.map(([, , l],i)=><span key={l} className={`flex-1 ${i===BUCKETS.length-1?'font-bold text-amber-700':''}`}>{l}</span>)}</div>
  {/* the same count for every student: what the 수업 일지 give, app or not (a coupon can be asked for offline) */}
  <p className="mt-2 text-[11px] text-slate-400">앱이 없어도 수업 일지대로 받을 포인트로 보여요 · 앱 미연결 {data.students.filter(s=>s.app==='none').length}명</p>
  <div className="mt-3 flex items-center gap-2"><input aria-label="학생 이름 찾기" placeholder="이름 찾기" value={query} onChange={e=>setQuery(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs"/></div>
  {/* the gauge is this month's coupon count only (full = the goal); what the student holds is the grey line under the name */}
  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_76px] gap-x-2 border-b border-slate-200 pb-1 text-[11px] text-slate-400"><span>학생</span><span>이번 달 쿠폰 누적 → 목표 {won(data.goal)}P</span><span className="text-right">누적</span></div>
  {list.map((s,i)=><div key={s.name+i}><button type="button" aria-expanded={openRow===i} onClick={()=>setOpenRow(openRow===i?-1:i)} title="이번 달 내역 보기" className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_76px] items-center gap-x-2 rounded border-b border-slate-100 py-1 text-left text-xs hover:bg-[#fff7f8]">
   <span className="min-w-0"><span className="block truncate">{s.name}{s.requested&&<span className="ml-1" title="이번 달 쿠폰 신청">🎟️</span>}{s.earned>=data.goal&&!s.requested&&<span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-800">신청 가능</span>}</span>
    <span className="block truncate text-[10px] text-slate-400">보유 {won(s.points)}P{s.app==='none'?<span title="앱 계정이 없어요 · 수업 일지대로 받을 포인트"> · 앱 미연결</span>:s.app==='no-pet'?<span title="펫을 아직 안 골랐어요 · 포인트는 쌓여요"> · 펫 없음</span>:(s.waiting||0)>0?<span title="다음 반영이나 앱을 열 때 들어올 포인트"> · +{won(s.waiting||0)} 대기</span>:null}</span></span>
   <span className="h-2 overflow-hidden rounded-full bg-[#f6e3e6]"><span className="block h-full rounded-full" style={{width:`${Math.min(100,s.earned/data.goal*100)}%`,background:s.earned>=data.goal?'#efa23a':'#e0587a'}}/></span>
   <span className="text-right tabular-nums"><b className={`font-bold ${s.earned>=data.goal?'text-amber-700':'text-slate-700'}`}>{won(s.earned)}</b> <span className="text-[10px] text-slate-400">{s.earned>=data.goal?'✓':`${Math.floor(s.earned/data.goal*100)}%`}</span></span>
  </button>
   {canRequest&&s.key&&(s.options||[]).length>0&&<div className="mb-1 flex flex-wrap items-center gap-1.5 pl-1 text-[11px] text-amber-700"><span aria-hidden="true">🎟️</span>신청할 수 있어요{(s.options||[]).map(o=><button key={o.id} type="button" className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold" onClick={()=>void offline(s,o)}>{won(o.won)}원 오프라인 신청</button>)}</div>}
   {/* the gauge's 내역, as the student sees it */}
   {openRow===i&&<div className="mb-2 rounded-lg bg-[#fffafb] px-3 pb-2">{s.key&&<RankNickname name={s.name} value={nicks[s.key]||''} save={saveNick(s)}/>}<PointsHistory coupon={{month:data.month,earned:s.earned}} ledger={s.ledger||[]} defaultOpen/>{!s.earned&&<p className="pt-2 text-[11px] text-slate-400">이번 달 모은 포인트가 아직 없어요.</p>}</div>}
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
 // 대기 포인트 모두 넣기: what the 수업 일지 give linked students but their accounts don't hold yet, paid as 반영 pays them
 const [ver,setVer]=useState(0);
 const settle=()=>act(async()=>{
  const w=await request('read:waiting-points');
  if(!w?.students){await askConfirm({title:w?.failed?`${w.failed}명은 확인하지 못했어요`:'대기 포인트가 없어요',message:w?.failed?'잠시 후 다시 눌러 주세요. 확인한 학생 중에는 대기 포인트가 없어요.':'모든 연결 학생의 포인트가 수업 일지대로 들어가 있어요.',confirmText:'확인',icon:'check'});return;}
  if(!await askConfirm({title:`${w.students}명에게 대기 포인트 ${Number(w.points).toLocaleString('ko-KR')}P를 넣을까요?`,message:(w.failed?`${w.failed}명은 확인하지 못해 이번에는 빠져요(잠시 후 다시 눌러 주세요). `:'')+'수업 반영 때와 같은 방식으로 지금 바로 넣어요. 같은 수업은 두 번 주지 않고, 펫이 없는 학생은 포인트 통장을 만들어 넣어요. 학생이 다음에 앱을 열면 놓친 보상으로 보여요.',confirmText:'모두 넣기',icon:'check'}))return;
  const r=await request('settle-waiting',{});
  await askConfirm({title:`${r.students}명에게 ${Number(r.points).toLocaleString('ko-KR')}P를 넣었어요`,message:r.failed?`${r.failed}명은 넣지 못했어요. 잠시 후 다시 눌러 주세요.`:'목록의 대기 표시가 사라졌어요.',confirmText:'확인',icon:'check'});
  setVer(v=>v+1);
 });
 // 예전 포인트 조정 (하루 300P): once; the list first (who and how much), then taken back
 const legacy=()=>act(async()=>{
  const w=await request('read:legacy-points');
  const held=(w?.heldBack||[]).length?` 기록이 너무 많은 ${w.heldBack.length}명(${w.heldBack.join(', ')})은 보류했어요.`:'';
  if(!w?.students?.length){await askConfirm({title:'조정할 예전 포인트가 없어요',message:'예전 포인트가 모두 하루 300P 제한 안에 있거나, 이미 조정했어요.'+held,confirmText:'확인',icon:'check'});return;}
  const list=<ul className="max-h-60 overflow-y-auto text-sm">{w.students.map((s:any,i:number)=><li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1"><span className="truncate">{s.name}</span><span className="text-xs text-slate-500">보유 {won(s.held)}P · 예전 {won(s.legacy)}P → 인정 {won(s.allowed)}P ({s.days}일 × 300P) · <b className="text-rose-700">−{won(s.take)}P</b></span></li>)}</ul>;
  if(!await askConfirm({title:`${w.students.length}명에게서 예전 포인트 ${won(w.total)}P를 조정할까요?`,message:'기기에 저장하던 시절(하루 제한 없음) 포인트를, 앱 학습 기록이 있는 날마다 하루 300P씩 인정하고 넘친 만큼 보유 포인트와 이번 달 쿠폰 누적에서 빼요. 그 시절 기록이 없는 학생은 조정하지 않아요.'+held+' 0P 아래로는 빼지 않고, 학생 포인트 내역에 \'예전 포인트 조정\'으로 남아요. 한 번만 할 수 있어요.',content:list,confirmText:'조정하기',tone:'danger'}))return;
  const r=await request('legacy-points-apply',{});
  await askConfirm({title:`${r.students}명에게서 ${won(r.total)}P를 조정했어요`,message:r.failed?`${r.failed}명은 조정하지 못했어요. 잠시 후 다시 눌러 주세요.`:'쿠폰 누적과 순위가 새 포인트로 바뀌어요.',confirmText:'확인',icon:'check'});
  setVer(v=>v+1);
 });
 const paid=(c:PetCouponRow,value:boolean)=>act(async()=>{await request('coupon-paid',{id:c.id,paid:value});await load();});
 return <section className="panel rv">
  <div className="rv-head"><h2>이달의 장학 쿠폰{rows&&<small>{list.length}장{waiting?` · 지급 전 ${waiting}`:''}</small>}</h2>
   {months.length>1&&<select aria-label="달" value={shown} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{m.replace('-','년 ')}월</option>)}</select>}</div>
  <p className="mt-1 text-xs text-slate-500">채움 학원 학생이 한 달에 모은 포인트가 1만 P를 넘으면 신청할 수 있어요 (포인트는 줄지 않아요). 앱이 없거나 불편한 학생은 아래 목록에서 오프라인으로 신청해요.</p>
  {autoLoad&&<div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" className="small-button" disabled={busy} onClick={()=>void settle()}>대기 포인트 모두 넣기</button><button type="button" className="small-button" disabled={busy} onClick={()=>void legacy()}>예전 포인트 조정 (하루 300P)</button><span className="text-[11px] text-slate-400">수업 일지대로 받을 포인트 중 아직 학생 계정에 안 들어간 것(대기)을 지금 넣어요</span></div>}
  {autoLoad&&<PetPointsOverview key={ver} request={request} act={act} canRequest onRequested={load}/>}
  {rows&&(list.length?<ul className="mt-2">{list.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={paid}/>)}</ul>:<p className="mt-2 text-sm text-slate-500">아직 신청한 학생이 없어요.</p>)}
 </section>;
}

/** The window a "26.10 쿠폰" badge opens on the student list. */
export function PetCouponDialog({name,coupons,busy,onPaid,onClose}:{name:string;coupons:PetCouponRow[];busy:boolean;onPaid:(c:PetCouponRow,paid:boolean)=>void;onClose:()=>void}){
 return <WorkspaceDialog open title={`${name} 학생의 장학 쿠폰`} onClose={onClose}>
  <ul>{coupons.map(c=><CouponLine key={c.id} c={c} busy={busy} onPaid={onPaid}/>)}</ul>
 </WorkspaceDialog>;
}
