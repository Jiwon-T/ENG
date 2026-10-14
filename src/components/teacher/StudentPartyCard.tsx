import {useEffect,useState} from 'react';
import {PetCharacter} from '../pet/PetCharacters';
import {PET_PARTY,petStage} from '../../lib/petCatalog';

/** 학생 관리 › this week's 원정대 party of the student: the whole team, students of our academy by name and others by
 *  nickname only. Hidden when the student has no team this week. */
export default function StudentPartyCard({studentKey,request}:{studentKey:string;request:(a:string,b?:any)=>Promise<any>}){
 const [party,setParty]=useState<any>(null);
 useEffect(()=>{let live=true;setParty(null);request('read:student-party',{studentKey}).then(r=>{if(live)setParty(r.party||null);}).catch(()=>undefined);return()=>{live=false;};},[studentKey]);
 if(!party)return null;
 const boss=PET_PARTY.bosses.find(b=>b.id===party.boss);
 return <div className="mt-2 rounded-xl border border-[#f3e6e8] bg-white px-3 py-2 text-xs">
  <div className="flex items-center justify-between"><b className="font-bold text-[#5e1e2a]">이번 주 원정대 파티</b><span className="text-[#8b2f40]">{party.name} · {boss?.icon} {Math.round(party.progress*100)}%</span></div>
  <ul className="mt-1">{party.members.map((m:any,i:number)=><li key={i} className="flex items-center gap-2 border-b border-[#f6eef0] py-1 last:border-0">
   <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#fdecef]"><PetCharacter character={m.pet.character} stage={petStage(m.pet.level)} accessory={m.pet.accessory} portrait size={22}/></span>
   <span className="min-w-0 flex-1 truncate">{m.ourAcademy?<><b className="font-bold">{m.name}</b> <span className="text-slate-400">({m.nickname} · 우리 학원)</span></>:<><b className="font-bold">{m.nickname}</b> <span className="text-slate-400">다른 학원</span></>}
    <span className="text-slate-400">{m.status==='left'?' · 나감':m.status==='kicked'?' · 내보내짐':m.idleDays>=2?` · ${m.idleDays}일째 쉼`:''}</span></span>
   <b className="font-bold text-[#5e1e2a]">{m.count}</b>
  </li>)}</ul>
 </div>;
}
