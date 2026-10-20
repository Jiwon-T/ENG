import React,{useId,useState} from 'react';
import {ChevronLeft,ChevronRight,Plus,Search,CalendarClock,Link2Off} from 'lucide-react';
import {studentSearchResults} from '../../lib/koreanSearch';
import {isCurrentStudent} from '../../lib/teacherLessonGrid';
import StudentCombobox from './StudentCombobox';
import StatusBadge from './StatusBadge';
import {PetCharacter} from '../pet/PetCharacters';
import {plannedStopOf} from '../../lib/studentOverview';
import {campusCounts,rememberCampus,rememberedCampus,studentCampusLabel,studentCampuses} from '../../lib/campus';
import {registrationCampuses} from '../../lib/studentRegistration';
const todayKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
// Same stages as PetService.getStage, kept here so the list does not load the pet service.
const petStage=(level:number|null)=>level==null||level<=20?'baby':level<=40?'child':level<=60?'teen':level<=99?'adult':'master';
type Registrations={count:number;onAdd:()=>void;render:(query:string,active:boolean)=>React.ReactNode};
/** One list for every student: 재원생 · 신입생·상담 · 이외, one search box that also finds 상담·신입생. */
/** today: students with a lesson today and those whose lesson log is not written yet (known once today's lessons are read). */
/** scope (principal/admin): 전체 학생 or only their own assigned students. */
import type {PetCouponRow} from './PetCouponPanel';
/** `coupons`: 이달의 장학 쿠폰 badges (admin), newest first; a badge opens them (`onCoupon`).
 *  `onPet`: the pet badge opens the student's pet (read only); the row itself still selects the student. */
export default function StudentMasterPanel({students,value,onSelect,onPet,onCouponCard,coupons,onCoupon,registrations,today,scope}:{students:any[];value:string;onSelect:(key:string)=>void;onPet?:(key:string)=>void;onCouponCard?:(key:string)=>void;coupons?:Record<string,PetCouponRow[]>;onCoupon?:(key:string)=>void;registrations?:Registrations;today?:{lesson:Set<string>;unwritten:Set<string>};scope?:{value:'all'|'mine';mine:number;onChange:(next:'all'|'mine')=>void}}){
 const id=useId(),[query,setQuery]=useState(''),[group,setGroup]=useState<'current'|'intake'|'other'>('current'),[subject,setSubject]=useState(''),[focus,setFocus]=useState('');
 const current=students.filter(s=>isCurrentStudent(s)),others=students.filter(s=>!isCurrentStudent(s));
 const searching=Boolean(query.trim()),intake=group==='intake'&&!searching;
 // While searching, every student is a candidate regardless of the chip, so nobody is hidden by the wrong tab.
 const pool=searching?students:group==='current'?current:group==='other'?others:[];
 // Campus chips: all three campuses (with counts, 0 included) as soon as any student has a campus; remembered on this device.
 const [campusChoice,setCampusChoice]=useState(()=>rememberedCampus('students'));
 const counted=new Map(campusCounts(current.flatMap(s=>studentCampuses(s))));
 const campusChips=counted.size?registrationCampuses.map(c=>[c,counted.get(c)||0] as [string,number]):[];
 const campus=campusChips.some(([c])=>c===campusChoice)?campusChoice:'';
 const filtered=studentSearchResults(pool.filter(s=>(!subject||s.subjects?.some((r:any)=>r.subject===subject))&&(!campus||studentCampuses(s).includes(campus))),query);
 const move=(direction:number)=>{const index=current.findIndex(s=>s.studentKey===value);if(current.length)onSelect(current[(index+direction+current.length)%current.length].studentKey);};
 const groups:[typeof group,string,number][]=[['current','재원생',current.length],...(registrations?[['intake','신입생·상담',registrations.count] as [typeof group,string,number]]:[]),['other','이외',others.length]];
 const chips=<div className="student-master-segment" role="group" aria-label="학생 구분">{groups.map(([key,label,n])=><button type="button" key={key} aria-pressed={group===key&&!searching} onClick={()=>{setGroup(key);setQuery('');setFocus('');}}>{label} <b>{n}</b></button>)}</div>;
 const search=<label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="학생 이름·초성 검색" placeholder="학생·신입생 이름·초성 검색" value={query} onChange={e=>{setQuery(e.target.value);setFocus('');}}/></label>;
 return <>
  {/* Above both layouts, so narrow screens can switch too. */}
  {scope&&<div className="student-scope" role="group" aria-label="보는 학생"><button type="button" aria-pressed={scope.value==='all'} onClick={()=>scope.onChange('all')}>전체 학생</button><button type="button" aria-pressed={scope.value==='mine'} onClick={()=>scope.onChange('mine')}>내 담당 <b>{scope.mine}</b></button></div>}
  <div className="student-master-mobile"><button type="button" aria-label="이전 학생" disabled={!current.length} onClick={()=>move(-1)}><ChevronLeft size={16}/></button><StudentCombobox students={students} value={value} onChange={onSelect} filters={[{label:'재원생',keys:current.map(s=>s.studentKey)},{label:'이외',keys:others.map(s=>s.studentKey)}]}/><button type="button" aria-label="다음 학생" disabled={!current.length} onClick={()=>move(1)}><ChevronRight size={16}/></button></div>
  {registrations&&<div className="student-master-mobile student-master-mobile-intake"><button type="button" className="small-button" aria-pressed={group==='intake'} onClick={()=>{setGroup(group==='intake'?'current':'intake');setQuery('');}}>신입생·상담 {registrations.count}</button><button type="button" className="primary-button" onClick={registrations.onAdd}><Plus size={16} aria-hidden="true"/>상담·신입생</button></div>}
  <div className="student-master-desktop">
   <div className="student-master-head"><h2>학생 관리</h2>{registrations&&<button type="button" className="small-button" onClick={registrations.onAdd}><Plus size={16} aria-hidden="true"/>상담·신입생</button>}</div>
   {search}{chips}
   {!intake&&campusChips.length>0&&<div className="campus-chips" role="group" aria-label="캠퍼스"><button type="button" aria-pressed={!campus} onClick={()=>{setCampusChoice('');rememberCampus('students','');}}>전체</button>{campusChips.map(([c,n])=><button type="button" key={c} aria-pressed={campus===c} onClick={()=>{setCampusChoice(c);rememberCampus('students',c);}}>{c} <b>{n}</b></button>)}</div>}
   {!intake&&<select aria-label="학생 과목 필터" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">전체 과목</option>{[...new Set<string>(students.flatMap(s=>(s.subjects||[]).map((r:any)=>r.subject)))].map(s=><option key={s}>{s}</option>)}</select>}
   {!intake&&<div role="listbox" aria-label="학생 목록" tabIndex={0} aria-activedescendant={filtered.some(s=>s.studentKey===(focus||value))?`${id}-${focus||value}`:undefined} onKeyDown={e=>{const index=filtered.findIndex(s=>s.studentKey===(focus||value));if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=filtered[(index+(e.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length];if(next){setFocus(next.studentKey);document.getElementById(`${id}-${next.studentKey}`)?.scrollIntoView({block:'nearest'});}}else if(e.key==='Enter'){e.preventDefault();if(filtered.some(s=>s.studentKey===(focus||value)))onSelect(focus||value);}}}>
    {searching&&filtered.length>0&&<p className="student-intake-heading">학생</p>}
    {filtered.map(s=>{const parts=s.studentDisplayName.match(/^(.*?)\s*\((.*)\)$/);return <div id={`${id}-${s.studentKey}`} key={s.studentKey} role="option" aria-selected={value===s.studentKey} className={`student-master-row has-look${value===s.studentKey?' is-selected':''}${focus===s.studentKey?' is-focused':''}`} onClick={()=>onSelect(s.studentKey)}><span className="smr-icon" aria-hidden="true">{s.look?.icon||(parts?.[1]||s.studentDisplayName).slice(0,1)}</span><span className="smr-main"><span className="smr-line"><strong>{parts?.[1]||s.studentDisplayName}</strong>{s.look?.pet&&<span className={`smr-pet${onPet?' is-clickable':''}`} onClick={onPet?e=>{e.stopPropagation();onPet(s.studentKey);}:undefined} title={`${onPet?'눌러서 펫 보기 · ':''}키우는 펫 ${s.look.pet.name}${s.look.pet.level!=null?` · Lv.${s.look.pet.level}`:''}${s.look.pet.count>1?` · ${s.look.pet.count}마리`:''}`}><span className="smr-pet-art" aria-hidden="true">{s.look.pet.character?<PetCharacter character={s.look.pet.character} stage={petStage(s.look.pet.level) as any} portrait/>:'🐾'}</span>{s.look.pet.name}{s.look.pet.level!=null&&<b>Lv.{s.look.pet.level}</b>}</span>}{typeof s.couponPoints==='number'&&onCouponCard&&<span className={`smr-gauge${s.couponPoints>=10000?' is-full':''}`} title={`이달의 장학 쿠폰 ${Math.min(100,Math.floor(s.couponPoints/10000*100))}% · ${s.couponPoints.toLocaleString('ko-KR')}P · 눌러서 보기`} onClick={e=>{e.stopPropagation();onCouponCard(s.studentKey);}}>{Math.min(100,Math.floor(s.couponPoints/100))}%</span>}{(coupons?.[s.studentKey]||[]).slice(0,2).map(c=><span key={c.id} className={`smr-coupon${c.paidAt?' is-paid':''}`} title={`${c.label} 장학 쿠폰 · ${c.paidAt?'지급 완료':'지급 전'} · 눌러서 보기`} onClick={onCoupon?e=>{e.stopPropagation();onCoupon(s.studentKey);}:undefined}>{c.label}{c.paidAt?' ✓':' 쿠폰'}</span>)}</span>{parts&&<small>{parts[2]}</small>}<div className="smr-tags">{studentCampusLabel(s)&&<span className="smr-campus">{studentCampusLabel(s)}</span>}{today?.unwritten.has(s.studentKey)?<StatusBadge kind="unwritten" text="오늘 일지 미작성"/>:today?.lesson.has(s.studentKey)&&<span className="smr-today">오늘 수업</span>}{(()=>{const stop=plannedStopOf(s);return stop?<span className={'smr-stop'+(stop<=todayKst()?' is-due':'')}><CalendarClock size={11} aria-hidden="true"/>{stop<=todayKst()?'중단 예정일 지남':`${md(stop)} 중단 예정`}</span>:null;})()}{searching&&!isCurrentStudent(s)&&<StatusBadge kind="unwritten" text="이외"/>}{!(s.accountLinked??s.linkedFirebaseUid)&&<span className="smr-quiet"><Link2Off size={11} aria-hidden="true"/>앱 계정 미연결</span>}{!s.hasGuardianContact&&<span className="smr-quiet">연락처 없음</span>}</div></span></div>;})}
   </div>}
   {!intake&&!filtered.length&&!searching&&<p className="report-caption">해당하는 학생이 없습니다.</p>}
  </div>
  {registrations?.render(query,intake)}
 </>;
}
