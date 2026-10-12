import {Check,Search,Users} from 'lucide-react';
import {matchesKoreanSearch} from '../../lib/koreanSearch';

const shortName=(name:string)=>name.replace(/\s*\(.*\)\s*$/,'').trim()||name;
const weekdayOf=(date:string)=>new Date(`${date}T12:00:00+09:00`).getUTCDay();
const todayKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());

/** 여러 학생 작성: the teacher's classes as cards. One tap adds the whole class; classes meeting on the chosen date come
 *  first with their time. Search matches a class name or any student in it (초성 too, e.g. ㅈㅅㅎ). */
export default function ClassPicker({classes,students,date,query,onQuery,selectedId,isAdded,onPick}:{classes:any[];students:any[];date:string;query:string;onQuery:(value:string)=>void;selectedId:string;isAdded:(c:any)=>boolean;onPick:(c:any)=>void}){
 const nameOf=(key:string)=>students.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생';
 const weekday=weekdayOf(date);
 const slotOf=(c:any)=>c.slots?.filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).sort((a:any,b:any)=>a.start.localeCompare(b.start))[0];
 const shown=classes.filter(c=>!query.trim()||matchesKoreanSearch(c.name||'',query)||(c.students||[]).some((key:string)=>matchesKoreanSearch(nameOf(key),query)))
  .map(c=>({c,slot:slotOf(c)}))
  .sort((a,b)=>Number(Boolean(b.slot))-Number(Boolean(a.slot))||(a.slot?.start||'').localeCompare(b.slot?.start||'')||String(a.c.name||'').localeCompare(String(b.c.name||''),'ko'));
 if(!classes.length)return null;
 return <section className="class-picker" aria-label="반에서 불러오기">
  <div className="class-picker-head"><h3>반에서 불러오기 <small>누르면 반 학생이 모두 추가돼요</small></h3>
   <label className="class-picker-search"><Search size={15} aria-hidden="true"/><input aria-label="반·학생 검색" placeholder="반·학생 이름·초성" value={query} onChange={e=>onQuery(e.target.value)}/></label></div>
  <div className="class-picker-grid">{shown.map(({c,slot})=>{const added=isAdded(c),picked=selectedId===c.id;return <button type="button" key={c.id} className={'class-card'+(slot?' is-today':'')+(picked?' is-picked':'')+(added?' is-added':'')} aria-pressed={picked} onClick={()=>onPick(c)}>
   <span className="class-card-top"><strong>{c.name||'이름 없는 반'}</strong>{added?<span className="class-card-added"><Check size={13} aria-hidden="true"/>추가됨</span>:<span className="class-card-subject">{c.subject}</span>}</span>
   <span className="class-card-meta">{slot?<span className="class-card-time">{date===todayKst()?'오늘':'이 날'} {slot.start}–{slot.end}</span>:<span className="class-card-off">이 날 수업 없음</span>}<span className="class-card-count"><Users size={12} aria-hidden="true"/>{(c.students||[]).length}명</span></span>
   <span className="class-card-names">{(c.students||[]).map((key:string)=>{const name=nameOf(key);return <span key={key} title={name}>{shortName(name)}</span>;})}{!(c.students||[]).length&&<em>학생 없음</em>}</span>
  </button>;})}</div>
  {!shown.length&&<p className="class-picker-empty">‘{query}’에 맞는 반이나 학생이 없어요.</p>}
 </section>;
}
