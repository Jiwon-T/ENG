import {useEffect,useState} from 'react';

/** 관리자 설정 › 탑 단어장 (admin): the hard wordbook the 채움의 탑 asks from. 고등 students use the 고등 book; 중등, 초등 and
 *  students whose grade isn't known use the 중등 book. */
export default function PetTowerSettingsPanel({busy,request,act,autoLoad=false}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;autoLoad?:boolean}){
 const [books,setBooks]=useState<{id:string;title:string}[]|null>(null),[middle,setMiddle]=useState(''),[high,setHigh]=useState(''),[saved,setSaved]=useState('');
 const load=async()=>{const r=await request('read:pet-tower-settings');setBooks(r.books||[]);setMiddle(r.middle||'');setHigh(r.high||'');};
 useEffect(()=>{if(autoLoad)void act(()=>load());},[]);
 const save=()=>act(async()=>{await request('save-pet-tower-settings',{middle,high});setSaved('저장했어요.');});
 const pick=(label:string,value:string,set:(v:string)=>void,hint:string)=><label className="block text-sm"><b className="font-bold">{label}</b> <span className="text-xs text-slate-400">{hint}</span>
  <select className="mt-1 block w-full" value={value} onChange={e=>{set(e.target.value);setSaved('');}}><option value="">정하지 않음</option>{(books||[]).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>;
 return <section className="panel rv">
  <div className="rv-head"><h2>탑 단어장</h2></div>
  <p className="mt-1 text-xs text-slate-500">채움의 탑 전투에 나오는 어려운 단어장이에요. 정하지 않으면 학생이 탑에 들어갈 수 없어요.</p>
  {books&&<div className="mt-3 space-y-3">
   {pick('중등용',middle,setMiddle,'중학생 · 초등학생 · 학년을 모르는 학생')}
   {pick('고등용',high,setHigh,'고등학생')}
   <div className="flex items-center gap-2"><button type="button" className="small-button" disabled={busy} onClick={()=>void save()}>저장</button>{saved&&<span className="text-xs text-slate-500">{saved}</span>}</div>
  </div>}
 </section>;
}
