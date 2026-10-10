import {BookOpen,Check,ClipboardCheck,Coffee,Plus,Trash2,X} from 'lucide-react';
// 정규 시간표: each line is a lesson (정규 수업, usually with 자습 before/after) or a 테스트 (no lesson,
// 자습·테스트 only). A line can be for the whole class or only some students, and each lesson can carry
// self-study blocks with their own times and students (students in one class often keep different hours).
export interface StudyBlock{start:string;end:string;students?:string[]}
export interface TimetableLine{id?:string;weekday:number;start:string;end:string;status?:string;kind?:'lesson'|'test';students?:string[];study?:StudyBlock[];notionEditedAt?:string}
const days=[1,2,3,4,5,6,0],dayNames=['일','월','화','수','목','금','토'];
export const addMinutes=(time:string,minutes:number)=>{const [h,m]=time.split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return time;const total=Math.min(Math.max(h*60+m+minutes,0),23*60+59);return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};
const short=(name:string)=>name.replace(/\s*\(.*\)\s*$/,'').trim()||name;
export default function ClassTimetableEditor({lines,onChange,classStudents,nameOf,statuses,classStatus,onStopLine}:{
 lines:TimetableLine[];onChange:(lines:TimetableLine[])=>void;classStudents:string[];nameOf:(key:string)=>string;statuses:string[];classStatus:string;onStopLine:(index:number)=>void;
}){
 const set=(i:number,patch:Partial<TimetableLine>)=>onChange(lines.map((l,j)=>j===i?{...l,...patch}:l));
 const remove=(i:number)=>onChange(lines.filter((_,j)=>j!==i));
 const targets=(l:TimetableLine)=>l.students?.length?l.students.filter(k=>classStudents.includes(k)):classStudents;
 const setStudy=(i:number,blocks:StudyBlock[])=>set(i,{study:blocks.length?blocks:undefined});
 const addLine=(kind:'lesson'|'test')=>{const last=lines[lines.length-1];const start=last?.end||'16:00';onChange([...lines,{weekday:last?.weekday??1,start,end:addMinutes(start,kind==='test'?60:80),status:classStatus,kind}]);};
 const counts={lesson:lines.filter(l=>l.kind!=='test').length,test:lines.filter(l=>l.kind==='test').length,study:lines.reduce((n,l)=>n+(l.kind==='test'?0:(l.study||[]).length),0)};
 // Keep the order they were added in, so a line does not jump away while its time is being typed.
 const ordered=lines.map((l,i)=>({l,i}));
 return <section className="tt">
  <div className="tt-head"><h3>정규 시간표</h3><span className="tt-legend"><span className="tt-tag lesson"><BookOpen size={12} aria-hidden="true"/>수업 {counts.lesson}</span><span className="tt-tag study"><Coffee size={12} aria-hidden="true"/>자습 {counts.study}</span><span className="tt-tag test"><ClipboardCheck size={12} aria-hidden="true"/>테스트 {counts.test}</span></span></div>
  {ordered.map(({l,i})=>{const test=l.kind==='test',who=targets(l);return <article key={l.id||i} className={'tt-line'+(test?' is-test':'')+(l.status==='중단'?' is-stopped':'')}>
   <div className="tt-row">
    <div className="tt-kind" role="group" aria-label="시간 종류"><button type="button" aria-pressed={!test} onClick={()=>set(i,{kind:'lesson'})}><BookOpen size={14} aria-hidden="true"/>수업</button><button type="button" aria-pressed={test} onClick={()=>set(i,{kind:'test',study:undefined,end:l.end})}><ClipboardCheck size={14} aria-hidden="true"/>테스트</button></div>
    <div className="tt-days" role="group" aria-label="요일">{days.map(d=><button key={d} type="button" aria-pressed={l.weekday===d} onClick={()=>set(i,{weekday:d})}>{dayNames[d]}</button>)}</div>
   </div>
   <div className="tt-row">
    <span className="tt-time"><input type="time" aria-label={test?'테스트 시작':'수업 시작'} value={l.start} onChange={e=>set(i,{start:e.target.value})}/><span>~</span><input type="time" aria-label={test?'테스트 종료':'수업 종료'} value={l.end} onChange={e=>set(i,{end:e.target.value})}/></span>
    <span className="tt-presets">{(test?[60]:[80,90,120]).map(m=><button key={m} type="button" className="lesson-time-chip" onClick={()=>set(i,{end:addMinutes(l.start,m)})}>+{m}분</button>)}</span>
    <span className="tt-grow"/>
    <select aria-label="시간표 상태" value={l.status||classStatus} onChange={e=>{if(e.target.value==='중단'&&classStatus!=='중단'){onStopLine(i);return;}set(i,{status:e.target.value});}}>{statuses.map(s=><option key={s} disabled={classStatus==='중단'&&s!=='중단'}>{s}</option>)}</select>
    <button type="button" className="tt-icon" aria-label="이 시간 삭제" onClick={()=>remove(i)}><Trash2 size={16}/></button>
   </div>
   {classStudents.length>0&&<div className="tt-who"><span className="tt-label">대상</span><PeoplePicker pool={classStudents} selected={l.students} nameOf={nameOf} onChange={students=>set(i,{students})}/></div>}
   {!test&&<div className="tt-study">
    {(l.study||[]).map((b,bi)=>{const pool=who;return <div key={bi} className="tt-study-row">
     <span className="tt-tag study"><Coffee size={12} aria-hidden="true"/>자습</span>
     <span className="tt-time"><input type="time" aria-label="자습 시작" value={b.start} onChange={e=>setStudy(i,(l.study||[]).map((x,j)=>j===bi?{...x,start:e.target.value}:x))}/><span>~</span><input type="time" aria-label="자습 종료" value={b.end} onChange={e=>setStudy(i,(l.study||[]).map((x,j)=>j===bi?{...x,end:e.target.value}:x))}/></span>
     <span className="tt-study-who">{pool.length>1?<PeoplePicker pool={pool} selected={b.students} nameOf={nameOf} tone="green" onChange={students=>setStudy(i,(l.study||[]).map((x,j)=>j===bi?{...x,students}:x))}/>:<span className="tt-solo">{short(nameOf(pool[0]||''))}</span>}</span>
     <button type="button" className="tt-icon" aria-label="자습 삭제" onClick={()=>setStudy(i,(l.study||[]).filter((_,j)=>j!==bi))}><X size={14}/></button>
    </div>;})}
    <div className="tt-study-add"><button type="button" onClick={()=>setStudy(i,[...(l.study||[]),{start:l.end,end:addMinutes(l.end,60)}])}><Plus size={13} aria-hidden="true"/>수업 후 자습 60분</button><button type="button" onClick={()=>setStudy(i,[...(l.study||[]),{start:addMinutes(l.start,-60),end:l.start}])}><Plus size={13} aria-hidden="true"/>수업 전 자습 60분</button><button type="button" onClick={()=>setStudy(i,[...(l.study||[]),{start:addMinutes(l.end,30),end:addMinutes(l.end,90)}])}><Plus size={13} aria-hidden="true"/>다른 시간</button></div>
   </div>}
  </article>;})}
  {!lines.length&&<p className="rv-empty">아직 정규 시간이 없습니다. 아래에서 수업이나 테스트를 추가해 주세요.</p>}
  <div className="tt-add"><button type="button" onClick={()=>addLine('lesson')}><BookOpen size={15} aria-hidden="true"/>+ 수업 시간</button><button type="button" onClick={()=>addLine('test')}><ClipboardCheck size={15} aria-hidden="true"/>+ 테스트 시간</button></div>
 </section>;
}

/** Who a line is for. Included students are coloured with a ✓; tapping toggles. Nobody picked out = everyone. */
function PeoplePicker({pool,selected,nameOf,onChange,tone='pink'}:{pool:string[];selected?:string[];nameOf:(key:string)=>string;onChange:(next?:string[])=>void;tone?:'pink'|'green'}){
 const chosen=selected?.length?pool.filter(k=>selected.includes(k)):pool,all=chosen.length===pool.length;
 const toggle=(key:string)=>{const next=chosen.includes(key)?chosen.filter(k=>k!==key):[...chosen,key];if(!next.length)return;onChange(next.length===pool.length?undefined:next);};
 return <span className={'tt-people '+tone}>
  <span className="tt-count">{all?`전체 ${pool.length}명`:`${chosen.length}/${pool.length}명`}</span>
  {pool.map(k=>{const on=chosen.includes(k);return <button key={k} type="button" className="tt-person" aria-pressed={on} title={on?'누르면 빠집니다':'누르면 들어갑니다'} onClick={()=>toggle(k)}>{on?<Check size={12} aria-hidden="true"/>:<Plus size={12} aria-hidden="true"/>}{short(nameOf(k))}</button>;})}
  {!all&&<button type="button" className="tt-reset" onClick={()=>onChange(undefined)}>모두 선택</button>}
 </span>;
}
