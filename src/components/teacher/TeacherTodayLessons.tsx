import {X} from 'lucide-react';
import {subscribeTodayVisibility,hiddenTodayLessons,setTodayVisibility} from '../../lib/todayLessonVisibility';
import StatusBadge from './StatusBadge';
import {AlertCircle,ArrowRight,CalendarDays,EyeOff,MessageCircle,Play,Plus} from 'lucide-react';
import {todayRecords,todayLessonState,todayLessonRecord,todayLessonProgress,todayProgressRatios,nextUnwrittenLesson,lessonStartOf,autoOpenLesson} from '../../lib/todayLessonProgress';
import {lazy,Suspense,useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {consultName,todayConsults,todayLessons,type TodayConsult,type TodayLesson} from '../../lib/teacherTodayLessons';
import {koreanDay} from '../../lib/teacherWeekCalendar';
import DateStepper from './DateStepper';
import {campusCounts,lessonCampus,rememberCampus,rememberedCampus} from '../../lib/campus';
import {autoOpenDone,markAutoOpenDone} from '../../lib/autoOpenGuard';
import {askConfirm} from './ConfirmDialog';
const StudentRegistrationManager=lazy(()=>import('./StudentRegistrationManager')),ConsultHelper=lazy(()=>import('./ConsultHelper'));
// '전수현 (평여중1)' -> '전수현': the school stays in the tooltip.
// Same time, type and subject in one card (students of several classes at that time together).
const timeGroups=(list:readonly TodayLesson[])=>{const map=new Map<string,TodayLesson[]>();for(const event of list){const k=[event.start,event.end,event.kind,event.subject].join('|');map.set(k,[...(map.get(k)||[]),event]);}return [...map.values()];};
const shortName=(name:string)=>name.replace(/\s*\(.*\)\s*$/,'').trim()||name;
export default function TeacherTodayLessons({data,date,onDate,onStudent,onGroup,request,disabled=false,active=true,onEvents,records=[],selection,onNewLesson,autoOpen=false,onAutoOpen,onStudentsChanged,onConsult,activeConsultId}:{
 data:any;date:string;onDate:(date:string)=>void;
 onStudent?:(key:string,event:TodayLesson,savedId?:string)=>void;onGroup?:(event:TodayLesson)=>void;
 records?:readonly any[];
 selection?:{studentKey?:string;subject?:string;date?:string;start?:string};onNewLesson?:()=>void;
 /** after a 신입생 is registered from a 상담 card: read the students again */onStudentsChanged?:()=>Promise<void>;
 /** 상담 card: shown by the parent (the 일지 screen's right column) instead of a pop-up; the one shown is marked */onConsult?:(consult:TodayConsult)=>void;activeConsultId?:string;
 onEvents?:(events:TodayLesson[],uid:string,date:string,dayLessons?:any[],matchEvents?:TodayLesson[])=>void;
 request:(action?:string,body?:any)=>Promise<any>;disabled?:boolean;active?:boolean;
 /** Open a lesson by itself once the day's list is loaded (single mode): see autoOpenLesson. */
 autoOpen?:boolean;onAutoOpen?:(key:string,event:TodayLesson,savedId?:string)=>void;
}) {
 const [reload,setReload]=useState(0);
 const [hiding,setHiding]=useState(false);
 // Skip a lesson (or one student) today: the same centered confirm as other actions.
 async function askExclude({events:list,studentKey}:{events:TodayLesson[];studentKey?:string}){const first=list[0];if(!first)return;
  const who=studentKey?shortName(data.students?.find((student:any)=>student.studentKey===studentKey)?.studentDisplayName||'학생'):'';
  const ok=await askConfirm(studentKey?{title:`${who} 학생이 오늘 이 수업에 빠지나요?`,message:`${first.start}–${first.end} ${first.kind}
일정과 일지는 유지되고, 이 날짜의 내 수업 목록에서만 숨겨져요.`,confirmText:'빼기',icon:'alert'}:{title:'오늘 이 수업을 진행하지 않나요?',message:`${first.start}–${first.end} ${list.map(event=>event.title).filter(Boolean).join(', ')||first.kind}
일정과 일지는 유지되고, 이 날짜의 내 수업 목록에서만 숨겨져요.`,confirmText:'숨기기',icon:'alert'});
  if(ok)await changeVisibility(studentKey?[`${first.id}|${studentKey}`]:list.map(event=>event.id));}
 const hidden=useSyncExternalStore(subscribeTodayVisibility,()=>hiddenTodayLessons(data.uid,date),()=>hiddenTodayLessons(data.uid,date));
 const [remote,setRemote]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const visibilityVersion=useRef(0);
 const requestRef=useRef(request);requestRef.current=request;
 useEffect(()=>{
  if(!active)return;let live=true;const visibilityToken=visibilityVersion.current;setLoading(true);setError('');
  requestRef.current('read:schedule-records',{day:date}).then(value=>{if(live){setRemote({uid:data.uid,date,...value});if(visibilityToken===visibilityVersion.current)setTodayVisibility(data.uid,date,value.hiddenTodayLessons||[]);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'일정 조회 실패');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[active,date,data.uid,reload]);
 // 숨기기 is kept on the server for the account and day: another device's change shows when this screen comes back into
 // view (focus, the tab shown again) and every minute while the list is open. A change made here meanwhile wins.
 useEffect(()=>{
  if(!active)return;let live=true;
  const refresh=()=>{if(document.visibilityState==='hidden')return;const token=visibilityVersion.current;requestRef.current('read:today-lesson-visibility',{day:date}).then(value=>{if(live&&token===visibilityVersion.current)setTodayVisibility(data.uid,date,value.hiddenTodayLessons||[]);}).catch(()=>{});};
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',onVisible);const timer=window.setInterval(refresh,60_000);
  return()=>{live=false;window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisible);window.clearInterval(timer);};
 },[active,date,data.uid]);
 const source=remote?.uid===data.uid&&remote.date===date?remote:data;
 // Hidden for today: a whole lesson (its id) or one student of it ('<id>|<studentKey>', e.g. absent from that class).
 // Saved lessons are matched against all of the day's events (allEvents), so a hidden lesson's record never moves to another event.
 const allEvents=todayLessons(data,date,source.schedules||[],source.reflectedSchedules||[]);
 const dayEvents=allEvents.filter(event=>!hidden.has(event.id)).map(event=>({...event,students:event.students.filter(key=>!hidden.has(`${event.id}|${key}`))})).filter(event=>event.students.length>0);
 // Campus chips: shown only when the day's lessons are at two or more campuses; the choice is remembered on this device.
 const [campusChoice,setCampusChoice]=useState(()=>rememberedCampus('today'));
 const campusChips=campusCounts(dayEvents.flatMap(event=>event.students.map(key=>lessonCampus(event,key,data.students))));
 const campus=campusChips.length>1&&campusChips.some(([c])=>c===campusChoice)?campusChoice:'';
 const events=campus?dayEvents.map(event=>({...event,students:event.students.filter(key=>lessonCampus(event,key,data.students)===campus)})).filter(event=>event.students.length>0):dayEvents;
 // 상담 카드 → 상담·신입생 원서 (the registration form), loaded on the first click
 const [intake,setIntake]=useState<{name:string;n:number;openId?:string}|null>(null),intakeLink=useRef<{scheduleId:string;name:string}|null>(null);
 // 상담 (no 일지): a reminder card in time order among the lessons, with or without students (a 신입생 has none yet)
 const consults=todayConsults(data,date,source.schedules||[],source.reflectedSchedules||[],(remote?.uid===data.uid&&remote.date===date?remote.consultTies:undefined)||{});
 // a 신입생 of the 일정: their tied 원서 (이어 쓰기), else a new one with their name, tied to the 일정 at its first save
 const openIntake=(c:TodayConsult)=>{const p=c.prospects[0];intakeLink.current=p&&!p.registrationId&&c.scheduleId?{scheduleId:c.scheduleId,name:p.name}:null;setIntake(i=>({name:p?.name||consultName(c.title),n:(i?.n||0)+1,...(p?.registrationId?{openId:p.registrationId}:{})}));};
 const tieIntake=async(id:string)=>{const link=intakeLink.current;intakeLink.current=null;if(!link)return;try{await requestRef.current('link-consult-registration',{...link,registrationId:id});setReload(n=>n+1);}catch{/* the 원서 is saved; the card ties it next time */}};
 // 상담 도우미 (a 상담 with registered students): their 학습 리포트, 성적 first, right over the 일지
 const [consultView,setConsultView]=useState<TodayConsult|null>(null);
 const consultCard=(c:TodayConsult)=>{const body=<><div className="today-time-head"><span className="today-lesson-time">{c.start}–{c.end}</span><span className="today-consult-kind" title="상담은 일지를 쓰지 않아요">상담</span><span className="today-consult-open" aria-hidden="true">{c.students.length?'리포트 보기 →':c.prospects[0]?.registrationId?'원서 이어 쓰기 →':'원서 쓰기 →'}</span></div><p className="today-consult-title"><MessageCircle size={12} aria-hidden="true"/>{c.title}</p><small className="today-consult-who">{[c.students.length?c.students.map(key=>shortName(data.students?.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생')).join(', '):c.prospects.length?c.prospects.map(p=>`${p.name} (${p.registrationId?'원서 작성 중':'신입생'})`).join(', '):'신입생',c.place].filter(Boolean).join(' · ')}</small><span className="sr-only">{c.students.length?'상담 도우미에서 학습 리포트 보기':'신입생 원서 쓰기'} · 상담은 일지를 쓰지 않아요</span></>;
  // a 신입생 상담 (no student yet): the 상담·신입생 원서 opens right here, over the 일지
  return <button key={c.id} type="button" disabled={disabled} className={`today-lesson-card today-consult-card is-open${activeConsultId===c.id?' is-current':''}`} onClick={()=>onConsult?onConsult(c):c.students.length?setConsultView(c):openIntake(c)}>{body}</button>;};
 const byTime=(nodes:ReactNode[],starts:string[])=>[...nodes.map((node,i)=>({start:starts[i]||'',node})),...consults.map(c=>({start:c.start,node:consultCard(c)}))].sort((a,b)=>a.start.localeCompare(b.start)).map(x=>x.node);
// 학생 관리 marks use the whole day, not the campus chip.
 useEffect(()=>{onEvents?.(dayEvents,data.uid,date,remote?.uid===data.uid&&remote.date===date?remote.dayLessons:undefined,allEvents);},[source,remote,data,date,onEvents,hidden]);
 async function changeVisibility(ids?:string[]){visibilityVersion.current++;setHiding(true);try{let result:any;if(ids)for(const eventId of ids)result=await requestRef.current('today-lesson-visibility',{date,eventId});else result=await requestRef.current('today-lesson-visibility',{date,restore:true});setTodayVisibility(data.uid,date,result.hiddenTodayLessons);}catch(e){setError(e instanceof Error?e.message:'수업 목록 변경 실패');}finally{setHiding(false);}}
 // The day's own lessons from the server (all of them, not only the first saved-lesson page), overridden by the copies
 // already in memory (just saved, published or deleted here), which are newer.
 const loaded=useMemo(()=>todayRecords(remote?.uid===data.uid&&remote.date===date?remote.dayLessons:undefined,[...(data.drafts||[]),...records]),[remote,data.uid,data.drafts,date,records]);
 const progress=todayLessonProgress(events,loaded,allEvents);
 const ratios=todayProgressRatios(progress),next=nextUnwrittenLesson(events,loaded,selection,allEvents);
 // 진행 중 / ended, only when the list shows today (Seoul time).
 const nowHM=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const phase=(event:TodayLesson)=>date!==koreanDay()?'':event.start<=nowHM&&nowHM<event.end?'now':event.end<=nowHM?'ended':'';
 const open=(key:string,event:TodayLesson)=>onGroup?onGroup(event):onStudent?.(key,event);
 // A lesson saved with a time changed just for today stays on its event: the card shows that time and opens that lesson.
 const movedTime=(event:TodayLesson,key:string)=>{const r=todayLessonRecord(event,key,loaded,allEvents),start=r&&lessonStartOf(r.data);if(!r||start===event.start)return null;const end=r.data.classSession==='없음'?r.data.selfStudyEnd:r.data.end;return {start,end:end||''};};
 // Keep the selected lesson in view: scroll only the list's own scroll area (the sticky sidebar), never the page.
 const panelRef=useRef<HTMLElement>(null);
 useEffect(()=>{const panel=panelRef.current,row=panel?.querySelector<HTMLElement>('.is-current');if(!panel||!row)return;let box:HTMLElement|null=panel.parentElement;
  while(box&&!/(auto|scroll)/.test(getComputedStyle(box).overflowY))box=box.parentElement;if(!box||box===document.scrollingElement||box===document.body)return;
  const headBox=panel.querySelector<HTMLElement>('.today-sticky-head'),head=headBox&&getComputedStyle(headBox).position==='sticky'?headBox.offsetHeight:0; // the sticky top covers the list's first rows
  const b=box.getBoundingClientRect(),r=row.getBoundingClientRect();if(r.top>=b.top+head+8&&r.bottom<=b.bottom-8)return;
  box.scrollTo({top:box.scrollTop+(r.top-b.top)-head-(b.height-head-r.height)/2,behavior:'smooth'});},[selection?.studentKey,selection?.date,selection?.subject,selection?.start,events.length]);
 useEffect(()=>{if(!autoOpen||!onAutoOpen||loading||autoOpenDone(data.uid,date)||remote?.uid!==data.uid||remote?.date!==date)return;
  const target=autoOpenLesson(events,loaded,allEvents);if(!target)return;markAutoOpenDone(data.uid,date);const moved=movedTime(target.event,target.key);
  onAutoOpen(target.key,moved?{...target.event,start:moved.start,end:moved.end||target.event.end}:target.event,todayLessonRecord(target.event,target.key,loaded,allEvents)?.id);},[autoOpen,onAutoOpen,loading,remote,date,data.uid,events.length,loaded]);
 const activeEvent=(event:TodayLesson,key?:string)=>selection?.date===event.date&&selection?.subject===event.subject&&(!key||selection?.studentKey===key)&&(lessonStartOf(selection)===event.start||Boolean(key&&movedTime(event,key)?.start===lessonStartOf(selection)));
 return <section ref={panelRef} className="panel today-lessons-panel"><div className="today-sticky-head"><h2>{date===koreanDay()?'오늘 수업':'선택한 날짜의 수업'}</h2><div className="today-dashboard-strip"><DateStepper date={date} onDate={onDate} disabled={disabled} extra={hidden.size>0&&<button type="button" className="small-button today-hidden-chip" disabled={hiding} title="숨긴 수업·학생 모두 다시 표시" aria-label={`숨긴 수업·학생 ${hidden.size}개 다시 표시`} onClick={()=>void changeVisibility()}><EyeOff size={13} aria-hidden="true"/><span className="today-hidden-label">숨김</span>{hidden.size}</button>}/><div className="today-dashboard-progress"><div className="today-progress-track" title="현재 불러온 기록 기준" role="progressbar" aria-label="오늘 수업 반영 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratios.done)} aria-valuetext={`반영 ${progress.published} · 저장 ${progress.saved} · 미작성 ${progress.empty}`}><span className="progress-done" style={{width:ratios.done+'%'}}/><span className="progress-saved" style={{width:ratios.saved+'%'}}/><span className="progress-unwritten" style={{width:ratios.unwritten+'%'}}/></div><p className="today-progress-line"><span className="tp-done">반영 {progress.published}</span> · <span className="tp-saved">저장 {progress.saved}</span> · <span>미작성 {progress.empty}</span></p></div></div>
 {campusChips.length>1&&<div className="campus-chips" role="group" aria-label="캠퍼스"><button type="button" aria-pressed={!campus} onClick={()=>{setCampusChoice('');rememberCampus('today','');}}>전체 <b>{dayEvents.reduce((n,e)=>n+e.students.length,0)}</b></button>{campusChips.map(([c,n])=><button type="button" key={c} aria-pressed={campus===c} onClick={()=>{setCampusChoice(c);rememberCampus('today',c);}}>{c} <b>{n}</b></button>)}</div>}
 <button type="button" className="today-next-button" disabled={disabled||!next} onClick={()=>{if(next)open(next.key,next.event);}}><ArrowRight size={14} aria-hidden="true"/>다음 미작성 수업</button></div>
 {error&&<p role="alert" className="text-xs text-rose-600 mt-2">{error}<button type="button" className="small-button ml-2" onClick={()=>setReload(value=>value+1)}>다시 불러오기</button></p>}
 <div className="today-lessons-list" aria-busy={loading}>{loading&&!events.length?<div className="today-skeleton" role="status" aria-label="예정된 일정을 불러오는 중">{[0,1,2].map(i=><div key={i}><span/><span/></div>)}</div>:!events.length&&!consults.length?<div className="today-empty"><CalendarDays size={24} aria-hidden="true"/><p>오늘 예정된 수업이 없어요</p>{onNewLesson&&<button type="button" className="small-button" onClick={onNewLesson}><Plus size={14}/>새 일지</button>}</div>:onGroup?byTime(events.map(event=>{const groupProgress=todayLessonProgress([event],loaded,allEvents);return <div key={event.id} className="today-lesson-card"><button type="button" className="today-dismiss" aria-label={`${event.start} ${event.title} 오늘 목록에서 숨기기`} onClick={()=>void askExclude({events:[event]})}><X size={12}/></button><p className="sr-only">{event.title} · {event.subject}</p>
 <button type="button" disabled={disabled} className={`today-lesson-student today-lesson-group today-lesson-entry ${activeEvent(event)?'is-current':''}`} onClick={()=>onGroup(event)}><span className="today-lesson-meta"><span className="today-lesson-time">{event.start}–{event.end}</span><span className="today-lesson-kind">{event.kind}</span></span><span className="today-group-title"><strong>{event.title||'수업'}</strong><small>학생 {event.students.length}명</small></span><span className="today-group-names">{event.students.map(key=>{const name=data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생';return <span key={key} className="today-group-name" title={name}>{shortName(name)}</span>;})}</span><span className="today-group-foot"><StatusBadge kind={groupProgress.published===groupProgress.total?'done':groupProgress.saved||groupProgress.published?'saved':'unwritten'} text={`반영 ${groupProgress.published}/${groupProgress.total}명`}/><span className="today-group-open" aria-hidden="true">반 불러오기 →</span></span><span className="sr-only">학생 {event.students.length}명 불러오기</span></button>
 </div>;}),events.map(e=>e.start)):byTime(timeGroups(events).map(group=>{const head=group[0],rows=group.flatMap(event=>event.students.map(key=>({event,key}))),now=phase(head)==='now',single=rows.length===1,headMoved=single?movedTime(rows[0].event,rows[0].key):null;return <div key={head.id} className={`today-lesson-card today-time-card${now?' is-now':''}`}>
 <div className="today-time-head"><span className="today-lesson-time">{head.start}–{head.end}</span>{now&&<span className="today-now" title="진행 중"><Play size={9} aria-hidden="true"/><span className="sr-only">진행 중</span></span>}<span className="today-lesson-kind">{head.kind}{rows.length>1?` · ${rows.length}명`:''}</span><button type="button" className="today-dismiss" aria-label={`${head.start} ${head.kind} 수업 전체를 오늘 목록에서 숨기기`} onClick={()=>void askExclude({events:group})}><X size={12}/></button></div>
 {headMoved&&<span className="today-moved-line">→ {headMoved.start}–{headMoved.end}</span>}<p className="sr-only">{group.map(event=>`${event.title} · ${event.subject}`).join(', ')}</p>
 {rows.map(({event,key})=>{const state=todayLessonState(event,key,loaded,allEvents),moved=movedTime(event,key),full=data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생',name=shortName(full),late=state==='미작성'&&phase(event)==='ended';return <div key={event.id+key} className={`today-student-row${activeEvent(event,key)?' is-current':''}`}><button type="button" disabled={disabled} className="today-lesson-student today-lesson-entry" onClick={()=>onStudent?.(key,moved?{...event,start:moved.start,end:moved.end||event.end}:event,todayLessonRecord(event,key,loaded,allEvents)?.id)}><span className="today-row-main"><span className="today-lesson-name" title={full}>{name}</span>{late?<span className="today-late"><AlertCircle size={11} aria-hidden="true"/>끝남 · 미작성</span>:<StatusBadge kind={state==='반영 완료'?'done':state==='저장됨'?'saved':'unwritten'}/>}</span>{moved&&!single&&<span className="today-moved-line">→ {moved.start}–{moved.end}</span>}</button>{rows.length>1&&<button type="button" className="today-dismiss is-row" aria-label={`${name} 학생을 오늘 이 수업에서 빼기`} onClick={()=>void askExclude({events:[event],studentKey:key})}><X size={11}/></button>}</div>;})}
 </div>;}),timeGroups(events).map(g=>g[0].start))}</div>
 
 {consultView&&<Suspense fallback={null}><ConsultHelper consult={consultView} students={data.students||[]} onClose={()=>setConsultView(null)}/></Suspense>}
 {intake&&<Suspense fallback={null}><StudentRegistrationManager startSignal={intake.n} startName={intake.name} startId={intake.openId||''} onSavedNew={id=>void tieIntake(id)} coreMode={Boolean(data.coreMode)} canAdditional={Boolean(data.admin||data.principal)} students={data.students||[]} onSynced={async()=>{await onStudentsChanged?.();}}/></Suspense>}
 </section>;
}
