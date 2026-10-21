import {useEffect,useState} from 'react';
import {SENTENCE_GRADES,type SentenceGrade} from '../../lib/petCatalog';

/** 관리자 설정 › 원정대 문장 세트 (admin): up to two 문장 세트 for each school grade (sentences come from both), for the
 *  문장 배열 and 낭독 stages (4장부터).
 *  학년을 모르는 학생은 중1, 선생님 계정은 고3 세트를 써요. 초등이 비어 있으면 중1 세트를, 다른 비어 있는 학년은 고3 세트를 쓰고, 고3도 비어 있으면
 *  문장 문제 대신 단어 게임이 나와요. */
type Pair=[string,string];
type Picks=Record<SentenceGrade,Pair>;
const empty=():Picks=>Object.fromEntries(SENTENCE_GRADES.map(g=>[g,['','']])) as Picks;
// A grade comes as a list (or one id, saved before): the first two.
const pair=(v:unknown):Pair=>{const a=Array.isArray(v)?v:typeof v==='string'&&v?[v]:[];return [String(a[0]||''),String(a[1]||'')];};
export default function ExpeditionSentenceSettingsPanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [sets,setSets]=useState<{id:string;title:string}[]|null>(null),[picks,setPicks]=useState<Picks>(empty),[saved,setSaved]=useState(''),[loadError,setLoadError]=useState('');
 const load=async()=>{const r=await request('read:pet-expedition-settings');setSets(r.sets||[]);setPicks(Object.fromEntries(SENTENCE_GRADES.map(g=>[g,pair(r.sentences?.[g])])) as Picks);};
 // A read on its own (not through act): beside the 탑 panel in one menu, two loads through act at once let only one run.
 useEffect(()=>{if(autoLoad)load().catch((e:any)=>setLoadError(e?.message||'불러오지 못했어요.'));},[]);
 const save=()=>act(async()=>{await request('save-pet-expedition-settings',{sentences:Object.fromEntries(SENTENCE_GRADES.map(g=>[g,picks[g].filter(Boolean)]))});setSaved('저장했어요.');});
 const choose=(g:SentenceGrade,i:number,id:string)=>{const next=[...picks[g]] as Pair;next[i]=id;setPicks({...picks,[g]:next});setSaved('');};
 return <section className="panel rv">
  <div className="rv-head"><h2>원정대 문장 세트</h2></div>
  {loadError&&<p role="alert" className="mt-1 text-xs text-orange-600">{loadError}</p>}
  <p className="mt-1 text-xs text-slate-500">원정대 4장부터 나오는 문장 배열·낭독 문제의 문장 세트예요. 학년마다 두 개까지 고르면 두 세트에서 섞어서 나와요. 학년을 모르는 학생은 중1, 선생님 계정은 고3 세트를 써요. 초등이 비어 있으면 중1 세트를, 다른 비어 있는 학년은 고3 세트를 쓰고, 고3도 비어 있으면 문장 대신 단어 게임이 나와요.</p>
  {sets&&<div className="mt-3 space-y-2">
   {sets.length===0&&<p className="text-xs text-orange-600">아직 문장 세트가 없어요. 학습 세트 › 문장 세트에서 먼저 만들어 주세요.</p>}
   <div className="grid gap-2">{SENTENCE_GRADES.map(g=><div key={g} role="group" aria-label={`${g} 문장 세트`} className="flex items-center gap-2 text-sm"><b className="w-9 flex-none font-bold">{g}</b>
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">{[0,1].map(i=><select key={i} aria-label={`${g} ${i+1}번째 문장 세트`} value={picks[g][i]} onChange={e=>choose(g,i,e.target.value)} className="min-w-0">
     <option value="">{i?'두 번째 세트 (선택)':g==='고3'?'(비어 있으면 단어 게임)':g==='초등'?'(비우면 중1 세트)':'(비우면 고3 세트)'}</option>{sets.filter(b=>b.id===picks[g][i]||b.id!==picks[g][1-i]).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>)}</div></div>)}</div>
   <div className="flex items-center gap-2"><button type="button" className="small-button" disabled={busy} onClick={()=>void save()}>저장</button>{saved&&<span className="text-xs text-slate-500">{saved}</span>}</div>
  </div>}
 </section>;
}
