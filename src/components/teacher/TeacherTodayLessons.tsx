import StatusBadge from './StatusBadge';
import {ArrowRight,CalendarDays,Plus} from 'lucide-react';
import {todayLessonState,todayLessonProgress,todayProgressRatios,nextUnwrittenLesson} from '../../lib/todayLessonProgress';
import {useEffect,useRef,useState} from 'react';
import {todayLessons,type TodayLesson} from '../../lib/teacherTodayLessons';
import {koreanDay} from '../../lib/teacherWeekCalendar';
import DateStepper from './DateStepper';
export default function TeacherTodayLessons({data,date,onDate,onStudent,onGroup,request,disabled=false,active=true,onEvents,records=[],selection,onNewLesson}:{
 data:any;date:string;onDate:(date:string)=>void;
 onStudent?:(key:string,event:TodayLesson)=>void;onGroup?:(event:TodayLesson)=>void;
 records?:readonly any[];
 selection?:{studentKey?:string;subject?:string;date?:string;start?:string};onNewLesson?:()=>void;
 onEvents?:(events:TodayLesson[],uid:string,date:string)=>void;
 request:(action?:string,body?:any)=>Promise<any>;disabled?:boolean;active?:boolean;
}) {
 const [reload,setReload]=useState(0);
 const [remote,setRemote]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const requestRef=useRef(request);requestRef.current=request;
 useEffect(()=>{
  if(!active)return;let live=true;setLoading(true);setError('');
  requestRef.current('read:schedule-records',{day:date}).then(value=>{if(live)setRemote({uid:data.uid,date,...value});}).catch(e=>{if(live)setError(e instanceof Error?e.message:'일정 조회 실패');}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[active,date,data.uid,reload]);
 const source=remote?.uid===data.uid&&remote.date===date?remote:data;
 const events=todayLessons(data,date,source.schedules||[],source.reflectedSchedules||[]);
 useEffect(()=>{onEvents?.(events,data.uid,date);},[source,data,date,onEvents]);
 const loaded=[...records,...(data.drafts||[])];const progress=todayLessonProgress(events,loaded);
 const ratios=todayProgressRatios(progress),next=nextUnwrittenLesson(events,loaded);
 const open=(key:string,event:TodayLesson)=>onGroup?onGroup(event):onStudent?.(key,event);
 const activeEvent=(event:TodayLesson,key?:string)=>selection?.date===event.date&&selection?.subject===event.subject&&selection?.start===event.start&&(!key||selection?.studentKey===key);
 return <section className="panel today-lessons-panel"><h2>{date===koreanDay()?'오늘 수업':'선택한 날짜의 수업'}</h2><div className="today-dashboard-strip"><DateStepper date={date} onDate={onDate} disabled={disabled}/><div className="today-dashboard-progress"><div className="today-progress-track" role="progressbar" aria-label="오늘 수업 반영 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratios.done)} aria-valuetext={`반영 ${progress.published} · 저장 ${progress.saved} · 미작성 ${progress.empty}`}><span className="progress-done" style={{width:ratios.done+'%'}}/><span className="progress-saved" style={{width:ratios.saved+'%'}}/><span className="progress-unwritten" style={{width:ratios.unwritten+'%'}}/></div><div className="today-progress-counts"><StatusBadge kind="done" text={`반영 ${progress.published}`}/><StatusBadge kind="saved" text={`저장 ${progress.saved}`}/><StatusBadge kind="unwritten" text={`미작성 ${progress.empty}`}/></div></div></div><p className="today-progress-scope">현재 불러온 기록 기준</p>
 <button type="button" className="today-next-button" disabled={disabled||!next} onClick={()=>{if(next)open(next.key,next.event);}}><ArrowRight size={14} aria-hidden="true"/>다음 미작성 수업</button>
 {error&&<p role="alert" className="text-xs text-rose-600 mt-2">{error}<button type="button" className="small-button ml-2" onClick={()=>setReload(value=>value+1)}>다시 불러오기</button></p>}
 <div className="today-lessons-list" aria-busy={loading}>{loading&&!events.length?<div className="today-skeleton" role="status" aria-label="예정된 일정을 불러오는 중">{[0,1,2].map(i=><div key={i}><span/><span/></div>)}</div>:!events.length?<div className="today-empty"><CalendarDays size={24} aria-hidden="true"/><p>오늘 예정된 수업이 없어요</p>{onNewLesson&&<button type="button" className="small-button" onClick={onNewLesson}><Plus size={14}/>새 일지</button>}</div>:events.map(event=>{const groupProgress=todayLessonProgress([event],loaded);return <div key={event.id} className="today-lesson-card"><p className="sr-only">{event.title} · {event.subject}</p>
 {onGroup?<button type="button" disabled={disabled} className={`today-lesson-student today-lesson-group today-lesson-entry ${activeEvent(event)?'is-current':''}`} onClick={()=>onGroup(event)}><span className="today-lesson-meta"><span className="today-lesson-time">{event.start}–{event.end}</span><span className="today-lesson-kind">{event.kind}</span><StatusBadge kind={groupProgress.published===groupProgress.total?'done':groupProgress.saved||groupProgress.published?'saved':'unwritten'} text={`반영 ${groupProgress.published}/${groupProgress.total}명`}/></span><span className="today-lesson-name">{event.students.map(key=>data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생').join(' · ')}</span><span className="sr-only">학생 {event.students.length}명 불러오기</span></button>:event.students.map(key=>{const state=todayLessonState(event,key,loaded);return <button type="button" key={key} disabled={disabled} className={`today-lesson-student today-lesson-entry ${activeEvent(event,key)?'is-current':''}`} onClick={()=>onStudent?.(key,event)}><span className="today-lesson-meta"><span className="today-lesson-time">{event.start}–{event.end}</span><span className="today-lesson-kind">{event.kind}</span><StatusBadge kind={state==='반영 완료'?'done':state==='저장됨'?'saved':'unwritten'}/></span><span className="today-lesson-name">{data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생'}</span></button>;})}
 </div>;})}</div>
 </section>;
}
