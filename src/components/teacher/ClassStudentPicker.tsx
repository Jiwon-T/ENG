import {useState} from 'react';
import {Check,Plus,Search,X} from 'lucide-react';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
type Student={studentKey:string;studentDisplayName:string};
const LIMIT=8;
/** Students are found by name or 초성; nothing is listed until something is typed, so long rosters stay out of the way. */
export function classStudentMatches<T extends Student>(pool:readonly T[],query:string){
 return query.trim()?pool.filter(s=>matchesKoreanSearch(s.studentDisplayName,query)):[];
}
export default function ClassStudentPicker({current,others,selected,nameOf,onChange}:{current:Student[];others:Student[];selected:string[];nameOf:(key:string)=>string;onChange:(next:string[])=>void}){
 const [query,setQuery]=useState(''),[group,setGroup]=useState<'active'|'other'>('active');
 const found=classStudentMatches(group==='active'?current:others,query);
 const toggle=(key:string)=>onChange(selected.includes(key)?selected.filter(k=>k!==key):[...selected,key]);
 return <div className="ce-students">
  <div className="ce-picked" aria-label="선택한 학생">{selected.map(key=><span key={key} className="ce-chip"><span>{nameOf(key)}</span><button type="button" aria-label={`${nameOf(key)} 빼기`} onClick={()=>toggle(key)}><X size={12}/></button></span>)}{!selected.length&&<span className="ce-hint">아직 학생이 없습니다. 아래에서 이름이나 초성으로 찾아 추가하세요.</span>}</div>
  <div className="ce-search">
   <label className="ce-search-box"><Search size={15} aria-hidden="true"/><input aria-label="반 학생 검색" placeholder="이름·초성 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="ce-seg" role="group" aria-label="반 학생 구분">{([['active','재원생'],['other','이외']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={group===key} onClick={()=>setGroup(key)}>{label}</button>)}</div>
  </div>
  {query.trim()&&<ul className="ce-results" aria-label="검색 결과">{found.slice(0,LIMIT).map(s=>{const on=selected.includes(s.studentKey);return <li key={s.studentKey}><button type="button" aria-pressed={on} onClick={()=>toggle(s.studentKey)}><span>{s.studentDisplayName}</span>{on?<span className="ce-state"><Check size={13}/>선택됨</span>:<span className="ce-state"><Plus size={13}/>추가</span>}</button></li>;})}
   {!found.length&&<li className="ce-empty">{group==='active'?'재원생':'이외 학생'} 중 맞는 이름이 없습니다.</li>}
   {found.length>LIMIT&&<li className="ce-empty">외 {found.length-LIMIT}명 · 조금 더 입력해 주세요.</li>}</ul>}
 </div>;
}
