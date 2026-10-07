import {todayLessonState,todayLessonProgress,todayStateTone} from '../../lib/todayLessonProgress';
import {useEffect,useRef,useState} from 'react';
import {todayLessons,type TodayLesson} from '../../lib/teacherTodayLessons';
import {koreanDay} from '../../lib/teacherWeekCalendar';
export default function TeacherTodayLessons({data,date,onDate,onStudent,onGroup,request,disabled=false,active=true,onEvents,records=[]}:{
 data:any;date:string;onDate:(date:string)=>void;
 onStudent?:(key:string,event:TodayLesson)=>void;onGroup?:(event:TodayLesson)=>void;
 records?:readonly any[];
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
 return <section className="panel today-lessons-panel"><div className="flex justify-between gap-2"><h2>{date===koreanDay()?'오늘 수업':'선택한 날짜의 수업'}</h2><button type="button" disabled={disabled} className="small-button" onClick={()=>onDate(koreanDay())}>오늘</button></div>
 <p className="today-lesson-progress" role="status">{date===koreanDay()?'오늘':'선택 날짜'} {progress.total}개 중 반영 {progress.published} · 저장 {progress.saved} · 미작성 {progress.empty}</p><p className="today-progress-scope">현재 불러온 기록 기준</p>
 <input aria-label="수업 목록 날짜" disabled={disabled} type="date" value={date} onChange={e=>{if(e.target.value)onDate(e.target.value);}}/>
 {loading&&<p role="status" className="text-xs text-slate-500 mt-2">예정된 일정을 불러오는 중…</p>}
 {error&&<p role="alert" className="text-xs text-rose-600 mt-2">{error}<button type="button" className="small-button ml-2" onClick={()=>setReload(value=>value+1)}>다시 불러오기</button></p>}
 {events.map(event=>{const groupProgress=todayLessonProgress([event],loaded);return <div key={event.id} className="today-lesson-card"><div className="today-lesson-meta"><span className="today-lesson-time">{event.start}–{event.end}</span><span className="today-lesson-kind">{event.kind}</span></div><p className="today-lesson-title">{event.title} · {event.subject}</p>
 {onGroup?<button type="button" disabled={disabled} className="today-lesson-student today-lesson-group" onClick={()=>onGroup(event)}><span className="today-lesson-name">{event.students.map(key=>data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생').join(' · ')}</span><span className="today-lesson-group-progress">반영 {groupProgress.published}/{groupProgress.total}명 · 저장 {groupProgress.saved}명</span><span className="today-lesson-group-hint">학생 {event.students.length}명 불러오기</span></button>:event.students.map(key=>{const state=todayLessonState(event,key,loaded);return <button type="button" key={key} disabled={disabled} className="today-lesson-student" onClick={()=>onStudent?.(key,event)}><span className="today-lesson-name">{data.students?.find((student:any)=>student.studentKey===key)?.studentDisplayName||'학생'}</span><span className={`today-lesson-state status-${todayStateTone(state)}`}><span aria-hidden="true" className={`lesson-status-dot status-${todayStateTone(state)}`}/>{state}</span></button>;})}
 </div>;})}
 {!events.length&&!loading&&<p className="text-xs text-slate-500 mt-2">선택한 날짜에 정규 수업 또는 예정된 일정이 없습니다.</p>}
 </section>;
}
