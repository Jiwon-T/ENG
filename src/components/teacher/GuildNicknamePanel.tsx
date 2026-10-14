import {useEffect,useState} from 'react';
import {ShieldAlert} from 'lucide-react';
import {askConfirm} from './ConfirmDialog';

/** 관리자 설정 › 원정대 별칭 (admin): every nickname students use in the 모험가 길드. A warning makes the student pick a new
 *  one (shown to others as "별칭 바꾸는 중" until then) and that nickname can't be used again. */
export default function GuildNicknamePanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [rows,setRows]=useState<any[]|null>(null);
 const load=async()=>{const r=await request('read:guild-nicknames');setRows(r.rows||[]);};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const warn=(r:any)=>act(async()=>{if(!await askConfirm({title:`'${r.nickname}'에 경고할까요?`,message:'학생에게 별칭을 바꾸라는 창이 뜨고, 이 별칭은 다시 쓸 수 없어요.',confirmText:'경고하기',tone:'danger'}))return;await request('guild-warn',{uid:r.uid});await load();});
 return <section className="panel rv">
  <div className="rv-head"><h2>원정대 별칭{rows&&<small>{rows.length}명</small>}</h2></div>
  {rows&&(rows.length?<ul className="mt-2 text-sm">{rows.map(r=><li key={r.uid} className="flex items-center gap-2 border-b border-slate-100 py-2">
   <span className="min-w-0 flex-1"><b className="font-bold">{r.nickname}</b> <span className="text-xs text-slate-400">{r.account||'이름 없음'}{r.banned?` · 경고 ${r.banned}회`:''}</span></span>
   {r.warned?<span className="text-xs font-bold text-amber-600">바꾸는 중</span>:<button type="button" className="small-button" disabled={busy} onClick={()=>warn(r)}><ShieldAlert size={14} aria-hidden="true"/>경고</button>}
  </li>)}</ul>:<p className="mt-2 text-sm text-slate-500">아직 길드 별칭을 정한 학생이 없어요.</p>)}
 </section>;
}
