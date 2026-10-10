import {useState} from 'react';
import {History} from 'lucide-react';
const groups=[['all','전체'],['account','회원'],['tuition','수강료'],['payroll','정산'],['class','반·커리큘럼']] as const;
/** 관리자 설정 › 관리 기록 (admin and principal): who changed what, newest first. */
export default function AdminHistoryPanel({busy,request,act}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}){
 const [group,setGroup]=useState<string>('all'),[entries,setEntries]=useState<any[]|null>(null);
 const load=async(g=group)=>{const r=await request('read:admin-history',{group:g});setEntries(r.entries||[]);setGroup(g);};
 let lastDay='';
 return <section className="panel rv ah">
  <div className="rv-head"><h2>관리 기록{entries&&<small>최근 {entries.length}건</small>}</h2>{!entries&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}><History size={16} aria-hidden="true"/>기록 열기</button>}</div>
  {entries&&<>
   <div className="rv-seg" role="group" aria-label="기록 종류">{groups.map(([k,l])=><button key={k} type="button" aria-pressed={group===k} disabled={busy} onClick={()=>act(()=>load(k))}>{l}</button>)}</div>
   <ol className="ah-list">{entries.map(e=>{const day=new Date(e.at).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});const head=day!==lastDay;lastDay=day;return <li key={e.id}>{head&&<p className="ah-day">{day}</p>}<div className="ah-row"><span className="ah-time">{new Date(e.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span><span className={'ah-area a-'+e.area}>{e.area}</span><span className="ah-text">{e.text}</span><span className="ah-by">{e.by}</span></div></li>;})}</ol>
   {!entries.length&&<p className="rv-empty">아직 기록이 없습니다.</p>}
  </>}
 </section>;
}
