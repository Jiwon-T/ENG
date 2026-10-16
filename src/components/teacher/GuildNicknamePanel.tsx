import {useEffect,useState} from 'react';
import {ShieldAlert} from 'lucide-react';
import {askConfirm} from './ConfirmDialog';

/** 관리자 설정 › 원정대 별칭 (admin): every student's 원정대 이름 and each pet's 모험가 별칭. A warning makes the student pick a
 *  new one (shown to others as "…바꾸는 중" until then) and that name can't be used again by that student. */
export default function GuildNicknamePanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [rows,setRows]=useState<any[]|null>(null);
 const load=async()=>{const r=await request('read:guild-nicknames');setRows(r.rows||[]);};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const warn=(r:any,target:'guild'|number,name:string,kind:string)=>act(async()=>{if(!await askConfirm({title:`'${name}'에 경고할까요?`,message:`학생에게 ${kind}을 바꾸라는 창이 뜨고, 이 이름은 다시 쓸 수 없어요.`,confirmText:'경고하기',tone:'danger'}))return;await request('guild-warn',{uid:r.uid,target});await load();});
 const name=(r:any,label:string,value:string,warned:boolean,target:'guild'|number,kind:string)=><span key={String(target)} className="flex items-center gap-2 py-0.5"><span className="w-16 shrink-0 truncate text-xs text-slate-400">{label}</span><b className="min-w-0 flex-1 truncate font-bold">{value||<span className="font-normal text-slate-300">아직 없음</span>}</b>
  {value&&(warned?<span className="text-xs font-bold text-amber-600">바꾸는 중</span>:<button type="button" className="small-button" disabled={busy} onClick={()=>warn(r,target,value,kind)}><ShieldAlert size={14} aria-hidden="true"/>경고</button>)}</span>;
 return <section className="panel rv">
  <div className="rv-head"><h2>원정대 이름·별칭{rows&&<small>{rows.length}명</small>}</h2></div>
  {rows&&(rows.length?<ul className="mt-2 text-sm">{rows.map(r=><li key={r.uid} className="border-b border-slate-100 py-2">
   <p className="text-xs text-slate-500">{r.account||'이름 없음'}{r.banned?` · 경고 ${r.banned}회`:''}</p>
   {name(r,'원정대',r.guildName,r.guildWarned,'guild','원정대 이름')}
   {(r.aliases||[]).map((a:any)=>name(r,a.pet,a.alias,a.warned,a.slot,'모험가 별칭'))}
  </li>)}</ul>:<p className="mt-2 text-sm text-slate-500">아직 원정대 이름이나 별칭을 정한 학생이 없어요.</p>)}
 </section>;
}
