import React,{useId,useState} from 'react';
import {ChevronLeft,ChevronRight,Plus,Search} from 'lucide-react';
import {studentSearchResults} from '../../lib/koreanSearch';
import {isCurrentStudent} from '../../lib/teacherLessonGrid';
import StudentCombobox from './StudentCombobox';
import StatusBadge from './StatusBadge';
import {PetCharacter} from '../pet/PetCharacters';
// Same stages as PetService.getStage, kept here so the list does not load the pet service.
const petStage=(level:number|null)=>level==null||level<=20?'baby':level<=40?'child':level<=60?'teen':level<=99?'adult':'master';
type Registrations={count:number;onAdd:()=>void;render:(query:string,active:boolean)=>React.ReactNode};
/** One list for every student: 재원생 · 신입생·상담 · 이외, one search box that also finds 상담·신입생. */
export default function StudentMasterPanel({students,value,onSelect,registrations}:{students:any[];value:string;onSelect:(key:string)=>void;registrations?:Registrations}){
 const id=useId(),[query,setQuery]=useState(''),[group,setGroup]=useState<'current'|'intake'|'other'>('current'),[subject,setSubject]=useState(''),[focus,setFocus]=useState('');
 const current=students.filter(s=>isCurrentStudent(s)),others=students.filter(s=>!isCurrentStudent(s));
 const searching=Boolean(query.trim()),intake=group==='intake'&&!searching;
 // While searching, every student is a candidate regardless of the chip, so nobody is hidden by the wrong tab.
 const pool=searching?students:group==='current'?current:group==='other'?others:[];
 const filtered=studentSearchResults(pool.filter(s=>!subject||s.subjects?.some((r:any)=>r.subject===subject)),query);
 const move=(direction:number)=>{const index=current.findIndex(s=>s.studentKey===value);if(current.length)onSelect(current[(index+direction+current.length)%current.length].studentKey);};
 const groups:[typeof group,string,number][]=[['current','재원생',current.length],...(registrations?[['intake','신입생·상담',registrations.count] as [typeof group,string,number]]:[]),['other','이외',others.length]];
 const chips=<div className="student-master-segment" role="group" aria-label="학생 구분">{groups.map(([key,label,n])=><button type="button" key={key} aria-pressed={group===key&&!searching} onClick={()=>{setGroup(key);setQuery('');setFocus('');}}>{label} <b>{n}</b></button>)}</div>;
 const search=<label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="학생 이름·초성 검색" placeholder="학생·신입생 이름·초성 검색" value={query} onChange={e=>{setQuery(e.target.value);setFocus('');}}/></label>;
 return <>
  <div className="student-master-mobile"><button type="button" aria-label="이전 학생" disabled={!current.length} onClick={()=>move(-1)}><ChevronLeft size={16}/></button><StudentCombobox students={students} value={value} onChange={onSelect} filters={[{label:'재원생',keys:current.map(s=>s.studentKey)},{label:'이외',keys:others.map(s=>s.studentKey)}]}/><button type="button" aria-label="다음 학생" disabled={!current.length} onClick={()=>move(1)}><ChevronRight size={16}/></button></div>
  {registrations&&<div className="student-master-mobile student-master-mobile-intake"><button type="button" className="small-button" aria-pressed={group==='intake'} onClick={()=>{setGroup(group==='intake'?'current':'intake');setQuery('');}}>신입생·상담 {registrations.count}</button><button type="button" className="primary-button" onClick={registrations.onAdd}><Plus size={16} aria-hidden="true"/>상담·신입생</button></div>}
  <div className="student-master-desktop">
   <div className="student-master-head"><h2>학생 관리</h2>{registrations&&<button type="button" className="small-button" onClick={registrations.onAdd}><Plus size={16} aria-hidden="true"/>상담·신입생</button>}</div>
   {search}{chips}
   {!intake&&<select aria-label="학생 과목 필터" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">전체 과목</option>{[...new Set<string>(students.flatMap(s=>(s.subjects||[]).map((r:any)=>r.subject)))].map(s=><option key={s}>{s}</option>)}</select>}
   {!intake&&<div role="listbox" aria-label="학생 목록" tabIndex={0} aria-activedescendant={filtered.some(s=>s.studentKey===(focus||value))?`${id}-${focus||value}`:undefined} onKeyDown={e=>{const index=filtered.findIndex(s=>s.studentKey===(focus||value));if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=filtered[(index+(e.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length];if(next){setFocus(next.studentKey);document.getElementById(`${id}-${next.studentKey}`)?.scrollIntoView({block:'nearest'});}}else if(e.key==='Enter'){e.preventDefault();if(filtered.some(s=>s.studentKey===(focus||value)))onSelect(focus||value);}}}>
    {searching&&filtered.length>0&&<p className="student-intake-heading">학생</p>}
    {filtered.map(s=>{const parts=s.studentDisplayName.match(/^(.*?)\s*\((.*)\)$/);return <div id={`${id}-${s.studentKey}`} key={s.studentKey} role="option" aria-selected={value===s.studentKey} className={`student-master-row has-look${value===s.studentKey?' is-selected':''}${focus===s.studentKey?' is-focused':''}`} onClick={()=>onSelect(s.studentKey)}><span className="smr-icon" aria-hidden="true">{s.look?.icon||(parts?.[1]||s.studentDisplayName).slice(0,1)}</span><span className="smr-main"><span className="smr-line"><strong>{parts?.[1]||s.studentDisplayName}</strong>{s.look?.pet&&<span className="smr-pet" title={`키우는 펫 ${s.look.pet.name}${s.look.pet.level!=null?` · Lv.${s.look.pet.level}`:''}`}><span className="smr-pet-art" aria-hidden="true">{s.look.pet.character?<PetCharacter character={s.look.pet.character} stage={petStage(s.look.pet.level) as any}/>:'🐾'}</span>{s.look.pet.name}{s.look.pet.level!=null&&<b>Lv.{s.look.pet.level}</b>}</span>}</span>{parts&&<small>{parts[2]}</small>}<div>{searching&&!isCurrentStudent(s)&&<StatusBadge kind="unwritten" text="이외"/>}{!s.linkedFirebaseUid&&<StatusBadge kind="saved" text="앱 계정 미연결"/>}{!s.hasGuardianContact&&<StatusBadge kind="saved" text="연락처 확인 필요"/>}</div></span></div>;})}
   </div>}
   {!intake&&!filtered.length&&!searching&&<p className="report-caption">해당하는 학생이 없습니다.</p>}
  </div>
  {registrations?.render(query,intake)}
 </>;
}
