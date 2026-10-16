import {useEffect,useState} from 'react';

/** 관리자 설정 › 탑 단어장 (admin): the hard wordbooks the 채움의 탑 asks from, up to two for each level (words come from
 *  both). 고등 students and every teacher use the 고등 books; 중등, 초등 and students whose grade isn't known use the 중등 books. */
type Pair=[string,string];
const pair=(v:unknown):Pair=>{const a=Array.isArray(v)?v:typeof v==='string'&&v?[v]:[];return [String(a[0]||''),String(a[1]||'')];};
export default function PetTowerSettingsPanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [books,setBooks]=useState<{id:string;title:string}[]|null>(null),[middle,setMiddle]=useState<Pair>(['','']),[high,setHigh]=useState<Pair>(['','']),[saved,setSaved]=useState('');
 const load=async()=>{const r=await request('read:pet-tower-settings');setBooks(r.books||[]);setMiddle(pair(r.middle));setHigh(pair(r.high));};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const save=()=>act(async()=>{await request('save-pet-tower-settings',{middle:middle.filter(Boolean),high:high.filter(Boolean)});setSaved('저장했어요.');});
 const picks=(label:string,hint:string,value:Pair,set:(v:Pair)=>void)=><fieldset className="text-sm"><legend><b className="font-bold">{label}</b> <span className="text-xs text-slate-400">{hint}</span></legend>
  <div className="mt-1 grid gap-2 sm:grid-cols-2">{[0,1].map(i=><select key={i} aria-label={`${label} ${i+1}번째 단어장`} value={value[i]} onChange={e=>{const next=[...value] as Pair;next[i]=e.target.value;set(next);setSaved('');}}>
   <option value="">{i?'두 번째 단어장 (선택)':'첫 번째 단어장'}</option>{(books||[]).filter(b=>b.id===value[i]||b.id!==value[1-i]).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select>)}</div></fieldset>;
 return <section className="panel rv">
  <div className="rv-head"><h2>탑 단어장</h2></div>
  <p className="mt-1 text-xs text-slate-500">채움의 탑 전투에 나오는 어려운 단어장이에요. 단계마다 두 권까지 고르면 두 권에서 섞어서 나와요. 하나도 정하지 않으면 그 학생들은 탑에 들어갈 수 없어요.</p>
  {books&&<div className="mt-3 space-y-3">
   {picks('중등용','중학생 · 초등학생 · 학년을 모르는 학생',middle,setMiddle)}
   {picks('고등용','고등학생 · 선생님 계정',high,setHigh)}
   <div className="flex items-center gap-2"><button type="button" className="small-button" disabled={busy} onClick={()=>void save()}>저장</button>{saved&&<span className="text-xs text-slate-500">{saved}</span>}</div>
  </div>}
 </section>;
}
