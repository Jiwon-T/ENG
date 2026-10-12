import {useMemo} from 'react';
import {CalendarClock,TrendingDown,TrendingUp,Trophy,UserPlus,Users} from 'lucide-react';
import {studentOverview} from '../../lib/studentOverview';
import {PetCharacter} from '../pet/PetCharacters';
import StopReminders from './StopReminders';

// Same stages as PetService.getStage (see StudentMasterPanel).
const petStage=(level:number|null)=>level==null||level<=20?'baby':level<=40?'child':level<=60?'teen':level<=99?'adult':'master';
const todayKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());

/** 학생 관리 main screen before a student is chosen: monthly joins and leaves, the academy's make-up and app activity,
 *  all from the student list already loaded. */
export default function StudentOverview({students,intakeCount,today=todayKst(),onEnrollmentChanged}:{students:any[];intakeCount?:number;today?:string;onEnrollmentChanged?:()=>Promise<void>|void}){
 const o=useMemo(()=>studentOverview(students,today),[students,today]);
 const peak=Math.max(1,...o.bars.flatMap(b=>[b.joined.length,b.left.length]));
 const W=640,H=180,top=22,bottom=30,step=W/o.bars.length,bar=Math.min(16,step/3.2),scale=(n:number)=>(H-top-bottom)*n/peak;
 const subjectMax=Math.max(1,...o.subjects.map(s=>s.count)),gradeMax=Math.max(1,...o.grades.map(g=>g.count));
 const cards=[
  {icon:Users,label:'재원생',value:o.current,unit:'명',tone:'brand'},
  {icon:TrendingUp,label:'이번 달 신규',value:o.joinedThisMonth,unit:'명',tone:'up'},
  {icon:TrendingDown,label:'이번 달 중단',value:o.leftThisMonth,unit:'명',tone:'down'},
  ...(intakeCount!==undefined?[{icon:UserPlus,label:'신입생·상담',value:intakeCount,unit:'명',tone:'plain'}]:[]),
 ];
 return <section className="so" aria-label="학원 한눈에 보기">
  <header className="so-head"><div><h2>학원 한눈에 보기</h2><p>왼쪽에서 학생을 고르면 리포트와 수업 기록을 볼 수 있어요.</p></div></header>
  {onEnrollmentChanged&&<StopReminders students={students} today={today} onChanged={onEnrollmentChanged}/>}
  <div className="so-cards">{cards.map(c=>{const Icon=c.icon;return <div key={c.label} className={`so-card is-${c.tone}`}><span className="so-card-icon" aria-hidden="true"><Icon size={18}/></span><span className="so-card-label">{c.label}</span><strong>{c.value}<small>{c.unit}</small></strong></div>;})}</div>
  <div className="so-panel so-chart">
   <div className="so-panel-head"><h3>월별 신규 등록 · 중단</h3><span className="so-legend"><i className="is-joined"/>신규<i className="is-left"/>중단</span></div>
   <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 12개월 신규 ${o.bars.reduce((n,b)=>n+b.joined.length,0)}명, 중단 ${o.bars.reduce((n,b)=>n+b.left.length,0)}명`}>
    {[0.5,1].map(f=><line key={f} x1={0} x2={W} y1={H-bottom-(H-top-bottom)*f} y2={H-bottom-(H-top-bottom)*f} className="so-grid"/>)}
    <line x1={0} x2={W} y1={H-bottom} y2={H-bottom} className="so-axis"/>
    {o.bars.map((b,i)=>{const cx=step*i+step/2,now=b.month===today.slice(0,7),first=i===0||b.month.endsWith('-01');return <g key={b.month} className={now?'is-now':''}>
     {now&&<rect x={step*i+2} y={top-14} width={step-4} height={H-top-bottom+14} rx={10} className="so-now"/>}
     {[[b.joined,'is-joined',-1],[b.left,'is-left',1]].map(([names,cls,side]:any)=>{const h=scale(names.length),x=cx+(side<0?-bar-1:1);return <g key={cls}>
      <rect x={x} y={H-bottom-Math.max(h,names.length?3:0)} width={bar} height={Math.max(h,names.length?3:0)} rx={4} className={`so-bar ${cls}`}><title>{`${b.year}년 ${b.label} ${cls==='is-joined'?'신규':'중단'} ${names.length}명${names.length?': '+names.join(', '):''}`}</title></rect>
      {names.length>0&&<text x={x+bar/2} y={H-bottom-h-5} className={`so-value ${cls}`}>{names.length}</text>}</g>;})}
     <text x={cx} y={H-12} className="so-month">{b.label}</text>
     {first&&<text x={cx} y={H-1} className="so-year">{b.year}</text>}
    </g>;})}
   </svg>
   {o.missingStart>0&&<p className="so-note">등록일이 비어 있는 재원생 {o.missingStart}명은 그래프에 들어가지 않았어요. 학생 정보의 과목 시작일을 채우면 함께 보여요.</p>}
  </div>
  <div className="so-row">
   <div className="so-panel">
    <div className="so-panel-head"><h3>과목 · 학년 구성</h3><span className="so-sub">재원생 기준</span></div>
    <ul className="so-bars">{o.subjects.map(s=><li key={s.subject}><span>{s.subject}</span><span className="so-track"><span style={{width:`${s.count/subjectMax*100}%`}}/></span><b>{s.count}</b></li>)}</ul>
    <ul className="so-bars is-grade">{o.grades.map(g=><li key={g.grade}><span>{g.grade}</span><span className="so-track"><span style={{width:`${g.count/gradeMax*100}%`}}/></span><b>{g.count}</b></li>)}</ul>
    {o.gradeUnknown>0&&<p className="so-note">학년을 알 수 없는 학생 {o.gradeUnknown}명</p>}
   </div>
   <div className="so-stack">
    <div className="so-panel so-tenure">
     <div className="so-panel-head"><h3><CalendarClock size={15} aria-hidden="true"/>재원 기간</h3>{o.tenure.known<o.current&&<span className="so-sub">등록일 아는 {o.tenure.known}명 기준</span>}</div>
     <div className="so-tenure-values"><div><strong>{o.tenure.averageMonths??'—'}<small>개월</small></strong><span>평균 재원</span></div><div><strong>{o.tenure.overYear}<small>명</small></strong><span>1년 이상</span></div></div>
    </div>
    <div className="so-panel so-pets">
     <div className="so-panel-head"><h3><Trophy size={15} aria-hidden="true"/>앱 활동 · 펫 랭킹</h3></div>
     {o.pets.length?<ol>{o.pets.map((p,i)=><li key={p.studentKey}><span className={`so-rank r${i+1}`}>{i+1}</span><span className="so-pet-art" aria-hidden="true">{p.pet.character?<PetCharacter character={p.pet.character} stage={petStage(p.pet.level) as any}/>:'🐾'}</span><span className="so-pet-who"><strong>{p.name}</strong><small>{p.pet.name}</small></span><b>Lv.{p.pet.level}</b></li>)}</ol>:<p className="so-note">앱에서 펫을 키우는 학생이 아직 없어요.</p>}
    </div>
   </div>
  </div>
 </section>;
}
