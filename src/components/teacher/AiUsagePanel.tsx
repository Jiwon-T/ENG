import {useEffect,useMemo,useState} from 'react';
import {AI_PLANS,type AiPlan} from '../../lib/aiPlans';
import {askConfirm} from './ConfirmDialog';

/** 관리자 설정 › AI 사용량 (admin): calls and tokens counted by the app for each Korea day, with an estimated cost.
 *  The estimate uses list prices (input $0.50, output and thinking $3.00 per million tokens, 1달러 = 1,400원); Google's
 *  billing page is the real bill and shows up later. */
const PRICE={input:0.5,output:3,krw:1400};
type Use={calls:number;input:number;output:number;thoughts:number};
type Day={day:string;pet:Use;workbook:Use;analyzer:Use;generator:Use};
type Person={uid:string;name:string;role:string;plan:AiPlan;analyzer:number;workbook:number;petTalk:number};
type Pass={uid:string;name:string;role:string;plan:AiPlan;until:string;active:boolean};
type AppUser={uid:string;name:string;email:string;role:string};
const ROLE:Record<string,string>={student:'학생',teacher:'선생님',principal:'원장',admin:'관리자'};
const FEATURES:[keyof Omit<Day,'day'>,string][]=[['pet','펫 말하기'],['workbook','워크북 해석'],['analyzer','분석기'],['generator','생성기']];
const won=(u:Use)=>(u.input*PRICE.input+(u.output+u.thoughts)*PRICE.output)/1e6*PRICE.krw;
const seoulDay=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(at);
/** A pass bought today runs a month: through the day before the same date next month. */
const monthLater=(day:string)=>{const [y,m,d]=day.split('-').map(Number);const t=new Date(Date.UTC(y,m,d-1));return t.toISOString().slice(0,10);};
/** This month in Korea time ('2026-10'): the counts are kept by Korea day, so UTC would put 1일 00:00–09:00 in last month. */
const seoulMonth=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(at).slice(0,7);
const fmt=(n:number)=>n<10?n.toFixed(2):Math.round(n).toLocaleString('ko-KR');

export default function AiUsagePanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [days,setDays]=useState<Day[]|null>(null),[people,setPeople]=useState<{month:string;rows:Person[]}|null>(null),[passes,setPasses]=useState<Pass[]|null>(null);
 // 패스 주기: pick a person (the app's users, loaded when the form opens), the pass and its last day.
 const [giving,setGiving]=useState(false),[users,setUsers]=useState<AppUser[]>([]),[find,setFind]=useState(''),[pick,setPick]=useState<AppUser|null>(null),[plan,setPlan]=useState<'pet'|'premium'>('pet'),[until,setUntil]=useState(()=>monthLater(seoulDay()));
 const load=async()=>{const [r,m,ps]=await Promise.all([request('read:ai-usage'),request('read:ai-monthly'),request('read:ai-passes')]);setDays(r.days||[]);setPeople(m);setPasses(ps.rows||[]);};
 const openGive=()=>act(async()=>{if(!users.length){const r=await request('read:app-users');setUsers(r.users||[]);}setGiving(true);});
 const give=()=>pick&&act(async()=>{await request('ai-pass-set',{uid:pick.uid,plan,until});setGiving(false);setPick(null);setFind('');await load();});
 const stop=(x:Pass)=>act(async()=>{if(x.active&&!await askConfirm({title:`${x.name}의 ${AI_PLANS[x.plan]?.label||'패스'}를 끝낼까요?`,message:'오늘부터 기본 한도로 돌아가요.',confirmText:'끝내기',tone:'danger'}))return;await request('ai-pass-set',{uid:x.uid,plan:'none'});await load();});
 const found=useMemo(()=>{const q=find.trim().toLowerCase();return q?users.filter(u=>u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)).slice(0,8):[];},[find,users]);
 const reset=(p:Person)=>act(async()=>{await request('ai-monthly-reset',{uid:p.uid});await load();});
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const month=useMemo(()=>{const m=seoulMonth();const rows=(days||[]).filter(d=>d.day.startsWith(m));return {calls:rows.reduce((n,d)=>n+FEATURES.reduce((k,[f])=>k+d[f].calls,0),0),won:rows.reduce((n,d)=>n+FEATURES.reduce((k,[f])=>k+won(d[f]),0),0)};},[days]);
 return <section className="panel rv">
  <div className="rv-head"><h2>AI 사용량</h2><button type="button" className="small-button" disabled={busy} onClick={()=>void act(()=>load())}>새로고침</button></div>
  <p className="mt-1 text-xs text-slate-500">앱이 AI를 부를 때마다 센 횟수와 토큰이에요. 금액은 정가로 계산한 <b>추정치</b>이고, 실제 청구는 Google Cloud 결제 화면에 하루쯤 늦게 나와요.</p>
  {days&&<>
   <div className="mt-3 flex gap-2 text-sm"><div className="flex-1 rounded-xl bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">이번 달 호출</span><b>{month.calls.toLocaleString('ko-KR')}번</b></div><div className="flex-1 rounded-xl bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">이번 달 추정 금액</span><b>약 {fmt(month.won)}원</b></div></div>
   {days.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-2 font-medium">날짜</th>{FEATURES.map(([,l])=><th key={l} className="py-1 pr-2 font-medium">{l}</th>)}<th className="py-1 font-medium">추정 금액</th></tr></thead>
    <tbody>{days.map(d=><tr key={d.day} className="border-t border-slate-100"><td className="py-1.5 pr-2">{d.day.slice(5).replace('-','/')}</td>{FEATURES.map(([f])=><td key={f} className="py-1.5 pr-2" title={`입력 ${d[f].input.toLocaleString('ko-KR')} · 출력 ${d[f].output.toLocaleString('ko-KR')} · 생각 ${d[f].thoughts.toLocaleString('ko-KR')} 토큰`}>{d[f].calls?`${d[f].calls}번 · ${fmt(won(d[f]))}원`:'—'}</td>)}<td className="py-1.5 font-bold">{fmt(FEATURES.reduce((n,[f])=>n+won(d[f]),0))}원</td></tr>)}</tbody></table></div>
   :<p className="mt-3 text-sm text-slate-500">아직 센 기록이 없어요. (이 기능을 배포한 뒤부터 세요.)</p>}
  </>}
  {passes&&<div className="mt-5">
   <div className="flex items-center justify-between"><b className="text-sm">AI 패스</b>{!giving&&<button type="button" className="small-button" disabled={busy} onClick={()=>void openGive()}>패스 주기</button>}</div>
   <p className="mt-0.5 text-xs text-slate-500">학원에서 결제한 사람에게 켜 줘요. {AI_PLANS.pet.label} 월 {AI_PLANS.pet.price.toLocaleString('ko-KR')}원: 펫 대화 모든 펫 합쳐 월 {AI_PLANS.pet.petTalk}번 · {AI_PLANS.premium.label} 월 {AI_PLANS.premium.price.toLocaleString('ko-KR')}원: 펫 패스 + 지문 분석 {AI_PLANS.premium.analyzer}번 · 워크북 AI 해석 {AI_PLANS.premium.workbook}번. 마지막 날까지 쓸 수 있어요.</p>
   {giving&&<div className="mt-2 rounded-xl border border-slate-200 p-2.5 text-sm">
    {pick?<div className="flex items-center gap-2"><b className="min-w-0 flex-1 truncate">{pick.name||'이름 없음'} <span className="text-xs font-normal text-slate-400">{ROLE[pick.role]||''}</span></b><button type="button" className="small-button" onClick={()=>setPick(null)}>다른 사람</button></div>
     :<><input value={find} onChange={e=>setFind(e.target.value)} placeholder="이름이나 이메일로 찾기" aria-label="패스 받을 사람 찾기" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"/>
      {found.length>0&&<ul className="mt-1">{found.map(u=><li key={u.uid}><button type="button" className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-slate-50" onClick={()=>setPick(u)}>{u.name||'이름 없음'} <span className="text-xs text-slate-400">{ROLE[u.role]||''} · {u.email}</span></button></li>)}</ul>}</>}
    <div className="mt-2 flex flex-wrap items-center gap-2">
     <select value={plan} onChange={e=>setPlan(e.target.value as 'pet'|'premium')} aria-label="패스 종류" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"><option value="pet">{AI_PLANS.pet.label}</option><option value="premium">{AI_PLANS.premium.label}</option></select>
     <label className="text-xs text-slate-500">마지막 날 <input type="date" value={until} min={seoulDay()} onChange={e=>setUntil(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm"/></label>
     <span className="flex-1"/>
     <button type="button" className="small-button" onClick={()=>setGiving(false)}>취소</button>
     <button type="button" className="small-button" disabled={busy||!pick||!until} onClick={()=>void give()}>켜기</button>
    </div>
   </div>}
   {passes.length?<ul className="mt-2 text-sm">{passes.map(x=><li key={x.uid} className={`flex items-center gap-2 border-b border-slate-100 py-2 ${x.active?'':'opacity-50'}`}>
    <span className="min-w-0 flex-1"><b className="font-bold">{x.name}</b> <span className="text-xs text-slate-400">{ROLE[x.role]||''}</span></span>
    <span className="text-xs text-slate-600">{AI_PLANS[x.plan]?.label||x.plan}</span>
    <span className="text-xs text-slate-500">{x.active?`${x.until.slice(5).replace('-','/')}까지`:'끝남'}</span>
    <button type="button" className="small-button" disabled={busy} onClick={()=>void stop(x)}>{x.active?'끝내기':'지우기'}</button>
   </li>)}</ul>:<p className="mt-2 text-xs text-slate-400">아직 패스를 가진 사람이 없어요.</p>}
  </div>}
  {people&&<div className="mt-5">
   <b className="text-sm">사람별 이번 달 사용량</b>
   <p className="mt-0.5 text-xs text-slate-500">기본 한도: 지문 분석 {AI_PLANS.free.analyzer}번 · 워크북 AI 해석 {AI_PLANS.free.workbook}번 · 펫 대화 펫마다 {AI_PLANS.free.petTalkPerPet}번 (관리자는 한도 없음). 다 쓴 사람은 '다시 쓰게 하기'로 이번 달 횟수를 0으로 되돌려요.</p>
   {people.rows.length?<ul className="mt-2 text-sm">{people.rows.map(p=>{const lim=AI_PLANS[p.plan]||AI_PLANS.free,full=p.analyzer>=lim.analyzer||p.workbook>=lim.workbook||(lim.petTalk!==null&&p.petTalk>=lim.petTalk);return <li key={p.uid} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-slate-100 py-2">
    <span className="min-w-0 flex-1"><b className="font-bold">{p.name}</b> <span className="text-xs text-slate-400">{ROLE[p.role]||''}{p.plan!=='free'?` · ${lim.label}`:''}</span></span>
    <span className={`text-xs ${p.analyzer>=lim.analyzer?'font-bold text-red-600':'text-slate-500'}`}>분석 {p.analyzer}/{lim.analyzer}</span>
    <span className={`text-xs ${p.workbook>=lim.workbook?'font-bold text-red-600':'text-slate-500'}`}>워크북 {p.workbook}/{lim.workbook}</span>
    <span className={`text-xs ${lim.petTalk!==null&&p.petTalk>=lim.petTalk?'font-bold text-red-600':'text-slate-500'}`}>펫 {p.petTalk}{lim.petTalk!==null?`/${lim.petTalk}`:''}</span>
    <button type="button" className="small-button" disabled={busy} onClick={()=>void reset(p)}>{full?'다시 쓰게 하기':'0으로'}</button>
   </li>;})}</ul>:<p className="mt-2 text-xs text-slate-400">이번 달에 AI를 쓴 사람이 아직 없어요.</p>}
  </div>}
 </section>;
}
