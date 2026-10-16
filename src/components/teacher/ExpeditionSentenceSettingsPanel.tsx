import {useEffect,useState} from 'react';
import {SENTENCE_GRADES,type SentenceGrade} from '../../lib/petCatalog';

/** 관리자 설정 › 원정대 문장 세트 (admin): one 문장 세트 for each school grade, for the 문장 배열 and 낭독 stages (4장부터).
 *  초등학생과 학년을 모르는 학생은 중1, 선생님 계정은 고3 세트를 써요. 비어 있는 학년은 고3 세트를 쓰고, 고3도 비어 있으면
 *  문장 문제 대신 단어 게임이 나와요. */
type Picks=Record<SentenceGrade,string>;
const empty=():Picks=>Object.fromEntries(SENTENCE_GRADES.map(g=>[g,''])) as Picks;
export default function ExpeditionSentenceSettingsPanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [sets,setSets]=useState<{id:string;title:string}[]|null>(null),[picks,setPicks]=useState<Picks>(empty),[saved,setSaved]=useState('');
 const load=async()=>{const r=await request('read:pet-expedition-settings');setSets(r.sets||[]);setPicks({...empty(),...(r.sentences||{})});};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const save=()=>act(async()=>{await request('save-pet-expedition-settings',{sentences:picks});setSaved('저장했어요.');});
 return <section className="panel rv">
  <div className="rv-head"><h2>원정대 문장 세트</h2></div>
  <p className="mt-1 text-xs text-slate-500">원정대 4장부터 나오는 문장 배열·낭독 문제의 문장 세트예요. 학년마다 하나씩 골라요. 초등학생과 학년을 모르는 학생은 중1, 선생님 계정은 고3 세트를 써요. 비어 있는 학년은 고3 세트를 쓰고, 고3도 비어 있으면 문장 대신 단어 게임이 나와요.</p>
  {sets&&<div className="mt-3 space-y-2">
   {sets.length===0&&<p className="text-xs text-orange-600">아직 문장 세트가 없어요. 학습 세트 › 문장 세트에서 먼저 만들어 주세요.</p>}
   <div className="grid gap-2 sm:grid-cols-2">{SENTENCE_GRADES.map(g=><label key={g} className="flex items-center gap-2 text-sm"><b className="w-9 flex-none font-bold">{g}</b>
    <select aria-label={`${g} 문장 세트`} value={picks[g]} onChange={e=>{setPicks({...picks,[g]:e.target.value});setSaved('');}} className="min-w-0 flex-1"><option value="">{g==='고3'?'(비어 있으면 단어 게임)':'(비우면 고3 세트)'}</option>{sets.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>)}</div>
   <div className="flex items-center gap-2"><button type="button" className="small-button" disabled={busy} onClick={()=>void save()}>저장</button>{saved&&<span className="text-xs text-slate-500">{saved}</span>}</div>
  </div>}
 </section>;
}
