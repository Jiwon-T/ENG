import {useEffect,useRef,useState} from 'react';
import {todayLessons,type TodayLesson} from '../../lib/teacherTodayLessons';
import {koreanDay} from '../../lib/teacherWeekCalendar';
export default function TeacherTodayLessons({data,date,onDate,onStudent,onGroup,request,disabled=false,active=true}:{
 data:any;date:string;onDate:(date:string)=>void;
 onStudent?:(key:string,event:TodayLesson)=>void;onGroup?:(event:TodayLesson)=>void;
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
 return <section className="panel"><div className="flex justify-between gap-2"><h2>{date===koreanDay()?'오늘 수업':'선택한 날짜의 수업'}</h2><button type="button" disabled={disabled} className="small-button" onClick={()=>onDate(koreanDay())}>오늘</button></div>
 <input aria-label="수업 목록 날짜" disabled={disabled} type="date" value={date} onChange={e=>{if(e.target.value)onDate(e.target.value);}}/>
 {loading&&<p role="status" className="text-xs text-slate-500 mt-2">예정된 일정을 불러오는 중…</p>}
 {error&&<p role="alert" className="text-xs text-rose-600 mt-2">{error}<button type="button" className="small-button ml-2" onClick={()=>setReload(value=>value+1)}>다시 불러오기</button></p>}
 {events.map(event=><div key={event.id} className="mt-3"><p className="font-bold text-sm">{event.title}</p><p className="text-xs text-slate-500">{event.start}–{event.end} · {event.subject} · {event.kind}</p>
 {onGroup&&<p className="text-xs text-slate-500 mt-1">{event.students.map(key=>data.students?.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생').join(' · ')}</p>}
 {onGroup?<button type="button" disabled={disabled} className="small-button mt-2" onClick={()=>onGroup(event)}>학생 {event.students.length}명 불러오기</button>:event.students.map(key=><button type="button" key={key} disabled={disabled} className="w-full text-left text-sm min-h-[44px]" onClick={()=>onStudent?.(key,event)}>{data.students?.find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생'}</button>)}
 </div>)}
 {!events.length&&!loading&&<p className="text-xs text-slate-500 mt-2">선택한 날짜에 정규 수업 또는 예정된 일정이 없습니다.</p>}
 </section>;
}
